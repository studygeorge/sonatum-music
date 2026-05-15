#!/usr/bin/env python3
"""
v2 — улучшенная подгрузка нот:
  1. Сначала пытаемся Mutopia (LilyPond — чистые типографские PDF, белый лист).
  2. Иначе Wikimedia Commons с фильтром:
     - blacklist: programmaboekje, manuscript, facsimile, holograph, historic
     - предпочитаем короткие имена файлов
  3. Удаляем старую запись SheetMusic + PDF, ставим новую.
"""
import io
import json
import os
import shutil
import subprocess
import time
import urllib.parse
import urllib.request
import zipfile
from typing import Optional

PDF_DIR = "/opt/sonatum/data/sheets/pdf"
WEB_PATH = "/sheets/pdf"
USER_AGENT = "SonatumBot/1.0 (https://sonatum-music.ru)"

# Чёрный список в имени файла (Commons) — чтобы избежать программок и факсимиле.
BLACK = ("programmaboekje", "programmboekje", "programma_boekje",
         "manuscript", "facsimile", "holograph", "autograph", "historic",
         "old print", "1800")

# Источники по приоритету.
WORKS = [
    {
        "track_id": "trk_3c726bdec53547cb9f2dfc52",
        "title": "Bach — Cello Suite No. 1 in G major, BWV 1007 — Prelude",
        "instrument": "Виолончель",
        "mutopia_zip": "https://www.mutopiaproject.org/ftp/BachJS/BWV1007/bwv1007/bwv1007-let-pdfs.zip",
        "commons_q": "Bach Cello Suite BWV 1007 score",
    },
    {
        "track_id": "trk_5f986f813eaf4f90b5753027",
        "title": "Bach — Cello Suite No. 1 in G major, BWV 1007 — Allemande",
        "instrument": "Виолончель",
        "mutopia_zip": "https://www.mutopiaproject.org/ftp/BachJS/BWV1007/bwv1007/bwv1007-let-pdfs.zip",
        "commons_q": "Bach Cello Suite BWV 1007 score",
    },
    {
        "track_id": "trk_2e70a623dd54406dbb1e199e",
        "title": "Beethoven — 32 Variations in C minor, WoO 80",
        "instrument": "Фортепиано",
        "mutopia_zip": None,  # WoO в Mutopia нет
        "commons_q": "Beethoven 32 Variations WoO 80",
    },
    {
        "track_id": "trk_b490e1767e6e4c1ea80b5673",
        "title": "Mozart — Eine kleine Nachtmusik, K. 525 — Allegro",
        "instrument": "Струнный квартет",
        "mutopia_zip": None,
        "commons_q": "Mozart Eine kleine Nachtmusik K 525 score",
    },
    {
        "track_id": "trk_5e3305b4f16b4f1ca698e524",
        "title": "Mozart — Piano Concerto No. 19 in F major, K. 459",
        "instrument": "Фортепиано с оркестром",
        "mutopia_zip": None,
        "commons_q": "Mozart Piano Concerto K 459 score",
    },
    {
        "track_id": "trk_ee086c8a10a547ecb8b6bd3a",
        "title": "Chopin — Scherzo No. 3 in C-sharp minor, Op. 39",
        "instrument": "Фортепиано",
        "mutopia_zip": None,
        "commons_q": "Chopin Scherzo Op 39 score",
    },
    {
        "track_id": "trk_c00b61bc4e624fc8a8c2d20c",
        "title": "Chopin — Waltz Op. 64 No. 1 (Minute Waltz)",
        "instrument": "Фортепиано",
        "mutopia_zip": "https://www.mutopiaproject.org/ftp/ChopinFF/O64/chop64-1/chop64-1-let-pdfs.zip",
        "commons_q": "Chopin Waltz Op 64 score",
    },
    {
        "track_id": "trk_c2f8361f04d24509acfcaede",
        "title": "Tchaikovsky — Symphony No. 4, Op. 36 — Finale",
        "instrument": "Симфонический оркестр",
        "mutopia_zip": None,
        "commons_q": "Tchaikovsky Symphony 4 Op 36 score",
    },
    {
        "track_id": "trk_002bf0e44a4f43da97fc796d",
        "title": "Tchaikovsky — Marche Slave, Op. 31",
        "instrument": "Симфонический оркестр",
        "mutopia_zip": None,
        "commons_q": "Tchaikovsky Marche Slave Op 31 score",
    },
    {
        "track_id": "trk_813ed36f29f64d108a5280bf",
        "title": "Rimsky-Korsakov — Flight of the Bumblebee",
        "instrument": "Фортепиано",
        "mutopia_zip": None,
        "commons_q": "Rimsky-Korsakov Flight Bumblebee piano score",
    },
]


