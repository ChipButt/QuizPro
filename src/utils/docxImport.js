const MAMMOTH_CDN = "https://cdn.jsdelivr.net/npm/mammoth@1.9.1/mammoth.browser.min.js";

let mammothPromise;

function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (mammothPromise) return mammothPromise;
  mammothPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MAMMOTH_CDN;
    script.async = true;
    script.onload = () => window.mammoth ? resolve(window.mammoth) : reject(new Error("The DOCX reader loaded, but Mammoth was not available."));
    script.onerror = () => reject(new Error("Could not load the DOCX reader. Check the internet connection and try again."));
    document.head.appendChild(script);
  });
  return mammothPromise;
}

function cleanLine(value = "") {
  return String(value).replace(/\u00a0/g, " ").replace(/[\t ]+/g, " ").trim();
}

function stripQuestionPrefix(value = "") {
  return cleanLine(value)
    .replace(/^\s*\d+\s*[.)-]\s*/i, "")
    .replace(/^\s*(?:Q(?:uestion)?\s*[:.-]\s*)/i, "")
    .trim();
}

// Word often stores a question and its Answer: text in the SAME paragraph.
// Some older files also glue the next numbered question onto the end of that paragraph.
function splitGluedNumberedQuestions(value = "") {
  const nextQuestion = /([^\n])\s*(?=[1-9]\d?\.\s+(?:What|Which|Who|Where|When|Why|How|In|On|At|Before|After|During|According|Name|Give|Identify|The)\b)/gi;
  return String(value)
    .split(/\r?\n/)
    .map((line) => /(?:answer|ans)\s*[:.-]|(?:^|[^A-Za-z0-9])a\s*[:.-]/i.test(line) ? line.replace(nextQuestion, "$1\n") : line)
    .join("\n");
}

function parseRoundHeading(line) {
  const cleaned = cleanLine(line);
  const numbered = cleaned.match(/^[^A-Za-z0-9]*round\s*(\d+)\s*(?:[-–—:]+\s*)?(.*)$/i);
  if (numbered) {
    return { number: Number(numbered[1]), title: cleanLine(numbered[2]).replace(/^[-–—:]+\s*/, "") || `Round ${numbered[1]}` };
  }
  const unnumbered = cleaned.match(/^[^A-Za-z0-9]*round\s*(?:[-–—:]+\s*)?(.+)$/i);
  if (unnumbered) {
    return { number: null, title: cleanLine(unnumbered[1]).replace(/^[-–—:]+\s*/, "") || "Round" };
  }
  if (/^[^A-Za-z0-9]*tie\s*breaker\s*$/i.test(cleaned)) return { number: null, title: "Tie Breaker" };
  return null;
}

function roundTypeFromTitle(title = "") {
  const lower = title.toLowerCase();
  if (lower.includes("picture") || lower.includes("name the") || lower.includes("eye know") || lower.includes("pop stars") || lower.includes("what are they selling")) return "Picture round";
  if (lower.includes("music") || lower.includes("song")) return "Music round";
  if (lower.includes("multiple choice")) return "Multiple choice round";
  if (lower.includes("nearest")) return "Nearest-wins question";
  if (lower.includes("numerical")) return "Numerical round";
  return "Standard question round";
}

// Returns both halves whether Answer:/A: is on its own line OR glued to the question.
function answerMarker(line) {
  const cleaned = cleanLine(line);
  const full = /(?:answer|ans)\s*[:.-]\s*/i.exec(cleaned);
  const short = /(^|[^A-Za-z0-9])(a\s*[:.-]\s*)/i.exec(cleaned);
  if (!full && !short) return null;

  let questionEnd;
  let answerStart;
  if (full && (!short || full.index <= short.index)) {
    questionEnd = full.index;
    answerStart = full.index + full[0].length;
  } else {
    const prefix = short[1] || "";
    questionEnd = short.index + (prefix.trim() ? prefix.length : 0);
    answerStart = short.index + short[0].length;
  }
  return { question: cleaned.slice(0, questionEnd).trim(), answer: cleaned.slice(answerStart).trim() };
}

function isExplicitQuestion(line) {
  const cleaned = cleanLine(line);
  return /\?$/.test(cleaned) || /^\s*(?:Q(?:uestion)?\s*[:.-]|\d+\s*[.)-]\s*)/i.test(cleaned) || Boolean(answerMarker(cleaned)?.question);
}

function looksLikeSpecialRoundHeading(line) {
  const cleaned = cleanLine(line);
  return /(?:\bpicture round\b|^eye know\b|^what are they selling\??$|^name (?:the )?(?:celebrity|film|dogs?|cars?|logos?)\b|^\d{4}s? pop stars\b)/i.test(cleaned);
}

