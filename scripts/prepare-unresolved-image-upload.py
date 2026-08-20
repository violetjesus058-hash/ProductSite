from pathlib import Path
import json
import re

asset_dir = Path('/home/ubuntu/webdev-static-assets/product-images')
source = Path('client/src/data/products.ts').read_text(encoding='utf-8')
refs = sorted(set(re.findall(r'/product-images/([^"\\s]+)', source)))
paths = []
missing = []
for ref in refs:
    stem = Path(ref).stem
    prefix = stem.split('_', 1)[0]
    candidates = list(asset_dir.glob(prefix + '.*'))
    if candidates:
        paths.append(str(candidates[0]))
    else:
        missing.append(ref)
Path('scripts/unresolved-image-upload-paths.txt').write_text('\n'.join(paths) + ('\n' if paths else ''))
Path('scripts/unresolved-image-missing.json').write_text(json.dumps(missing, ensure_ascii=False, indent=2))
print({'refs': len(refs), 'paths': len(paths), 'missing': len(missing)})
