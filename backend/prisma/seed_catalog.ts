import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultAudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
const defaultCoverUrl = "https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&q=80&w=400";

async function main() {
  console.log("Seeding comprehensive catalog...");
  
  // WIPE OLD SEED DATA (Cascades to Artist, Track, Genres, TrackGenres)
  console.log("Clearing old seed data...");
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@seed.sonatum.ru' } }
  });

  // 1. Создание пользователя-заглушки для авторов
  const adminUser = await prisma.user.upsert({
    where: { email: 'seed_admin@sonatum.ru' },
    update: {},
    create: {
      email: 'seed_admin@sonatum.ru',
      username: 'seed_admin',
      passwordHash: 'dummy',
      role: 'ADMIN',
      firstName: 'System',
      lastName: 'Seeder',
    }
  });

  // 2. ROOT GENRES
  const rootGenresData = [
    { name: 'Духовная', slug: 'duhovnaya', color: '#8B5A2B', icon: 'cross' },
    { name: 'Народная', slug: 'narodnaya', color: '#228B22', icon: 'leaf' },
    { name: 'Академическая', slug: 'classical', color: '#4682B4', icon: 'music' },
    { name: 'Современная', slug: 'modern', color: '#9370DB', icon: 'headphones' },
  ];

  const rootGenres: Record<string, any> = {};
  for (const g of rootGenresData) {
    rootGenres[g.slug] = await prisma.genre.upsert({
      where: { slug: g.slug },
      update: { name: g.name, color: g.color, icon: g.icon, parentId: null },
      create: { name: g.name, slug: g.slug, color: g.color, icon: g.icon, parentId: null }
    });
  }

  // 3. СУБЖАНРЫ
  const subgenresData: Record<string, Array<{ name: string; slug: string }>> = {
    'duhovnaya': [
      { name: 'Знаменный распев (крюковое пение)', slug: 'znamenny' },
      { name: 'Духовные концерты', slug: 'duhovny-concert' },
      { name: 'Колокольные звоны', slug: 'bells-chime' },
      { name: 'Современное церковное пение', slug: 'modern-church' },
      { name: 'Другие конфессии России', slug: 'other-religions' }
    ],
    'narodnaya': [
      { name: 'Обрядовая песня', slug: 'obryadovaya' },
      { name: 'Бытовая лирика', slug: 'bytovaya' },
      { name: 'Былины и исторические песни', slug: 'byliny' },
      { name: 'Инструментальная традиция', slug: 'instrumental-folk' },
      { name: 'Региональные школы', slug: 'regional-folk' }
    ],
    'classical': [
      { name: 'Инструментальная сольная музыка', slug: 'solo-classical' },
      { name: 'Камерная музыка', slug: 'chamber' },
      { name: 'Симфоническая музыка', slug: 'symphonic' },
      { name: 'Вокальная музыка', slug: 'vocal-classical' },
      { name: 'Танцевальная музыка', slug: 'dance-classical' },
      { name: 'Опера и балет', slug: 'opera-ballet' }
    ],
    'modern': [
      { name: 'Авторская песня и барды', slug: 'bard' },
      { name: 'Рок', slug: 'rock' },
      { name: 'Хип-хоп и рэп', slug: 'hip-hop' },
      { name: 'Поп и эстрада', slug: 'estrada' },
      { name: 'Электроника', slug: 'electronica' },
      { name: 'Фолк', slug: 'folk-modern' },
      { name: 'Джаз', slug: 'jazz' }
    ]
  };

  const subgenres: Record<string, any> = {};
  for (const [parentSlug, subs] of Object.entries(subgenresData)) {
    for (const sub of subs) {
      subgenres[sub.slug] = await prisma.genre.upsert({
        where: { slug: sub.slug },
        update: { parentId: rootGenres[parentSlug].id },
        create: { name: sub.name, slug: sub.slug, parentId: rootGenres[parentSlug].id }
      });
    }
  }

  // 4. ДАННЫЕ ДЛЯ АРТИСТОВ И ТРЕКОВ
  let trackCounter = 1;
  const generateTracks = async (artistName: string, subgenreSlug: string, tracksData: any[]) => {
    // Generate purely numeric slug for Artist (e.g. 523910)
    const artistSlug = Math.floor(100000 + Math.random() * 900000).toString();
    
    const mockUser = await prisma.user.upsert({
      where: { email: `${artistSlug}@seed.sonatum.ru` },
      update: {},
      create: {
        email: `${artistSlug}@seed.sonatum.ru`,
        username: `user_${artistSlug}`,
        passwordHash: 'dummy',
        role: 'ARTIST',
        firstName: artistName
      }
    });

    const artist = await prisma.artist.upsert({
      where: { slug: artistSlug },
      update: { name: artistName, userId: mockUser.id },
      create: { name: artistName, slug: artistSlug, userId: mockUser.id, authorType: 'PERFORMER', verified: true }
    });

    for (const data of tracksData) {
      // Generate purely numeric slug for Track (e.g. 819203)
      const trackSlug = Math.floor(100000 + Math.random() * 900000).toString();
      const parentKey = Object.keys(subgenresData).find(parent => subgenresData[parent].find(s => s.slug === subgenreSlug));
      const subcategoryName = parentKey ? subgenresData[parentKey].find(s => s.slug === subgenreSlug)?.name : '';

      const metadata = {
        ...data.metadata,
        subcategory: subcategoryName
      };

      await prisma.track.upsert({
        where: { slug: trackSlug },
        update: {
          title: data.title,
          metadata: metadata,
          status: 'PUBLISHED',
          isForSale: false,
          isFree: true,
          confession: metadata.confession || null,
          language: metadata.language || null,
          artistId: artist.id,
        },
        create: {
          title: data.title,
          slug: trackSlug,
          duration: Math.floor(Math.random() * 100) + 120, // 2-4 minutes
          audioUrl: defaultAudioUrl,
          cover: defaultCoverUrl,
          artistId: artist.id,
          status: 'PUBLISHED',
          isFree: true,
          isForSale: false,
          confession: metadata.confession || null,
          language: metadata.language || null,
          metadata: metadata,
          genres: {
            create: [
              { genreId: rootGenres[parentKey!].id },
              { genreId: subgenres[subgenreSlug].id }
            ]
          }
        }
      });
      trackCounter++;
    }
  };

  // --- ДУХОВНАЯ --- //
  await generateTracks("Хор Троице-Сергиевой Лавры", "znamenny", [
    { title: "Иже Херувимы (Столповой распев)", metadata: { confession: "Православие", language: "Церковнославянский", era: "Древнерусская", choirType: "Мужской хор", performanceStyle: "Столповой распев", format: "Аутентичная" } },
    { title: "Тело Христово приимите (Большой распев)", metadata: { confession: "Православие", language: "Церковнославянский", era: "Древнерусская", choirType: "Мужской хор", performanceStyle: "Большой распев", format: "Студийная" } }
  ]);
  await generateTracks("Хор имени Свешникова", "duhovny-concert", [
    { title: "Бортнянский - Херувимская песнь №7", metadata: { confession: "Православие", era: "Классический период (XVIII век)", choirType: "Смешанный хор", format: "Концертная", voices: "4-голосный" } },
    { title: "Рахманинов - Богородице Дево, радуйся", metadata: { confession: "Православие", era: "Серебряный век", choirType: "Смешанный хор", format: "Студийная", voices: "8-голосный" } }
  ]);
  await generateTracks("Звонари Храма Христа Спасителя", "bells-chime", [
    { title: "Праздничный Пасхальный Трезвон", metadata: { bellType: "Трезвон", serviceTime: "Утренний звон", calendar: "Пасха", region: "Москва", complexity: "Сложный" } },
    { title: "Будничный благовест", metadata: { bellType: "Благовест", serviceTime: "Вечерний звон", calendar: "Повседневные", region: "Москва", complexity: "Простой" } }
  ]);
  await generateTracks("Хор Сретенского монастыря", "modern-church", [
    { title: "Свете тихий (Современная гармонизация)", metadata: { confession: "Православие", performanceStyle: "Академическое церковное пение", choirType: "Мужской хор", genre: "Богослужебное пение" } },
    { title: "Псалом 50 (Новая музыка)", metadata: { confession: "Православие", performanceStyle: "Современные интерпретации", choirType: "Смешанный хор", genre: "Псалмы" } }
  ]);
  await generateTracks("Камерный хор Баха", "other-religions", [
    { title: "Григорианский хорал (Salve Regina)", metadata: { confession: "Католичество", language: "Латынь", format: "Богослужебная", region: "Северо-Запад" } },
    { title: "Лютеранский гимн (Ein feste Burg)", metadata: { confession: "Протестантизм", language: "Немецкий", format: "Студийная", region: "Центральная Россия" } }
  ]);

  // --- НАРОДНАЯ --- //
  await generateTracks("Фольклорный ансамбль 'Родники'", "obryadovaya", [
    { title: "Святочные Колядки", metadata: { cycle: "Зимние", execution: "Смешанный хор", region: "Южная школа" } },
    { title: "Ой, на Ивана Купала", metadata: { cycle: "Летние", execution: "Соло", region: "Центр" } }
  ]);
  await generateTracks("Деревенский хор", "bytovaya", [
    { title: "Ой, мороз, мороз (Протяжная)", metadata: { songType: "Протяжные песни", mood: "Грустная", region: "Сибирская школа" } },
    { title: "Частушки-веселушки", metadata: { songType: "Частушки", mood: "Задорные", region: "Уральская школа" } }
  ]);
  await generateTracks("Гусляры России", "byliny", [
    { title: "Былина об Илье Муромце", metadata: { bylineCycle: "Киевский цикл", execution: "Соло с гуслями", region: "Северная школа" } },
    { title: "Казачья историческая (Ой, да на реке)", metadata: { bylineCycle: "Исторические", execution: "С ансамблем", region: "Южная школа" } }
  ]);
  await generateTracks("Оркестр народных инструментов", "instrumental-folk", [
    { title: "Плясовой наигрыш на балалайке", metadata: { instruments: ["Балалайка"], ensemble: "Соло", mood: "Энергичная" } },
    { title: "Волжские напевы", metadata: { instruments: ["Баян", "Домбра"], ensemble: "Оркестр", mood: "Лиричная" } }
  ]);
  await generateTracks("Северные голоса", "regional-folk", [
    { title: "Беломорская свадебная", metadata: { school: "Северная школа", mood: "Торжественная" } },
    { title: "Поволжская заливистая", metadata: { school: "Поволжская школа", mood: "Задорные" } }
  ]);

  // --- АКАДЕМИЧЕСКАЯ --- //
  await generateTracks("Борис Березовский", "solo-classical", [
    { title: "Соната для фортепиано №2 (Скрябин)", metadata: { instruments: ["Фортепиано"], form: "Соната", composer: "Скрябин", era: "Серебряный век" } },
    { title: "Этюд-картина фа минор (Рахманинов)", metadata: { instruments: ["Фортепиано"], form: "Этюд", composer: "Рахманинов", era: "Серебряный век" } }
  ]);
  await generateTracks("Квартет им. Бородина", "chamber", [
    { title: "Струнный квартет №8 (Шостакович)", metadata: { ensemble: "Струнный квартет", form: "Квартет", composer: "Шостакович", era: "Советский период" } },
    { title: "Фортепианное трио (Чайковский)", metadata: { ensemble: "Фортепианный трио", form: "Трио", composer: "Чайковский", era: "Вторая половина XIX века" } }
  ]);
  await generateTracks("ГАСО им. Светланова", "symphonic", [
    { title: "Симфония №6 'Патетическая' (Чайковский)", metadata: { orchestra: "ГАСО", form: "Симфония", composer: "Чайковский", era: "Вторая половина XIX века" } },
    { title: "Симфоническая поэма 'Поэма экстаза' (Скрябин)", metadata: { orchestra: "ГАСО", form: "Симфоническая поэма", composer: "Скрябин", era: "Серебряный век" } }
  ]);
  await generateTracks("Дмитрий Хворостовский", "vocal-classical", [
    { title: "Мне грустно... (Романс Даргомыжского)", metadata: { voices: "Баритон", style: "Романс", composer: "Даргомыжский", era: "Золотой век" } },
    { title: "Ария Елецкого (Пиковая дама)", metadata: { voices: "Баритон", style: "Оперная ария", composer: "Чайковский", era: "Вторая половина XIX века" } }
  ]);
  await generateTracks("Оркестр Большого театра", "dance-classical", [
    { title: "Вальс Цветов (Щелкунчик)", metadata: { danceType: "Вальс", composer: "Чайковский", context: "Из балетов" } },
    { title: "Камаринская (Оркестровая фантазия)", metadata: { danceType: "Камаринская", composer: "Глинка", context: "Самостоятельные сочинения" } }
  ]);
  await generateTracks("Солисты Мариинского театра", "opera-ballet", [
    { title: "Хор из оперы 'Борис Годунов'", metadata: { operaType: "Историческая опера", composer: "Мусоргский", era: "Могучая кучка" } },
    { title: "Танец рыцарей (Ромео и Джульетта)", metadata: { operaType: "Драматический балет", composer: "Прокофьев", era: "Советский период" } }
  ]);

  // --- СОВРЕМЕННАЯ --- //
  await generateTracks("Булат Окуджава", "bard", [
    { title: "Надежды маленький оркестрик", metadata: { generation: "Классики (1960–1980-е)", theme: "Лирическая", style: "Гитарный романс" } },
    { title: "Дежурный по апрелю", metadata: { generation: "Классики (1960–1980-е)", theme: "Городская лирика", style: "Поэтическая песня" } }
  ]);
  await generateTracks("Аквариум", "rock", [
    { title: "Город золотой", metadata: { rockStyle: "Классический русский рок (1980-е)", era: "Подпольный период (1980–1985)", theme: "Философская" } },
    { title: "Поезд в огне", metadata: { rockStyle: "Классический русский рок (1980-е)", era: "Перестройка и расцвет (1986–1991)", theme: "Социальная критика" } }
  ]);
  await generateTracks("Каста", "hip-hop", [
    { title: "Вокруг шум", metadata: { generation: "Золотой век (2000–2010)", hiphopStyle: "Классический рэп", region: "Юг России" } },
    { title: "Радиосигналы", metadata: { generation: "Золотой век (2000–2010)", hiphopStyle: "Концептуальный рэп", region: "Юг России" } }
  ]);
  await generateTracks("Zivert", "estrada", [
    { title: "Life", metadata: { popStyle: "Танцевальный поп", era: "2010-е", format: "Сольные исполнители" } },
    { title: "Credo", metadata: { popStyle: "Лирический поп", era: "2010-е", format: "Сольные исполнители" } }
  ]);
  await generateTracks("IC3PEAK", "electronica", [
    { title: "Смерти больше нет", metadata: { electroGenre: "Экспериментальная электроника", era: "2010-е", region: "Москва" } },
    { title: "Плак-плак", metadata: { electroGenre: "Эмбиент и неоклассика", era: "2010-е", region: "Москва" } }
  ]);
  await generateTracks("Мельница", "folk-modern", [
    { title: "Дорога сна", metadata: { folkDirection: "Фолк-рок", instruments: ["Акустическая гитара + этнические элементы"] } },
    { title: "Ночная кобыла", metadata: { folkDirection: "Фолк-рок", instruments: ["С народными инструментами"] } }
  ]);
  await generateTracks("Игорь Бутман", "jazz", [
    { title: "Русские страсти", metadata: { jazzStyle: "Современный джаз (1990-е — н.в.)", format: "Квартет / трио", center: "Москва" } },
    { title: "Осенний блюз", metadata: { jazzStyle: "Современный джаз (1990-е — н.в.)", format: "Соло-исполнители", center: "Москва" } }
  ]);

  console.log(`Seeded complete! Total Tracks generated: 48`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
