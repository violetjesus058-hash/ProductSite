import json
import re
from pathlib import Path

root = Path('/home/ubuntu/product-catalog-site')
generator = root / 'scripts/generate-kakobuy-full-products.py'
results = json.loads((root / 'scripts/ai-title-review.json').read_text(encoding='utf-8'))
accepted = [row for row in results if row.get('confidence') in {'high', 'medium'} and row.get('title') and len(row['title']) <= 42]
entries = '\n'.join(f"    {row['sourceProductId']!r}: {row['title']!r}," for row in accepted)
text = generator.read_text(encoding='utf-8')
pattern = re.compile(r"AI_TITLE_OVERRIDES = \{.*?\n\}\n\nMANUAL_OVERRIDES = \{", re.S)
replacement = f"AI_TITLE_OVERRIDES = {{\n{entries}\n}}\n\nMANUAL_OVERRIDES = {{"
updated, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('AI_TITLE_OVERRIDES block not found')
generator.write_text(updated, encoding='utf-8')
(root / 'scripts/ai-title-accepted.json').write_text(json.dumps(accepted, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'accepted': len(accepted), 'lowConfidenceSkipped': sum(row.get('confidence') == 'low' for row in results)}, ensure_ascii=False))
