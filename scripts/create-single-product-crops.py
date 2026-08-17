from pathlib import Path
from PIL import Image

root = Path('/home/ubuntu/product-catalog-site/client/public/product-images')
# These crops remain tied to the original source image and are used only as card covers.
operations = [
    ('7b6cd06b71b31417b77f_c45fb836.webp', '7578496024-single-bottle.webp', (800, 405, 1180, 790)),
    ('bb16ae7769e04b5ce18b_kakobuy.webp', '7786196426-single-watch.webp', (18, 405, 600, 900)),
]
for source_name, output_name, box in operations:
    with Image.open(root / source_name) as source:
        crop = source.convert('RGB').crop(box)
        crop.save(root / output_name, 'WEBP', quality=92, method=6)
        print(output_name, crop.size)
