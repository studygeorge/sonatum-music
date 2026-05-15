#!/usr/bin/env python3
"""
Import real Public Domain music into Sonatum DB.

Sources:
  - Wikimedia Commons API for OGG audio (PD/CC0/CC-BY)
  - Wikipedia REST for composer bio + portrait

Each track gets:
  - Artist (composer) created/upserted
  - Track row with audioUrl pointing to /audio/import/<slug>.ogg
  - Cover image = composer portrait from Wikipedia

Run on host:
  /opt/sonatum/scripts/import-music.py [N]

  N — desired number of tracks (default 30). Iterates composers round-robin
  until reaching N.
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
from psycopg2.extras import RealDictCursor

# --- Config ---

DB = dict(
    host="127.0.0.1",
    port=5432,
    dbname="sonatum_music",
    user="sonatum_user",
    password="Sonatum_Music_2026_Strong_Pass",
)
DATA_DIR = "/opt/sonatum/data"
AUDIO_DIR = os.path.join(DATA_DIR, "audio", "import")
COVER_DIR_COMPOSER = os.path.join(DATA_DIR, "images", "composers")
COVER_DIR_TRACK = os.path.join(DATA_DIR, "images", "tracks")
USER_AGENT = "SonatumImporter/1.0 (https://sonatum-music.ru; info@sonatum-music.ru)"

# Источники импорта. Каждый — либо композитор (свой Artist), либо общий
# тематический сборник (artist_slug — общий собирательный исполнитель).
# category должна совпадать с slug корневого жанра в БД: classical/duhovnaya/narodnaya/modern.
COMPOSERS = [
    # === АКАДЕМИЧЕСКАЯ (classical) ===
    {"category":"classical","name":"Пётр Чайковский","wiki":"Pyotr_Ilyich_Tchaikovsky","search":"Tchaikovsky","era":"Романтизм","region":"Россия"},
    {"category":"classical","name":"Сергей Рахманинов","wiki":"Sergei_Rachmaninoff","search":"Rachmaninoff","era":"XX век","region":"Россия"},
    {"category":"classical","name":"Модест Мусоргский","wiki":"Modest_Mussorgsky","search":"Mussorgsky","era":"Романтизм","region":"Россия"},
    {"category":"classical","name":"Николай Римский-Корсаков","wiki":"Nikolai_Rimsky-Korsakov","search":"Rimsky-Korsakov","era":"Романтизм","region":"Россия"},
    {"category":"classical","name":"Александр Бородин","wiki":"Alexander_Borodin","search":"Borodin","era":"Романтизм","region":"Россия"},
    {"category":"classical","name":"Михаил Глинка","wiki":"Mikhail_Glinka","search":"Glinka","era":"Золотой век","region":"Россия"},
    {"category":"classical","name":"Александр Скрябин","wiki":"Alexander_Scriabin","search":"Scriabin","era":"Серебряный век","region":"Россия"},
    {"category":"classical","name":"Анатолий Лядов","wiki":"Anatoly_Lyadov","search":"Liadov","era":"Романтизм","region":"Россия"},
    {"category":"classical","name":"Иоганн Себастьян Бах","wiki":"Johann_Sebastian_Bach","search":"Johann Sebastian Bach","era":"Барокко","region":"Германия"},
    {"category":"classical","name":"Людвиг ван Бетховен","wiki":"Ludwig_van_Beethoven","search":"Beethoven","era":"Классицизм","region":"Германия"},
    {"category":"classical","name":"Вольфганг Амадей Моцарт","wiki":"Wolfgang_Amadeus_Mozart","search":"Mozart","era":"Классицизм","region":"Австрия"},
    {"category":"classical","name":"Фредерик Шопен","wiki":"Frédéric_Chopin","search":"Chopin","era":"Романтизм","region":"Польша"},
    {"category":"classical","name":"Антонио Вивальди","wiki":"Antonio_Vivaldi","search":"Vivaldi","era":"Барокко","region":"Италия"},
    {"category":"classical","name":"Клод Дебюсси","wiki":"Claude_Debussy","search":"Debussy","era":"XX век","region":"Франция"},

    # === ДУХОВНАЯ (duhovnaya) — композиторы ===
    {"category":"duhovnaya","name":"Дмитрий Бортнянский","wiki":"Dmitry_Bortniansky","search":"Bortniansky","era":"Классицизм","region":"Россия","confession":"Православие"},
    {"category":"duhovnaya","name":"Павел Чесноков","wiki":"Pavel_Chesnokov","search":"Chesnokov","era":"Серебряный век","region":"Россия","confession":"Православие"},
    {"category":"duhovnaya","name":"Александр Архангельский","wiki":"Alexander_Arkhangelsky_(composer)","search":"Arkhangelsky composer","era":"Серебряный век","region":"Россия","confession":"Православие"},
    {"category":"duhovnaya","name":"Александр Кастальский","wiki":"Alexander_Kastalsky","search":"Kastalsky","era":"Серебряный век","region":"Россия","confession":"Православие"},
    {"category":"duhovnaya","name":"Александр Гречанинов","wiki":"Alexander_Gretchaninov","search":"Gretchaninov","era":"Серебряный век","region":"Россия","confession":"Православие"},
    {"category":"duhovnaya","name":"Максим Березовский","wiki":"Maxim_Berezovsky","search":"Berezovsky","era":"Классицизм","region":"Россия","confession":"Православие"},

    # === ДУХОВНАЯ — тематические запросы (общий артист) ===
    {"category":"duhovnaya","kind":"theme","name":"Знаменный распев","artist_name":"Знаменный распев (анонимные)","artist_slug":"znamenny-anon","queries":["Znamenny chant","Russian Orthodox chant"],"era":"Древнерусская","region":"Россия","confession":"Православие","subcategory":"Знаменный распев (крюковое пение)"},
    {"category":"duhovnaya","kind":"theme","name":"Колокольные звоны","artist_name":"Колокольные звоны России","artist_slug":"russian-bells","queries":["Russian Orthodox bells","Russian church bells"],"era":"Современность","region":"Россия","confession":"Православие","subcategory":"Колокольные звоны"},
    {"category":"duhovnaya","kind":"theme","name":"Православный хор","artist_name":"Православный хор","artist_slug":"orthodox-choir","queries":["Russian Orthodox choir","Russian liturgy"],"era":"Современность","region":"Россия","confession":"Православие","subcategory":"Современное церковное пение"},
    {"category":"duhovnaya","kind":"theme","name":"Григорианский хорал","artist_name":"Григорианский хорал","artist_slug":"gregorian","queries":["Gregorian chant"],"era":"Древнерусская","region":"Италия","confession":"Католичество","subcategory":"Григорианский хорал"},

    # === НАРОДНАЯ (narodnaya) — тематические запросы ===
    {"category":"narodnaya","kind":"theme","name":"Русская народная песня","artist_name":"Русская народная песня","artist_slug":"russian-folk-song","queries":["Russian folk song","Russian traditional song"],"era":"Современность","region":"Россия","subcategory":"Бытовая лирика"},
    {"category":"narodnaya","kind":"theme","name":"Балалайка","artist_name":"Балалайка (народный инструмент)","artist_slug":"balalaika","queries":["balalaika","Russian balalaika"],"era":"Современность","region":"Россия","subcategory":"Инструментальная традиция"},
    {"category":"narodnaya","kind":"theme","name":"Гусли","artist_name":"Гусли (народный инструмент)","artist_slug":"gusli","queries":["gusli Russian","Russian gusli music"],"era":"Древнерусская","region":"Россия","subcategory":"Инструментальная традиция"},
    {"category":"narodnaya","kind":"theme","name":"Гармонь","artist_name":"Гармонь (народный инструмент)","artist_slug":"garmon","queries":["Russian garmon","Russian accordion folk"],"era":"Современность","region":"Россия","subcategory":"Инструментальная традиция"},
    {"category":"narodnaya","kind":"theme","name":"Калинка / Камаринская","artist_name":"Народные пляски","artist_slug":"russian-dance","queries":["Kalinka Russian","Kamarinskaya Russian"],"era":"Современность","region":"Россия","subcategory":"Региональные школы"},
    {"category":"narodnaya","kind":"theme","name":"Украинская народная","artist_name":"Украинская народная музыка","artist_slug":"ukrainian-folk","queries":["Ukrainian folk song","Ukrainian traditional"],"era":"Современность","region":"Украина","subcategory":"Региональные школы"},

    # === СОВРЕМЕННАЯ (modern) — композиторы советского периода в PD ===
    {"category":"modern","name":"Сергей Прокофьев","wiki":"Sergei_Prokofiev","search":"Prokofiev","era":"Советский период","region":"Россия","subcategory":"Авторская песня и барды"},
    {"category":"modern","name":"Дмитрий Шостакович","wiki":"Dmitri_Shostakovich","search":"Shostakovich","era":"Советский период","region":"Россия","subcategory":"Авторская песня и барды"},

    # === СОВРЕМЕННАЯ — тематические запросы ===
    {"category":"modern","kind":"theme","name":"Русский рок","artist_name":"Русский рок (сборник)","artist_slug":"russian-rock-misc","queries":["Russian rock"],"era":"Подпольный период (1980–1985)","region":"Россия","subcategory":"Рок"},
    {"category":"modern","kind":"theme","name":"Бардовская песня","artist_name":"Бардовская песня (сборник)","artist_slug":"bard-songs","queries":["Russian bard song","Soviet bard"],"era":"Советский период","region":"Россия","subcategory":"Авторская песня и барды"},
    {"category":"modern","kind":"theme","name":"Джаз","artist_name":"Современный джаз (сборник)","artist_slug":"modern-jazz-misc","queries":["jazz public domain","modern jazz instrumental"],"era":"2010-е","region":"Россия","subcategory":"Джаз"},
    {"category":"modern","kind":"theme","name":"Современная электроника","artist_name":"Электронная музыка (сборник)","artist_slug":"modern-electronic","queries":["electronic ambient creative commons","modern electronic"],"era":"2010-е","region":"Россия","subcategory":"Электроника"},
]

# --- Helpers ---

CYRILLIC_TRANSLIT = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z",
    "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
    "с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch",
    "ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya",
}


def slugify(text: str) -> str:
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


def http_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_download(url: str, dest: str) -> int:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return os.path.getsize(dest)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp, open(dest, "wb") as f:
        size = 0
        while True:
            chunk = resp.read(64 * 1024)
            if not chunk:
                break
            f.write(chunk)
            size += len(chunk)
    return size


def wiki_summary(title: str) -> dict | None:
    try:
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
        return http_json(url)
    except (HTTPError, URLError) as e:
        print(f"  ! wiki failed for {title}: {e}", flush=True)
        return None


def commons_audio(search: str, limit: int = 30) -> list[dict]:
    """Return list of audio file pages from Wikimedia Commons matching search term."""
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": search,
        "gsrnamespace": "6",   # File: namespace
        "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url|size|mime|user|extmetadata",
        "format": "json",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    data = http_json(url)
    pages = data.get("query", {}).get("pages", {})
    out = []
    for p in pages.values():
        info = (p.get("imageinfo") or [{}])[0]
        mime = info.get("mime", "")
        if not mime.startswith("audio/") and mime not in ("application/ogg",):
            continue
        title = p.get("title", "")
        if not title.lower().startswith("file:"):
            continue
        out.append({
            "title": title[5:],  # strip "File:"
            "url": info.get("url"),
            "mime": mime,
            "duration": info.get("duration"),
            "size": info.get("size"),
            "extmeta": info.get("extmetadata", {}) or {},
        })
    return out


def is_acceptable_license(extmeta: dict) -> tuple[bool, str]:
    license_short = (extmeta.get("LicenseShortName", {}) or {}).get("value", "").upper()
    license_url = (extmeta.get("LicenseUrl", {}) or {}).get("value", "")
    # Accept Public Domain, CC0, CC-BY, CC-BY-SA. Skip non-free.
    pd_markers = ["PD", "PUBLIC DOMAIN", "CC0", "CC-BY", "CC BY"]
    bad_markers = ["NON-COMMERCIAL", "ND ", "-ND", "FAIR USE", "GFDL"]
    text = license_short
    for bad in bad_markers:
        if bad in text:
            return False, license_short
    for ok in pd_markers:
        if ok in text:
            return True, license_short
    # If LicenseUrl говорит CC, тоже принимаем.
    if license_url and "creativecommons.org" in license_url and "nc" not in license_url:
        return True, license_short or "CC"
    return False, license_short or "unknown"


# --- DB ---

def db_connect():
    return psycopg2.connect(
        host=DB["host"], port=DB["port"], dbname=DB["dbname"],
        user=DB["user"], password=DB["password"]
    )


def cuid_like(prefix: str = "imp") -> str:
    """Просто uuid в hex без дефисов — Prisma cuid-совместимый формат не нужен,
    Postgres схема требует только String. Префикс помогает отличить импорт."""
    import uuid
    return f"{prefix}_{uuid.uuid4().hex[:24]}"


def make_password_hash() -> str:
    """PBKDF2-SHA512 hash compatible with backend/lib/password.ts."""
    import hashlib, os
    salt = os.urandom(32).hex()
    digest = hashlib.pbkdf2_hmac("sha512", os.urandom(32), bytes.fromhex(salt), 100000, 64).hex()
    return f"{salt}:{digest}"


def ensure_composer_user(cur, composer: dict) -> str:
    """Каждому композитору — отдельный User (constraint Artist.userId @unique)."""
    slug = slugify(composer["search"])
    email = f"composer-{slug}@import.sonatum"
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    if row:
        return row[0]
    user_id = cuid_like("usr")
    cur.execute(
        '''INSERT INTO users (id, email, "emailVerified", "passwordHash", "firstName", "lastName",
                              role, status, "createdAt", "updatedAt")
           VALUES (%s, %s, NOW(), %s, %s, %s, 'ARTIST', 'ACTIVE', NOW(), NOW())''',
        (user_id, email, make_password_hash(), composer["name"].split()[0], composer["name"].split()[-1]),
    )
    return user_id


def upsert_artist(cur, composer: dict, summary: dict | None, portrait_url: str | None):
    """Composer mode — Artist соответствует одному композитору."""
    name = composer["name"]
    slug = slugify(composer["search"])
    bio_ru = (summary or {}).get("extract") or ""
    avatar = portrait_url or (summary or {}).get("thumbnail", {}).get("source")
    cur.execute("SELECT id FROM artists WHERE slug = %s", (slug,))
    row = cur.fetchone()
    if row:
        cur.execute(
            'UPDATE artists SET name=%s, bio=%s, avatar=%s, region=%s, "updatedAt"=NOW() WHERE id=%s',
            (name, bio_ru[:2000], avatar, composer.get("region"), row[0]),
        )
        return row[0], False
    artist_id = cuid_like("art")
    user_id = ensure_composer_user(cur, composer)
    cur.execute(
        '''INSERT INTO artists (id, "userId", name, slug, bio, avatar, verified, followers,
                                region, "authorType", "isSelfEmployedVerified", "createdAt", "updatedAt")
           VALUES (%s, %s, %s, %s, %s, %s, true, 0, %s, 'COMPOSER', false, NOW(), NOW())''',
        (artist_id, user_id, name, slug, bio_ru[:2000], avatar, composer.get("region")),
    )
    return artist_id, True


def upsert_theme_artist(cur, src: dict) -> tuple[str, bool]:
    """Theme mode — создаём общего собирательного исполнителя для запроса."""
    artist_slug = src["artist_slug"]
    artist_name = src["artist_name"]
    cur.execute("SELECT id FROM artists WHERE slug = %s", (artist_slug,))
    row = cur.fetchone()
    if row:
        return row[0], False
    artist_id = cuid_like("art")
    fake_composer = {
        "name": artist_name,
        "search": artist_slug,
        "region": src.get("region"),
    }
    user_id = ensure_composer_user(cur, fake_composer)
    cur.execute(
        '''INSERT INTO artists (id, "userId", name, slug, bio, verified, followers,
                                region, "authorType", "isSelfEmployedVerified", "createdAt", "updatedAt")
           VALUES (%s, %s, %s, %s, %s, true, 0, %s, 'PERFORMER', false, NOW(), NOW())''',
        (artist_id, user_id, artist_name, artist_slug,
         f"Сборник: {artist_name}. Источник — Wikimedia Commons (Public Domain / Creative Commons).",
         src.get("region")),
    )
    return artist_id, True


def attach_genre(cur, track_id: str, genre_slug: str):
    cur.execute("SELECT id FROM genres WHERE slug = %s", (genre_slug,))
    row = cur.fetchone()
    if not row:
        return
    cur.execute(
        'INSERT INTO track_genres ("trackId", "genreId") VALUES (%s, %s) ON CONFLICT DO NOTHING',
        (track_id, row[0]),
    )


def upsert_track(cur, artist_id: str, src: dict, work_title: str,
                 audio_url: str, cover_url: str | None, duration: int,
                 license_short: str):
    search_token = src.get("search") or src.get("artist_slug") or "track"
    slug = slugify(f"{search_token}-{work_title}-{cuid_like('')[:6]}")
    metadata = {
        "era": src.get("era"),
        "region": src.get("region"),
        "source": "Wikimedia Commons",
        "license": license_short,
        "imported": True,
        "category": src.get("category"),
    }
    if src.get("confession"):
        metadata["confession"] = src["confession"]
    if src.get("subcategory"):
        metadata["subcategory"] = src["subcategory"]

    cur.execute("SELECT id FROM tracks WHERE slug = %s", (slug,))
    if cur.fetchone():
        return None

    track_id = cuid_like("trk")
    cur.execute(
        '''INSERT INTO tracks (id, title, slug, duration, "audioUrl", cover, "isFree", "isForSale",
                               "artistId", "playCount", "likeCount", "purchaseCount", "isExplicit",
                               status, metadata, "createdAt", "updatedAt", "publishedAt", language, confession,
                               "licenseType", "attributionRequired")
           VALUES (%s, %s, %s, %s, %s, %s, true, false, %s, 0, 0, 0, false,
                   'PUBLISHED', %s::jsonb, NOW(), NOW(), NOW(), %s, %s, %s, %s)''',
        (track_id, work_title[:200], slug, duration, audio_url, cover_url,
         artist_id, json.dumps(metadata, ensure_ascii=False),
         "Русский" if src.get("region") == "Россия" else None,
         src.get("confession"),
         "PUBLIC_DOMAIN" if "PD" in license_short.upper() or "PUBLIC" in license_short.upper() else "CC_BY",
         "CC" in license_short.upper() and "PD" not in license_short.upper())
    )
    # Корневой жанр по category
    if src.get("category"):
        attach_genre(cur, track_id, src["category"])
    return track_id


# --- Main ---

BAD_TITLE_HINTS = (
    "pronunciation", "произношение", "spoken", "interview", "lecture",
    "speech", "обсуждение", "voice ", "biography", "documentary",
)
# Hy- / Az- / Ka- / Sgw- / Bn- — wikimedia spoken-word lang prefixes.
LANG_PREFIX = re.compile(r"^[A-Za-z]{2,4}-")


def filter_files(files: list[dict], existing_titles: set[str], existing_filenames: set[str]) -> list[dict]:
    """Фильтруем по: длительности, размеру, лицензии, эвристикам шумных файлов
    и **исключаем дубликаты** по уже импортированным title/file."""
    good = []
    seen_in_batch = set()
    for f in files:
        if not f.get("duration"):
            continue
        d = int(f["duration"])
        if d < 60 or d > 900:
            continue
        if (f.get("size") or 0) > 30_000_000:
            continue
        raw_title = f["title"]
        title_lc = raw_title.lower()
        if any(h in title_lc for h in BAD_TITLE_HINTS):
            continue
        if LANG_PREFIX.match(raw_title):
            continue
        ok, lic = is_acceptable_license(f["extmeta"])
        if not ok:
            continue
        # Очищенный title (без расширения) — сравниваем с уже импортированным.
        clean = re.sub(r"\.(ogg|oga|opus|mp3|flac|wav|ogv)$", "", raw_title, flags=re.I)
        clean = clean.replace("_", " ").strip()
        if clean.lower() in existing_titles:
            continue
        if clean.lower() in seen_in_batch:
            continue
        # Сам файл — если уже скачан раньше (по имени файла на Commons)
        fn_lower = raw_title.lower()
        if fn_lower in existing_filenames:
            continue
        seen_in_batch.add(clean.lower())
        f["license_short"] = lic
        f["clean_title"] = clean
        good.append(f)
    return good


def fetch_existing(cur) -> tuple[set[str], set[str]]:
    """Текущие title и audioUrl (lowercase) — чтобы не качать повторно."""
    cur.execute("SELECT lower(title) FROM tracks")
    titles = {r[0] for r in cur.fetchall() if r[0]}
    cur.execute("SELECT lower(\"audioUrl\") FROM tracks WHERE \"audioUrl\" IS NOT NULL")
    urls = {r[0] for r in cur.fetchall() if r[0]}
    # filename часть из audioUrl /audio/import/<fn>
    filenames = set()
    for u in urls:
        if "/audio/import/" in u:
            filenames.add(u.rsplit("/", 1)[-1])
    return titles, filenames


def parse_args():
    target = 30
    category = None
    for a in sys.argv[1:]:
        if a.startswith("--category="):
            category = a.split("=", 1)[1]
        elif a.isdigit():
            target = int(a)
    return target, category


def main():
    target, category = parse_args()
    print(f"Target: {target} tracks (category={category or 'any'})", flush=True)

    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(COVER_DIR_COMPOSER, exist_ok=True)
    os.makedirs(COVER_DIR_TRACK, exist_ok=True)

    sources = [s for s in COMPOSERS if not category or s.get("category") == category]
    if not sources:
        print(f"! no sources match category={category}")
        return

    conn = db_connect()
    conn.autocommit = False
    cur = conn.cursor()

    existing_titles, existing_filenames = fetch_existing(cur)
    print(f"DB has {len(existing_titles)} tracks, {len(existing_filenames)} known filenames")

    imported = 0
    artists_cache: dict[str, tuple[str, str | None]] = {}
    idx = 0
    skipped_inrun = 0

    while imported < target and skipped_inrun < len(sources) * 3:
        src = sources[idx % len(sources)]
        idx += 1
        sname = src["name"]
        is_theme = src.get("kind") == "theme"
        print(f"\n[{imported}/{target}] {sname} ({src.get('category')}, {'theme' if is_theme else 'composer'})", flush=True)

        # 1. Ensure artist + portrait
        if sname not in artists_cache:
            artist_id = None
            portrait_url = None
            if is_theme:
                artist_id, _created = upsert_theme_artist(cur, src)
            else:
                summary = wiki_summary(src["wiki"])
                if summary and summary.get("thumbnail"):
                    img_src = summary["thumbnail"]["source"]
                    img_src = re.sub(r"/thumb/(.+)/[^/]+$", r"/\1", img_src)
                    portrait_slug = slugify(src["search"])
                    local = os.path.join(COVER_DIR_COMPOSER, f"{portrait_slug}.jpg")
                    try:
                        http_download(img_src, local)
                        portrait_url = f"/images/composers/{portrait_slug}.jpg"
                    except Exception as e:
                        print(f"  ! portrait failed: {e}")
                artist_id, _created = upsert_artist(cur, src, summary, portrait_url)
            conn.commit()
            artists_cache[sname] = (artist_id, portrait_url)
            print(f"  artist ready: {artist_id}")

        artist_id, portrait_url = artists_cache[sname]

        # 2. Find audio
        queries = src["queries"] if is_theme else [src["search"]]
        files: list[dict] = []
        try:
            for q in queries:
                files += commons_audio(q, limit=15)
                if len(files) >= 20:
                    break
        except Exception as e:
            print(f"  ! commons search failed: {e}")
            skipped_inrun += 1
            continue

        good = filter_files(files, existing_titles, existing_filenames)
        if not good:
            print(f"  ! no new audio (filtered: dupes/license/length)")
            skipped_inrun += 1
            continue

        per_iteration = min(2, target - imported)
        added = 0
        for f in good:
            if added >= per_iteration:
                break
            work = f.get("clean_title") or re.sub(r"\.(ogg|oga|opus|mp3|flac|wav|ogv)$", "", f["title"], flags=re.I).replace("_", " ").strip()
            search_token = src.get("search") or src.get("artist_slug") or "track"
            ext = "ogg" if "ogg" in f["mime"] else "mp3"
            fname = f"{slugify(search_token)}-{slugify(work)[:40]}-{cuid_like('')[:6]}.{ext}"
            local_path = os.path.join(AUDIO_DIR, fname)
            try:
                size = http_download(f["url"], local_path)
            except Exception as e:
                print(f"  ! download failed: {e}")
                continue
            audio_rel = f"/audio/import/{fname}"
            duration = int(f["duration"])
            tid = upsert_track(cur, artist_id, src, work, audio_rel,
                               portrait_url, duration, f["license_short"])
            if tid:
                conn.commit()
                imported += 1
                added += 1
                existing_titles.add(work.lower())
                existing_filenames.add(fname.lower())
                print(f"  + track [{imported}/{target}]: {work[:60]} ({duration}s, {size//1024} KB, {f['license_short']})")
        if added == 0:
            skipped_inrun += 1

        time.sleep(0.5)

    cur.close()
    conn.close()
    print(f"\nDone: imported {imported} tracks")


if __name__ == "__main__":
    main()
