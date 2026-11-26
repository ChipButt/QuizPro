// Age-difference and capture-date gate for THEN & NOW photographic pub-quiz packs.
// No guesses: each image must be dated from documented evidence before any approval.
const MIN_GAP_YEARS = 40;

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
export function validatePhotoTimeline(question,minYears=MIN_GAP_YEARS) {
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
  const guaranteedGap=fullYearsBetween(earlier.last,later.first);
  if(guaranteedGap<minYears) {
    errors.push('Q'+num+': photos are not verifiably '+minYears+' years apart (earliest possible age gap '+guaranteedGap+' years)');
  }
  const birth=exactDate(String(question?.subjectBirthDate||''));
  if(!birth) {
    errors.push('Q'+num+': subject date of birth is missing or invalid, cannot verify first-photo age');
  } else {
    if(birth>earlier.first) errors.push('Q'+num+': claimed photo predates the subject’s birth');
    const youngestPossibleAge=fullYearsBetween(birth,earlier.first);
    const oldestPossibleAge=fullYearsBetween(birth,earlier.last);
    // Preference: subject must be UNDER 25 at capture (ages 0–24), not over 25.
    // For year-only metadata, require the full possible capture window to be under 25.
    if(oldestPossibleAge >= 25) {
      warnings.push('Q'+num+': first photograph does not establish the preferred age UNDER 25'
        +' (possible age '+youngestPossibleAge+'–'+oldestPossibleAge+'); prefer a photograph taken before the 25th birthday');
    }
    if(fullYearsBetween(birth,later.first)<minYears) {
      errors.push('Q'+num+': subject is not yet '+minYears+' years old at the latest photograph; impossible to meet the rule');
    }
  }
  return {errors,warnings,guaranteedGapYears:guaranteedGap,earlier:earlier.description,later:later.description};
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
