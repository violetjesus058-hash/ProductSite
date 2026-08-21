from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/upload/pasted_file_8T651i_image.png')
out_dir = Path('/home/ubuntu/webdev-static-assets')
out_dir.mkdir(parents=True, exist_ok=True)

original = Image.open(source).convert('RGBA')
# Preserve the user-provided wordmark exactly for the website brand lockup.
original.save(out_dir / 'rivora-wordmark.png', optimize=True)

# Crop the geometric emblem above the wordmark for a compact favicon/icon.
icon = original.crop((62, 8, 216, 153))
canvas = Image.new('RGBA', (512, 512), (255, 255, 255, 0))
icon.thumbnail((448, 448), Image.Resampling.LANCZOS)
canvas.alpha_composite(icon, ((512 - icon.width) // 2, (512 - icon.height) // 2))
canvas.save(out_dir / 'rivora-icon.png', optimize=True)

for path in (out_dir / 'rivora-wordmark.png', out_dir / 'rivora-icon.png'):
    print(f'{path} {path.stat().st_size} bytes')
