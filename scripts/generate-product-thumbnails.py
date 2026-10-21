#!/usr/bin/env python3
"""Generate responsive product-card thumbnails without changing original assets."""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "client/public/product-images"
SIZES = (320, 640)
QUALITY = 78


def make_thumbnail(source: Path, output: Path, size: int, force: bool) -> bool:
    if output.exists() and not force and output.stat().st_mtime >= source.stat().st_mtime:
        return False
    output.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        image.save(output, "WEBP", quality=QUALITY, method=6)
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    sources = sorted(p for p in SOURCE_DIR.iterdir() if p.is_file() and p.suffix.lower() == ".webp")
    created = 0
    failed = 0
    for index, source in enumerate(sources, 1):
        for size in SIZES:
            output = SOURCE_DIR / f"thumb-{size}" / source.name
            try:
                created += int(make_thumbnail(source, output, size, args.force))
            except Exception as exc:
                failed += 1
                print(f"Failed: {source.name} ({exc})")
        if index % 250 == 0 or index == len(sources):
            print(f"Processed {index}/{len(sources)} source images")
    print(f"Generated {created} thumbnails; failures: {failed}")


if __name__ == "__main__":
    main()
