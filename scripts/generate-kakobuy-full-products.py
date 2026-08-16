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


CATEGORY_PATTERNS = {
    'shoe': r'\b(shoes?|sneakers?|boots?|slides?|sandals?|loafers?|mules?|running shoes?)\b',
    'watches': r'\b(watch(?:es)?|smart watch(?:es)?|mechanical watch(?:es)?|腕表|手表)\b',
    'fragrance': r'\b(perfumes?|fragrances?|colognes?|parfum|香水)\b',
    'bags': r'\b(bags?|backpacks?|totes?|shoulder bags?|crossbody|handbags?|pouches?)\b',
    'wallets': r'\b(wallets?|card holders?|cardholder|keychains?|零钱包|钱包)\b',
    'pants': r'\b(pants|trousers|jeans|shorts|joggers|sweatpants|leggings|denim|cargo|bottoms|长裤|短裤|牛仔裤|休闲裤|运动裤)\b',
    'clothing': r'\b(shirts?|t-?shirts?|tees?|short sleeve|short-sleeve|hoodies?|jackets?|coats?|sweaters?|sweatshirts?|jerseys?|sportswear|tracksuits?|dresses?|skirts?|vests?|tops?|clothing|衬衫|卫衣|夹克|外套|毛衣|短袖|长袖|裙)\b',
    'accessories': r'\b(caps?|hats?|belts?|glasses|sunglasses|scarves?|ties?|bracelets?|rings?|necklaces?|earrings?|headphones?|phone cases?|accessor)\b',
}
BRAND_PATTERNS = [('Louis Vuitton', r'\b(louis\s*vuitton|lv)\b'), ('Stone Island', r'\bstone\s*island\b'), ('Ralph Lauren', r'\bralph\s*lauren\b'), ('Nike', r'\bnike\b'), ('Adidas', r'\badidas\b'), ('Puma', r'\bpuma\b'), ('Balenciaga', r'\bbalenciaga\b'), ('Dior', r'\bdior\b'), ('Moncler', r'\bmoncler\b'), ('The North Face', r'\bthe\s*north\s*face\b'), ('New Balance', r'\bnew\s*balance\b'), ('Gucci', r'\bgucci\b'), ('Prada', r'\bprada\b'), ('Supreme', r'\bsupreme\b')]
MANUAL_OVERRIDES = {
    '7543307459': {'category': 'clothing', 'subCategory': 'Shirts', 'primary_image_index': 2, 'review_note': 'Manual review: use third gallery image as catalog cover.'},
    '7601623089': {'category': 'clothing', 'subCategory': 'Hoodies', 'review_note': 'Manual review: cover image shows two hooded zip-up sweatshirts.'},
    '7603560398': {'category': 'clothing', 'subCategory': 'Hoodies', 'review_note': 'Manual review: cover image shows three hooded sweatshirts.'},
    '7578517746': {'category': 'clothing', 'subCategory': 'Jackets', 'review_note': 'Manual review: cover image shows a padded jacket; retain body-weight size labels.'},
}

def classify_product(info: dict) -> str:
    title_text = f"{info.get('title', '')} {info.get('subcategory', '')}".lower()
    text = f"{title_text} {info.get('category', '')}".lower()
    if re.search(CATEGORY_PATTERNS['shoe'], title_text, re.I): return 'shoe'
    if re.search(CATEGORY_PATTERNS['watches'], title_text, re.I): return 'watches'
    if re.search(CATEGORY_PATTERNS['fragrance'], title_text, re.I): return 'fragrance'
    if re.search(CATEGORY_PATTERNS['bags'], title_text, re.I): return 'bags'
    if re.search(CATEGORY_PATTERNS['wallets'], title_text, re.I): return 'ACC'
    has_pants = bool(re.search(CATEGORY_PATTERNS['pants'], title_text, re.I))
    has_clothing = bool(re.search(CATEGORY_PATTERNS['clothing'], title_text, re.I))
    mixed_set = bool(re.search(r'\b(set|outfit|collection)\b', title_text, re.I))
    if has_pants and not (has_clothing and mixed_set): return 'pants'
    if has_clothing or info.get('category') == 'Clothing': return 'clothing'
    if re.search(CATEGORY_PATTERNS['accessories'], title_text, re.I) or info.get('category') == 'Accessories': return 'ACC'
    return 'ACC'

