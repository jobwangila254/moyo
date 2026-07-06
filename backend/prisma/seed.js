const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo Marakwet',
  'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado',
  'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga',
  'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia',
  'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit',
  'Meru', 'Migori', 'Mombasa', 'Muranga', 'Nairobi',
  'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua',
  'Nyeri', 'Samburu', 'Siaya', 'Taita Taveta', 'Tana River',
  'Tharaka Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu',
  'Vihiga', 'Wajir', 'West Pokot',
];

const SURNAMES = ['Mwangi', 'Kamau', 'Wanjiku', 'Omondi', 'Njoroge', 'Wambui', 'Kiprop', 'Otieno', 'Kariuki', 'Akinyi', 'Nyambura', 'Kipyegon', 'Chebet', 'Juma', 'Odhiambo'];

const NAMES_MALE = ['James', 'John', 'Peter', 'Daniel', 'Patrick', 'David', 'Samuel', 'Joseph', 'Kevin', 'Brian', 'Michael', 'Robert', 'George', 'Paul', 'Stephen', 'Mark', 'Alex', 'Eric', 'Collins', 'Felix', 'Isaiah', 'Tom', 'Chris', 'Victor', 'Ben'];
const NAMES_FEMALE = ['Mary', 'Jane', 'Grace', 'Faith', 'Esther', 'Sarah', 'Rose', 'Nancy', 'Margaret', 'Elizabeth', 'Catherine', 'Dorothy', 'Joyce', 'Alice', 'Ruth', 'Anne', 'Monica', 'Agnes', 'Lydia', 'Martha', 'Diana', 'Phyllis', 'Brenda', 'Caroline', 'Janet'];

const OCCUPATIONS = ['Software Engineer', 'Teacher', 'Nurse', 'Farmer', 'Business Owner', 'Student', 'Driver', 'Chef', 'Journalist', 'Banker', 'Doctor', 'Lawyer', 'Architect', 'Police Officer', 'Flight Attendant'];

const BIOS = [
  'Love hiking and exploring new places. Looking for someone to share adventures with!',
  'Coffee enthusiast and bookworm. Let me take you to my favorite café.',
  'Fitness lover and foodie. Yes, both can coexist!',
  'Looking for genuine connections, not games.',
  'Love traveling and meeting new people. Counties and counting!',
  'Outgoing and spontaneous. Let me show you the hidden gems of our county.',
  'Deep conversations and good laughs. Bonus if you can make me smile.',
  'Ambitious and driven. Looking for someone with their own goals too.',
  'Nature lover, dog person. Weekend getaways are my thing.',
  'Music is my soul. Looking for someone to share playlists with.',
  'Simple guy/girl who loves the outdoors and good food.',
  'Adventurous spirit trapped in a 9-5. Help me escape!',
  'Fitness enthusiast who also loves lazy Sundays.',
  'Book lover looking for my storybook romance.',
  'Foodie who loves cooking for two. Swipe right for homemade meals!',
];

const LIKES_OPTIONS = ['Music', 'Travel', 'Food', 'Fitness', 'Movies', 'Reading', 'Art', 'Fashion', 'Tech', 'Nature', 'Photography', 'Dancing', 'Animals', 'Coffee'];
const HOBBIES_OPTIONS = ['Hiking', 'Cooking', 'Gaming', 'Sports', 'Yoga', 'Painting', 'Writing', 'Gardening', 'Cycling', 'Swimming', 'Running', 'Singing', 'Dancing', 'Camping'];

const PHONE_PREFIXES = ['0701', '0702', '0703', '0710', '0711', '0712', '0720', '0721', '0722', '0730', '0733', '0734', '0740', '0743', '0757', '0768', '0770', '0771', '0780', '0790'];
let phoneIndex = 0;

function nextPhone() {
  const prefix = PHONE_PREFIXES[phoneIndex % PHONE_PREFIXES.length];
  const suffix = 100000 + Math.floor(phoneIndex / PHONE_PREFIXES.length) * 997 + (phoneIndex % 997);
  phoneIndex++;
  return `${prefix}${String(suffix).padStart(6, '0')}`;
}

function randomAge(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr, min, max) {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  return shuffle(arr).slice(0, count);
}

