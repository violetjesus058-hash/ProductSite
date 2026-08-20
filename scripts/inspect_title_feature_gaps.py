import json
from pathlib import Path
from collections import Counter

ROOT = Path('/home/ubuntu/product-catalog-site')
source = (ROOT / 'client/src/data/products.ts').read_text(encoding='utf-8')
start = source.index('export const products: Product[] = ') + len('export const products: Product[] = ')
end = source.index('] as Product[];', start) + 1
products = json.loads(source[start:end])
generic = {'Essential Apparel', 'Everyday Apparel'}
rows = [p for p in products if (p.get('catalogName') or '') in generic]
print('generic rows', len(rows))
for p in rows[:40]:
    print(json.dumps({k:p.get(k) for k in ['sourceProductId','catalogName','name','category','subCategory','brand','colors','tags','description']}, ensure_ascii=False))
print('--- source field availability by category ---')
for cat in sorted({p.get('category') for p in products}):
    rs=[p for p in products if p.get('category')==cat]
    print(cat, len(rs), {field: sum(bool(p.get(field)) for p in rs) for field in ['brand','colors','tags','subCategory','description']})
