from pathlib import Path
from PIL import Image, ImageChops

source = Path('client/public/branding/rivora-wordmark.png')
target = Path('client/public/branding/rivora-wordmark-cropped.png')
image = Image.open(source).convert('RGBA')
background = Image.new('RGBA', image.size, (255, 255, 255, 255))
diff = ImageChops.difference(image, background).convert('L')
# Include near-white antialiasing while removing the large outer canvas.
mask = diff.point(lambda value: 255 if value > 10 else 0)
box = mask.getbbox()
if box is None:
    raise SystemExit('No non-white logo content found')
left, top, right, bottom = box
padding = 4
left = max(0, left - padding)
top = max(0, top - padding)
right = min(image.width, right + padding)
bottom = min(image.height, bottom + padding)
image.crop((left, top, right, bottom)).save(target, optimize=True)
print(f'{source} -> {target}: {image.size} -> {(right-left, bottom-top)}')
