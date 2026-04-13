"""
audit_catches.py
Run from inside the CustomCatches folder.
Checks every SpritePath has a matching image file in the same folder.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent

with open(HERE / "CustomCatches.txt", encoding='utf-8-sig') as f:
    custom = json.load(f)

existing = {f.name for f in HERE.iterdir() if f.is_file()}

missing = []
found   = []

for name, data in custom.items():
    sprite = data.get('SpritePath', '')
    if not sprite:
        missing.append((name, '(no SpritePath)'))
        continue
    if sprite in existing:
        found.append((name, sprite))
    else:
        missing.append((name, sprite))

print(f"FOUND:   {len(found)}")
print(f"MISSING: {len(missing)}")

if missing:
    print("\nMISSING FILES:")
    for name, expected in missing:
        print(f"  [{name}] -> {expected}")

input("\nPress Enter to close...")
