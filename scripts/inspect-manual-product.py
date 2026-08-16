import json
from pathlib import Path

items = json.loads(Path('/home/ubuntu/product-catalog-site/scripts/kakobuy-full-products.json').read_text(encoding='utf-8'))
needle = 'High Quality Short Sleeve from Factory'
for item in items:
    if item.get('name') == needle:
        print(json.dumps({
            'id': item['id'],
            'sourceProductId': item.get('sourceProductId'),
            'price': item['price'],
            'category': item['category'],
            'subCategory': item['subCategory'],
            'images': item.get('images', [])[:5],
            'imageCount': len(item.get('images', [])),
            'sizes': item.get('sizes', [])[:10],
        }, ensure_ascii=False))
