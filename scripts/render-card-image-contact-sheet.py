import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

products_path = Path('/home/ubuntu/product-catalog-site/client/src/data/products.ts')
source = products_path.read_text()
start = source.index('export const products: Product[] = [')
end = source.index('] as Product[];', start) + 1
array_start = source.index('= [', start) + 2
products = json.loads(source[array_start:end])
targets = {
    ('High-Quality Shirt', 19.10), ('REP High-Quality', 11.38), ('B Fashion', 28.74),
    ('High-Quality Apparel', 30.47), ('High-Quality Fashion', 22.95),
    ('High-Quality Shoes', 112.24), ('High-Quality Shoes 030', 67.50),
    ('100ml Fashion Perfume (W2C-101)', 22.18), ('High-Quality Fashion Versatile', 17.20),
}
selected = [p for p in products if (p.get('name'), round(p.get('price', -1), 2)) in targets]
assets = Path('/home/ubuntu/product-catalog-site/client/public')
out = Path('/tmp/card-image-contact-sheets')
out.mkdir(parents=True, exist_ok=True)
font = ImageFont.load_default()
for p in selected:
    imgs = []
    for idx, url in enumerate(p.get('images', [])[:8]):
        path = assets / url.lstrip('/')
        if not path.exists():
            continue
        try:
            im = Image.open(path).convert('RGB')
            im.thumbnail((220, 220))
            tile = Image.new('RGB', (240, 260), 'white')
            tile.paste(im, ((240-im.width)//2, 24))
            d = ImageDraw.Draw(tile)
            d.text((8, 6), f'{idx}: {path.name[:20]}', fill='black', font=font)
            imgs.append(tile)
        except Exception:
            pass
    if not imgs:
        continue
    cols = 4
    rows = (len(imgs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols*240, rows*260), '#e9e5dc')
    for i, tile in enumerate(imgs):
        sheet.paste(tile, ((i%cols)*240, (i//cols)*260))
    safe = p['id'].replace('/', '_')
    sheet.save(out / f'{safe}.jpg', quality=90)
    print(out / f'{safe}.jpg', p['id'], p['name'], p['price'])
