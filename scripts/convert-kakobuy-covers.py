from __future__ import annotations

import json
import re
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path('/home/ubuntu/product-catalog-site')
DOWNLOAD_REPORT = ROOT / 'scripts/kakobuy-cover-download-report.json'
COVER_LIST = ROOT / 'scripts/kakobuy-cover-download-list.json'
SOURCE_DIR = Path('/home/ubuntu/webdev-static-assets/product-images')
OUTPUT_DIR = ROOT / 'client/public/product-images'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def canon(url: object) -> str:
    return re.sub(r'\?.*$', '', str(url or '').strip()).lower()

def main() -> None:
    report = json.loads(DOWNLOAD_REPORT.read_text(encoding='utf-8'))
    items = json.loads(COVER_LIST.read_text(encoding='utf-8'))['items']
    downloaded = {canon(item['url']): item for item in report['results'] if item.get('ok')}
    path_by_url = {}
    converted = 0
    failed = []
    for url, item in downloaded.items():
        source = Path(item['path'])
        target_name = f"{source.stem}_kakobuy.webp"
        target = OUTPUT_DIR / target_name
        try:
            with Image.open(source) as image:
                image = ImageOps.exif_transpose(image)
                image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                if image.mode == 'RGBA':
                    image.save(target, 'WEBP', quality=72, method=6)
                else:
                    image.convert('RGB').save(target, 'WEBP', quality=72, method=6)
            path_by_url[url] = f'/product-images/{target_name}'
            converted += 1
        except Exception as exc:
            failed.append({'url': url, 'error': str(exc)})
    updated = []
    for item in items:
        key = canon(item['url'])
        if key in path_by_url:
            item['local_path'] = path_by_url[key]
        updated.append(item)
    COVER_LIST.write_text(json.dumps({'generatedAt': '2026-08-16', 'products': len(updated), 'reused': sum(bool(item.get('local_path')) for item in updated), 'missing': sum(not bool(item.get('local_path')) for item in updated), 'items': updated}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'scripts/kakobuy-cover-conversion-report.json').write_text(json.dumps({'downloaded': len(downloaded), 'converted': converted, 'failed': failed, 'output_dir': str(OUTPUT_DIR)}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Downloaded: {len(downloaded)}; converted: {converted}; failed: {len(failed)}; total reusable covers: {sum(bool(item.get("local_path")) for item in updated)}')

if __name__ == '__main__':
    main()
