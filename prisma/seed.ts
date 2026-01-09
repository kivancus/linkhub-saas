import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default themes
  const themes = [
    {
      id: 'default',
      name: 'Default',
      isPremium: false,
      previewImageUrl: '/themes/default-preview.png',
      cssTemplate: '.bio-page { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }',
      colorVariables: JSON.stringify(['primary', 'secondary', 'background', 'text'])
    },
    {
      id: 'minimal',
      name: 'Minimal',
      isPremium: false,
      previewImageUrl: '/themes/minimal-preview.png',
      cssTemplate: '.bio-page { background: #ffffff; color: #333333; }',
      colorVariables: JSON.stringify(['primary', 'secondary', 'background', 'text'])
    },
    {
      id: 'dark',
      name: 'Dark Mode',
      isPremium: false,
      previewImageUrl: '/themes/dark-preview.png',
      cssTemplate: '.bio-page { background: #1a1a1a; color: #ffffff; }',
      colorVariables: JSON.stringify(['primary', 'secondary', 'background', 'text'])
    },
    {
      id: 'glass',
      name: 'Glass Morphism',
      isPremium: true,
      previewImageUrl: '/themes/glass-preview.png',
      cssTemplate: '.bio-page { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); backdrop-filter: blur(20px); }',
      colorVariables: JSON.stringify(['primary', 'secondary', 'background', 'text'])
    },
    {
      id: 'gradient-pro',
      name: 'Gradient Pro',
      isPremium: true,
      previewImageUrl: '/themes/gradient-pro-preview.png',
      cssTemplate: '.bio-page { background: linear-gradient(45deg, #ff9a9e 0%, #fecfef 100%); }',
      colorVariables: JSON.stringify(['primary', 'secondary', 'background', 'text'])
    }
  ];

  // Insert themes
  for (const theme of themes) {
    await prisma.theme.upsert({
      where: { id: theme.id },
      update: theme,
      create: theme,
    });
  }

  console.log(`✅ Created ${themes.length} themes (${themes.filter(t => !t.isPremium).length} free, ${themes.filter(t => t.isPremium).length} premium)`);
  console.log('🎨 Available themes:', themes.map(t => `${t.name}${t.isPremium ? ' (Premium)' : ''}`).join(', '));

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { username: 'demoaccount' },
    update: {},
    create: {
      username: 'demoaccount',
      email: 'demo@linkhub.com',
      passwordHash: '$2a$10$dummy.hash.for.demo.user.only', // This won't work for login, just for demo
      profileName: 'Demo Account',
      profileBio: 'This is a demo LinkHub bio page showcasing the platform features.',
      emailVerified: true,
    },
  });

  // Create demo bio page
  const demoBioPage = await prisma.bioPage.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      themeId: 'default',
      isPublished: true,
    },
  });

  // Create demo links
  const demoLinks = [
    {
      title: 'My Portfolio',
      url: 'https://portfolio.com',
      iconName: 'globe',
      orderIndex: 1,
    },
    {
      title: 'GitHub Profile',
      url: 'https://github.com/demoaccount',
      iconName: 'github',
      orderIndex: 2,
    },
    {
      title: 'Twitter',
      url: 'https://twitter.com/demoaccount',
      iconName: 'twitter',
      orderIndex: 3,
    },
  ];

  for (const link of demoLinks) {
    await prisma.link.create({
      data: {
        ...link,
        bioPageId: demoBioPage.id,
        isActive: true,
      },
    });
  }

  console.log('👤 Created demo user: demoaccount');
  console.log('🔗 Created demo bio page with 3 links');
  console.log('🌐 Visit: http://localhost:3000/demoaccount');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });