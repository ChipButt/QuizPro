# Famous Faces – Then & Now 0001 | Photo-date and age rules

Updated 26 November 2026, after the user's explicit clarification.

## Enforced eligibility rules

- **Mandatory:** the two actual photographs must have been taken **at least 40 full years apart**, backed by a verifiable photo-capture date or year for each. Publication date of an article is not evidence that its illustration was taken that year. Where only a year is known, the **shortest possible gap** must be at least 40 years.
- **Preferred:** the celebrity is **UNDER 25 years old in the first photograph** (ages 0–24, before their 25th birthday), not over 25. This is a preference, not a compulsory blocker; a warning must be visible in editorial review when it is not established.
- **Required:** the photographed individual must be correctly identified, the face visible and identifiable at QuizPro mobile size; real WebP assets with verified source, rights and creator/attribution records must be stored before a photo is displayed for approval.
- All rights to use and redistribute photographs commercially in the UK must be resolved before images are offered for approval; ambiguous public-domain status is a rejection, not an outstanding task that can follow approval.
- Never change approved answer photographs silently. If an approved answer's capture date makes the 40-year gap impossible, **explicitly flag the whole pair for renewed selection**. Preserve all superseded image selections in history.

## Impact on this round

All previously approved picture pairs must be rechecked against **photo capture dates**, not estimated image eras. Photographs without dated capture evidence are not ready for this approval gate.

**Tom Jones:** The proposed early 1967 photograph (born 7 June 1940) shows him at about 26–27, so it meets the 40-year gap against the 2018 answer photograph but **does not meet the preferred under-25 first-photo age**. Because under 25 is a preference, the pair can be retained with that note; it should never be misrepresented as satisfying the preference.

**Daniel Radcliffe:** Born in 1989, he cannot have two photographs dated 40 years apart by 2026. He needs replacing as the current person in this particular format; neither image should be silently changed.

Other pictures captured only 10–25 years apart are **not eligible** under the hard gap even when both photos are properly licensed. User's name/person preferences and locked answer photos must remain preserved as historical editorial decisions, not secretly reassigned.

## Automated checks

- `scripts/picture-round-age-gap.mjs` calculates **conservative full years** between verified capture dates. For dates known only to the year, it uses the end of the first year and start of the last to prevent false positive eligibility.
- Birth-date checks flag impossible timelines and **warn**, rather than fail, whenever a first photograph does not establish that the subject was **under 25**.
- `scripts/test-picture-round-age-gap.mjs` tests the 40-year boundary, exact age 24 vs age 25, ambiguous capture years, missing date evidence and an impossible Daniel Radcliffe timeline.
- `scripts/build-approved-picture-round.mjs` blocks package construction when chronology validation fails. This applies to all ten questions in this round.

**No further round and no live import until the user has approved ten actually usable, clearly dated, rights-eligible pairs.**
