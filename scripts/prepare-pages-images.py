from __future__ import annotations

import json
import re
from pathlib import Path
from PIL import Image, ImageOps

PROJECT = Path('/home/ubuntu/product-catalog-site')
DATA = PROJECT / 'client/src/data/products.ts'
SOURCE_DIR = Path('/home/ubuntu/webdev-static-assets/product-images')
OUTPUT_DIR = PROJECT / 'client/public/product-images'
REPORT = PROJECT / 'scripts/pages-image-conversion-report.json'
MAX_SIZE = (1600, 1600)
QUALITY = 72

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
source_map = {p.stem: p for p in SOURCE_DIR.iterdir() if p.is_file()}
refs = sorted(set(re.findall(r'"/manus-storage/([^" ]+)"', DATA.read_text(encoding='utf-8'))))
converted = []
missing = []
for ref in refs:
    stem = Path(ref).stem
    source_stem = stem.split('_')[0]
    source = source_map.get(source_stem)
    if source is None:
        missing.append(ref)
        continue
    target_name = f'{stem}.webp'
    target = OUTPUT_DIR / target_name
    try:
        with Image.open(source) as image:
            image.seek(0)
            image = ImageOps.exif_transpose(image)
            if image.mode not in ('RGB', 'RGBA'):
                image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
            image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
            if image.mode == 'RGBA':
                image.save(target, 'WEBP', quality=QUALITY, method=6, lossless=False)
            else:
                image.convert('RGB').save(target, 'WEBP', quality=QUALITY, method=6, lossless=False)
        converted.append({'from': ref, 'to': f'/product-images/{target_name}', 'source_bytes': source.stat().st_size, 'output_bytes': target.stat().st_size, 'size': list(image.size)})
    except Exception as exc:
        missing.append(f'{ref} ({exc})')

REPORT.write_text(json.dumps({'refs': len(refs), 'converted': len(converted), 'missing': missing, 'source_bytes': sum(x['source_bytes'] for x in converted), 'output_bytes': sum(x['output_bytes'] for x in converted), 'output_dir': str(OUTPUT_DIR)}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'refs': len(refs), 'converted': len(converted), 'missing': len(missing), 'source_bytes': sum(x['source_bytes'] for x in converted), 'output_bytes': sum(x['output_bytes'] for x in converted), 'output_dir': str(OUTPUT_DIR)}, ensure_ascii=False))
