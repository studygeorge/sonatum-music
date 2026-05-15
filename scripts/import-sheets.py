#!/usr/bin/env python3
"""
Привязывает реальные ноты PDF (Wikimedia Commons, public domain) к существующим
треком классики в БД sonatum_music.

Запуск на сервере:
  python3 /opt/sonatum/scripts/import-sheets.py
"""
import json
import os
import subprocess
import time
import urllib.parse
import urllib.request
from typing import Optional

PDF_DIR = "/opt/sonatum/data/sheets/pdf"
WEB_PATH = "/sheets/pdf"
USER_AGENT = "SonatumBot/1.0 (https://sonatum-music.ru)"

# Связка трек ↔ инструмент ↔ поисковый запрос для Commons.
WORKS = [
    {
        "track_id": "trk_3c726bdec53547cb9f2dfc52",
        "title": "Bach — Cello Suite No. 1 in G major, BWV 1007 — Prelude",
        "instrument": "Виолончель",
        "query": "Bach Cello Suites BWV 1007",
    },
    {
        "track_id": "trk_5f986f813eaf4f90b5753027",
        "title": "Bach — Cello Suite No. 1 in G major, BWV 1007 — Allemande",
        "instrument": "Виолончель",
        "query": "Bach Cello Suites BWV 1007",
    },
    {
        "track_id": "trk_2e70a623dd54406dbb1e199e",
        "title": "Beethoven — 32 Variations in C minor, WoO 80",
        "instrument": "Фортепиано",
        "query": "Beethoven 32 Variations C minor WoO 80",
    },
    {
        "track_id": "trk_b490e1767e6e4c1ea80b5673",
        "title": "Mozart — Eine kleine Nachtmusik, K. 525 — Allegro",
        "instrument": "Струнный квартет",
        "query": "Mozart Eine kleine Nachtmusik K 525",
    },
    {
        "track_id": "trk_5e3305b4f16b4f1ca698e524",
        "title": "Mozart — Piano Concerto No. 19 in F major, K. 459 — Allegro Assai",
        "instrument": "Фортепиано с оркестром",
        "query": "Mozart Piano Concerto K 459",
    },
    {
        "track_id": "trk_ee086c8a10a547ecb8b6bd3a",
        "title": "Chopin — Scherzo No. 3 in C-sharp minor, Op. 39",
        "instrument": "Фортепиано",
        "query": "Chopin Scherzo Op 39",
    },
    {
        "track_id": "trk_c00b61bc4e624fc8a8c2d20c",
        "title": "Chopin — Waltz Op. 64 No. 1 (Minute Waltz)",
        "instrument": "Фортепиано",
        "query": "Chopin Waltz Op 64 minute",
    },
    {
        "track_id": "trk_c2f8361f04d24509acfcaede",
        "title": "Tchaikovsky — Symphony No. 4, Op. 36 — Finale",
        "instrument": "Симфонический оркестр",
        "query": "Tchaikovsky Symphony No 4 Op 36",
    },
    {
        "track_id": "trk_002bf0e44a4f43da97fc796d",
        "title": "Tchaikovsky — Marche Slave, Op. 31",
        "instrument": "Симфонический оркестр",
        "query": "Tchaikovsky Marche Slave Op 31",
    },
    {
        "track_id": "trk_813ed36f29f64d108a5280bf",
        "title": "Rimsky-Korsakov — Flight of the Bumblebee",
        "instrument": "Фортепиано",
        "query": "Rimsky Korsakov Flight Bumblebee",
    },
]


def http_get(url, headers=None, allow_redirects=True):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            **(headers or {}),
        },
    )
    return urllib.request.urlopen(req, timeout=45)


def commons_search_pdf(query: str) -> Optional[str]:
    """Возвращает имя файла на Commons (без префикса 'File:') или None."""
    enc = urllib.parse.quote(f"{query} filetype:pdf")
    url = (
        "https://commons.wikimedia.org/w/api.php?"
        f"action=query&format=json&list=search&srsearch={enc}"
        "&srnamespace=6&srlimit=10"
    )
    with http_get(url) as r:
        data = json.loads(r.read().decode("utf-8"))
    hits = data.get("query", {}).get("search", [])
    for h in hits:
        title = h["title"]  # 'File:Foo.pdf'
        if title.startswith("File:") and title.lower().endswith(".pdf"):
            return title[len("File:"):]
    return None


