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
const daniel=validatePhotoTimeline(record({number:7,name:'Daniel Radcliffe',born:'1989-07-23',thenDate:'1995-08-01',nowDate:'2026-08-01'}));
assert.deepEqual(daniel.errors,[]); // Infant photo + 2026 can qualify for the under-15 exception.
assert.equal(daniel.requiredGapYears,30);
// Exactly age 14: 30-year gap is permitted.
const under15At30=validatePhotoTimeline(record({born:'1981-01-01',thenDate:'1995-12-30',nowDate:'2025-12-30'}));
assert.deepEqual(under15At30.errors,[]);
assert.equal(under15At30.requiredGapYears,30);
assert.equal(under15At30.guaranteedGapYears,30);
// A 29-year gap still fails for under-15 first photograph.
const childAt29=validatePhotoTimeline(record({born:'1981-01-01',thenDate:'1995-12-30',nowDate:'2024-12-30'}));
assert.equal(childAt29.requiredGapYears,30);
assert.match(childAt29.errors.join(' '),/30 years apart/);
// A first photograph at exactly 15 does NOT qualify for the shortened gap.
const ageExactly15=validatePhotoTimeline(record({born:'1980-01-01',thenDate:'1995-01-01',nowDate:'2025-01-01'}));
assert.equal(ageExactly15.requiredGapYears,40);
assert.match(ageExactly15.errors.join(' '),/40 years apart/);
// An age 15 first photo is still acceptable if the full 40 years pass.
const age15At40=validatePhotoTimeline(record({born:'1970-01-01',thenDate:'1985-01-01',nowDate:'2025-01-01'}));
assert.deepEqual(age15At40.errors,[]);
assert.equal(age15At40.requiredGapYears,40);
// Year-only photography that might include their 15th birthday must use 40.
const ambiguousUnder15=validatePhotoTimeline(record({born:'1980-06-15',thenYear:1995,nowYear:2026}));
assert.equal(ambiguousUnder15.requiredGapYears,40);
assert.match(ambiguousUnder15.errors.join(' '),/40 years apart/);
// Year-only data that conclusively puts subject below 15 can use 30.
const definitelyUnder15=validatePhotoTimeline(record({born:'1981-01-01',thenYear:1995,nowYear:2026}));
assert.deepEqual(definitelyUnder15.errors,[]);
assert.equal(definitelyUnder15.requiredGapYears,30);
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
process.stdout.write('PASS: 30-year gap for verified under-15 photos, 40-year standard, age boundaries, under-25 preference and date evidence\n');