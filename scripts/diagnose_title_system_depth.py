import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path('/home/ubuntu/product-catalog-site')
source = (ROOT / 'client/src/data/products.ts').read_text(encoding='utf-8')
start = source.index('export const products: Product[] = ') + len('export const products: Product[] = ')
end = source.index('] as Product[];', start) + 1
products = json.loads(source[start:end])

style_words = ['Essential', 'Streetwear', 'Vintage', 'Retro', 'Minimalist', 'Casual', 'Everyday', 'Warm-Weather', 'Layering', 'Relaxed Fit', 'Classic', 'Daily Carry', 'Performance']
generic_words = ['Essential Apparel', 'Everyday Apparel', 'Essential Accessory', 'Everyday Accessory', 'Daily Essential', 'Everyday Pants', 'Everyday Clothing', 'Classic Clothing']
feature_words = ['Oversized', 'Graphic', 'Zip-Up', 'Pullover', 'Cargo', 'Wide-Leg', 'Relaxed', 'Slim', 'Low-Top', 'High-Top', 'Crossbody', 'Football', 'Baseball', 'Basketball', 'Running', 'Jeans', 'Trousers', 'Sweatpants', 'Shorts', 'Hoodie', 'Jacket', 'Shirt', 'T-Shirt', 'Sneakers', 'Jersey', 'Bag', 'Watch', 'Fragrance', 'Wallet', 'Cap']
code_re = re.compile(r'\b(?:[A-Z]{1,5}\d{2,}|\d{3,}[A-Z]{1,}|[A-Z0-9]{6,})\b')

by_cat = defaultdict(list)
for p in products:
    by_cat[p.get('category', 'Unknown')].append(p)

titles = [p.get('catalogName') or p.get('name') or '' for p in products]
counts = Counter(titles)
result = {
    'totalProducts': len(products),
    'uniqueTitles': len(counts),
    'uniqueTitleRate': round(len(counts) / len(products), 4),
    'duplicateTitleProducts': sum(n for n in counts.values() if n > 1),
    'duplicateTitleClusters': sum(1 for n in counts.values() if n > 1),
    'genericTitleProducts': sum(any(g.lower() in t.lower() for g in generic_words) for t in titles),
    'styleWordProducts': sum(any(w.lower() in t.lower() for w in style_words) for t in titles),
    'featureWordProducts': sum(any(w.lower() in t.lower() for w in feature_words) for t in titles),
    'codeLikeTitles': sum(bool(code_re.search(t)) for t in titles),
    'averageTitleLength': round(sum(len(t) for t in titles) / len(titles), 2),
    'maxTitleLength': max(map(len, titles)),
    'topTitles': counts.most_common(30),
    'categories': {},
}

for category, rows in sorted(by_cat.items()):
    cat_titles = [p.get('catalogName') or p.get('name') or '' for p in rows]
    cat_counts = Counter(cat_titles)
    source_feature_counts = Counter()
    title_feature_counts = Counter()
    for p, title in zip(rows, cat_titles):
        for field in ['brand', 'colors', 'sizes', 'subCategory', 'tags']:
            value = p.get(field)
            if value and (not isinstance(value, list) or any(str(x).strip() for x in value)):
                source_feature_counts[field] += 1
        for word in feature_words:
            if word.lower() in title.lower():
                title_feature_counts[word] += 1
    result['categories'][category] = {
        'products': len(rows),
        'uniqueTitles': len(cat_counts),
        'uniqueRate': round(len(cat_counts) / len(rows), 4),
        'generic': sum(any(g.lower() in t.lower() for g in generic_words) for t in cat_titles),
        'styleWord': sum(any(w.lower() in t.lower() for w in style_words) for t in cat_titles),
        'featureWord': sum(any(w.lower() in t.lower() for w in feature_words) for t in cat_titles),
        'sourceFeatureAvailability': dict(source_feature_counts),
        'titleFeatureUsage': dict(title_feature_counts),
        'topTitles': cat_counts.most_common(8),
    }

(ROOT / 'scripts/title-system-diagnosis.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: result[k] for k in ['totalProducts','uniqueTitles','uniqueTitleRate','duplicateTitleProducts','duplicateTitleClusters','genericTitleProducts','styleWordProducts','featureWordProducts','codeLikeTitles','averageTitleLength','maxTitleLength']}, ensure_ascii=False))
for category, data in result['categories'].items():
    print(category, data['products'], data['uniqueRate'], data['generic'], data['featureWord'], data['topTitles'][:3])
