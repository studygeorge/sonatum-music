import re

with open('/root/.gemini/antigravity/brain/73b537cd-2b89-48a2-b941-c04d6f5c45a1/АККАУНТЫ_ПОДПИСКА.md', 'r') as f:
    lines = f.readlines()

for line in lines:
    line = line.strip()
    if re.match(r'^[A-Z0-9А-Я].*[A-ZА-Я]$', line) and len(line) < 80 and not '─' in line and not '│' in line and not '┌' in line and not '└' in line:
        print(line)
    elif re.match(r'^\d+\.\s+[A-ZА-Я]', line):
        print(line)
