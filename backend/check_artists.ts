import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const artists = await prisma.artist.findMany({
    select: { 
      name: true, 
      bio: true, 
      avatar: true 
    }
  });

  const emptyArtists = artists.filter(a => !a.bio || !a.avatar);
  const filledArtists = artists.filter(a => !!a.bio && !!a.avatar);

  console.log(`ВСЕГО АРТИСТОВ: ${artists.length}`);
  console.log(`ЗАПОЛНЕНО: ${filledArtists.length}`);
  console.log(`НЕ ЗАПОЛНЕНО: ${emptyArtists.length}`);
  
  if (emptyArtists.length > 0) {
    console.log('\n--- НЕ ЗАПОЛНЕННЫЕ АРТИСТЫ ---');
    emptyArtists.forEach(a => console.log(`- ${a.name}`));
  }

  console.log('\n--- ЗАПОЛНЕННЫЕ АРТИСТЫ ---');
  filledArtists.forEach(a => console.log(`- ${a.name}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
