#!/usr/bin/env python3
"""Acquire ORIGINAL licensed Wikimedia Commons image files BEFORE picture-round review.

Input: {"items":[{"id":"Q01-question","commonsFilePage":"https://commons.wikimedia.org/wiki/File:..."}]}
Output: actual WebP photos + evidence, not references or ephemeral thumbnails.
Never modifies live QuizPro data or user approvals.
Install prerequisite in execution environment: Pillow (python -m pip install pillow).
"""
from __future__ import annotations
import argparse
import hashlib
import html
import io
import json
import re
import sys
import time
from urllib.error import HTTPError
from pathlib import Path
from urllib.parse import unquote, urlencode, urlparse
from urllib.request import Request, urlopen
from PIL import Image, ImageOps

ACCEPTED_LICENSE_RE = re.compile(r'^(CC BY(?:-SA)?[ -]\d+(?:\.\d+)?|CC0(?:[ -]1\.0)?|Public domain)$', re.I)
AGENT = 'QuizPro-PictureAssetReview/1.0 (source/licence verification and local archival)'

def clean_markup(s):
    return html.unescape(re.sub(r'<[^>]+>', ' ', str(s or ''))).strip()

def commons_title(url):
    u=urlparse(url)
    if u.hostname != 'commons.wikimedia.org' or not u.path.startswith('/wiki/File:'):
        raise ValueError('Only Wikimedia Commons file-description page URLs are allowed')
    return unquote(u.path.removeprefix('/wiki/')).replace('_', ' ')

def choose_license(ext):
    def value(k):
        return ext.get(k,{}).get('value','')
    name=clean_markup(value('LicenseShortName'))
    link=value('LicenseUrl')
    if not ACCEPTED_LICENSE_RE.fullmatch(name):
        raise ValueError('Missing/restricted image licence: '+repr(name))
    if name.lower()=='public domain' and clean_markup(value('Copyrighted')).lower()!='false':
        raise ValueError('Ambiguous public domain status')
    if name.lower().startswith('cc') and not link.startswith(('https://creativecommons.org/','http://creativecommons.org/')):
        raise ValueError('Missing verified Creative Commons licence link')
    return {'name':name,'url':link,'author':clean_markup(value('Artist')),'credit':clean_markup(value('Credit')),
            'attributionRequired':name.lower().startswith('cc by'),
            'caution':'Check personality rights and applicable copyright law for intended publication'}

def get_bytes(url,max_size=26000000):
    request=Request(url, headers={'User-Agent':AGENT})
    for attempt in range(5):
        try:
            with urlopen(request,timeout=35) as response:
                u=urlparse(response.url)
                if u.scheme!='https' or u.hostname not in ('commons.wikimedia.org','upload.wikimedia.org','thumb.wikimedia.org'):
                    raise ValueError('Wikimedia download redirected to unknown host')
                data=response.read(max_size+1)
            if len(data)>max_size: raise ValueError('Source image exceeded 26MB')
            return data
        except HTTPError as e:
            if e.code not in (429,500,502,503,504) or attempt==4: raise
            time.sleep(min(45, 4 * 2**attempt))
    raise RuntimeError('Exhausted retries')

def image_info(title):
    params={'action':'query','format':'json','prop':'imageinfo','iiprop':'url|extmetadata|size','iiurlwidth':'1200','titles':title}
    api='https://commons.wikimedia.org/w/api.php?'+urlencode(params)
    obj=json.loads(get_bytes(api).decode('utf-8'))
    info=next(iter(obj['query']['pages'].values())).get('imageinfo',[None])[0]
    if not info or not info.get('url'): raise ValueError('Wikimedia image source unavailable')
    return info,api

def webp(data):
    with Image.open(io.BytesIO(data)) as source:
        source.load()
        if source.width < 250 or source.height < 250:
            raise ValueError('Source is too low-resolution')
        img=ImageOps.exif_transpose(source).convert('RGB')
        img.thumbnail((720,720),Image.Resampling.LANCZOS)
        frame=Image.new('RGB',(720,720),(24,27,32))
        frame.paste(img,((720-img.width)//2,(720-img.height)//2))
        for quality in (84,76,68,60,52,44,36,30):
            target=io.BytesIO()
            frame.save(target,format='WEBP',quality=quality,method=6)
            encoded=target.getvalue()
            if len(encoded)<=140000: return encoded
        raise ValueError('Cannot fit image within QuizPro 140KB target')

def acquire(item,out):
    key=item['id']
    if not re.fullmatch(r'Q(?:0[1-9]|10)-(question|answer)',key):
        raise ValueError('Invalid picture candidate identifier')
    source_page=item['commonsFilePage']
    title=commons_title(source_page)
    info,api=image_info(title)
    license_info=choose_license(info.get('extmetadata',{}))
    url=info.get('thumburl') or info['url']
    if urlparse(url).hostname not in ('upload.wikimedia.org','thumb.wikimedia.org'):
        raise ValueError('Commons image URL host invalid')
    raw=get_bytes(url)
    picture=webp(raw)
    target=out/(key[1:].lower()+'.webp')
    if target.exists(): raise FileExistsError('Refusing to replace a previously sourced image: '+str(target))
    target.write_bytes(picture)
    evidence={'id':key,'fileName':target.name,'sourcePage':source_page,'commonsFileTitle':title,
              'imageUrl':url,'sourceMetadataApi':api,'license':license_info,
              'sourceSha256':hashlib.sha256(raw).hexdigest(),
              'imageSha256':hashlib.sha256(picture).hexdigest(),
              'bytes':len(picture),'width':720,'height':720,'cropApplied':False,
              'editorialStatus':'PENDING USER REVIEW','published':False,
              'attributionDisplayNeeded':license_info['attributionRequired']}
    (out/(key[1:].lower()+'.source.json')).write_text(json.dumps(evidence,indent=2)+'\n')
    return evidence

def main():
    p=argparse.ArgumentParser()
    p.add_argument('candidate_manifest')
    p.add_argument('--out',required=True)
    args=p.parse_args()
    manifest=json.loads(Path(args.candidate_manifest).read_text())
    items=manifest.get('items',[])
    if not 1 <= len(items) <= 20: p.error('Manifest must specify 1–20 candidate photos')
    if len(set(x.get('id') for x in items))!=len(items): p.error('Duplicate photo IDs')
    dest=Path(args.out);dest.mkdir(parents=True,exist_ok=True)
    success=[];failures=[]
    for item in items:
        time.sleep(1.5)  # Gentle pacing for Wikimedia's public API
        try: success.append(acquire(item,dest))
        except Exception as ex: failures.append({'id':item.get('id'), 'error':str(ex)})
    (dest/'acquisition-report.json').write_text(json.dumps({'filesSaved':len(success),'sources':success,'failures':failures},indent=2)+'\n')
    print(f'Image candidate files saved: {len(success)}, blocked: {len(failures)}')
    if failures:
        for problem in failures:print(problem,file=sys.stderr)
        sys.exit(2)

if __name__=='__main__':
    main()
