from pathlib import Path
import json

root = Path('/home/ubuntu/product-catalog-site')
sample = json.loads((root / 'scripts/kakobuy-sample-products.json').read_text(encoding='utf-8'))
header = 'export type Product = { id: string; name: string; catalogName: string; category: string; subCategory: string; brand: string; price: number; referencePrice: number | null; currency: string; description: string; sizes: string[]; colors: string[]; stock: string; shop: string; shopUrl: string; url: string; images: string[]; tags: string[]; collectedAt: string; sourceProductId?: string; sourceSkuIds?: string[]; priceRmb?: number | null; priceCheckedAt?: string }\n'
body = 'export const products: Product[] = ' + json.dumps(sample, ensure_ascii=False, indent=2) + ' as Product[];\n'
footer = 'export const categoryLabels: Record<string, string> = { clothing: "Clothing", shoe: "Shoes", pants: "Pants", ACC: "Accessories", watches: "Watches" };\nexport const categoryOrder = ["all", "clothing", "shoe", "pants", "ACC", "watches"];\n'
(root / 'client/src/data/products.kakobuy-sample.ts').write_text(header + body + footer, encoding='utf-8')
print('Wrote products.kakobuy-sample.ts')
