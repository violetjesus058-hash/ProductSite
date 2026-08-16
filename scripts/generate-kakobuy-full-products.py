from __future__ import annotations

import json
import re
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path('/home/ubuntu/product-catalog-site')
WORKBOOK = Path('/home/ubuntu/upload/pasted_file_drov2V_Kakobuy_SKU_数据表.xlsx')
DOWNLOAD_REPORT = ROOT / 'scripts/product-image-download-report.json'
COVER_LIST = ROOT / 'scripts/kakobuy-cover-download-list.json'
OUTPUT_JSON = ROOT / 'scripts/kakobuy-full-products.json'
OUTPUT_TS = ROOT / 'client/src/data/products.kakobuy-full.ts'


def money(value: object) -> str:
    try:
        return f'{Decimal(str(value)).quantize(Decimal("0.01"))}'
    except (InvalidOperation, TypeError, ValueError):
        return ''


def canon(url: object) -> str:
    return re.sub(r'\?.*$', '', str(url or '').strip()).lower()


def clean_title(value: str, fallback: str) -> str:
    value = re.sub(r'📏.*$', '', value)
    value = re.sub(r'whatsapp[:：]?\s*\+?\d+', '', value, flags=re.I)
    value = re.sub(r'pls add whatsapp.*$', '', value, flags=re.I)
    value = re.sub(r'\s+', ' ', value).strip(' -')
    return value or fallback


