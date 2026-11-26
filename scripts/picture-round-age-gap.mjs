// Age-difference and capture-date gate for THEN & NOW photographic pub-quiz packs.
// No guesses: each image must be dated from documented evidence before any approval.
const STANDARD_MIN_GAP_YEARS = 40;
const UNDER_15_MIN_GAP_YEARS = 30;

function exactDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const d = new Date(value + 'T00:00:00.000Z');
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== value ? null : d;
}
function dateParts(date) {
  return [date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate()];
}
function fullYearsBetween(earlier,later) {
  const [y1,m1,d1]=dateParts(earlier),[y2,m2,d2]=dateParts(later);
  return y2-y1 - (m2<m1 || (m2===m1 && d2<d1) ? 1:0);
}
function photoRange(slot) {
  if (slot?.photoTakenOn) {
    const date = exactDate(slot.photoTakenOn);
    return date && {first:date,last:date,description:slot.photoTakenOn};
  }
  const year=slot?.photoTakenYear;
  if (!Number.isInteger(year) || year<1850 || year>new Date().getUTCFullYear()) return null;
  const first=exactDate(year+'-01-01'),last=exactDate(year+'-12-31');
  return {first,last,description:String(year)};
}
export function validatePhotoTimeline(question,minYears=STANDARD_MIN_GAP_YEARS) {
  const errors=[],warnings=[];
  const num=question?.number ?? '?';
  const earlier=photoRange(question?.questionImage);
  const later=photoRange(question?.answerImage);
  for(const [name,slot,range] of [
    ['question',question?.questionImage,earlier],
    ['answer',question?.answerImage,later],
  ]) {
    if(!range) errors.push('Q'+num+': '+name+' photo capture date or documented year is missing or invalid');
    const evidence=String(slot?.photoDateEvidenceUrl || '').trim();
    if(!/^https:\/\/[^/\s]+\/\S*/.test(evidence)) errors.push('Q'+num+': '+name+' photograph date requires a verifiable https source');
  }
  if(!earlier || !later) return {errors,warnings};
  if(earlier.last >= later.first) {
    errors.push('Q'+num+': question photograph is not demonstrably earlier than answer photograph');
  }
  const birth=exactDate(String(question?.subjectBirthDate||''));
  let requiredGapYears=minYears;
  let ageAtFirst=null;
  if(!birth) {
    errors.push('Q'+num+': subject date of birth is missing or invalid, cannot verify first-photo age');
  } else {
    if(birth>earlier.first) errors.push('Q'+num+': claimed photo predates the subject’s birth');
    const youngestPossibleAge=fullYearsBetween(birth,earlier.first);
    const oldestPossibleAge=fullYearsBetween(birth,earlier.last);
    ageAtFirst={youngestPossibleAge,oldestPossibleAge};
    // A 30-year photo gap is allowed ONLY if every possible capture date proves
    // the person was under 15. Undated birthdays/ambiguous year windows retain 40.
    if(youngestPossibleAge>=0 && oldestPossibleAge<15) requiredGapYears=UNDER_15_MIN_GAP_YEARS;
    // Preferred first photo: under 25. Unlike the gap, this is a warning only.
    if(oldestPossibleAge>=25) {
      warnings.push('Q'+num+': first photograph does not establish the preferred age UNDER 25'
        +' (possible age '+youngestPossibleAge+'–'+oldestPossibleAge+'); prefer a photograph taken before the 25th birthday');
    }
  }
  const guaranteedGap=fullYearsBetween(earlier.last,later.first);
  if(guaranteedGap<requiredGapYears) {
    errors.push('Q'+num+': photos are not verifiably '+requiredGapYears
      +' years apart (guaranteed gap '+guaranteedGap+' years)');
  }
  if(birth && fullYearsBetween(birth,later.first)<requiredGapYears) {
    errors.push('Q'+num+': subject is not yet '+requiredGapYears
      +' years old at the later photograph; impossible to meet the rule');
  }
  return {errors,warnings,requiredGapYears,guaranteedGapYears:guaranteedGap,ageAtFirst,earlier:earlier.description,later:later.description};
}
export function validateRoundPhotoTimeline(questions) {
  const errors=[],warnings=[],summaries=[];
  for(const question of questions||[]) {
    const result=validatePhotoTimeline(question);
    errors.push(...result.errors);warnings.push(...result.warnings);
    summaries.push({question:question.number,person:question.answer,...result});
  }
  return {errors,warnings,summaries};
}
