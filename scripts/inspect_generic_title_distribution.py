import json
from collections import Counter
from pathlib import Path
text = Path('client/src/data/products.ts').read_text(encoding='utf-8')
start = text.index('export const products: Product[] = [') + len('export const products: Product[] = ')
end = text.index('] as Product[];', start) + 1
products = json.loads(text[start:end])
weak = {'Everyday Apparel','Everyday Pants','Everyday Shoes','Everyday Accessory','Everyday Bag','Everyday Fragrance','Everyday Watch','Daily Essential Accessory','Daily Essential Belt','Everyday Hoodie','Everyday Jersey'}
counts = Counter((p.get('category'), p.get('subCategory'), p.get('catalogName')) for p in products if p.get('catalogName') in weak)
for (cat, sub, title), n in counts.most_common():
    print(f'{n}\t{cat}/{sub}\t{title}')
