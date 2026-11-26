# Famous Faces – Then & Now 0001 | STRICT IMAGE ELIGIBILITY AUDIT

Date: 26 November 2026. This document **supersedes** any earlier statement that downloading a photo from Wikimedia automatically makes it eligible. All current approved answer images are preserved, but no image enters a new approval screen until it has an actual saved file, licence evidence for commercial UK reuse, usable image dimensions, good identification visibility and a matching source SHA-256.

## Hard rules
1. Source must explicitly offer valid worldwide **CC0, CC BY or CC BY-SA** permission for commercial reuse, with original author and source-page URL recorded. **Not merely a general "Public domain" claim.**
2. Each actual image must be stored as WebP in this branch with valid rights-evidence JSON beside it and hashed against the user-reviewed image.
3. Copyright conditions, including creator attribution, links to source and licence, modification notices and ShareAlike for adapted files, must be supported in the published QuizPro round.
4. A face must be identifiable at the target mobile size, solo where possible, and a meaningfully earlier photo than its reveal image. Reject distant crowd/concert images before showing them.
5. If ANY gate fails, do not show that image as approvable. Do not deploy/import with gaps, placeholders or uncleared images.

## Actual audit & candidate states

| Q | Subject | Question image | Answer image | Eligibility |
|---|---|---|---|---|
| 1 | Richard Branson | `licensed-candidates/uk-portraits-v3/01-question.webp` (2000 event, CC BY-SA 2.0, Kingkongphoto) | `batch2/01-answer.webp` (approved) | New question image licensed+visually checked, **pending user approval** |
| 2 | Kylie Minogue | `review-v2/02-question.webp` (CC BY-SA 2.0) | `batch2/02-answer.webp` (approved) | New question candidate pending approval |
| 3 | Robbie Williams | `licensed-candidates/uk-portraits-v3/03-question.webp` (2006 close-up, CC BY 2.0, catzi) | `batch2/03-answer.webp` (approved) | New question image licensed+visually checked, **pending approval** |
| 4 | Tom Jones | `tom-jones/04-question.webp` (CC0) | `tom-jones/04-answer.webp` (CC BY 2.0) | Both images approved, saved and licence-reviewed |
| 5 | Samuel L. Jackson | `review-v2/05-question.webp` (CC BY 2.0) | `batch2/05-answer.webp` (approved) | New question candidate pending approval |
| 6 | Emma Thompson | `review-v2/06-question.webp` (CC BY 3.0) | `batch2/06-answer.webp` (approved) | New question candidate pending approval |
| 7 | Daniel Radcliffe | `review-v2/07-question.webp` (CC BY-SA 3.0) | `batch2/07-answer.webp` (approved) | New question candidate pending approval |
| 8 | Gary Barlow | `review-v2/08-question.webp` (CC BY 2.0) | `batch2/08-answer.webp` (approved) | New question candidate pending approval |
| 9 | Joan Collins | `joan-cc-solo/09-question.webp` (2009 solo crop, CC BY-SA 3.0, Prince Power) | `batch3/09-answer.webp` (approved) | Replacement licensed+visually checked, **pending user approval** |
| 10 | Helen Mirren | `review-v2/10-question.webp` (CC BY-SA 3.0) | `batch3/10-answer.webp` (approved) | New question candidate pending approval |

All paths above are relative to `drafts/picture-rounds/famous-faces-then-now-0001/`; except candidate folders prefixed under `licensed-candidates/`. The `review-v2` folder is also under `licensed-candidates/`. Each file has a matching `.source.json` record with the original photographer, source page, license URL and sha256.

## Explicitly withdrawn and NOT selectable
- `licensed-candidates/batch3/09-question.webp` Joan Collins 1954: US-only public-domain status; **NO confirmed UK commercial reuse clearance**. Do not offer, approve or publish.
- `licensed-candidates/review-v2/01-question.webp` Richard Branson NASA: generic Public domain metadata, excluded under strict worldwide licence gate pending independent rights verification.
- `licensed-candidates/review-v2/03-question.webp` Robbie Williams: CC BY 2.0 copyright is okay, but the performer is a tiny, distant figure in a crowd and it fails visual identification QA.

## Release status
The 1954 Joan photo's prior editorial approval was **not a rights clearance**. Original file stays preserved for provenance but is excluded from production. The licensed cropped Joan Collins alternative is not yet user-approved, and must be reapproved as the new actual file. **No edits to live QuizPro library; no next round.**

The revised source-first acquisition and package validator have passed build/syntax checks. Compliance with creator attribution, modification notices and ShareAlike is required before any live import. Be careful: a photo's general CC licence does not automatically confer endorsement rights for advertising or use of a person's likeness in all contexts.
