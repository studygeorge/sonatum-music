#!/usr/bin/env python3
"""
Импорт старых записей с Internet Archive (archive.org) в Sonatum DB.

Используется как ДОБАВКА к Wikimedia-импорту:
  - коллекция 78rpm даёт записи до ~1925 г. — Public Domain в РФ и США
  - search по subject/title для нужной категории
  - все файлы — VBR MP3, готовы к стримингу

Запуск:
  ./scripts/import-archive.py --category=narodnaya 30
  ./scripts/import-archive.py --category=modern 20
  ./scripts/import-archive.py --category=duhovnaya 20
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError, URLError
import psycopg2

DB = dict(host="127.0.0.1", port=5432, dbname="sonatum_music",
          user="sonatum_user", password="Sonatum_Music_2026_Strong_Pass")
DATA_DIR = "/opt/sonatum/data"
AUDIO_DIR = os.path.join(DATA_DIR, "audio", "import")
COVER_DIR = os.path.join(DATA_DIR, "images", "composers")
USER_AGENT = "SonatumImporter/1.0 (https://sonatum-music.ru; info@sonatum-music.ru)"

# По категории — общий собирательный артист и набор поисковых запросов.
# В коллекции 78rpm есть 2062 записи на русском языке (любой жанр) — это базовый запрос.
SOURCES = {
    "narodnaya": {
        "artist_slug": "russian-folk-archive",
        "artist_name": "Русский фольклор (архив)",
        "subcategory": "Региональные школы",
        "queries": [
            "collection%3A78rpm+AND+language%3A%22Russian%22",
        ],
    },
    "modern": {
        "artist_slug": "soviet-archive",
        "artist_name": "Архивные записи (советская эстрада)",
        "subcategory": "Авторская песня и барды",
        "queries": [
            "collection%3A78rpm+AND+language%3A%22Russian%22+AND+year%3A%5B1925+TO+1945%5D",
            "collection%3A78rpm+AND+(subject%3A%22jazz%22+OR+subject%3A%22tango%22)+AND+year%3A%5B1920+TO+1945%5D",
        ],
    },
    "duhovnaya": {
        "artist_slug": "orthodox-archive",
        "artist_name": "Православные песнопения (архив)",
        "subcategory": "Современное церковное пение",
        "queries": [
            "collection%3A78rpm+AND+(subject%3A%22sacred%22+OR+subject%3A%22hymn%22+OR+subject%3A%22liturgy%22+OR+subject%3A%22orthodox%22)",
            "collection%3A78rpm+AND+language%3A%22Russian%22+AND+(title%3A%22liturgy%22+OR+title%3A%22kyrie%22+OR+title%3A%22hymn%22+OR+title%3A%22sacred%22)",
            "collection%3Aopensource_audio+AND+(subject%3A%22russian+orthodox%22+OR+subject%3A%22byzantine+chant%22)",
        ],
    },
}

# --- Helpers ---

CYRILLIC_TRANSLIT = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z",
    "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
    "с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch",
    "ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya",
}


def slugify(text):
    text = (text or "").strip().lower()
    out = []
    for ch in text:
        if ch in CYRILLIC_TRANSLIT:
            out.append(CYRILLIC_TRANSLIT[ch])
        elif ch.isalnum() or ch in "-_":
            out.append(ch)
        elif ch.isspace() or ch in ".,/\\:;()[]{}\"'":
            out.append("-")
    s = "".join(out)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:80] or "track"


def cuid_like(prefix="imp"):
    import uuid
    return f"{prefix}_{uuid.uuid4().hex[:24]}"


def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def http_save(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        size = 0
        while True:
            chunk = r.read(64 * 1024)
            if not chunk: break
            f.write(chunk); size += len(chunk)
    return size


def archive_search(query, rows=20):
    """advancedsearch.php → list of {identifier, title, creator, year}"""
    url = (
        "https://archive.org/advancedsearch.php?"
        f"q={query}+AND+mediatype%3Aaudio"
        "&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&fl[]=date"
        f"&output=json&rows={rows}"
    )
    try:
        data = http_json(url)
    except (HTTPError, URLError) as e:
        print(f"  ! search failed: {e}")
        return []
    return (data.get("response") or {}).get("docs", []) or []


def archive_metadata(identifier):
    try:
        return http_json(f"https://archive.org/metadata/{identifier}")
    except (HTTPError, URLError):
        return None


def best_mp3(meta):
    """Выбираем самый компактный VBR MP3 в пределах 30..900 секунд."""
    files = meta.get("files", []) or []
    candidates = []
    for f in files:
        fmt = (f.get("format") or "").lower()
        if "mp3" not in fmt:
            continue
        name = f.get("name", "")
        if not name.lower().endswith(".mp3"):
            continue
        size = int(f.get("size") or 0)
        if size > 30_000_000 or size < 100_000:
            continue
        length = f.get("length") or "0"
        if isinstance(length, str) and ":" in length:
            parts = list(map(float, length.split(":")))
            sec = int(sum(p * 60 ** i for i, p in enumerate(reversed(parts))))
        else:
            try: sec = int(float(length))
            except: sec = 0
        if sec < 30 or sec > 900:
            continue
        candidates.append((size, sec, name))
    if not candidates:
        return None
    # самый маленький подходящий — быстрее качать и дешевле дисково
    candidates.sort()
    size, sec, name = candidates[0]
    return {"name": name, "size": size, "duration": sec}


# --- DB ---

def db_connect():
    return psycopg2.connect(**DB)


def make_password_hash():
    import hashlib, os as _os
    salt = _os.urandom(32).hex()
    digest = hashlib.pbkdf2_hmac("sha512", _os.urandom(32), bytes.fromhex(salt), 100000, 64).hex()
    return f"{salt}:{digest}"


def ensure_artist(cur, src):
    cur.execute("SELECT id FROM artists WHERE slug=%s", (src["artist_slug"],))
    row = cur.fetchone()
    if row: return row[0]
    cur.execute("SELECT id FROM users WHERE email=%s", (f"composer-{src['artist_slug']}@import.sonatum",))
    u = cur.fetchone()
    if u:
        user_id = u[0]
    else:
        user_id = cuid_like("usr")
        cur.execute(
            'INSERT INTO users (id,email,"emailVerified","passwordHash","firstName","lastName",role,status,"createdAt","updatedAt") '
            "VALUES (%s,%s,NOW(),%s,'Архив','Сонатум','ARTIST','ACTIVE',NOW(),NOW())",
            (user_id, f"composer-{src['artist_slug']}@import.sonatum", make_password_hash()),
        )
    artist_id = cuid_like("art")
    cur.execute(
        'INSERT INTO artists (id,"userId",name,slug,bio,verified,followers,region,"authorType","isSelfEmployedVerified","createdAt","updatedAt") '
        "VALUES (%s,%s,%s,%s,%s,true,0,'Россия','PERFORMER',false,NOW(),NOW())",
        (artist_id, user_id, src["artist_name"], src["artist_slug"],
         f"Сборник архивных записей. Источник: Internet Archive (archive.org), коллекция 78rpm — записи общественного достояния."),
    )
    return artist_id


def insert_track(cur, artist_id, src, category, title, audio_url, duration, source_url, year):
    slug = slugify(f"{src['artist_slug']}-{title}-{cuid_like('')[:6]}")
    cur.execute("SELECT id FROM tracks WHERE lower(title) = lower(%s)", (title,))
    if cur.fetchone():
        return None  # дубль по названию — пропускаем
    metadata = {
        "era": "Советский период" if category == "modern" else
               "Древнерусская" if category == "duhovnaya" else
               "Современность",
        "region": "Россия",
        "source": "Internet Archive",
        "sourceUrl": source_url,
        "license": "PUBLIC_DOMAIN",
        "imported": True,
        "category": category,
        "subcategory": src["subcategory"],
        "year": year,
    }
    track_id = cuid_like("trk")
    cur.execute(
        '''INSERT INTO tracks (id, title, slug, duration, "audioUrl", "isFree", "isForSale",
                               "artistId", "playCount", "likeCount", "purchaseCount", "isExplicit",
                               status, metadata, "createdAt", "updatedAt", "publishedAt", language,
                               "licenseType", "attributionRequired")
           VALUES (%s, %s, %s, %s, %s, true, false, %s, 0, 0, 0, false,
                   'PUBLISHED', %s::jsonb, NOW(), NOW(), NOW(), %s, 'PUBLIC_DOMAIN', false)''',
        (track_id, title[:200], slug, duration, audio_url, artist_id,
         json.dumps(metadata, ensure_ascii=False),
         "Русский"),
    )
    cur.execute("SELECT id FROM genres WHERE slug=%s", (category,))
    g = cur.fetchone()
    if g:
        cur.execute(
            'INSERT INTO track_genres ("trackId","genreId") VALUES (%s,%s) ON CONFLICT DO NOTHING',
            (track_id, g[0]),
        )
    return track_id


def parse_args():
    target = 20
    category = None
    for a in sys.argv[1:]:
        if a.startswith("--category="):
            category = a.split("=", 1)[1]
        elif a.isdigit():
            target = int(a)
    return target, category


def main():
    target, category = parse_args()
    if not category or category not in SOURCES:
        print(f"usage: {sys.argv[0]} --category={'/'.join(SOURCES)} N")
        sys.exit(1)

    src = SOURCES[category]
    print(f"Target: {target} {category} tracks (artist={src['artist_name']})", flush=True)

    os.makedirs(AUDIO_DIR, exist_ok=True)
    conn = db_connect()
    conn.autocommit = False
    cur = conn.cursor()

    artist_id = ensure_artist(cur, src)
    conn.commit()

    cur.execute("SELECT lower(title) FROM tracks")
    seen = {r[0] for r in cur.fetchall()}

    imported = 0
    for q in src["queries"]:
        if imported >= target: break
        print(f"\n[{imported}/{target}] query: {urllib.parse.unquote_plus(q)[:80]}", flush=True)
        docs = archive_search(q, rows=80)
        for doc in docs:
            if imported >= target: break
            ident = doc.get("identifier")
            raw_title = doc.get("title") or ident
            if isinstance(raw_title, list):
                raw_title = raw_title[0]
            tlow = raw_title.lower().strip()
            if tlow in seen: continue

            meta = archive_metadata(ident)
            if not meta: continue
            best = best_mp3(meta)
            if not best:
                continue

            year = doc.get("year") or doc.get("date") or ""
            if isinstance(year, list): year = year[0] if year else ""
            year = str(year)[:10]

            mp3_url = f"https://archive.org/download/{ident}/{urllib.parse.quote(best['name'])}"
            ext = "mp3"
            fname = f"{slugify(src['artist_slug'])}-{slugify(raw_title)[:40]}-{cuid_like('')[:6]}.{ext}"
            local = os.path.join(AUDIO_DIR, fname)
            try:
                size = http_save(mp3_url, local)
            except Exception as e:
                print(f"  ! download failed: {e}")
                continue

            audio_rel = f"/audio/import/{fname}"
            tid = insert_track(cur, artist_id, src, category, raw_title[:200],
                               audio_rel, best["duration"],
                               f"https://archive.org/details/{ident}", year)
            if tid:
                conn.commit()
                imported += 1
                seen.add(tlow)
                print(f"  + [{imported}/{target}] {raw_title[:70]} ({best['duration']}s, {best['size']//1024} KB, {year})")
            time.sleep(0.3)

    cur.close(); conn.close()
    print(f"\nDone: imported {imported} {category} tracks")


if __name__ == "__main__":
    main()
