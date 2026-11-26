# Famous Faces – Then & Now 0001 | Photo-date and age rules

Updated 26 November 2026, incorporating the user's further under-15 exception.

## Enforced eligibility rules

- **Mandatory, age-dependent:** if the celebrity was **under 15** when the first photograph was taken (age 0–14), the two actual photographs must be **at least 30 full years apart**. If they were **15 or older**, the minimum remains **40 full years**. If the first-photo age is uncertain or might have reached 15 during an imprecisely dated capture period, use the stricter **40-year** threshold until evidence proves otherwise. Both capture dates must have source evidence; an article's publication date does not prove when its photo was taken. The shortest possible gap must satisfy the applicable threshold.
- **Preferred:** the celebrity is **UNDER 25 years old in the first photograph** (ages 0–24, before their 25th birthday), not over 25. This is a preference, not a compulsory blocker; a warning must be visible in editorial review when it is not established.
- **Required:** the photographed individual must be correctly identified, the face visible and identifiable at QuizPro mobile size; real WebP assets with verified source, rights and creator/attribution records must be stored before a photo is displayed for approval.
- All rights to use and redistribute photographs commercially in the UK must be resolved before images are offered for approval; ambiguous public-domain status is a rejection, not an outstanding task that can follow approval.
- Never change approved answer photographs silently. If an approved answer's capture date makes the **applicable 30- or 40-year gap** impossible, **explicitly flag the whole pair for renewed selection**. Preserve all superseded image selections in history.

## Impact on this round

All previously approved picture pairs must be rechecked against **photo capture dates**, not estimated image eras. Photographs without dated capture evidence are not ready for this approval gate.

**Tom Jones:** The proposed early 1967 photograph (born 7 June 1940) shows him at about 26–27, so it meets the 40-year gap against the 2018 answer photograph but **does not meet the preferred under-25 first-photo age**. Because under 25 is a preference, the pair can be retained with that note; it should never be misrepresented as satisfying the preference.

**Daniel Radcliffe:** Born in 1989, he is *not automatically excluded anymore*. A genuine photograph taken when he was **under 15**, paired with an answer photo taken at least **30 full years later**, can qualify. His previously considered images still need genuine capture-date evidence; retain existing approval decisions until a qualifying pair has been checked and explicitly approved.

Other pictures captured only 10–25 years apart are **not eligible** even when both photos are properly licensed. Pictures 30–39 years apart qualify **only** with documentary evidence that the subject was under 15 in the first photograph. User's name/person preferences and locked answer photos must remain preserved as historical editorial decisions, not secretly reassigned.

## Automated checks

- `scripts/picture-round-age-gap.mjs` calculates **conservative full years** between verified capture dates. For dates known only to the year, it uses the end of the first year and start of the last to prevent false positive eligibility. It selects the **30-year threshold only if the subject was demonstrably under 15 for the entire possible capture window**; otherwise it uses 40.
- Birth-date checks flag impossible timelines and **warn**, rather than fail, whenever a first photograph does not establish that the subject was **under 25**.
- `scripts/test-picture-round-age-gap.mjs` tests the under-15 30-year boundary, exact age 15 cutoff, conservative uncertain-year handling, standard 40-year boundary, preferred age 24 vs 25, missing date evidence, and a potentially eligible childhood-to-adult Daniel Radcliffe timeline.
- `scripts/build-approved-picture-round.mjs` blocks package construction when the applicable **30- or 40-year** chronology validation fails. This applies to all ten questions in this round.

**No further round and no live import until the user has approved ten actually usable, clearly dated, rights-eligible pairs.**