def subcategory_for(category: str, info: dict) -> str:
    text = f"{info.get('title', '')} {info.get('subcategory', '')}".lower()
    rules = {'pants': [('Jeans', r'jeans|denim'), ('Shorts', r'shorts'), ('Sweatpants', r'joggers|sweatpants|track pants'), ('Trousers', r'pants|trousers|cargo')], 'clothing': [('Hoodies', r'hoodies?|sweatshirts?'), ('Jackets', r'jackets?|coats?|outerwear'), ('Sweaters', r'sweaters?|knitwear'), ('Shirts', r'shirts?|tees?|t-?shirts?|jerseys?'), ('Dresses', r'dresses?|skirts?')], 'shoe': [('Sneakers', r'sneakers?|running shoes?'), ('Boots', r'boots?'), ('Sandals', r'sandals?|slides?')], 'bags': [('Backpacks', r'backpacks?'), ('Shoulder Bags', r'shoulder bags?|crossbody|handbags?')], 'fragrance': [('Perfume', r'perfumes?|fragrances?|colognes?|parfum')], 'watches': [('Watches', r'watch(?:es)?|腕表|手表')]}
    for label, pattern in rules.get(category, []):
        if re.search(pattern, text, re.I): return label
    return info.get('subcategory') if info.get('subcategory') and info.get('subcategory').lower() != 'unspecified' else 'Selection'

def brand_for(info: dict) -> str:
    text = f"{info.get('title', '')} {info.get('subcategory', '')}"
    for label, pattern in BRAND_PATTERNS:
        if re.search(pattern, text, re.I): return label
    return 'Unbranded'

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
            override = MANUAL_OVERRIDES.get(pid, {})
            display_images = images[:16]
            primary_index = override.get('primary_image_index')
            if isinstance(primary_index, int) and 0 <= primary_index < len(display_images):
                display_images = [display_images[primary_index]] + [image for index, image in enumerate(display_images) if index != primary_index]
            inferred_category = classify_product(info)
            inferred_subcategory = subcategory_for(inferred_category, info)
            grouped.append({
                'id': f'kb-{pid}-{price.replace(".", "-")}',
                'sourceProductId': pid,
                'name': info.get('title', f'Kakobuy Product {pid}'),
                'catalogName': info.get('title', f'Kakobuy Product {pid}'),
                'category': override.get('category') or inferred_category,
                'subCategory': override.get('subCategory') or inferred_subcategory,
                'brand': brand_for(info),
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
                'images': display_images,
                'tags': [value for value in ['kakobuy', subcategory_for(classify_product(info), info), classify_product(info)] if value],
                'collectedAt': collected_at,
                'sourceSkuIds': [row['sku_id'] for row in selected if row['sku_id']],
                'priceRmb': next((float(row['price_rmb']) for row in selected if row['price_rmb']), None),
                'priceCheckedAt': collected_at,
            })

    grouped.sort(key=lambda item: (item['category'], item['catalogName'].lower(), item['price'], item['id']))
    OUTPUT_JSON.write_text(json.dumps(grouped, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    header = 'export type Product = { id: string; name: string; catalogName: string; category: string; subCategory: string; brand: string; price: number; referencePrice: number | null; currency: string; description: string; sizes: string[]; colors: string[]; stock: string; shop: string; shopUrl: string; url: string; images: string[]; tags: string[]; collectedAt: string; sourceProductId?: string; sourceSkuIds?: string[]; priceRmb?: number | null; priceCheckedAt?: string }\n'
    body = 'export const products: Product[] = ' + json.dumps(grouped, ensure_ascii=False, indent=2) + ' as Product[];\n'
    footer = 'export const categoryLabels: Record<string, string> = { clothing: "Clothing", shoe: "Shoes", pants: "Pants", bags: "Bags", fragrance: "Fragrance", ACC: "Accessories", watches: "Watches" };\nexport const categoryOrder = ["all", "clothing", "pants", "shoe", "bags", "fragrance", "watches", "ACC"];\n'
    OUTPUT_TS.write_text(header + body + footer, encoding='utf-8')
    print(f'Generated {len(grouped)} grouped Kakobuy products with local images; unique source products: {len(sku_rows)}')

if __name__ == '__main__':
    main()
