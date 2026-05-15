import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultAvatars = [
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1493225457124-a1a2f298fa91?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1520637836993-5f0e98741d5e?auto=format&fit=crop&q=80&w=400'
];

async function main() {
  console.log('Seeding missing artists with minimal data...');

  // Find all artists missing an avatar or bio
  const artists = await prisma.artist.findMany({
    where: {
      OR: [
        { avatar: null },
        { avatar: '' },
        { bio: null },
        { bio: '' }
      ]
    }
  });

  console.log(`Found ${artists.length} artists missing bio/avatar data.`);

  let updatedCount = 0;
  for (const artist of artists) {
    const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
    const defaultBio = `Профиль исполнителя "${artist.name}".\n\nЭтот артист недавно присоединился к Sonatum Music. Мы находимся в процессе сбора подробной биографии, но вы уже можете наслаждаться его прекрасной музыкой из нашего каталога.`;
    
    await prisma.artist.update({
      where: { id: artist.id },
      data: {
        avatar: artist.avatar || randomAvatar,
        bio: artist.bio || defaultBio,
        followers: artist.followers > 0 ? artist.followers : Math.floor(100 + Math.random() * 5000),
        region: artist.region || 'Россия',
        foundedYear: artist.foundedYear || 2020
      }
    });
    console.log(`  ✓ Minimum seeded for: ${artist.name}`);
    updatedCount++;
  }

  console.log(`Done! Updated ${updatedCount} artists.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
