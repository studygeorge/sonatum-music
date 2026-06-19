#!/usr/bin/env python3
"""
Дополняет картинки артистам и трекам:
  • для theme-артистов (Балалайка, Гусли, Колокола…) — фото из Wikipedia/Commons
  • для треков без cover — копируем avatar артиста
  • для старых seed-артистов (Eldjey/Markul/etc) — оставляем как есть, только подставляем cover их трекам если пусто
"""
import io
import json
import os
import re
import urllib.parse
import urllib.request
from urllib.error import HTTPError, URLError

import psycopg2

DB = dict(host="127.0.0.1", port=5432, dbname="sonatum_music",
          user="sonatum_user", password=os.getenv("PGPASSWORD",""))
DATA_DIR = "/opt/sonatum/data"
COVER_DIR = os.path.join(DATA_DIR, "images", "composers")
USER_AGENT = "SonatumImporter/1.0 (https://sonatum-music.ru; info@sonatum-music.ru)"

# theme-artist slug → (Wikipedia title, fallback Commons search)
THEME_IMAGES = {
    "balalaika":          ("Balalaika",          "Balalaika instrument"),
    "gusli":              ("Gusli",              "Gusli instrument Russian"),
    "garmon":             ("Garmon",             "Russian garmon accordion"),
    "russian-folk-song":  ("Russian_folk_music", "Russian folk choir"),
    "russian-dance":      ("Russian_folk_dance", "Russian folk dance"),
    "ukrainian-folk":     ("Music_of_Ukraine",   "Ukrainian folk musicians"),
    "znamenny-anon":      ("Znamenny_chant",     "Znamenny manuscript"),
    "russian-bells":      ("Russian_bell_ringing","Russian Orthodox bells"),
    "orthodox-choir":     ("Russian_Orthodox_chant", "Russian Orthodox choir"),
    "gregorian":          ("Gregorian_chant",    "Gregorian chant manuscript"),
    "bard-songs":         ("Soviet_bard",        "Soviet bard guitar"),
    "russian-rock-misc":  ("Russian_rock",       "Russian rock band"),
    "modern-jazz-misc":   ("Jazz",               "jazz quartet stage"),
    "modern-electronic":  ("Electronic_music",   "electronic music studio"),
    "chesnokov":          ("Pavel_Chesnokov",    "Pavel Chesnokov"),
    # Сборные исполнители из archive.org (78rpm collection)
    "russian-folk-archive": ("Russian_traditional_music", "Russian folk peasants ensemble"),
    "soviet-archive":       ("Music_of_the_Soviet_Union", "Soviet song accordion stage"),
    "orthodox-archive":     ("Russian_Orthodox_chant",    "Russian Orthodox priest choir liturgy"),
}

def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))

def http_save(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(64 * 1024)
            if not chunk:
                break
            f.write(chunk)
    return os.path.getsize(dest)

def wiki_thumbnail(title):
    try:
        d = http_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}")
        thumb = (d.get("thumbnail") or {}).get("source")
        if thumb:
            return re.sub(r"/thumb/(.+)/[^/]+$", r"/\1", thumb)
    except (HTTPError, URLError):
        pass
    return None

def commons_image(query):
    """First decent JPEG/PNG image from Wikimedia Commons matching query."""
    params = {
        "action": "query", "generator": "search", "gsrsearch": query,
        "gsrnamespace": "6", "gsrlimit": "8",
        "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata",
        "format": "json",
    }
    try:
        data = http_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params))
    except (HTTPError, URLError):
        return None
    pages = (data.get("query") or {}).get("pages") or {}
    candidates = []
    for p in pages.values():
        info = (p.get("imageinfo") or [{}])[0]
        mime = info.get("mime", "")
        if mime not in ("image/jpeg", "image/png", "image/webp"):
            continue
        size = info.get("size") or 0
        if size < 5000 or size > 20_000_000:
            continue
        url = info.get("url")
        if not url:
            continue
        candidates.append((size, url))
    if not candidates:
        return None
    # Берём средний по размеру (не самый огромный, не самый крошечный)
    candidates.sort()
    return candidates[len(candidates) // 2][1]


def main():
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()

    print("=== STEP 1: Заполняем аватары theme-артистам ===")
    for slug, (wiki, query) in THEME_IMAGES.items():
        cur.execute("SELECT id, avatar FROM artists WHERE slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            print(f"  ? not found: {slug}")
            continue
        artist_id, current = row
        if current:
            print(f"  = already has avatar: {slug}")
            continue

        # Try Wikipedia first
        img_url = wiki_thumbnail(wiki)
        if not img_url:
            img_url = commons_image(query)
        if not img_url:
            print(f"  ! no image found for {slug}")
            continue

        local = os.path.join(COVER_DIR, f"{slug}.jpg")
        try:
            size = http_save(img_url, local)
        except Exception as e:
            print(f"  ! download failed for {slug}: {e}")
            continue
        rel = f"/images/composers/{slug}.jpg"
        cur.execute(
            'UPDATE artists SET avatar = %s, "updatedAt" = NOW() WHERE id = %s',
            (rel, artist_id),
        )
        conn.commit()
        print(f"  + {slug}: {size//1024} KB")

    print("\n=== STEP 2: Прокидываем avatar артиста в cover трека (где cover пустой) ===")
    cur.execute('''
        UPDATE tracks t
        SET cover = a.avatar, "updatedAt" = NOW()
        FROM artists a
        WHERE t."artistId" = a.id
          AND (t.cover IS NULL OR t.cover = '')
          AND a.avatar IS NOT NULL AND a.avatar <> '';
    ''')
    rows = cur.rowcount
    conn.commit()
    print(f"  + {rows} tracks now have cover")

    print("\n=== STEP 3: Сводка ===")
    cur.execute("SELECT count(*) FILTER (WHERE avatar IS NULL OR avatar = '') AS no_avatar, count(*) FROM artists")
    no_av, total_a = cur.fetchone()
    cur.execute("SELECT count(*) FILTER (WHERE cover IS NULL OR cover = '') AS no_cover, count(*) FROM tracks")
    no_cov, total_t = cur.fetchone()
    print(f"  artists: {total_a - no_av}/{total_a} с аватаром")
    print(f"  tracks:  {total_t - no_cov}/{total_t} с обложкой")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
