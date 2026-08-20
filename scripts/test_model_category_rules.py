import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('generator', Path('scripts/generate-kakobuy-full-products.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
for title, category, sub in [('A74 Jacket','clothing','Jackets'),('KJ9216 Pants','pants','Jeans'),('CK3518 Pants','clothing','Selection'),('N5239 Pants','pants','Pants')]:
    print(title, '=>', module.optimize_display_title({'title': title, 'title_original': title}, category, sub, 'Fallback Product'))
