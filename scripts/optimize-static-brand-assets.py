from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path('/home/ubuntu/product-catalog-site')
PUBLIC = ROOT / 'client/public'
ASSETS = {
    'catalog-mark.png': ('catalog-mark.webp', (900, 900), 76),
    'catalog-paper-texture.jpg': ('catalog-paper-texture.webp', (1800, 1200), 68),
    'catalog-detail-stilllife.jpg': ('catalog-detail-stilllife.webp', (1600, 1100), 72),
}
for source_name, (target_name, max_size, quality) in ASSETS.items():
    source = PUBLIC / source_name
    target = PUBLIC / target_name
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        if image.mode in ('RGBA', 'LA') or 'A' in image.getbands():
            image.convert('RGBA').save(target, 'WEBP', quality=quality, method=6)
        else:
            image.convert('RGB').save(target, 'WEBP', quality=quality, method=6)
    print(source_name, '->', target_name, target.stat().st_size)
