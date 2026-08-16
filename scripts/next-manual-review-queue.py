import json
import re
from pathlib import Path

ROOT = Path('/home/ubuntu/product-catalog-site')
PRODUCTS_FILE = ROOT / 'scripts/kakobuy-full-products.json'
LOG_FILE = ROOT / 'scripts/manual-product-review-log.md'

def get_reviewed_ids():
    if not LOG_FILE.exists():
        return set()
    text = LOG_FILE.read_text(encoding='utf-8')
    return {value for value in re.findall(r"Source product ID:\s*`([^`]+)`", text)}

def main():
    items = json.loads(PRODUCTS_FILE.read_text(encoding='utf-8'))
    reviewed = get_reviewed_ids()
    seen = set()
    count = 0
    
    print(f"Total items: {len(items)}")
    print(f"Already reviewed unique sources: {len(reviewed)}")
    print("-" * 40)
    
    for item in items:
        pid = str(item.get('sourceProductId', ''))
        if not pid or pid in reviewed or pid in seen:
            continue
        
        seen.add(pid)
        
        # Focus on Clothing and Pants as requested
        if item.get('category') not in {'clothing', 'pants'}:
            continue
            
        images = item.get('images', [])
        img_str = ' | '.join(images[:3])
        print(f"ID: {item['id']} | SourcePID: {pid} | Cat: {item['category']}/{item['subCategory']} | Name: {item['name'][:60]} | Images: {img_str}")
        
        count += 1
        if count >= 10:
            break
            
    print("-" * 40)
    print(f"Next batch count: {count}")

if __name__ == '__main__':
    main()
