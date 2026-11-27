# Famous Faces – Then & Now 0001 | Production finalization audit

**Date:** 26 November 2026
**Editorial status:** **10/10 approved and locked**
**Live QuizPro status:** **NOT IMPORTED; NOT FINALIZED**
**Work branch:** `picture-rounds-14-formats-20261126` (no edits to main, live quiz data or integrations)

## Approved answers (unchanged)

1. Richard Branson
2. Kylie Minogue
3. Robbie Williams
4. Tom Jones
5. Samuel L. Jackson
6. Emma Thompson
7. Daniel Radcliffe
8. Gary Barlow
9. Joan Collins
10. Helen Mirren

Approved choices come from Review 1–9. The nine earlier approvals and Q4 Tom Jones remain unchanged. All superseded image decisions, including the retired **David Beckham answer photo** and **Hugh Laurie answer photo**, are preserved in the individual numbered review documents; neither is assigned to any active question.

## Media inventory — decisive release blocker

The user approved **web previews** in ChatGPT, not 20 retrievable, licensed photographs. The ChatGPT preview reference IDs in the manifests are archival labels, **not binary assets or persistent public download URLs**. Do not treat an image-query reference or an article containing photographs as a reusable file.

| # | Answer | Earlier/question photo source recorded | Later/answer photo source recorded | Exact approved image files present? |
|---|---|---|---|---|
| 1 | Richard Branson | Virgin article (Review 3) | Original ChatGPT preview only | No |
| 2 | Kylie Minogue | 1987 Time Tunnel article (Review 2) | Original ChatGPT preview only | No |
| 3 | Robbie Williams | Getty editorial-search page (Review 8) | Robbie Williams Music press page (Review 8) | No |
| 4 | Tom Jones | Woman's Day editorial photo page (Review 9) | Official Tom Jones photo page (Review 9) | No |
| 5 | Samuel L. Jackson | Infobae story (Review 2) | Original ChatGPT preview only | No |
| 6 | Emma Thompson | Original ChatGPT preview only | Original ChatGPT preview only | No |
| 7 | Daniel Radcliffe | TheWrap image article (Review 2) | Original ChatGPT preview only | No |
| 8 | Gary Barlow | Original ChatGPT preview only | Original ChatGPT preview only | No |
| 9 | Joan Collins | Original ChatGPT preview only | Original ChatGPT preview only | No |
| 10 | Helen Mirren | OK Magazine Romania (Review 7) | Getty-linked 2025 event image, preview only | No |

**Totals:** 10 approved question/answer pairs, 20 expected photo files, **0 actual image files**, 9 source-page leads, 11 slots missing even a durable source-page URL, **0 confirmed reproduction/website-use licences**.

### Image rights audit

- Public availability, a publication page, and photo previews are **not a grant of reproduction rights**.
- Getty Images requires licenses for downloaded photos; specific editorial licenses may limit how they are used. See https://www.gettyimages.co.uk/faq/licensing and https://www.gettyimages.co.uk/eula
- Other publisher or photographer-owned images also require an appropriate reuse basis for this hosted quiz; use the exact selected images rather than silently substituting alternatives.
- No rights purchases, licensing contracts or usage permission records were supplied or completed. Rights status on **all 20** slots stays `not-cleared`.

## Completed technical preparation

- Staged a **10-question, 20-image-slot, 10-answer** approved manifest at `drafts/picture-rounds/famous-faces-then-now-0001/manifest.json`.
- Preserved historical preview IDs, review provenance, current person selection, naming and link leads for each image slot.
- Staged a strict **offline package builder** at `scripts/build-approved-picture-round.mjs`. This builds a QuizPro saved-round JSON entry only if every approved image file exists, is properly sized and its usage-rights evidence is recorded.
- The builder produces the same picture-question fields used by the existing QuizPro editor: `type: Picture`, `image`, `answerImage`, `answer`, `answerMode: text`, `points: 1`, `roundLibrary`-compatible round entry.
- Local validation with **20 temporary synthetic test images**, all excluded from the repository and the final assets, successfully produced a 10-question picture-round JSON. A validation run using the real approved manifest **correctly refused to generate the output**, reporting 20 missing image files and 20 missing rights records.
- This test verifies the package structure and fail-closed checks only; **a live browser rendering, answer reveal, persistence and sync test has NOT happened**, because genuine selected assets are absent.

## Finalization still required

1. Retrieve each exact approved question and answer photograph as a permitted original, preserving the selected appearance/crop. For unresolved ChatGPT-only previews, recover the actual original source file or request the user provide it.
2. Secure or record adequate rights for public online pub-quiz use (or obtain the user's explicit replacement approval for an alternative), with evidence per image.
3. Produce 20 image files named `01-question.webp`, `01-answer.webp` ... `10-question.webp`, `10-answer.webp` (min 520×520; keep each at or below 140KB).
4. Mark individual license records `cleared` and attach permission evidence; run `scripts/build-approved-picture-round.mjs` to create the standalone saved-round entry.
5. Append the completed entry **without replacing any other saved rounds or quizzes** through QuizPro's existing shared-library pathway, then confirm live persistence, portrait-mobile display, image crossfade and scoring.
6. Only then mark `Famous Faces – Then & Now 0001` **production-finalized**, and allow work to proceed to the next round.

**Safety:** Do not write an incomplete round or stock images into `data/quiz-library.json`; do not overwrite the existing shared library; do not alter the QuizPro app or Printful integration.
