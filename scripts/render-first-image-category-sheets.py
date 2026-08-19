from collections import OrderedDict
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/home/ubuntu/product-catalog-site')
PRODUCTS = ROOT / 'client/src/data/products.ts'
OUT = Path('/tmp/first-image-category-sheets')
OUT.mkdir(parents=True, exist_ok=True)
source = PRODUCTS.read_text(encoding='utf-8')
start = source.index('export const products: Product[] = ') + len('export const products: Product[] = ')
end = source.index('] as Product[];', start) + 1
products = json.loads(source[start:end])
unique = OrderedDict()
for p in products:
    unique.setdefault(p.get('sourceProductId') or p['id'], p)
by_category = OrderedDict()
for p in unique.values():
    by_category.setdefault(p.get('category','unknown'), []).append(p)
font = ImageFont.load_default()
for cat, rows in by_category.items():
    cat_dir = OUT / cat
    cat_dir.mkdir(parents=True, exist_ok=True)
    for batch_start in range(0, len(rows), 50):
        batch = rows[batch_start:batch_start+50]
        cols = 5; tile_w=220; tile_h=220; rows_n=math.ceil(len(batch)/cols)
        sheet = Image.new('RGB',(cols*tile_w,rows_n*tile_h),'white'); draw=ImageDraw.Draw(sheet)
        for i,p in enumerate(batch):
            x=(i%cols)*tile_w; y=(i//cols)*tile_h
            rel=p.get('images',[''])[0]
            path=ROOT/'client/public'/rel.lstrip('/')
            try:
                im=Image.open(path).convert('RGB'); im.thumbnail((200,175))
                px=x+(200-im.width)//2; py=y+4+(175-im.height)//2
                sheet.paste(im,(px,py))
            except Exception: pass
            label=f"{batch_start+i+1}. {p.get('sourceProductId',p['id'])}"
            name=(p.get('name') or '')[:28]
            draw.text((x+5,y+183),label,fill='black',font=font)
            draw.text((x+5,y+198),name,fill='black',font=font)
        sheet.save(cat_dir/f'batch_{batch_start//50+1:02d}.jpg',quality=88)
    print(cat, len(rows), len(list(cat_dir.glob('batch_*.jpg'))))
