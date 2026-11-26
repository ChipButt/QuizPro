#!/usr/bin/env node
// Offline picture-round packaging gate. Does NOT edit existing QuizPro data.
import fs from 'node:fs';
import path from 'node:path';

function inspectImage(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return {mime: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
  }
  if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return {mime: 'image/webp', width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3)};
    if (chunk === 'VP8L') {
      const n = bytes.readUInt32LE(21);
      return {mime: 'image/webp', width: 1 + (n & 0x3fff), height: 1 + ((n >> 14) & 0x3fff)};
    }
    if (chunk === 'VP8 ') return {mime: 'image/webp', width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff};
  }
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    let i = 2;
    while (i + 10 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return {mime: 'image/jpeg', height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7)};
      }
      const length = bytes.readUInt16BE(i + 2);
      if (length < 2) break;
      i += length + 2;
    }
  }
  return null;
}

function makeEntry(manifest, assetsDir) {
  const errors = [];
  if (manifest.schema !== 'quizpro-approved-picture-round-manifest-v1') errors.push('Wrong manifest schema');
  if (manifest.type !== 'Picture round' || manifest.answerMode !== 'text') errors.push('Invalid QuizPro round format');
  if (!Array.isArray(manifest.questions) || manifest.questions.length !== 10) errors.push('Expected exactly 10 questions');
  const seen = new Set();
  const questions = [];
  for (const [i, question] of (manifest.questions || []).entries()) {
    if (question.number !== i + 1 || question.approval !== 'approved') errors.push('Question ' + (i + 1) + ' has not been editorially approved');
    const answer = String(question.answer || '').trim();
    if (!answer || seen.has(answer.toLowerCase())) errors.push('Missing or repeated answer at question ' + (i + 1));
    seen.add(answer.toLowerCase());
    const imageFields = {};
    for (const [key, dataKey, nameKey] of [['questionImage','image','imageName'], ['answerImage','answerImage','answerImageName']]) {
      const slot = question[key];
      if (!slot) { errors.push('Missing ' + key + ' metadata at question ' + (i + 1)); continue; }
      if (slot.licensing?.status !== 'cleared' || !String(slot.licensing?.evidence || '').trim()) {
        errors.push('Usage rights not documented: question ' + (i + 1) + ' ' + key);
      }
      const filename = String(slot.expectedAssetFile || '');
      if (!/^[0-9]{2}-(question|answer)[.]webp$/.test(filename)) {
        errors.push('Invalid approved image filename at question ' + (i + 1) + ' ' + key);
        continue;
      }
      const location = path.join(assetsDir, filename);
      if (!fs.existsSync(location)) {
        errors.push('Approved image file missing: ' + filename);
        continue;
      }
      const bytes = fs.readFileSync(location);
      const info = inspectImage(bytes);
      if (!info) { errors.push('Invalid image: ' + filename); continue; }
      if (bytes.length > 140000) errors.push('Image exceeds QuizPro 140KB target: ' + filename);
      if (info.width < 520 || info.height < 520) errors.push('Image too small for mobile: ' + filename);
      imageFields[dataKey] = 'data:' + info.mime + ';base64,' + bytes.toString('base64');
      imageFields[nameKey] = filename;
    }
    questions.push({
      id: 'q-fftn-0001-' + String(i + 1).padStart(2, '0'),
      number: i + 1, text: question.question || 'Who is this famous person?',
      answer, alternatives: [], points: 1, type: 'Picture', options: [],
      category: 'Picture', difficulty: 'Medium', ...imageFields,
      audio: '', audioName: '', answerAudio: '', answerAudioName: '',
      notes: '', timeLimit: 60, autoMark: true
    });
  }
  if (errors.length) return {errors};
  const stamp = new Date().toISOString();
  return {entry: {
    id: manifest.libraryId, title: manifest.title, type: manifest.type,
    answerMode: manifest.answerMode, choiceCount: 4,
    instructions: manifest.instructions, scoringRules: manifest.scoringRules,
    category: manifest.category, createdAt: stamp, updatedAt: stamp,
    assetProof: {schema: 'quizpro-picture-pack-v1', checkedAt: stamp, photoCount: 20, rightsEvidenceCount: 20,
      sources: manifest.questions.flatMap((q) => ['questionImage', 'answerImage'].map((kind) => ({
        questionNumber: q.number, kind, sourcePage: q[kind]?.sourcePage || null,
        imageFile: q[kind]?.expectedAssetFile, permissionEvidenceRecorded: true,
      }))),
    },
    questions
  }};
}
const [manifestFile, assetsFolder, outputFile] = process.argv.slice(2);
if (!manifestFile || !assetsFolder || !outputFile) {
  process.stderr.write('Usage: node scripts/build-approved-picture-round.mjs manifest.json licensed-assets-folder output.json\n');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const result = makeEntry(manifest, assetsFolder);
if (result.errors) {
  for (const error of result.errors) process.stderr.write('ERROR: ' + error + '\n');
  process.exit(2);
}
fs.mkdirSync(path.dirname(path.resolve(outputFile)), {recursive: true});
fs.writeFileSync(outputFile, JSON.stringify(result.entry, null, 2) + '\n');
process.stdout.write('Validated 10 questions and 20 images. Created QuizPro library-ready round: ' + outputFile + '\n');
