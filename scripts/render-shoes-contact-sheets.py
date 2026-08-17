import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

source = Path('/home/ubuntu/product-catalog-site/client/src/data/products.ts').read_text()
start = source.index('export const products: Product[] = [')
end = source.index('] as Product[];', start) + 1
array_start = source.index('= [', start) + 2
products = json.loads(source[array_start:end])
by_source = {}
for p in products:
    if p.get('category') == 'shoe' and p.get('sourceProductId') not in by_source:
        by_source[p['sourceProductId']] = p
items = list(by_source.values())
assets = Path('/home/ubuntu/product-catalog-site/client/public')
out = Path('/tmp/shoes-contact-sheets')
out.mkdir(exist_ok=True)
font = ImageFont.load_default()
for batch, start_i in enumerate(range(0, len(items), 20), 1):
    batch_items = items[start_i:start_i+20]
    row_w, row_h = 6*150, 178
    sheet = Image.new('RGB', (row_w, len(batch_items)*row_h), '#e9e5dc')
    draw = ImageDraw.Draw(sheet)
    for row_i, p in enumerate(batch_items):
        y = row_i * row_h
        label = f"{p['sourceProductId']} | {p['name'][:24]} | ${p['price']:.2f}"
        draw.text((4, y+2), label, fill='black', font=font)
        for idx, url in enumerate(p.get('images', [])[:6]):
            path = assets / url.lstrip('/')
            if not path.exists():
                continue
            try:
                im = Image.open(path).convert('RGB')
                im.thumbnail((140, 140))
                x = idx*150 + (150-im.width)//2
                sheet.paste(im, (x, y+20+(140-im.height)//2))
                draw.text((idx*150+4, y+160), str(idx), fill='black', font=font)
            except Exception:
                pass
    out_path = out / f'shoes-batch-{batch}.jpg'
    sheet.save(out_path, quality=88)
    print(out_path, len(batch_items))
