#!/usr/bin/env python3
"""
Подтягивает реальные фото артистов с ru.wikipedia.org / en.wikipedia.org
(CC BY-SA 4.0) и обновляет Artist.avatar в БД.

Запуск на сервере:
  cd /opt/sonatum && python3 scripts/fetch-artist-photos.py

Стратегия:
  1. Берём всех артистов с avatar='unsplash'/'dicebear' или пустых.
  2. Запрашиваем Wikipedia REST: page/summary/<имя> (ru → en fallback).
  3. Скачиваем originalimage / thumbnail.
  4. Сжимаем до 800x800 q78 jpeg.
  5. Кладём в /opt/sonatum/data/images/composers/<slug>.jpg.
  6. UPDATE artists SET avatar='/images/composers/<slug>.jpg' WHERE id=...
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

DATA_DIR = "/opt/sonatum/data/images/composers"
USER_AGENT = "SonatumBot/1.0 (https://sonatum-music.ru)"

# Алиасы для имён, которых не находит точный поиск.
NAME_OVERRIDES = {
    "Аквариум": "Аквариум (группа)",
    "Каста": "Каста (группа)",
    "Мельница": "Мельница (группа)",
    "Zivert": "Zivert",
    "IC3PEAK": "IC3PEAK",
    "Markul": "Markul",
    "Игорь Бутман": "Бутман, Игорь Михайлович",
    "Дмитрий Хворостовский": "Хворостовский, Дмитрий Александрович",
    "Булат Окуджава": "Окуджава, Булат Шалвович",
    "Борис Березовский": "Березовский, Борис Вадимович",
    "ГАСО им. Светланова": "Государственный академический симфонический оркестр России",
    "Оркестр Большого театра": "Оркестр Большого театра",
    "Хор Сретенского монастыря": "Хор Сретенского монастыря",
    "Хор имени Свешникова": "Государственный академический русский хор имени А. В. Свешникова",
    "Хор Троице-Сергиевой Лавры": "Хор Троице-Сергиевой лавры",
    "Квартет им. Бородина": "Квартет имени Бородина",
    "Звонари Храма Христа Спасителя": "Храм Христа Спасителя",
    "Гусляры России": "Гусли",
    "Северные голоса": None,                   # не персонаж — без фото
    "Деревенский хор": None,
    "Камерный хор Баха": None,
    "Оркестр народных инструментов": "Оркестр русских народных инструментов",
    "Солисты Мариинского театра": "Мариинский театр",
    "Фольклорный ансамбль 'Родники'": None,
}


def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode("utf-8"))


def http_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def wiki_summary(title, lang="ru"):
    enc = urllib.parse.quote(title.replace(" ", "_"))
    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{enc}"
    try:
        return http_json(url)
    except Exception:
        return None


def find_image(name):
    """Возвращает URL картинки или None."""
    title = NAME_OVERRIDES.get(name, name)
    if title is None:
        return None  # явно отключено
    # Сначала ru, потом en
    for lang in ("ru", "en"):
        s = wiki_summary(title, lang)
        if not s:
            continue
        # Пропускаем disambiguation страницы
        if s.get("type") == "disambiguation":
            continue
        img = (s.get("originalimage") or {}).get("source") or (s.get("thumbnail") or {}).get("source")
        if img:
            return img
    return None


def resize_to_jpg(raw, out_path):
    """Сохраняем во временный файл, ресайзим через ImageMagick mogrify."""
    tmp = out_path + ".dl"
    with open(tmp, "wb") as f:
        f.write(raw)
    # convert ужмёт в jpeg 800x800 max, q78
    subprocess.check_call(
        ["convert", tmp, "-resize", "800x800>", "-quality", "78", "-strip",
         "-interlace", "Plane", "-background", "white", "-flatten", out_path],
        stderr=subprocess.STDOUT
    )
    os.remove(tmp)


def db_query(sql):
    """Выполняем SQL через sudo -u postgres psql, возвращаем строки."""
    out = subprocess.check_output(
        ["sudo", "-u", "postgres", "psql", "sonatum_music", "-t", "-A", "-F|", "-c", sql],
        text=True
    )
    return [line.split("|") for line in out.strip().split("\n") if line.strip()]


def db_update_avatar(artist_id, path):
    sql = f"UPDATE artists SET avatar = '{path}', \"updatedAt\" = now() WHERE id = '{artist_id}';"
    subprocess.check_call(["sudo", "-u", "postgres", "psql", "sonatum_music", "-c", sql],
                          stdout=subprocess.DEVNULL)


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    # Берём только тех, у кого аватар Unsplash/Dicebear или null/пустой.
    rows = db_query("""
        SELECT id, name, slug, avatar FROM artists
        WHERE avatar IS NULL
           OR avatar = ''
           OR avatar LIKE '%unsplash%'
           OR avatar LIKE '%dicebear%'
        ORDER BY name;
    """)

    print(f"Кандидатов на обновление: {len(rows)}")

    ok = []
    skip = []
    fail = []

    for artist_id, name, slug, old_avatar in rows:
        try:
            print(f"\n[{name}]  slug={slug}")
            img_url = find_image(name)
            if not img_url:
                print(f"  ⊘  пропускаем (не найдено / явно отключено)")
                skip.append(name)
                continue
            print(f"  →  {img_url[:80]}...")

            raw = http_bytes(img_url)
            out_path = os.path.join(DATA_DIR, f"{slug}.jpg")
            resize_to_jpg(raw, out_path)
            size_kb = os.path.getsize(out_path) // 1024
            print(f"  ✓  сохранено {size_kb} КБ → {out_path}")

            db_update_avatar(artist_id, f"/images/composers/{slug}.jpg")
            print(f"  ✓  БД обновлена")
            ok.append(name)

            time.sleep(0.5)  # не долбим Wiki
        except Exception as e:
            print(f"  ✗  ошибка: {e}")
            fail.append((name, str(e)))

    print("\n=== ИТОГО ===")
    print(f"  обновлено: {len(ok)}")
    print(f"  пропущено: {len(skip)}")
    print(f"  ошибок:    {len(fail)}")
    if fail:
        print("\nОшибки:")
        for n, e in fail:
            print(f"  - {n}: {e}")


if __name__ == "__main__":
    main()
