import json
from pathlib import Path

report = json.loads(Path('scripts/title-audit-report.json').read_text(encoding='utf-8'))
for issue in report['examples']:
    if set(issue['flags']) & {'contact_residue', 'sku_like', 'code_only', 'truncated'}:
        print(f"{issue['id']}\t{issue['category']}/{issue['subCategory']}\t{issue['title']}\t{','.join(issue['flags'])}")
