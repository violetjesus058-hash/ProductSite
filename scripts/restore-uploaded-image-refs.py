import json
import re
from pathlib import Path

ROOT = Path('/home/ubuntu/product-catalog-site')
log_paths = [ROOT / 'scripts/product-image-upload.log', ROOT / 'scripts/unresolved-image-upload.log']
pattern = re.compile(r'(?:\[SUCCESS\]\s+[^\n]*/([^/]+?)\s+->\s+|Storage Path:\s+)(/manus-storage/[^\s]+)')
mapping = {}
for log_path in log_paths:
    if not log_path.exists():
        continue
    for match in pattern.finditer(log_path.read_text(encoding='utf-8', errors='ignore')):
        local_name = Path(match.group(1)).name if match.group(1) else Path(match.group(2).split('/')[-1]).name
        storage_url = match.group(2)
        local_stem = Path(local_name).stem
        mapping[local_stem] = storage_url
        mapping[local_stem.split('_', 1)[0]] = storage_url

path_pattern = re.compile(r'/product-images/([^"\\\s]+)')
missing = set()
replaced = 0

def replace_path(match):
    global replaced
    name = match.group(1)
    key = Path(name).stem
    storage = mapping.get(key) or mapping.get(key.split('_', 1)[0])
    if storage:
        replaced += 1
        return storage
    missing.add(name)
    return match.group(0)

for relative in ['client/src/data/products.ts', 'scripts/kakobuy-full-products.json']:
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    updated = path_pattern.sub(replace_path, text)
    path.write_text(updated, encoding='utf-8')

report = {
    'mappingEntries': len(mapping),
    'replacedRefs': replaced,
    'unresolvedRefs': len(missing),
    'unresolvedSamples': sorted(missing)[:30],
}
(ROOT / 'scripts/image-ref-restore-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
