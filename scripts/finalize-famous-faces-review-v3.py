#!/usr/bin/env python3
"""Prepare visually checked solo celebrity crops from SAVED, licensed QuizPro assets.
Never changes the original or the editorial-approved pictures.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

def finish(cropped, originals, out):
    out.mkdir(parents=True, exist_ok=True)
    # Coordinates refer to 720x720 SAVED, already rights-screened input WebPs.
    specs = [
        ('06-question', cropped, (232, 35, 532, 635)),  # Diana Ross alone in 1965
        ('06-answer', originals, (205, 160, 490, 560)),  # Diana Ross closer in 2022
        ('08-question', cropped, (224, 215, 496, 504)),  # Cher, 1966, upscale original small photo
    ]
    for stem, root, box in specs:
        proof = json.loads((root / (stem + '.source.json')).read_text())
        source = (root / (stem + '.webp')).read_bytes()
        original_hash = hashlib.sha256(source).hexdigest()
        if original_hash != proof['imageSha256']:
            raise ValueError('Original rights-verified image was modified: ' + stem)
        img = Image.open(io.BytesIO(source)).convert('RGB')
        if img.size != (720, 720):
            raise ValueError('Source picture dimensions changed: ' + stem)
        img = img.crop(box)
        desired = (round(700 / max(img.size) * img.width),
                   round(700 / max(img.size) * img.height))
        img = img.resize(desired, Image.Resampling.LANCZOS)
        frame = Image.new('RGB', (720, 720), (24, 27, 32))
        frame.paste(img, ((720 - img.width)//2, (720 - img.height)//2))
        for quality in (85, 78, 70, 60, 50, 40, 30):
            buf = io.BytesIO()
            frame.save(buf, 'WEBP', quality=quality, method=6)
            if len(buf.getvalue()) <= 140000:
                break
        picture = buf.getvalue()
        if len(picture) > 140000:
            raise ValueError('Could not optimize photo to QuizPro limit: ' + stem)
        (out / (stem + '.webp')).write_bytes(picture)
        proof.update(
            imageSha256=hashlib.sha256(picture).hexdigest(), bytes=len(picture),
            derivedFromImageSha256=original_hash, postProcessCropRect=list(box),
            postProcessUpscaled=img.width > box[2] - box[0] or img.height > box[3] - box[1],
            modificationNotice='Cropped to isolate celebrity, resampled to fit quiz card; no changes to the person or original scene',
            cropApplied=True, editorialStatus='PENDING USER APPROVAL')
        (out / (stem + '.source.json')).write_text(json.dumps(proof, indent=2) + '\n')
        print(stem, len(picture), proof['imageSha256'])

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cropped-dir', type=Path, required=True)
    parser.add_argument('--original-dir', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    finish(args.cropped_dir, args.original_dir, args.out)
