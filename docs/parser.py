import os
import zipfile
import xml.etree.ElementTree as ET

source_dir = '/home/sonatum-music'
dest_dir = '/root/.gemini/antigravity/brain/73b537cd-2b89-48a2-b941-c04d6f5c45a1'

for file in os.listdir(source_dir):
    if file.endswith('.docx'):
        docx_path = os.path.join(source_dir, file)
        md_name = file.replace('.docx', '.md').replace(' ', '_').replace('+', '_')
        dest_path = os.path.join(dest_dir, md_name)
        try:
            with zipfile.ZipFile(docx_path) as docx:
                xml_content = docx.read('word/document.xml')
                tree = ET.fromstring(xml_content)
                ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                texts = []
                for p in tree.findall('.//w:p', ns):
                    line = ''.join([t.text for t in p.findall('.//w:t', ns) if t.text])
                    if line:
                        texts.append(line)
                with open(dest_path, 'w', encoding='utf-8') as out:
                    out.write('\n\n'.join(texts))
            print(f'Extracted {file} to {md_name}')
        except Exception as e:
            print(f'Failed {file}: {e}')
