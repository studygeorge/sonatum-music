const { PrismaClient } = require('@prisma/client');
const { createHash, randomBytes, pbkdf2Sync } = require('crypto');

const prisma = new PrismaClient();

// Хеширование пароля
function hashPassword(password) {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Данные жанров
const genres = [
  { name: 'Рэп', slug: 'rap', icon: 'mic', color: '#FF6B6B', description: 'Русский рэп и хип-хоп культура' },
  { name: 'Рок', slug: 'rock', icon: 'guitar', color: '#4ECDC4', description: 'Российский рок от классики до современности' },
  { name: 'Поп', slug: 'pop', icon: 'music', color: '#FFE66D', description: 'Популярная музыка с запоминающимися мелодиями' },
  { name: 'Электроника', slug: 'electronic', icon: 'wave', color: '#95E1D3', description: 'Электронная музыка всех направлений' },
  { name: 'Инди', slug: 'indie', icon: 'headphones', color: '#F38181', description: 'Независимая музыка с уникальным звучанием' },
  { name: 'Альтернатива', slug: 'alternative', icon: 'disc', color: '#AA96DA', description: 'Альтернативная музыка вне жанровых рамок' },
  { name: 'Панк', slug: 'punk', icon: 'zap', color: '#E94560', description: 'Панк-рок: энергия и протест' },
  { name: 'Метал', slug: 'metal', icon: 'shield', color: '#2C3E50', description: 'Тяжелая музыка различных направлений' },
  { name: 'Trap', slug: 'trap', icon: 'flame', color: '#FF5722', description: 'Современный трэп с 808 басами' },
  { name: 'Phonk', slug: 'phonk', icon: 'moon', color: '#9C27B0', description: 'Темный фонк с мемфис-рэп элементами' },
  { name: 'Lo-fi', slug: 'lofi', icon: 'coffee', color: '#E91E63', description: 'Расслабляющий lo-fi хип-хоп' },
  { name: 'Джаз', slug: 'jazz', icon: 'trumpet', color: '#795548', description: 'Джазовая музыка и импровизация' },
  { name: 'Пост-панк', slug: 'post-punk', icon: 'heart', color: '#607D8B', description: 'Мрачный пост-панк с синтезаторами' },
  { name: 'Drill', slug: 'drill', icon: 'bolt', color: '#212121', description: 'Жесткий дрилл с агрессивным флоу' },
  { name: 'R&B', slug: 'rnb', icon: 'star', color: '#673AB7', description: 'Ритм-энд-блюз с душевным вокалом' },
];

// Данные артистов
const artistsData = [
  { name: 'Oxxxymiron', slug: 'oxxxymiron', region: 'Москва', genres: ['rap'], verified: true, role: 'ARTIST', email: 'oxxxy@sonatum.music', password: 'Artist123!' },
  { name: 'Земфира', slug: 'zemfira', region: 'Москва', genres: ['rock', 'alternative'], verified: true, role: 'ARTIST', email: 'zemfira@sonatum.music', password: 'Artist123!' },
  { name: 'Монеточка', slug: 'monetochka', region: 'Екатеринбург', genres: ['indie', 'pop'], verified: true, role: 'ARTIST', email: 'monetochka@sonatum.music', password: 'Artist123!' },
  { name: 'IC3PEAK', slug: 'ic3peak', region: 'Москва', genres: ['electronic', 'alternative'], verified: true, role: 'ARTIST', email: 'ic3peak@sonatum.music', password: 'Artist123!' },
  { name: 'Кровосток', slug: 'krovostok', region: 'Москва', genres: ['rap'], verified: true, role: 'ARTIST', email: 'krovostok@sonatum.music', password: 'Artist123!' },
  { name: 'Дельфин', slug: 'dolphin', region: 'Москва', genres: ['alternative', 'electronic'], verified: true, role: 'ARTIST', email: 'dolphin@sonatum.music', password: 'Artist123!' },
  { name: 'Mnogoznaal', slug: 'mnogoznaal', region: 'Санкт-Петербург', genres: ['rap', 'trap'], verified: true, role: 'ARTIST', email: 'mnogoznaal@sonatum.music', password: 'Artist123!' },
  { name: 'Boulevard Depo', slug: 'boulevard-depo', region: 'Москва', genres: ['rap', 'trap'], verified: true, role: 'ARTIST', email: 'depo@sonatum.music', password: 'Artist123!' },
  { name: 'ЛСП', slug: 'lsp', region: 'Минск', genres: ['rap', 'alternative'], verified: true, role: 'ARTIST', email: 'lsp@sonatum.music', password: 'Artist123!' },
  { name: 'Shortparis', slug: 'shortparis', region: 'Санкт-Петербург', genres: ['alternative', 'post-punk'], verified: true, role: 'ARTIST', email: 'shortparis@sonatum.music', password: 'Artist123!' },
  { name: 'Cream Soda', slug: 'cream-soda', region: 'Москва', genres: ['pop', 'electronic'], verified: true, role: 'ARTIST', email: 'cream@sonatum.music', password: 'Artist123!' },
  { name: 'Хаски', slug: 'husky', region: 'Улан-Удэ', genres: ['rap', 'alternative'], verified: true, role: 'ARTIST', email: 'husky@sonatum.music', password: 'Artist123!' },
  { name: 'Anacondaz', slug: 'anacondaz', region: 'Москва', genres: ['rap', 'punk'], verified: true, role: 'ARTIST', email: 'anacondaz@sonatum.music', password: 'Artist123!' },
  { name: 'Валентин Стрыкало', slug: 'valentin-strykalo', region: 'Минск', genres: ['indie', 'pop'], verified: true, role: 'ARTIST', email: 'strykalo@sonatum.music', password: 'Artist123!' },
  { name: 'Порнофильмы', slug: 'pornofilms', region: 'Москва', genres: ['rock', 'punk'], verified: true, role: 'ARTIST', email: 'porno@sonatum.music', password: 'Artist123!' },
  { name: 'GONE.Fludd', slug: 'gone-fludd', region: 'Москва', genres: ['rap', 'trap'], verified: true, role: 'ARTIST', email: 'fludd@sonatum.music', password: 'Artist123!' },
  { name: 'Markul', slug: 'markul', region: 'Москва', genres: ['rap', 'trap'], verified: true, role: 'ARTIST', email: 'markul@sonatum.music', password: 'Artist123!' },
  { name: 'Scriptonite', slug: 'scriptonite', region: 'Павлодар', genres: ['rap', 'rnb'], verified: true, role: 'ARTIST', email: 'scriptonite@sonatum.music', password: 'Artist123!' },
  { name: 'Элджей', slug: 'eldzhey', region: 'Москва', genres: ['rap', 'pop'], verified: true, role: 'ARTIST', email: 'eldzhey@sonatum.music', password: 'Artist123!' },
  { name: 'Кино', slug: 'kino', region: 'Санкт-Петербург', genres: ['rock'], verified: true, role: 'ARTIST', email: 'kino@sonatum.music', password: 'Artist123!' },
];

// Названия треков
const trackNames = [
  'Новый день', 'Свет в окне', 'Дорога домой', 'Между строк', 'Осколки',
  'Последний шанс', 'Вечность', 'Город теней', 'Без правил', 'Время идёт',
  'Холодный асфалт', 'Разговор', 'Пустота', 'Начало', 'Финал',
  'Бессонница', 'Молчание', 'Крики', 'Дым', 'Лабиринт',
  'За гранью', 'Один в поле', 'Слёзы на асфальте', 'Ночной город',
  'Память', 'Отражение', 'Правда', 'Иллюзия', 'Свобода', 'Побег',
  'Туман', 'Рассвет', 'Закат', 'Тени', 'Звезды', 'Ветер'
];

async function main() {
  console.log('\n========================================');
  console.log('Заполнение базы данных Sonatum Music');
  console.log('========================================\n');

  // Очистка БД
  console.log('[1/7] Очистка существующих данных...');
  await prisma.trackTag.deleteMany();
  await prisma.trackGenre.deleteMany();
  await prisma.artistGenre.deleteMany();
  await prisma.likedTrack.deleteMany();
  await prisma.playlistTrack.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.track.deleteMany();
  await prisma.album.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.genre.deleteMany();
  console.log('   Данные очищены\n');

  // Создание жанров
  console.log('[2/7] Создание жанров...');
  const createdGenres = [];
  for (const genre of genres) {
    const created = await prisma.genre.create({ data: genre });
    createdGenres.push(created);
  }
  console.log(`   Создано ${createdGenres.length} жанров\n`);

  // Создание admin пользователя
  console.log('[3/7] Создание администраторов...');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@sonatum.music',
      username: 'admin',
      firstName: 'Администратор',
      lastName: 'Системы',
      passwordHash: hashPassword('Admin123!'),
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    }
  });
  console.log(`   Admin: ${adminUser.email} / Admin123!\n`);

  // Создание обычного пользователя
  const regularUser = await prisma.user.create({
    data: {
      email: 'user@sonatum.music',
      username: 'testuser',
      firstName: 'Тестовый',
      lastName: 'Пользователь',
      passwordHash: hashPassword('User123!'),
      role: 'USER',
      status: 'ACTIVE'
    }
  });
  console.log(`   User: ${regularUser.email} / User123!\n`);

  // Создание артистов
  console.log('[4/7] Создание артистов...');
  const createdArtists = [];
  for (const artistData of artistsData) {
    const { genres: genreSlugs, email, password, role, ...artistInfo } = artistData;

    const user = await prisma.user.create({
      data: {
        email,
        username: artistInfo.slug,
        firstName: artistInfo.name.split(' ')[0] || artistInfo.name,
        lastName: artistInfo.name.split(' ')[1] || '',
        passwordHash: hashPassword(password),
        role,
        status: 'ACTIVE'
      }
    });

    const artist = await prisma.artist.create({
      data: {
        userId: user.id,
        ...artistInfo,
        bio: `${artistInfo.name} — яркий представитель современной российской музыкальной сцены. Творчество характеризуется уникальным звучанием и авторским стилем.`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${artistInfo.slug}`,
        coverImage: `https://picsum.photos/seed/${artistInfo.slug}/1600/600`,
        foundedYear: 2010 + Math.floor(Math.random() * 14),
        followers: Math.floor(Math.random() * 2000000) + 10000,
        canSellMusic: true,
        socialLinks: {
          vk: `https://vk.com/${artistInfo.slug}`,
          telegram: `https://t.me/${artistInfo.slug}`,
          youtube: `https://youtube.com/@${artistInfo.slug}`
        }
      }
    });

    for (const genreSlug of genreSlugs) {
      const genre = createdGenres.find(g => g.slug === genreSlug);
      if (genre) {
        await prisma.artistGenre.create({
          data: { artistId: artist.id, genreId: genre.id }
        });
      }
    }

    createdArtists.push({ artist, genres: genreSlugs });
  }
  console.log(`   Создано ${createdArtists.length} артистов\n`);

  // Создание треков
  console.log('[5/7] Создание треков...');
  let totalTracks = 0;
  for (const { artist, genres: genreSlugs } of createdArtists) {
    const numTracks = 12 + Math.floor(Math.random() * 18);

    for (let i = 0; i < numTracks; i++) {
      const trackName = trackNames[Math.floor(Math.random() * trackNames.length)];
      const isFree = Math.random() > 0.7;
      const price = isFree ? null : (50 + Math.floor(Math.random() * 200));

      const track = await prisma.track.create({
        data: {
          title: `${trackName} ${i > 9 ? i : ''}`.trim(),
          slug: `${artist.slug}-${trackName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${i}`,
          duration: 120 + Math.floor(Math.random() * 240),
          audioUrl: `/audio/${artist.slug}/track-${i + 1}.mp3`,
          cover: `https://picsum.photos/seed/${artist.slug}-${i}/800/800`,
          bpm: 80 + Math.floor(Math.random() * 90),
          key: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bb', 'D', 'E', 'A'][Math.floor(Math.random() * 10)],
          price,
          isFree,
          isForSale: !isFree,
          format: 'mp3',
          artistId: artist.id,
          playCount: Math.floor(Math.random() * 1000000),
          likeCount: Math.floor(Math.random() * 100000),
          releaseDate: new Date(2020 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)),
          isExplicit: Math.random() > 0.85,
          status: 'PUBLISHED',
          publishedAt: new Date()
        }
      });

      for (const genreSlug of genreSlugs) {
        const genre = createdGenres.find(g => g.slug === genreSlug);
        if (genre) {
          await prisma.trackGenre.create({
            data: { trackId: track.id, genreId: genre.id }
          });
        }
      }

      totalTracks++;
    }
  }
  console.log(`   Создано ${totalTracks} треков\n`);

  // Создание плейлистов
  console.log('[6/7] Создание плейлистов...');
  const allTracks = await prisma.track.findMany({ take: 50 });
  
  const playlists = [
    { title: 'Лучшее из рэпа', description: 'Топовые треки русского рэпа' },
    { title: 'Инди микс', description: 'Независимая музыка для настроения' },
    { title: 'Рок классика', description: 'Легендарные рок композиции' },
    { title: 'Электронный вайб', description: 'Электроника для любого повода' }
  ];

  for (const playlistData of playlists) {
    const playlist = await prisma.playlist.create({
      data: {
        ...playlistData,
        slug: playlistData.title.toLowerCase().replace(/\s+/g, '-'),
        userId: regularUser.id,
        isPublic: true,
        cover: `https://picsum.photos/seed/${playlistData.title}/800/800`
      }
    });

    const shuffledTracks = allTracks.sort(() => Math.random() - 0.5).slice(0, 15);
    for (let i = 0; i < shuffledTracks.length; i++) {
      await prisma.playlistTrack.create({
        data: {
          playlistId: playlist.id,
          trackId: shuffledTracks[i].id,
          position: i + 1
        }
      });
    }

    await prisma.playlist.update({
      where: { id: playlist.id },
      data: {
        trackCount: shuffledTracks.length,
        duration: shuffledTracks.reduce((sum, t) => sum + t.duration, 0)
      }
    });
  }
  console.log(`   Создано ${playlists.length} плейлиста\n`);

  // Статистика
  console.log('[7/7] Подсчет статистики...\n');
  const stats = {
    users: await prisma.user.count(),
    artists: await prisma.artist.count(),
    tracks: await prisma.track.count(),
    genres: await prisma.genre.count(),
    playlists: await prisma.playlist.count(),
  };

  console.log('========================================');
  console.log('База данных успешно заполнена!');
  console.log('========================================\n');
  console.log('Статистика:');
  console.log(`  Пользователей: ${stats.users}`);
  console.log(`  Артистов: ${stats.artists}`);
  console.log(`  Треков: ${stats.tracks}`);
  console.log(`  Жанров: ${stats.genres}`);
  console.log(`  Плейлистов: ${stats.playlists}\n`);
  
  console.log('Учетные записи:');
  console.log('  Admin: admin@sonatum.music / Admin123!');
  console.log('  User:  user@sonatum.music / User123!');
  console.log('  Artists: [артист]@sonatum.music / Artist123!\n');
  
  console.log('Запустите "npm run db:studio" для просмотра данных\n');
}

main()
  .catch((e) => {
    console.error('\nОшибка при заполнении БД:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