def download_commons(filename: str, out_path: str) -> int:
    """Скачивает файл с Commons через Special:FilePath. Возвращает размер в байтах."""
    enc = urllib.parse.quote(filename.replace(" ", "_"))
    url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{enc}"
    with http_get(url) as r, open(out_path, "wb") as f:
        size = 0
        while True:
            chunk = r.read(64 * 1024)
            if not chunk:
                break
            f.write(chunk)
            size += len(chunk)
    return size


def db_query(sql: str):
    out = subprocess.check_output(
        ["sudo", "-u", "postgres", "psql", "sonatum_music", "-t", "-A", "-F|", "-c", sql],
        text=True,
    )
    return [line.split("|") for line in out.strip().split("\n") if line.strip()]


def db_exec(sql: str):
    subprocess.check_call(
        ["sudo", "-u", "postgres", "psql", "sonatum_music", "-c", sql],
        stdout=subprocess.DEVNULL,
    )


def slug_safe(s: str) -> str:
    out = []
    for c in s.lower():
        if c.isalnum():
            out.append(c)
        elif c in " -_":
            out.append("-")
    res = "".join(out)
    while "--" in res:
        res = res.replace("--", "-")
    return res.strip("-")[:80]


def main():
    os.makedirs(PDF_DIR, exist_ok=True)

    # Возьмём id первого ADMIN-юзера для uploaderId
    admin_rows = db_query("SELECT id FROM users WHERE role IN ('ADMIN','SUPER_ADMIN') LIMIT 1;")
    if not admin_rows:
        admin_rows = db_query("SELECT id FROM users LIMIT 1;")
    uploader_id = admin_rows[0][0]
    print(f"uploaderId = {uploader_id}")

    ok, fail = [], []

    for w in WORKS:
        print(f"\n[{w['title']}]")
        # Проверяем, что трек ещё без нот.
        rows = db_query(
            f"SELECT t.id, t.\"artistId\" FROM tracks t WHERE t.id = '{w['track_id']}' "
            f"AND NOT EXISTS (SELECT 1 FROM sheet_music sm WHERE sm.\"trackId\" = t.id);"
        )
        if not rows:
            print("  ⊘  трек уже с нотами или не найден — skip")
            continue
        artist_id = rows[0][1]

        try:
            fname = commons_search_pdf(w["query"])
            if not fname:
                print("  ✗  Commons: PDF не найден")
                fail.append(w["title"])
                continue
            print(f"  →  {fname}")

            slug = slug_safe(w["title"])
            out_path = os.path.join(PDF_DIR, f"{slug}.pdf")
            size = download_commons(fname, out_path)
            print(f"  ✓  скачано {size // 1024} КБ → {out_path}")

            if size < 5_000:
                print("  ✗  файл подозрительно мал — skip")
                os.remove(out_path)
                fail.append(w["title"])
                continue

            # INSERT SheetMusic
            sm_id = "sm_" + os.urandom(12).hex()
            web_path = f"{WEB_PATH}/{slug}.pdf"
            esc_title = w["title"].replace("'", "''")
            esc_instr = w["instrument"].replace("'", "''")
            db_exec(f"""
                INSERT INTO sheet_music
                  (id, "trackId", title, "composerId", "pdfUrl", instrument,
                   difficulty, "isPublicDomain", "verifyStatus",
                   "uploaderId", "createdAt", "updatedAt")
                VALUES
                  ('{sm_id}', '{w['track_id']}', '{esc_title}', '{artist_id}',
                   '{web_path}', '{esc_instr}',
                   'INTERMEDIATE', true, 'APPROVED',
                   '{uploader_id}', now(), now());
            """)
            print(f"  ✓  SheetMusic id={sm_id}")
            ok.append(w["title"])
            time.sleep(0.5)
        except Exception as e:
            print(f"  ✗  ошибка: {e}")
            fail.append(w["title"])

    print("\n=== ИТОГО ===")
    print(f"  добавлено: {len(ok)}")
    print(f"  ошибок:    {len(fail)}")
    if fail:
        print("\nОшибки:")
        for t in fail:
            print(f"  - {t}")


if __name__ == "__main__":
    main()
