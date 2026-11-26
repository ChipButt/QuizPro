# QuizPro – 14 reusable picture-round packs (production plan)

**Status:** preproduction and editorial review only. **Not published to the shared QuizPro round library.**
**Review date:** 2026-11-26. **History source:** `data/question-history.json` (sourceUpdatedAt 2026-10-30T08:43:27.327Z, 1621 distinct questions).

## Confirmed QuizPro compatibility
- Existing type: `Picture round`, with question type `Picture`, `image`, `imageName`, `answerImage`, `answerImageName`, `answer` and `alternatives`.
- Existing saved-round library stores a snapshot in `roundLibrary`. Merely adding repo JSON does **not** import rounds into the live QuizPro library.
- Existing image uploader optimises images to WebP with a ~140 KB target; visual detail must survive that limit.
- Picture question and answer image use a shared image frame and crossfade; test portrait-mobile display.
- Do not change live quiz data or integration code as a shortcut.

## Round pack queue (10 questions each)
### 01 – Famous Faces – Then & Now 0001
Status: initial editorial lineup prepared; images not sourced
Image rule: Two verified photographs of the same famous person from different decades; no names or watermarks.

### 02 – Film Props 0001
Status: not started
Image rule: Photograph of one identifiable prop; ask for its associated film, specifying an original film where sequels repeat the prop.

### 03 – TV Show Locations 0001
Status: not started
Image rule: A distinctive fictional interior or exterior; ask for the TV programme.

### 04 – Cartoon Close-Ups 0001
Status: not started
Image rule: Crop of a distinctive feature of an animated character; reveal the uncropped character.

### 05 – Music Video Stills 0001
Status: not started
Image rule: An identifiable frame from a music video; ask for the song title. Verify rights and source.

### 06 – Extreme Close-Ups 0001
Status: not started
Image rule: Original clear macro photographs of everyday objects; reveal a complete object.

### 07 – Famous Food Mascots 0001
Status: not started
Image rule: Illustration or photograph of the identifiable brand character with brand name hidden; ask for brand/product.

### 08 – Retro Food Packaging 0001
Status: not started
Image rule: Verified authentic older UK product packaging with legible brand name masked; ask for historical product.

### 09 – Logos Without Words 0001
Status: not started
Image rule: Only an existing distinctive logo symbol, with lettering removed; avoid generic shapes.

### 10 – Board Game Pieces 0001
Status: not started
Image rule: Distinctive game equipment or a close-up board section; ask for the board game; avoid multiple possible games.

### 11 – Brands Before They Were Famous 0001
Status: not started
Image rule: Authentic dated early brand logos, with visible brand lettering hidden where necessary; verify originality.

### 12 – Animal Eyes 0001
Status: not started
Image rule: Close-up photograph with enough surrounding anatomy to uniquely identify the animal.

### 13 – Animal Footprints 0001
Status: not started
Image rule: Grounded photograph of a complete track and scale context; exclude ambiguous generic paw prints.

### 14 – Plants Before They Flower 0001
Status: not started
Image rule: Photographs of distinctive leaves/plant habit before blooms; no flowers or identifying labels.


## QA gates
1. 10 unique images; no identifying words visible in the question picture.
2. Each picture admits one unambiguous answer, with verified specificity (avoid sequels/generic objects).
3. Reject same-fact duplicates against **only** `data/question-history.json`; also compare within drafted packs.
4. Check source provenance, reuse permission and attribution. Genuine documentary/historical images must not be fabricated.
5. Images must still be legible after the app's optimisation and in portrait view.
6. Test question image, reveal image, answer text, marking, round reuse, and persistent library save.
7. Only then mark an individual round ready for library publication.

## Pack 01 – Famous Faces – Then & Now 0001
Prompt for each picture: **Which famous person is shown in these two photographs?**
Each question requires an authentic earlier-career photograph paired with a genuinely later photograph. No invented appearance or undated AI reconstruction.

| # | Answer | Required image | History-name string check |
|---|---|---|---|
| 1 | Richard Branson | Earlier-career and later-life dated portrait; same subject in both, no visible name | No exact name in index |
| 2 | Kylie Minogue | Earlier-career and later-life dated portrait; same subject in both, no visible name | No exact name in index |
| 3 | David Beckham | Earlier-career and later-life dated portrait; same subject in both, no visible name | No exact name in index |
| 4 | Gordon Ramsay | Earlier-career and later-life dated portrait; same subject in both, no visible name | No exact name in index |
| 5 | Samuel L. Jackson | Earlier-career and later-life dated portrait; same subject in both, no visible name | No exact name in index |
| 6 | Emma Thompson | Earlier-career and later-life dated portrait; same subject in both, no visible name | No exact name in index |
| 7 | Daniel Radcliffe | Earlier-career and later-life dated portrait; same subject in both, no visible name | No exact name in index |
| 8 | Gary Barlow | Earlier-career and later-life dated portrait; same subject in both, no visible name | No exact name in index |
| 9 | Joan Collins | Earlier-career and later-life dated portrait; same subject in both, no visible name | No exact name in index |
| 10 | Shania Twain | Earlier-career and later-life dated portrait; same subject in both, no visible name | No exact name in index |

**Pack status:** editorial candidate only. This is not a completed picture round until the 20 licensed/cleared source photos are selected, pairs composed, and both question/answer screens are tested.

## Production principle
The project operates one round at a time. Preserve approved questions. Do not move to the next pack until all ten in the current pack have been reviewed and approved.