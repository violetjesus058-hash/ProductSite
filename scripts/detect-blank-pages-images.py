from __future__ import annotations

import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path('/home/ubuntu/product-catalog-site/client/public/product-images')
REPORT = Path('/home/ubuntu/product-catalog-site/scripts/blank-pages-images.json')
hits = []
for path in ROOT.glob('*.webp'):
    try:
        with Image.open(path).convert('RGB') as image:
            sample = np.asarray(image.resize((32, 32)), dtype=np.uint8)
        light = np.all(sample >= 248, axis=2).mean()
        contrast = float(sample.std())
        if light >= 0.985 and contrast < 8:
            hits.append({'file': path.name, 'white_ratio': round(float(light), 5), 'std': round(contrast, 3)})
    except Exception:
        continue
REPORT.write_text(json.dumps(hits, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'scanned': len(list(ROOT.glob("*.webp"))), 'blank_like': len(hits), 'report': str(REPORT)}, ensure_ascii=False))
