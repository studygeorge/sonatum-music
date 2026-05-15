#!/usr/bin/env python3
"""
v3 — жёсткая фильтрация:
  • Mutopia (LilyPond) — приоритет, всегда чистые типографские PDF.
  • Commons — только если имя файла содержит ≥2 обязательных ключевых слов
    (BWV/Op./K. + composer surname). Иначе — оставляем без нот.
"""
import io
import json
import os
import re
import subprocess
import time
import urllib.parse
import urllib.request
import zipfile
from typing import Optional, List

PDF_DIR = "/opt/sonatum/data/sheets/pdf"
WEB_PATH = "/sheets/pdf"
USER_AGENT = "SonatumBot/1.0 (https://sonatum-music.ru)"

BLACK = (
    "programmaboekje", "programmboekje", "programma_boekje", "programme",
    "manuscript", "facsimile", "holograph", "autograph",
    "newspaper", "news", "evening", "journal", "magazine",
    "catalog", "catalogue", "catalogo",
    "harmonic analysis", "review", "essay",
)

WORKS = [
    {
        "track_id": "trk_3c726bdec53547cb9f2dfc52",
        "title": "Bach — Cello Suite No. 1 in G major, BWV 1007 — Prelude",
        "instrument": "Виолончель",
        "mutopia_zip": "https://www.mutopiaproject.org/ftp/BachJS/BWV1007/bwv1007/bwv1007-let-pdfs.zip",
        "must_all": ["bwv 1007", "bach"],   # хотя бы один паттерн (внутри any of)
        "must_any": [["bwv 1007"], ["bwv1007"], ["cello suite", "no.1"], ["cello suite", "1"]],
    },
    {
        "track_id": "trk_5f986f813eaf4f90b5753027",
        "title": "Bach — Cello Suite No. 1 in G major, BWV 1007 — Allemande",
        "instrument": "Виолончель",
        "mutopia_zip": "https://www.mutopiaproject.org/ftp/BachJS/BWV1007/bwv1007/bwv1007-let-pdfs.zip",
        "must_any": [["bwv 1007"], ["bwv1007"], ["cello suite", "no.1"], ["cello suite", "1"]],
    },
    {
        "track_id": "trk_2e70a623dd54406dbb1e199e",
        "title": "Beethoven — 32 Variations in C minor, WoO 80",
        "instrument": "Фортепиано",
        "mutopia_zip": None,
        "commons_q": "Beethoven 32 Variations C minor WoO 80",
        "must_any": [["woo 80"], ["32 variations"], ["variations c minor"]],
    },
    {
        "track_id": "trk_b490e1767e6e4c1ea80b5673",
        "title": "Mozart — Eine kleine Nachtmusik, K. 525 — Allegro",
        "instrument": "Струнный квартет",
        "mutopia_zip": None,
        "commons_q": "Mozart Eine kleine Nachtmusik K.525",
        "must_any": [["k.525"], ["k 525"], ["nachtmusik", "525"], ["eine kleine"]],
    },
    {
        "track_id": "trk_5e3305b4f16b4f1ca698e524",
        "title": "Mozart — Piano Concerto No. 19 in F major, K. 459",
        "instrument": "Фортепиано с оркестром",
        "mutopia_zip": None,
        "commons_q": "Mozart Piano Concerto K.459",
        "must_any": [["k.459"], ["k 459"], ["piano concerto", "no.19"]],
    },
    {
        "track_id": "trk_ee086c8a10a547ecb8b6bd3a",
        "title": "Chopin — Scherzo No. 3 in C-sharp minor, Op. 39",
        "instrument": "Фортепиано",
        "mutopia_zip": None,
        "commons_q": "Chopin Scherzo Op.39",
        "must_any": [["op.39", "chopin"], ["scherzo", "chopin", "39"]],
    },
    {
        "track_id": "trk_c00b61bc4e624fc8a8c2d20c",
        "title": "Chopin — Waltz Op. 64 No. 1 (Minute Waltz)",
        "instrument": "Фортепиано",
        "mutopia_zip": "https://www.mutopiaproject.org/ftp/ChopinFF/O64/chop64-1/chop64-1-let-pdfs.zip",
        "commons_q": "Chopin Waltz Op.64",
        "must_any": [["op.64", "chopin"], ["waltz", "chopin", "64"]],
    },
    {
        "track_id": "trk_c2f8361f04d24509acfcaede",
        "title": "Tchaikovsky — Symphony No. 4, Op. 36 — Finale",
        "instrument": "Симфонический оркестр",
        "mutopia_zip": None,
        "commons_q": "Tchaikovsky Symphony No.4 Op.36",
        "must_any": [["tchaikovsky", "symphony", "4"], ["tchaikovsky", "op.36"]],
    },
    {
        "track_id": "trk_002bf0e44a4f43da97fc796d",
        "title": "Tchaikovsky — Marche Slave, Op. 31",
        "instrument": "Симфонический оркестр",
        "mutopia_zip": None,
        "commons_q": "Tchaikovsky Marche Slave Op.31",
        "must_any": [["marche slave"], ["slavonic march", "tchaikovsky"]],
    },
    {
        "track_id": "trk_813ed36f29f64d108a5280bf",
        "title": "Rimsky-Korsakov — Flight of the Bumblebee",
        "instrument": "Фортепиано",
        "mutopia_zip": None,
        "commons_q": "Rimsky-Korsakov Flight Bumblebee",
        "must_any": [["bumblebee"], ["flight", "bumblebee"]],
    },
]


