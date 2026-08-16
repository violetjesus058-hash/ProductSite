import json
from pathlib import Path

items = json.loads(Path('/home/ubuntu/product-catalog-site/scripts/kakobuy-full-products.json').read_text(encoding='utf-8'))
seen = set()
count = 0
for item in items:
    pid = item.get('sourceProductId')
    if pid in seen:
        continue
    seen.add(pid)
    if item.get('category') not in {'clothing', 'pants'}:
        continue
    print(f"{item['id']}\t{pid}\t{item['category']}\t{item['subCategory']}\t{item['name'][:90]}\t{' | '.join(item.get('images', [])[:3])}")
    count += 1
    if count >= 30:
        break
print(f'queue_count={count}')
