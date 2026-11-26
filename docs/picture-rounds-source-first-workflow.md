# Source-first picture-round asset acquisition
This is the corrected ordering for NEW candidate media. Do not display a picture for approval until a reusable original has been obtained **as an actual file**, processed for QuizPro, and its SHA-256 + source licence recorded.

Workflow:
1. Choose genuine photographs from Wikimedia Commons **file pages** with compatible CC0, CC BY or CC BY-SA licences. Avoid unverified editorial images.
2. Create an input JSON like:
   `{"items":[{"id":"Q01-question","commonsFilePage":"https://commons.wikimedia.org/wiki/File:Tom_Jones%2C_2017.jpg"}]}`
3. Run `python scripts/source-commons-picture-assets.py candidates.json --out drafts/picture-rounds/asset-candidates` in an internet-enabled build environment with Pillow.
4. Before asking for approval, store BOTH resulting `.webp` asset file and `.source.json` licence/attribution evidence in the review branch. Preview exactly the saved file, **not a separate web search image reference**.
5. Upon user approval, lock the asset SHA-256 and file. Never replace one without another explicit review.
6. Prepare all 20 approved real photos; run `scripts/build-approved-picture-round.mjs` and verify persistence in QuizPro's round library. Ensure required photographer attribution is shown.

The script refuses non-Commons file pages, unknown licences, unsupported redirects, small image sources and overwrites. A Commons licence may require attribution and ShareAlike; automated metadata is an initial screening, not a substitute for legal review of a specific image.

**Current Famous Faces 0001:** The 10 historical previews were not downloaded during approval. Do not quietly substitute Commons alternatives; that would invalidate the user's approved image selections. They remain editorial approvals, not import-ready assets. If exact approved images cannot be obtained and cleared, replacement choices must be sourced, saved, shown, and explicitly approved using the new source-first procedure.

The script does not touch `data/quiz-library.json`, Printful, or the live QuizPro app.