function isLikelyLooseRoundHeading(line, nextLine, currentQuestionCount, bufferLength) {
  const cleaned = cleanLine(line);
  if (!cleaned || bufferLength || cleaned.length > 90 || answerMarker(cleaned)) return false;
  if (/^\s*(?:Q(?:uestion)?\s*[:.-]|\d+\s*[.)-]\s*|answer\s*[:.-])/i.test(cleaned)) return false;
  if (looksLikeSpecialRoundHeading(cleaned)) return true;
  if (cleaned.includes("?")) return false;
  return isExplicitQuestion(nextLine) && (currentQuestionCount > 0 || /^[A-Z][A-Za-z &/()'’–—-]{2,}$/u.test(cleaned));
}

function shouldIgnoreLooseLine(line) {
  const cleaned = cleanLine(line);
  return !cleaned || /^(?:question\s*\d+\s*)?info\s*:/i.test(cleaned) || /^adjusted answer\s*:/i.test(cleaned) || /^round\s*\d+\s*[-–—:]?.*answers?\)?$/i.test(cleaned) || /^\d+(?:\.\s*)?$/.test(cleaned);
}

function buildQuestion(buffer, answer, number) {
  const text = buffer.map(stripQuestionPrefix).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return text && answer ? { number, text, answer } : null;
}

export function parseQuizText(rawText, fileName = "Imported quiz.docx") {
  const lines = splitGluedNumberedQuestions(rawText).split(/\r?\n/).map(cleanLine).filter(Boolean);
  const rounds = [];
  const warnings = [];
  let currentRound = null;
  let buffer = [];

  function ensureRound() {
    if (!currentRound) {
      currentRound = { title: "General Questions", type: "Standard question round", instructions: "", questions: [] };
      rounds.push(currentRound);
    }
    return currentRound;
  }

  function flushLooseBuffer(context) {
    const loose = buffer.filter((line) => !shouldIgnoreLooseLine(line));
    if (loose.length) warnings.push(`Ignored ${loose.length} line${loose.length === 1 ? "" : "s"} without a usable answer near ${context}: ${loose.slice(0, 2).join(" / ")}`);
    buffer = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] || "";
    const heading = parseRoundHeading(line);

    if (heading) {
      flushLooseBuffer(currentRound?.title || "the start of the document");
      if (/\(answers?\)|\banswers?$/i.test(heading.title)) continue;
      currentRound = { title: heading.title, type: roundTypeFromTitle(heading.title), instructions: "", questions: [] };
      rounds.push(currentRound);
      continue;
    }

    if (isLikelyLooseRoundHeading(line, nextLine, currentRound?.questions?.length || 0, buffer.length)) {
      flushLooseBuffer(currentRound?.title || "the start of the document");
      currentRound = { title: line, type: roundTypeFromTitle(line), instructions: "", questions: [] };
      rounds.push(currentRound);
      continue;
    }

    // Preserve an instruction line such as "Give the year each was first released...".
    if (currentRound && !currentRound.questions.length && !buffer.length && !line.includes("?") && !answerMarker(line) && answerMarker(nextLine)?.question) {
      currentRound.instructions = line;
      continue;
    }

    const marked = answerMarker(line);
    if (marked) {
      const round = ensureRound();
      const parts = [...buffer];
      if (marked.question) parts.push(marked.question);
      const question = buildQuestion(parts, marked.answer, round.questions.length + 1);
      if (question) round.questions.push(question);
      else warnings.push(`Found an answer without a usable question: ${line}`);
      buffer = [];
      continue;
    }

    // A handful of old files contain one obvious answer without the "Answer:" label.
    const bufferedQuestion = buffer.join(" ");
    const nextHeading = parseRoundHeading(nextLine);
    if (buffer.length && bufferedQuestion.includes("?") && line.length <= 120 && !line.includes("?") && !/^\d+\s*[.)-]\s*/.test(line) && (nextHeading || isExplicitQuestion(nextLine))) {
      const round = ensureRound();
      const question = buildQuestion(buffer, line, round.questions.length + 1);
      if (question) {
        round.questions.push(question);
        warnings.push(`Imported an unlabeled answer for question ${question.number} in ${round.title}: ${line}`);
        buffer = [];
        continue;
      }
    }

    // Picture rounds usually contain embedded artwork / answer labels rather than normal Q+A text.
    // Keep the round itself, but don't allow loose picture text to corrupt the next round.
    if (currentRound?.type === "Picture round") continue;
    if (!shouldIgnoreLooseLine(line)) buffer.push(line);
  }

  flushLooseBuffer(currentRound?.title || "the end of the document");
  const usableRounds = rounds.filter((round) => round.title || round.questions.length);
  const questionCount = usableRounds.reduce((total, round) => total + round.questions.length, 0);
  return {
    title: fileName.replace(/\.docx$/i, "").trim() || "Imported quiz",
    rounds: usableRounds,
    questionCount,
    warnings,
  };
}

export async function importQuizDocx(file) {
  if (!file?.name?.toLowerCase().endsWith(".docx")) throw new Error("Please choose a .docx Word document.");
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const parsed = parseQuizText(result.value, file.name);
  if (!parsed.rounds.length || !parsed.questionCount) {
    throw new Error("I could not find usable question/answer pairs in this document. The importer accepts answers on separate lines or in the same paragraph as the question.");
  }
  return parsed;
}
