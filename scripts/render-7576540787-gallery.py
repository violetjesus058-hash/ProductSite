from pathlib import Path
from PIL import Image, ImageDraw
names = [
    '2b6c674b555936e8d76b_288280f9.webp',
    '5335d37ef726bf69ec5d_e26a3a0b.webp',
    'c00167bec64ceff7f5de_d4fd0162.webp',
    'cf66cbd3c2ea7850f1f2_30a958f1.webp',
    'b1926e19005699aa0aa6_ee2503cb.webp',
    '9d10c87d24b2234a905b_e6a241d6.webp',
    '4269e56184a275c31366_1ed9146e.webp',
    '8dd543ecf63e252502ba_06a5d595.webp',
    'f71446d4be3fb2bae237_306abf94.webp',
    'c913efb9609aabf314a2_886d8e08.webp',
    '72c86c2eecc44c096181_f1dab6bf.webp',
    'fa1305e2bcec6fc995e6_61a8212f.webp',
    '06316158415848400663_7f0a0bc7.webp',
    '2198815296ee0b0ce663_7ea1c313.webp',
]
root = Path('/home/ubuntu/product-catalog-site/client/public/product-images')
thumb_w, thumb_h = 220, 250
sheet = Image.new('RGB', (thumb_w * 4, thumb_h * 4), '#f1eee7')
draw = ImageDraw.Draw(sheet)
for i, name in enumerate(names):
    path = root / name
    try:
        with Image.open(path) as im:
            im = im.convert('RGB')
            im.thumbnail((thumb_w - 18, thumb_h - 48))
            x = (i % 4) * thumb_w + (thumb_w - im.width) // 2
            y = (i // 4) * thumb_h + 8
            sheet.paste(im, (x, y))
    except Exception as exc:
        draw.text(((i % 4) * thumb_w + 8, (i // 4) * thumb_h + 8), f'ERROR {exc}', fill='red')
    draw.text(((i % 4) * thumb_w + 8, (i // 4) * thumb_h + thumb_h - 30), f'{i + 1}. {name[:12]}', fill='#28251f')
sheet.save('/tmp/7576540787-gallery.jpg', quality=92)
