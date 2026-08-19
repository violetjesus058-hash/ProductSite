import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('/home/ubuntu/product-catalog-site')
source = (root / 'client/src/data/products.ts').read_text()
start = source.index('export const products: Product[] = ') + len('export const products: Product[] = ')
end = source.index('] as Product[];', start) + 1
products = json.loads(source[start:end])
targets = [
    ('High-Quality 8004', 15.91), ('High-Quality 22', 13.12), ('AC10', 23.47),
    ('High-Quality Apparel', 27.97), ('High-Quality Short-Sleeve Shirt', 13.12),
    ('High-Quality R*L Hoodie', 42.43), ('High-Quality Fashion Versatile Pants', 24.35),
    ('High-Quality Shoes 030', 48.60), ('Freps- High-Quality Shoes 005', 112.24),
    ('High-Quality Shoes', 112.24),
]
out = Path('/tmp/requested-single-contact-sheets')
out.mkdir(parents=True, exist_ok=True)
font = ImageFont.load_default()
for title, price in targets:
    matches = [p for p in products if p.get('catalogName') == title and abs(float(p.get('price', 0)) - price) < 0.011]
    for p in matches:
        imgs = []
        for idx, src in enumerate(p.get('images', [])):
            path = root / 'client/public' / src.lstrip('/')
            if not path.exists():
                continue
            try:
                im = Image.open(path).convert('RGB')
                im.thumbnail((190, 170))
                tile = Image.new('RGB', (210, 210), 'white')
                tile.paste(im, ((210-im.width)//2, 8))
                d = ImageDraw.Draw(tile)
                d.text((8, 184), f'{idx}: {path.name[:20]}', fill='black', font=font)
                imgs.append(tile)
            except Exception:
                pass
        if not imgs:
            continue
        cols = 4
        rows = (len(imgs) + cols - 1) // cols
        sheet = Image.new('RGB', (cols*210, rows*210), '#e8e4dc')
        for i, tile in enumerate(imgs):
            sheet.paste(tile, ((i % cols)*210, (i // cols)*210))
        safe = re.sub(r'[^a-zA-Z0-9_-]+', '_', f'{p["id"]}_{title}_{price}')
        sheet.save(out / f'{safe}.jpg', quality=92)
        print(out / f'{safe}.jpg')
