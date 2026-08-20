import json
from pathlib import Path

ROOT = Path('/home/ubuntu/product-catalog-site')
missing = {'/product-images/7578496024-single-bottle.webp', '/product-images/7786196426-single-watch.webp'}
source = ROOT.joinpath('client/src/data/products.ts').read_text(encoding='utf-8')
start = source.index('export const products: Product[] = [') + len('export const products: Product[] = ')
end = source.index('] as Product[];', start) + 1
products = json.loads(source[start:end])
replacements = {}
for product in products:
    images = product.get('images') or []
    for index, image in enumerate(images):
        if image in missing:
            fallback = next((candidate for candidate in images[index + 1:] if candidate and candidate not in missing), '/manus-storage/catalog-detail-stilllife_f1f3f213.jpg')
            replacements[image] = fallback

for relative in ['client/src/data/products.ts', 'scripts/kakobuy-full-products.json']:
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    for old, new in replacements.items():
        text = text.replace(old, new)
    path.write_text(text, encoding='utf-8')

print({'replacements': replacements})
