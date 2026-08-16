import json
from collections import Counter
from pathlib import Path

items = json.loads(Path('/home/ubuntu/product-catalog-site/scripts/kakobuy-full-products.json').read_text(encoding='utf-8'))
print('products=', len(items))
print('categories=', dict(Counter(item['category'] for item in items)))
print('subcategories=', dict(Counter(item['subCategory'] for item in items).most_common(30)))
print('brands=', dict(Counter(item['brand'] for item in items).most_common(20)))
for term in ['pants', 'watch', 'perfume', 'bag']:
    matches = [item for item in items if term in item['name'].lower()]
    print(term, 'sample=', [(item['id'], item['category'], item['subCategory'], item['name'][:60]) for item in matches[:5]])
