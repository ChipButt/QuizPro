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
assert.match(ok.warnings.join(' '),/UNDER 25/); // Tom was 26–27 in 1967; acceptable minimum gap, but not preferred youth photo

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
assert.deepEqual(firstTooYoung.warnings,[]); // Age 10–11 in first image meets preference
const preferredAge24=validatePhotoTimeline(record({born:'1960-02-13',thenDate:'1985-02-12',nowDate:'2026-02-12'}));
assert.deepEqual(preferredAge24.errors,[]);
assert.deepEqual(preferredAge24.warnings,[]); // Exact age 24, before 25th birthday
const ageExactly25=validatePhotoTimeline(record({born:'1960-02-13',thenDate:'1985-02-13',nowDate:'2026-02-13'}));
assert.deepEqual(ageExactly25.errors,[]);
assert.match(ageExactly25.warnings.join(' '),/UNDER 25/); // 25 is outside preference
const uncertainFirstAge=validatePhotoTimeline(record({born:'1960-12-31',thenYear:1985,nowYear:2026}));
assert.deepEqual(uncertainFirstAge.errors,[]);
assert.match(uncertainFirstAge.warnings.join(' '),/UNDER 25/); // Age reaches 25 by end of year
const missingEvidence=validatePhotoTimeline(record({source:''}));
assert.match(missingEvidence.errors.join(' '),/verifiable https source/);
const all=validateRoundPhotoTimeline([record(),record({thenYear:2010,nowYear:2025})]);
assert.ok(all.errors.length>0);
process.stdout.write('PASS: 40-year photo gap, under-25 first-photo preference, boundary dates and source evidence\n');