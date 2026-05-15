const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const track = await prisma.track.findFirst({
    where: { slug: '608986' },
    include: {
      tags: { include: { tag: true } },
      sheetMusic: true
    }
  });
  console.log(JSON.stringify(track, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