def http_get(url, headers=None):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "*/*", **(headers or {})},
    )
    return urllib.request.urlopen(req, timeout=60)


def fetch_mutopia_pdf(zip_url: str) -> Optional[bytes]:
    """Скачивает Mutopia ZIP и возвращает первый PDF внутри."""
    try:
        with http_get(zip_url) as r:
            data = r.read()
        z = zipfile.ZipFile(io.BytesIO(data))
        pdfs = [n for n in z.namelist() if n.lower().endswith(".pdf")]
        if not pdfs:
            return None
        return z.read(pdfs[0])
    except Exception as e:
        print(f"    (mutopia err: {e})")
        return None


def commons_filtered_pdf(query: str) -> Optional[str]:
    """Ищет PDF на Commons, фильтрует чёрный список, возвращает имя файла."""
    enc = urllib.parse.quote(f"{query} filetype:pdf")
    url = (
        "https://commons.wikimedia.org/w/api.php?"
        f"action=query&format=json&list=search&srsearch={enc}"
        "&srnamespace=6&srlimit=10"
    )
    with http_get(url) as r:
        data = json.loads(r.read().decode("utf-8"))
    candidates = []
    for h in data.get("query", {}).get("search", []):
        t = h["title"]
        if not (t.startswith("File:") and t.lower().endswith(".pdf")):
            continue
        name = t[len("File:"):]
        low = name.lower()
        if any(b in low for b in BLACK):
            continue
        candidates.append(name)
    # предпочитаем короткие имена (часто это аккуратные названия)
    candidates.sort(key=len)
    return candidates[0] if candidates else None


def download_commons(filename: str) -> bytes:
    enc = urllib.parse.quote(filename.replace(" ", "_"))
    url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{enc}"
    with http_get(url) as r:
        return r.read()


def db_query(sql):
    out = subprocess.check_output(
        ["sudo", "-u", "postgres", "psql", "sonatum_music", "-t", "-A", "-F|", "-c", sql],
        text=True,
    )
    return [line.split("|") for line in out.strip().split("\n") if line.strip()]


def db_exec(sql):
    subprocess.check_call(
        ["sudo", "-u", "postgres", "psql", "sonatum_music", "-c", sql],
        stdout=subprocess.DEVNULL,
    )


def slug_safe(s):
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

    rows = db_query("SELECT id FROM users WHERE role IN ('ADMIN','SUPER_ADMIN') LIMIT 1;")
    if not rows:
        rows = db_query("SELECT id FROM users LIMIT 1;")
    uploader_id = rows[0][0]

    ok, fail = [], []

    for w in WORKS:
        print(f"\n[{w['title']}]")

        track_rows = db_query(f"SELECT \"artistId\" FROM tracks WHERE id='{w['track_id']}';")
        if not track_rows:
            print("  ⊘  трек не найден")
            continue
        artist_id = track_rows[0][0]

        # Удаляем старую SheetMusic + PDF (если был).
        old_rows = db_query(
            f"SELECT id, \"pdfUrl\" FROM sheet_music WHERE \"trackId\"='{w['track_id']}';"
        )
        for old_id, old_url in old_rows:
            old_path = os.path.join("/opt/sonatum/data", old_url.lstrip("/"))
            if os.path.exists(old_path):
                os.remove(old_path)
                print(f"  ⊖  удалил старый PDF: {old_path}")
            db_exec(f"DELETE FROM sheet_music WHERE id='{old_id}';")

        try:
            data = None
            source = None
            if w.get("mutopia_zip"):
                data = fetch_mutopia_pdf(w["mutopia_zip"])
                if data:
                    source = "mutopia (LilyPond)"

            if not data:
                fname = commons_filtered_pdf(w["commons_q"])
                if fname:
                    print(f"  →  Commons: {fname}")
                    data = download_commons(fname)
                    source = f"commons:{fname}"

            if not data:
                print("  ✗  ни Mutopia, ни Commons не дали ничего")
                fail.append(w["title"])
                continue

            slug = slug_safe(w["title"])
            out_path = os.path.join(PDF_DIR, f"{slug}.pdf")
            with open(out_path, "wb") as f:
                f.write(data)
            size_kb = len(data) // 1024
            print(f"  ✓  {source}, {size_kb} КБ → {out_path}")

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
            ok.append(w["title"])
            time.sleep(0.5)
        except Exception as e:
            print(f"  ✗  ошибка: {e}")
            fail.append(w["title"])

    print("\n=== ИТОГО ===")
    print(f"  обновлено: {len(ok)}")
    print(f"  ошибок:    {len(fail)}")
    if fail:
        for t in fail:
            print(f"  - {t}")


if __name__ == "__main__":
    main()
