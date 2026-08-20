from __future__ import annotations

import re
from pathlib import Path
from io import BytesIO
from urllib.request import Request, urlopen
from PIL import Image, ImageOps

PROJECT = Path('/home/ubuntu/product-catalog-site')
DATA = PROJECT / 'client/src/data/products.ts'
OUTPUT_DIR = PROJECT / 'client/public/product-images'
SOURCE_DIR = Path('/home/ubuntu/webdev-static-assets/product-images')
SPECIAL_COVER = 'kb-7778863173-cover_a7bcd7b2.webp'
SPECIAL_URL = 'https://si.geilicdn.com/pcitem901908374288-414a00000195a8fd71180a23047e-unadjust_800_800.gif'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

refs = sorted(set(re.findall(r'"(/product-images/[^" ]+)"', DATA.read_text(encoding='utf-8'))))
source_by_stem = {p.stem: p for p in SOURCE_DIR.iterdir() if p.is_file()}
converted = []
missing_source = []
for ref in refs:
    target = PROJECT / 'client/public' / ref.lstrip('/')
    if target.exists():
        continue
    stem = Path(ref).stem
    source = source_by_stem.get(stem.split('_')[0])
    if source is None:
        missing_source.append(ref)
        continue
    try:
        with Image.open(source) as image:
            image.seek(0)
            image = ImageOps.exif_transpose(image)
            if image.mode not in ('RGB', 'RGBA'):
                image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            if image.mode == 'RGBA':
                image.save(target, 'WEBP', quality=72, method=6)
            else:
                image.convert('RGB').save(target, 'WEBP', quality=72, method=6)
        converted.append(ref)
    except Exception as exc:
        missing_source.append(f'{ref} ({exc})')

special_target = OUTPUT_DIR / SPECIAL_COVER
if not special_target.exists():
    request = Request(SPECIAL_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(request, timeout=30) as response:
        payload = response.read()
    with Image.open(BytesIO(payload)) as image:
        image.seek(0)
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        image.save(special_target, 'WEBP', quality=78, method=6)
    converted.append('/product-images/' + SPECIAL_COVER)

print({'converted': len(converted), 'missing_source': missing_source[:20], 'missing_source_count': len(missing_source)})
