import os

files = [
    'ГЛАВНАЯ_ПЛЕЙЛИСТЫ_МУЗЫКА.md', 
    'КАРТА.md', 
    'МУЗЫКА.md', 
    'НАПОЛНЕНИЕ.md', 
    'НОТНЫЙ_АРХИВ.md', 
    'ОБЩЕЕ.md', 
    'подвал_сайта(где-то_должно_быть).md'
]

for f in files:
    path = os.path.join('/root/.gemini/antigravity/brain/73b537cd-2b89-48a2-b941-c04d6f5c45a1', f)
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
        print(f'\n--- {f} (Length: {len(content)}) ---')
        print(content[:1500])
