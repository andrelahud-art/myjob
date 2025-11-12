import { PrismaClient } from '@prisma/client'
import { hash } from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create service categories
  const categories = [
    { slug: 'guide', name: 'Guía Turístico / Tour Guide', icon: '🗺️' },
    { slug: 'driver', name: 'Chofer / Driver', icon: '🚗' },
    { slug: 'translator', name: 'Traductor / Translator', icon: '💬' },
    { slug: 'porter', name: 'Ayudante / Helper', icon: '🎒' },
  ]

  for (const cat of categories) {
    await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    })
  }
  console.log('✅ Categories created')

  // Cities for pilot
  const cities = ['CDMX', 'Guadalajara', 'Monterrey', 'León', 'Cancún']

  // Languages
  const languages = ['es', 'en', 'pt', 'fr', 'de', 'ja', 'zh']
  const skills = ['guide', 'driver', 'translator', 'porter']

  // Create sample workers (10 per city)
  let workerCount = 0
  for (const city of cities) {
    for (let i = 0; i < 10; i++) {
      workerCount++
      const email = `worker${workerCount}@fixmyjob.mx`
      const passwordHash = await hash('Demo1234!', 10)

      // Random skills and languages
      const workerSkills = skills.filter(() => Math.random() > 0.5)
      const workerLangs = languages.filter(() => Math.random() > 0.6).slice(0, 3)
      if (workerLangs.length === 0) workerLangs.push('es')

      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash,
          role: 'WORKER',
          profile: {
            create: {
              fullName: `Worker ${workerCount} ${city}`,
              languages: workerLangs,
              rating: 4 + Math.random(),
              ratingsCount: Math.floor(Math.random() * 50),
              city,
              country: 'MX',
            },
          },
          worker: {
            create: {
              headline: `Experienced ${workerSkills.join(', ')} in ${city}`,
              skills: workerSkills,
              categories: workerSkills,
              baseCity: city,
              radiusKm: 15 + Math.floor(Math.random() * 20),
              hourlyMinMXN: 120 + Math.floor(Math.random() * 100),
              kycStatus: 'VERIFIED',
              lat: 19.4326 + (Math.random() - 0.5) * 0.1, // Approximate CDMX coords with variance
              lng: -99.1332 + (Math.random() - 0.5) * 0.1,
            },
          },
        },
      })
    }
  }
  console.log(`✅ Created ${workerCount} sample workers`)

  // Create sample tourist
  const tourist = await prisma.user.upsert({
    where: { email: 'tourist@fixmyjob.mx' },
    update: {},
    create: {
      email: 'tourist@fixmyjob.mx',
      passwordHash: await hash('Demo1234!', 10),
      role: 'TOURIST',
      profile: {
        create: {
          fullName: 'Demo Tourist',
          languages: ['en', 'es'],
          country: 'US',
          city: 'CDMX',
        },
      },
      tourist: {
        create: {
          homeCountry: 'US',
          prefPayment: 'card',
        },
      },
    },
  })
  console.log('✅ Created sample tourist')

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fixmyjob.mx' },
    update: {},
    create: {
      email: 'admin@fixmyjob.mx',
      passwordHash: await hash('Admin1234!', 10),
      role: 'ADMIN',
      profile: {
        create: {
          fullName: 'Admin User',
          languages: ['es', 'en'],
          country: 'MX',
        },
      },
    },
  })
  console.log('✅ Created admin user')

  console.log('✨ Seeding complete!')
  console.log('\n📝 Test credentials:')
  console.log('Tourist: tourist@fixmyjob.mx / Demo1234!')
  console.log('Worker: worker1@fixmyjob.mx / Demo1234!')
  console.log('Admin: admin@fixmyjob.mx / Admin1234!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