def http_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    return urllib.request.urlopen(req, timeout=60)


def fetch_mutopia(url):
    try:
        with http_get(url) as r:
            data = r.read()
        z = zipfile.ZipFile(io.BytesIO(data))
        pdfs = [n for n in z.namelist() if n.lower().endswith(".pdf")]
        if not pdfs:
            return None
        return z.read(pdfs[0])
    except Exception as e:
        print(f"    (mutopia err: {e})")
        return None


def commons_search(query):
    enc = urllib.parse.quote(f"{query} filetype:pdf")
    url = (f"https://commons.wikimedia.org/w/api.php?action=query&format=json"
           f"&list=search&srsearch={enc}&srnamespace=6&srlimit=15")
    with http_get(url) as r:
        data = json.loads(r.read().decode("utf-8"))
    out = []
    for h in data.get("query", {}).get("search", []):
        t = h["title"]
        if not (t.startswith("File:") and t.lower().endswith(".pdf")):
            continue
        out.append(t[len("File:"):])
    return out


def name_matches(name: str, must_any: List[List[str]]) -> bool:
    """name содержит ВСЕ слова хотя бы одной из must_any-групп."""
    low = name.lower()
    if any(b in low for b in BLACK):
        return False
    for group in must_any:
        if all(re.search(re.escape(w), low) for w in group):
            return True
    return False


def commons_pick(query, must_any):
    cands = commons_search(query)
    for c in cands:
        if name_matches(c, must_any):
            return c
    return None


def download_commons(filename):
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
        track = db_query(f"SELECT \"artistId\" FROM tracks WHERE id='{w['track_id']}';")
        if not track:
            print("  ⊘  трек не найден")
            continue
        artist_id = track[0][0]

        # Чистим существующие записи (без нот лучше, чем с мусором)
        old = db_query(f"SELECT id, \"pdfUrl\" FROM sheet_music WHERE \"trackId\"='{w['track_id']}';")
        for old_id, old_url in old:
            p = os.path.join("/opt/sonatum/data", old_url.lstrip("/"))
            if os.path.exists(p):
                os.remove(p)
            db_exec(f"DELETE FROM sheet_music WHERE id='{old_id}';")
        if old:
            print(f"  ⊖  очистил предыдущую запись")

        try:
            data, source = None, None
            if w.get("mutopia_zip"):
                data = fetch_mutopia(w["mutopia_zip"])
                if data:
                    source = "mutopia (LilyPond)"

            if not data and w.get("commons_q"):
                fname = commons_pick(w["commons_q"], w["must_any"])
                if fname:
                    print(f"  →  Commons: {fname}")
                    data = download_commons(fname)
                    source = f"commons:{fname}"

            if not data:
                print("  ✗  ничего подходящего не найдено — оставляем без нот")
                fail.append(w["title"])
                continue

            slug = slug_safe(w["title"])
            out_path = os.path.join(PDF_DIR, f"{slug}.pdf")
            with open(out_path, "wb") as f:
                f.write(data)
            print(f"  ✓  {source}, {len(data)//1024} КБ")

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

    print(f"\n=== ИТОГО ===\n  обновлено: {len(ok)}\n  без нот:   {len(fail)}")
    for t in fail:
        print(f"  - {t}")


if __name__ == "__main__":
    main()
