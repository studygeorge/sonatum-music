#!/usr/bin/env python3
"""
Расширение каталога классики:
  • создаёт недостающих композиторов (с фото с Wikipedia)
  • качает аудио (Wikimedia Commons .ogg/.mp3/.flac)
  • качает PDF нот (Mutopia ZIP или Commons со strict-фильтром)
  • вставляет Track + SheetMusic в БД
  • duration трека определяется через ffprobe
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
from typing import List, Optional

AUDIO_DIR = "/opt/sonatum/data/audio/classical"
PDF_DIR   = "/opt/sonatum/data/sheets/pdf"
COVERS_DIR= "/opt/sonatum/data/images/composers"
WEB_AUDIO = "/audio/classical"
WEB_PDF   = "/sheets/pdf"
WEB_COVER = "/images/composers"
USER_AGENT = "SonatumBot/1.0 (https://sonatum-music.ru)"

PDF_BLACK = ("programmaboekje", "programme", "manuscript", "facsimile",
             "holograph", "newspaper", "evening", "journal", "magazine",
             "catalog", "review")

# Новые композиторы
NEW_COMPOSERS = [
    {"slug": "schubert",    "name": "Франц Шуберт",         "wiki": "Шуберт, Франц"},
    {"slug": "handel",      "name": "Георг Фридрих Гендель", "wiki": "Гендель, Георг Фридрих"},
    {"slug": "haydn",       "name": "Йозеф Гайдн",           "wiki": "Гайдн, Йозеф"},
    {"slug": "schumann",    "name": "Роберт Шуман",          "wiki": "Шуман, Роберт"},
    {"slug": "satie",       "name": "Эрик Сати",             "wiki": "Сати, Эрик"},
    {"slug": "brahms",      "name": "Иоганнес Брамс",        "wiki": "Брамс, Иоганнес"},
    {"slug": "mendelssohn", "name": "Феликс Мендельсон",     "wiki": "Мендельсон, Феликс"},
    {"slug": "liszt",       "name": "Ференц Лист",            "wiki": "Лист, Ференц"},
]

# Каталог произведений: (composer_slug, title, instrument, audio_query, sheet)
# sheet: либо {"mutopia": URL_zip} либо {"commons_q": ..., "must_any": [[...]]}.
WORKS = [
    # === Бах ===
    {
        "composer_slug": "johann-sebastian-bach",
        "title": "Bach — Air on the G String, BWV 1068",
        "instrument": "Камерный оркестр",
        "year": 1731,
        "audio_q": "Bach Air G String BWV 1068",
        "audio_must": [["air", "string"], ["bwv 1068"], ["bwv1068"]],
        "sheet": {"commons_q": "Bach Air on G String BWV 1068",
                  "must_any": [["bwv 1068"], ["bwv1068"], ["air", "string"]]},
    },
    {
        "composer_slug": "johann-sebastian-bach",
        "title": "Bach — Invention No. 1 in C major, BWV 772",
        "instrument": "Фортепиано",
        "year": 1723,
        "audio_q": "Bach Invention BWV 772",
        "audio_must": [["bwv 772"], ["bwv772"], ["invention", "1"]],
        "sheet": {"commons_q": "Bach Invention BWV 772",
                  "must_any": [["bwv 772"], ["bwv772"], ["invention", "no.1"]]},
    },
    # === Бетховен ===
    {
        "composer_slug": "beethoven",
        "title": "Beethoven — Piano Sonata No. 14 «Moonlight», Op. 27 No. 2 — Adagio",
        "instrument": "Фортепиано",
        "year": 1801,
        "audio_q": "Beethoven Moonlight Sonata Op 27 Adagio",
        "audio_must": [["moonlight"], ["op.27"], ["op 27"]],
        "sheet": {"commons_q": "Beethoven Moonlight Sonata Op.27",
                  "must_any": [["op.27"], ["moonlight"], ["sonata", "27"]]},
    },
    {
        "composer_slug": "beethoven",
        "title": "Beethoven — «Für Elise», WoO 59",
        "instrument": "Фортепиано",
        "year": 1810,
        "audio_q": "Beethoven Fur Elise",
        "audio_must": [["elise"], ["fur elise"]],
        "sheet": {"commons_q": "Beethoven Fur Elise WoO 59",
                  "must_any": [["elise"], ["woo 59"]]},
    },
    # === Моцарт ===
    {
        "composer_slug": "mozart",
        "title": "Mozart — Piano Sonata No. 16, K. 545 — Allegro",
        "instrument": "Фортепиано",
        "year": 1788,
        "audio_q": "Mozart Sonata K 545 Allegro",
        "audio_must": [["k 545"], ["k.545"], ["sonata", "545"]],
        "sheet": {"commons_q": "Mozart Piano Sonata K.545",
                  "must_any": [["k.545"], ["k 545"], ["sonata", "16"]]},
    },
    {
        "composer_slug": "mozart",
        "title": "Mozart — Rondo alla Turca (Sonata K. 331, Mvt. III)",
        "instrument": "Фортепиано",
        "year": 1783,
        "audio_q": "Mozart Rondo Turca K 331",
        "audio_must": [["turca"], ["k 331"], ["k.331"], ["alla turca"]],
        "sheet": {"commons_q": "Mozart Sonata K.331 Turca",
                  "must_any": [["k.331"], ["alla turca"]]},
    },
    # === Шопен ===
    {
        "composer_slug": "chopin",
        "title": "Chopin — Nocturne in E-flat major, Op. 9 No. 2",
        "instrument": "Фортепиано",
        "year": 1832,
        "audio_q": "Chopin Nocturne Op 9 No 2",
        "audio_must": [["nocturne", "9"], ["op.9", "no.2"], ["op 9 no 2"]],
        "sheet": {"commons_q": "Chopin Nocturne Op.9",
                  "must_any": [["op.9", "chopin"], ["nocturne", "chopin", "9"]]},
    },
    {
        "composer_slug": "chopin",
        "title": "Chopin — Prelude in E minor, Op. 28 No. 4",
        "instrument": "Фортепиано",
        "year": 1839,
        "audio_q": "Chopin Prelude Op 28 No 4",
        "audio_must": [["op.28"], ["op 28"], ["prelude", "28"]],
        "sheet": {"commons_q": "Chopin Preludes Op.28",
                  "must_any": [["op.28", "chopin"], ["preludes", "28"]]},
    },
    # === Шуберт ===
    {
        "composer_slug": "schubert",
        "title": "Schubert — Ave Maria, D. 839",
        "instrument": "Голос и фортепиано",
        "year": 1825,
        "audio_q": "Schubert Ave Maria D 839",
        "audio_must": [["ave maria", "schubert"], ["d 839"], ["d.839"]],
        "sheet": {"commons_q": "Schubert Ave Maria D.839",
                  "must_any": [["ave maria", "schubert"], ["d.839"]]},
    },
    {
        "composer_slug": "schubert",
        "title": "Schubert — Impromptu Op. 90 No. 3 in G-flat major, D. 899",
        "instrument": "Фортепиано",
        "year": 1827,
        "audio_q": "Schubert Impromptu Op 90 D 899",
        "audio_must": [["impromptu", "schubert"], ["d 899"], ["op.90"]],
        "sheet": {"commons_q": "Schubert Impromptu Op.90 D.899",
                  "must_any": [["op.90", "schubert"], ["impromptu", "899"]]},
    },
    # === Шуман ===
    {
        "composer_slug": "schumann",
        "title": "Schumann — Träumerei (Kinderszenen, Op. 15 No. 7)",
        "instrument": "Фортепиано",
        "year": 1838,
        "audio_q": "Schumann Traumerei Kinderszenen",
        "audio_must": [["traumerei"], ["träumerei"], ["kinderszenen"]],
        "sheet": {"commons_q": "Schumann Kinderszenen Op.15",
                  "must_any": [["op.15", "schumann"], ["kinderszenen"]]},
    },
    # === Сати ===
    {
        "composer_slug": "satie",
        "title": "Satie — Gymnopédie No. 1",
        "instrument": "Фортепиано",
        "year": 1888,
        "audio_q": "Satie Gymnopedie No 1",
        "audio_must": [["gymnopedie"], ["gymnopédie"]],
        "sheet": {"commons_q": "Satie Gymnopedie",
                  "must_any": [["gymnopedie"], ["gymnopédie"]]},
    },
    # === Гендель ===
    {
        "composer_slug": "handel",
        "title": "Handel — Sarabande from Suite in D minor, HWV 437",
        "instrument": "Клавесин/фортепиано",
        "year": 1733,
        "audio_q": "Handel Sarabande HWV 437",
        "audio_must": [["sarabande", "handel"], ["hwv 437"]],
        "sheet": {"commons_q": "Handel Suite HWV 437",
                  "must_any": [["hwv 437"], ["sarabande", "handel"]]},
    },
    # === Гайдн ===
    {
        "composer_slug": "haydn",
        "title": "Haydn — Symphony No. 94 «Surprise», Hob. I:94 — Andante",
        "instrument": "Симфонический оркестр",
        "year": 1791,
        "audio_q": "Haydn Symphony 94 Surprise Andante",
        "audio_must": [["surprise", "haydn"], ["symphony 94"], ["hob.i:94"]],
        "sheet": {"commons_q": "Haydn Symphony 94 Surprise",
                  "must_any": [["hob.i:94"], ["surprise", "haydn"], ["symphony", "94", "haydn"]]},
    },
]


# ── HTTP ──────────────────────────────────────────────────────────────────────
def http(url):
    return urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": USER_AGENT}),
        timeout=60,
    )


def commons_search(query, exts):
    """Возвращает имена файлов из Commons по query, фильтр расширений на клиенте.
    (Commons MediaWiki search не поддерживает корректно `filetype:X OR filetype:Y`.)"""
    enc = urllib.parse.quote(query)
    url = (f"https://commons.wikimedia.org/w/api.php?action=query&format=json"
           f"&list=search&srsearch={enc}&srnamespace=6&srlimit=30")
    with http(url) as r:
        data = json.loads(r.read().decode("utf-8"))
    out = []
    for h in data.get("query", {}).get("search", []):
        t = h["title"]
        if not t.startswith("File:"):
            continue
        name = t[5:]
        if any(name.lower().endswith("." + e) for e in exts):
            out.append(name)
    return out


def name_matches(name, must_any: List[List[str]], black=()):
    low = name.lower()
    if any(b in low for b in black):
        return False
    return any(all(re.search(re.escape(w), low) for w in g) for g in must_any)


def commons_pick(query, exts, must_any, black=()):
    for c in commons_search(query, exts):
        if name_matches(c, must_any, black):
            return c
    return None


def download_commons(filename):
    enc = urllib.parse.quote(filename.replace(" ", "_"))
    url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{enc}"
    with http(url) as r:
        return r.read()


def fetch_mutopia(zip_url):
    try:
        with http(zip_url) as r:
            data = r.read()
        z = zipfile.ZipFile(io.BytesIO(data))
        pdfs = [n for n in z.namelist() if n.lower().endswith(".pdf")]
        if pdfs:
            return z.read(pdfs[0])
    except Exception as e:
        print(f"    (mutopia err: {e})")
    return None


# ── DB ────────────────────────────────────────────────────────────────────────
def db_q(sql):
    out = subprocess.check_output(
        ["sudo", "-u", "postgres", "psql", "sonatum_music", "-t", "-A", "-F|", "-c", sql],
        text=True,
    )
    return [line.split("|") for line in out.strip().split("\n") if line.strip()]


def db_x(sql):
    subprocess.check_call(
        ["sudo", "-u", "postgres", "psql", "sonatum_music", "-c", sql],
        stdout=subprocess.DEVNULL,
    )


def slug_safe(s, maxlen=80):
    out = []
    for c in s.lower():
        if c.isalnum():
            out.append(c)
        elif c in " -_":
            out.append("-")
    res = "".join(out)
    while "--" in res:
        res = res.replace("--", "-")
    return res.strip("-")[:maxlen]


def cuid():
    return os.urandom(12).hex()


def ffprobe_seconds(path):
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            text=True,
        )
        return int(float(out.strip()) or 180)
    except Exception:
        return 180


# ── Создание композиторов ─────────────────────────────────────────────────────
def find_or_create_artist(slug, name, wiki_title):
    rows = db_q(f"SELECT id, avatar FROM artists WHERE slug='{slug}' LIMIT 1;")
    if rows:
        return rows[0][0]

    print(f"  + создаём артиста '{name}' ({slug})")
    # Создаём User + Artist (User нужен для FK)
    user_id = "u_" + cuid()
    artist_id = "art_" + cuid()
    user_email = f"{slug}@seed.sonatum.ru"
    safe_name = name.replace("'", "''")

    db_x(f"""
        INSERT INTO users (id, email, "passwordHash", role, status, "createdAt", "updatedAt")
        VALUES ('{user_id}', '{user_email}', 'seed', 'ARTIST', 'ACTIVE', now(), now())
        ON CONFLICT DO NOTHING;
    """)
    db_x(f"""
        INSERT INTO artists (id, "userId", name, slug, verified, followers, "authorType",
                             "createdAt", "updatedAt")
        VALUES ('{artist_id}', '{user_id}', '{safe_name}', '{slug}', true, 0, 'BOTH',
                now(), now());
    """)

    # Аватар с Wikipedia
    try:
        cover_path = f"{COVERS_DIR}/{slug}.jpg"
        if not os.path.exists(cover_path):
            enc = urllib.parse.quote(wiki_title.replace(" ", "_"))
            for lang in ("ru", "en"):
                try:
                    with http(f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{enc}") as r:
                        s = json.loads(r.read().decode("utf-8"))
                    if s.get("type") == "disambiguation":
                        continue
                    img = (s.get("originalimage") or {}).get("source") or (s.get("thumbnail") or {}).get("source")
                    if img:
                        with http(img) as r:
                            raw = r.read()
                        with open(cover_path + ".dl", "wb") as f:
                            f.write(raw)
                        subprocess.run(
                            ["convert", cover_path + ".dl", "-resize", "800x800>",
                             "-quality", "78", "-strip", "-background", "white",
                             "-flatten", cover_path],
                            check=True, stderr=subprocess.DEVNULL,
                        )
                        os.remove(cover_path + ".dl")
                        db_x(f"UPDATE artists SET avatar='{WEB_COVER}/{slug}.jpg' WHERE id='{artist_id}';")
                        print(f"    ✓ фото {os.path.getsize(cover_path)//1024} КБ")
                        break
                except Exception:
                    continue
    except Exception as e:
        print(f"    (avatar err: {e})")

    return artist_id


# ── Импорт произведений ───────────────────────────────────────────────────────
def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(PDF_DIR, exist_ok=True)

    # 1. Создаём недостающих композиторов
    print("=== composers ===")
    for c in NEW_COMPOSERS:
        find_or_create_artist(c["slug"], c["name"], c["wiki"])

    # 2. Получаем uploaderId для SheetMusic
    rows = db_q("SELECT id FROM users WHERE role IN ('ADMIN','SUPER_ADMIN') LIMIT 1;")
    if not rows:
        rows = db_q("SELECT id FROM users LIMIT 1;")
    uploader_id = rows[0][0]

    print("\n=== works ===")
    ok_tracks, ok_sheets, fail = [], [], []

    for w in WORKS:
        print(f"\n[{w['title']}]")

        # Найти артиста
        art_rows = db_q(f"SELECT id, avatar FROM artists WHERE slug='{w['composer_slug']}' LIMIT 1;")
        if not art_rows:
            print("  ⊘ артист не найден, пропуск")
            fail.append(w["title"] + " (no artist)")
            continue
        artist_id, avatar = art_rows[0][0], art_rows[0][1]

        slug = slug_safe(w['composer_slug'] + "-" + w['title'])

        # Если такой трек уже есть — пропускаем
        if db_q(f"SELECT 1 FROM tracks WHERE slug='{slug}' LIMIT 1;"):
            print("  ⊘ трек уже есть, skip")
            continue

        try:
            # 1. Аудио
            audio_name = commons_pick(
                w["audio_q"], ["ogg", "mp3", "flac"], w["audio_must"]
            )
            if not audio_name:
                print("  ✗ аудио не найдено")
                fail.append(w["title"] + " (no audio)")
                continue
            print(f"  ♪  Commons: {audio_name}")
            audio_data = download_commons(audio_name)
            ext = audio_name.rsplit(".", 1)[1].lower()
            audio_path = f"{AUDIO_DIR}/{slug}.{ext}"
            with open(audio_path, "wb") as f:
                f.write(audio_data)
            duration = ffprobe_seconds(audio_path)
            print(f"     {len(audio_data)//1024} КБ · {duration}с")

            # 2. PDF
            pdf_data, pdf_src = None, None
            sht = w["sheet"]
            if sht.get("mutopia"):
                pdf_data = fetch_mutopia(sht["mutopia"])
                if pdf_data:
                    pdf_src = "mutopia"
            if not pdf_data and sht.get("commons_q"):
                fname = commons_pick(sht["commons_q"], ["pdf"],
                                     sht["must_any"], black=PDF_BLACK)
                if fname:
                    print(f"  ♫  Commons PDF: {fname}")
                    pdf_data = download_commons(fname)
                    pdf_src = f"commons:{fname[:40]}"

            # 3. INSERT track
            track_id = "trk_" + cuid()
            web_audio = f"{WEB_AUDIO}/{slug}.{ext}"
            cover = avatar if avatar else ""
            esc_title = w["title"].replace("'", "''")
            release = f"{w.get('year', 1900)}-01-01"
            db_x(f"""
                INSERT INTO tracks
                  (id, title, slug, duration, "audioUrl", cover,
                   "artistId", "playCount", "likeCount", "purchaseCount",
                   "isFree", "isForSale", "isExplicit", status,
                   "releaseDate", "createdAt", "updatedAt", "publishedAt")
                VALUES
                  ('{track_id}', '{esc_title}', '{slug}', {duration}, '{web_audio}', '{cover}',
                   '{artist_id}', 0, 0, 0,
                   true, false, false, 'PUBLISHED',
                   '{release}', now(), now(), now());
            """)
            ok_tracks.append(w["title"])
            print(f"  ✓ track {track_id}")

            # 4. INSERT sheet (если PDF есть)
            if pdf_data and len(pdf_data) > 5_000:
                pdf_path = f"{PDF_DIR}/{slug}.pdf"
                with open(pdf_path, "wb") as f:
                    f.write(pdf_data)
                sm_id = "sm_" + cuid()
                esc_instr = w["instrument"].replace("'", "''")
                db_x(f"""
                    INSERT INTO sheet_music
                      (id, "trackId", title, "composerId", "pdfUrl", instrument,
                       difficulty, "isPublicDomain", "verifyStatus",
                       "uploaderId", "createdAt", "updatedAt")
                    VALUES
                      ('{sm_id}', '{track_id}', '{esc_title}', '{artist_id}',
                       '{WEB_PDF}/{slug}.pdf', '{esc_instr}',
                       'INTERMEDIATE', true, 'APPROVED',
                       '{uploader_id}', now(), now());
                """)
                ok_sheets.append(w["title"])
                print(f"  ✓ sheet  ({pdf_src}, {len(pdf_data)//1024} КБ)")
            else:
                print("  ⊘ нот не нашли — трек без нот")

            time.sleep(0.5)
        except Exception as e:
            print(f"  ✗ ошибка: {e}")
            fail.append(w["title"])

    print("\n=== ИТОГО ===")
    print(f"  треков:   {len(ok_tracks)}")
    print(f"  с нотами: {len(ok_sheets)}")
    print(f"  ошибок:   {len(fail)}")
    for t in fail:
        print(f"    - {t}")


if __name__ == "__main__":
    main()
