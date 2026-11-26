import assert from 'node:assert/strict';
import {validatePhotoTimeline, validateRoundPhotoTimeline} from './picture-round-age-gap.mjs';

const src='https://commons.wikimedia.org/wiki/File:Verified_photo_example.jpg';
function record({number=4,name='Tom Jones',born='1940-06-07',thenYear=1967,nowYear=2018,thenDate,nowDate,source=src}={}) {
  return {
    number,answer:name,subjectBirthDate:born,
    questionImage:{...(thenDate?{photoTakenOn:thenDate}:{photoTakenYear:thenYear}),photoDateEvidenceUrl:source},
    answerImage:{...(nowDate?{photoTakenOn:nowDate}:{photoTakenYear:nowYear}),photoDateEvidenceUrl:source},
  };
}
const ok=validatePhotoTimeline(record());
assert.deepEqual(ok.errors,[]);
assert.ok(ok.guaranteedGapYears >= 40);
assert.deepEqual(ok.warnings,[]); // Tom was >25 in 1967

const notEnough=validatePhotoTimeline(record({thenYear:2009,nowYear:2023}));
assert.match(notEnough.errors.join(' '),/40 years apart/);
const daniel=validatePhotoTimeline(record({number:7,name:'Daniel Radcliffe',born:'1989-07-23',thenYear:1989,nowYear:2026}));
assert.match(daniel.errors.join(' '),/not yet 40 years old/);
const yearOnlyUncertain=validatePhotoTimeline(record({thenYear:1986,nowYear:2026}));
assert.match(yearOnlyUncertain.errors.join(' '),/not verifiably 40 years apart/);
const yearOnlySafe=validatePhotoTimeline(record({thenYear:1985,nowYear:2026}));
assert.deepEqual(yearOnlySafe.errors,[]);
const exactBoundary=validatePhotoTimeline(record({thenDate:'1986-01-01',nowDate:'2026-01-01'}));
assert.deepEqual(exactBoundary.errors,[]);
const firstTooYoung=validatePhotoTimeline(record({born:'1974-02-13',thenYear:1985,nowYear:2026}));
assert.deepEqual(firstTooYoung.errors,[]);
assert.match(firstTooYoung.warnings.join(' '),/under|younger/);
const missingEvidence=validatePhotoTimeline(record({source:''}));
assert.match(missingEvidence.errors.join(' '),/verifiable https source/);
const all=validateRoundPhotoTimeline([record(),record({thenYear:2010,nowYear:2025})]);
assert.ok(all.errors.length>0);
process.stdout.write('PASS: 40-year photo gap, boundary dates, unsupported age, preference and source evidence\n');