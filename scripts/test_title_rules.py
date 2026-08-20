import importlib.util
import re
from pathlib import Path

path = Path(__file__).with_name('generate-kakobuy-full-products.py')
spec = importlib.util.spec_from_file_location('title_generator', path)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)

cases = [
    ('*26-27', 'clothing', 'Shirts'),
    ('26-27 120', 'clothing', 'Shirts'),
    ('High-Quality Fashion', 'clothing', 'Shirts'),
    ('High-Quality Fashion Versatile Shoes', 'shoe', 'Sneakers'),
]
for title, category, subcategory in cases:
    info = {'title': title, 'title_original': title}
    matched = bool(re.fullmatch(r'[*]?\s*\d+\s*[-–]\s*\d+(?:\s+\d+)?(?:\s+[A-Z]{1,5})?', title, re.I))
    direct = module.finalize_display_title('High-Quality Shirt', category, subcategory)
    cleaned = module.clean_title(title, '')
    print(title, 'cleaned=', repr(cleaned), 'category=', category, 'subcategory=', subcategory, 'size_only=', matched, 'direct=', direct, '=>', module.optimize_display_title(info, category, subcategory, 'Product'))