async function main() {
  console.log('Cleaning database...');
  await prisma.report.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.message.deleteMany();
  await prisma.match.deleteMany();
  await prisma.swipe.deleteMany();
  await prisma.user.deleteMany();
  await prisma.county.deleteMany();

  const tables = ['Report', 'Transaction', 'Message', 'Match', 'Swipe', 'User', 'County'];
  for (const table of tables) {
    try { await prisma.$executeRawUnsafe(`ALTER SEQUENCE "${table}_id_seq" RESTART WITH 1`); } catch {}
  }

  console.log('Seeding 47 counties...');
  const countyRecords = [];
  for (const name of COUNTIES) {
    const county = await prisma.county.create({ data: { name } });
    countyRecords.push(county);
  }
  console.log(`  Created ${countyRecords.length} counties`);

  console.log('Seeding 141 users (3 per county)...');
  const hashedPassword = await bcrypt.hash('Password123!', 12);
  const users = [];
  let idx = 0;

  for (let c = 0; c < countyRecords.length; c++) {
    const countyId = countyRecords[c].id;
    const genderPattern = c % 2 === 0 ? ['male', 'female', 'male'] : ['female', 'male', 'female'];

    for (let slot = 0; slot < 3; slot++) {
      const gender = genderPattern[slot];
      const namePool = gender === 'male' ? NAMES_MALE : NAMES_FEMALE;
      const name = `${namePool[idx % namePool.length]} ${SURNAMES[idx % SURNAMES.length]}`;
      const age = randomAge(18, 55);
      const interestedIn = gender === 'male' ? 'female' : 'male';
      const phone = nextPhone();
      const bio = BIOS[idx % BIOS.length];
      const tier = idx < 94 ? 'FREE' : 'PREMIUM';

      const user = await prisma.user.create({
        data: {
          phone,
          name,
          age,
          gender,
          interestedIn,
          countyId,
          bio,
          occupation: OCCUPATIONS[idx % OCCUPATIONS.length],
          likes: JSON.stringify(pickRandom(LIKES_OPTIONS, 2, 5)),
          hobbies: JSON.stringify(pickRandom(HOBBIES_OPTIONS, 2, 5)),
          photos: JSON.stringify([
            `https://i.pravatar.cc/400?u=user${idx + 1}_1&img=${(idx % 60) + 1}`,
            `https://i.pravatar.cc/400?u=user${idx + 1}_2&img=${((idx + 20) % 60) + 1}`,
            `https://i.pravatar.cc/400?u=user${idx + 1}_3&img=${((idx + 40) % 60) + 1}`,
          ]),
          profilePicUrl: `https://i.pravatar.cc/400?u=user${idx + 1}`,
          phoneVerified: true,
          passwordHash: hashedPassword,
          tier,
        },
      });
      users.push(user);
      idx++;
    }
  }
  console.log(`  Created ${users.length} users`);

  console.log('Seeding swipe data...');
  const swipesCreated = [];
  for (let i = 0; i < 80; i++) {
    const swiperId = users[i % users.length].id;
    let swipedId;
    let attempts = 0;
    do {
      swipedId = users[Math.floor(Math.random() * users.length)].id;
      attempts++;
    } while ((swipedId === swiperId || swipesCreated.some(s => s.swiperId === swiperId && s.swipedId === swipedId)) && attempts < 20);

    if (swipedId !== swiperId) {
      const direction = Math.random() < 0.5 ? 'like' : 'pass';
      try {
        await prisma.swipe.create({ data: { swiperId, swipedId, direction, createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) } });
        swipesCreated.push({ swiperId, swipedId });
      } catch {}
    }
  }
  console.log(`  Created ${swipesCreated.length} swipes`);

  console.log('Seeding 20 matches...');
  const matchPairs = [];
  for (let i = 0; i < 20; i++) {
    let u1, u2;
    let attempts = 0;
    do {
      u1 = users[Math.floor(Math.random() * users.length)].id;
      u2 = users[Math.floor(Math.random() * users.length)].id;
      attempts++;
    } while ((u1 === u2 || matchPairs.some(p => (p[0] === u1 && p[1] === u2) || (p[0] === u2 && p[1] === u1))) && attempts < 30);

    if (u1 !== u2) {
      matchPairs.push([Math.min(u1, u2), Math.max(u1, u2)]);
    }
  }

  for (const [u1, u2] of matchPairs) {
    await prisma.match.create({
      data: {
        user1Id: u1, user2Id: u2,
        user1FreeUsed: Math.floor(Math.random() * 3),
        user2FreeUsed: Math.floor(Math.random() * 3),
        matchedAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log(`  Created ${matchPairs.length} matches`);

  console.log('Seeding messages...');
  const seedMessages = [
    'Hey, how are you?',
    "Hi! I'm good, thanks! How about you?",
    "I'm doing great! Seen you around the county?",
    'Yeah I think I have seen you before! Small world.',
    'Would you like to grab coffee sometime?',
    "I'd love that! What's your favorite spot?",
    "There's a nice café near the mall, Java House?",
    'Perfect! How about this Saturday?',
  ];

  const matches = await prisma.match.findMany();
  for (const match of matches.slice(0, 10)) {
    const msgCount = match.id % 3 + 1;
    const usersInMatch = [match.user1Id, match.user2Id];
    for (let m = 0; m < msgCount; m++) {
      const senderId = usersInMatch[m % 2];
      await prisma.message.create({
        data: {
          matchId: match.id, senderId,
          content: seedMessages[m % seedMessages.length],
          createdAt: new Date(Date.now() - (msgCount - m) * 60 * 60 * 1000),
        },
      });
    }
  }
  console.log('  Created messages across match conversations');

  console.log('');
  console.log('✅ Seed complete! 141 users across 47 counties (3 per county)');
  console.log('');
  console.log('Credentials for all users: Password123!');
  console.log('Sample logins:');
  for (let i = 0; i < 3; i++) {
    const u = users[i];
    const genderIcon = u.gender === 'male' ? '♂️' : '♀️';
    console.log(`  ${u.phone} → ${u.name}, ${COUNTIES[u.countyId - 1]}, ${u.tier} ${genderIcon}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