def main() -> None:
    old_download = json.loads(DOWNLOAD_REPORT.read_text(encoding='utf-8'))
    image_by_url = {}
    for item in old_download.get('results', []):
        if item.get('ok') and item.get('url') and item.get('path'):
            stem = Path(item['path']).stem
            candidates = sorted((ROOT / 'client/public/product-images').glob(f'{stem}_*.webp'))
            if candidates:
                image_by_url[canon(item['url'])] = f'/product-images/{candidates[0].name}'
    cover_data = json.loads(COVER_LIST.read_text(encoding='utf-8'))
    cover_by_product = {str(item['product_id']): item.get('local_path') for item in cover_data['items'] if item.get('local_path')}

    wb = load_workbook(WORKBOOK, read_only=True, data_only=True)
    products = {}
    sku_rows = defaultdict(list)
    image_rows = defaultdict(list)
    for ws in wb.worksheets:
        rows = ws.iter_rows(values_only=True)
        try:
            header_values = next(rows)
        except StopIteration:
            continue
        headers = [str(v).strip() if v is not None else '' for v in header_values]
        index = {name: i for i, name in enumerate(headers)}
        for values in rows:
            def get(name: str):
                i = index.get(name)
                return values[i] if i is not None and i < len(values) else None
            pid = get('product_id')
            if pid is None:
                continue
            pid = str(pid).strip()
            if ws.title == 'products':
                raw_title = str(get('title_en_platform') or get('title_original') or '').strip()
                products[pid] = {
                    'title': clean_title(raw_title, f'Kakobuy Product {pid}'),
                    'source_url': str(get('source_url') or '').strip(),
                    'platform_url': str(get('primary_platform_url') or '').strip(),
                    'category': str(get('category') or 'Unclassified').strip(),
                    'subcategory': str(get('subcategory') or '').strip(),
                    'seller': str(get('seller_name') or 'Kakobuy').strip(),
                    'collected_at': str(get('collected_at') or '').strip(),
                }
            elif ws.title == 'sku_records':
                sku_rows[pid].append({
                    'sku_id': str(get('sku_id') or '').strip(),
                    'variant': str(get('variant_label') or '').strip(),
                    'price_usd': money(get('price_usd')),
                    'price_rmb': money(get('price_rmb')),
                    'stock': str(get('stock_status') or get('status') or '').strip(),
                    'platform_url': str(get('platform_url') or '').strip(),
                    'checked_at': str(get('price_checked_at') or '').strip(),
                    'title': clean_title(str(get('title_en_platform') or get('title_original') or '').strip(), ''),
                    'category': str(get('category') or '').strip(),
                    'subcategory': str(get('subcategory') or '').strip(),
                })
            elif ws.title == 'product_images':
                image_rows[pid].append({'url': str(get('image_url') or '').strip(), 'order': get('image_order') or 999})

    category_map = {'Clothing': 'clothing', 'Shoes': 'shoe', 'Pants': 'pants', 'Accessories': 'ACC', 'Watches': 'watches'}
    grouped = []
    for pid, rows in sku_rows.items():
        info = products.get(pid, {})
        fallback_row = next((row for row in rows if row.get('title')), {})
        if not info:
            info = {'title': fallback_row.get('title') or f'Kakobuy Product {pid}', 'category': fallback_row.get('category') or 'Unclassified', 'subcategory': fallback_row.get('subcategory') or '', 'seller': 'Kakobuy', 'source_url': '', 'platform_url': '', 'collected_at': ''}
        elif not info.get('title') or info.get('title') == f'Kakobuy Product {pid}':
            info['title'] = fallback_row.get('title') or info.get('title')
        prices = sorted({row['price_usd'] for row in rows if row['price_usd']})
        for price in prices:
            selected = [row for row in rows if row['price_usd'] == price]
            images = []
            if cover_by_product.get(pid):
                images.append(cover_by_product[pid])
            for image in sorted(image_rows.get(pid, []), key=lambda x: x['order']):
                local = image_by_url.get(canon(image['url']))
                if local and local not in images:
                    images.append(local)
            platform_url = next((row['platform_url'] for row in selected if row['platform_url']), info.get('platform_url', ''))
            collected_at = next((row['checked_at'] for row in selected if row['checked_at']), info.get('collected_at', ''))
            if not images:
                continue
            grouped.append({
                'id': f'kb-{pid}-{price.replace(".", "-")}',
                'sourceProductId': pid,
                'name': info.get('title', f'Kakobuy Product {pid}'),
                'catalogName': info.get('title', f'Kakobuy Product {pid}'),
                'category': category_map.get(info.get('category'), 'ACC'),
                'subCategory': info.get('subcategory') or 'Selection',
                'brand': 'Unbranded',
                'price': float(price),
                'referencePrice': float(price),
                'currency': 'USD',
                'description': 'Product details are based on the latest Kakobuy catalog capture.',
                'sizes': sorted({row['variant'] for row in selected if row['variant']}),
                'colors': [],
                'stock': 'In stock' if any('available' in row['stock'].lower() for row in selected) else 'Check availability',
                'shop': info.get('seller') or 'Kakobuy',
                'shopUrl': info.get('source_url', ''),
                'url': platform_url,
                'images': images[:16],
                'tags': [value for value in ['kakobuy', info.get('subcategory', ''), info.get('category', '')] if value],
                'collectedAt': collected_at,
                'sourceSkuIds': [row['sku_id'] for row in selected if row['sku_id']],
                'priceRmb': next((float(row['price_rmb']) for row in selected if row['price_rmb']), None),
                'priceCheckedAt': collected_at,
            })

    grouped.sort(key=lambda item: (item['category'], item['catalogName'].lower(), item['price'], item['id']))
    OUTPUT_JSON.write_text(json.dumps(grouped, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    header = 'export type Product = { id: string; name: string; catalogName: string; category: string; subCategory: string; brand: string; price: number; referencePrice: number | null; currency: string; description: string; sizes: string[]; colors: string[]; stock: string; shop: string; shopUrl: string; url: string; images: string[]; tags: string[]; collectedAt: string; sourceProductId?: string; sourceSkuIds?: string[]; priceRmb?: number | null; priceCheckedAt?: string }\n'
    body = 'export const products: Product[] = ' + json.dumps(grouped, ensure_ascii=False, indent=2) + ' as Product[];\n'
    footer = 'export const categoryLabels: Record<string, string> = { clothing: "Clothing", shoe: "Shoes", pants: "Pants", ACC: "Accessories", watches: "Watches" };\nexport const categoryOrder = ["all", "clothing", "shoe", "pants", "ACC", "watches"];\n'
    OUTPUT_TS.write_text(header + body + footer, encoding='utf-8')
    print(f'Generated {len(grouped)} grouped Kakobuy products with local images; unique source products: {len(sku_rows)}')

if __name__ == '__main__':
    main()
