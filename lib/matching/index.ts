import { prisma } from "@/lib/db"
import { Job, WorkerProfile, User, Profile } from "@prisma/client"

// Haversine formula to calculate distance between two coordinates
export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

type WorkerWithProfile = WorkerProfile & {
  user: User & {
    profile: Profile | null
  }
}

export function calculateWorkerScore(
  worker: WorkerWithProfile,
  job: Job
): number {
  let score = 0

  // Rating score (0-5 points based on rating)
  const ratingScore = worker.user.profile?.rating || 0
  score += ratingScore * 0.5

  // Language overlap (0-3 points)
  const workerLangs = worker.user.profile?.languages || []
  const jobLangs = job.languages || []
  const langOverlap = workerLangs.filter((lang) => jobLangs.includes(lang)).length
  const langScore = Math.min(langOverlap / jobLangs.length, 1) * 3
  score += langScore

  // Number of ratings (trust factor, 0-2 points)
  const ratingsCount = worker.user.profile?.ratingsCount || 0
  const trustScore = Math.min(ratingsCount / 50, 1) * 2
  score += trustScore

  return score
}

export async function getCandidateWorkers(job: Job) {
  // Get category
  const category = await prisma.serviceCategory.findUnique({
    where: { id: job.categoryId },
  })

  if (!category) {
    return []
  }

  // Find workers in the same city with verified KYC
  const workers = await prisma.workerProfile.findMany({
    where: {
      baseCity: job.city,
      kycStatus: "VERIFIED",
      skills: {
        has: category.slug,
      },
    },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  })

  // Filter by radius
  const withinRadius = workers.filter((worker) => {
    if (!worker.lat || !worker.lng) return false
    const distance = haversine(worker.lat, worker.lng, job.lat, job.lng)
    return distance <= worker.radiusKm
  })

  // Calculate scores and sort
  const scoredWorkers = withinRadius.map((worker) => ({
    worker,
    score: calculateWorkerScore(worker, job),
  }))

  scoredWorkers.sort((a, b) => b.score - a.score)

  // Return top 10 candidates
  return scoredWorkers.slice(0, 10).map((sw) => sw.worker)
}

export async function notifyCandidates(jobId: string, workerIds: string[]) {
  // Create notifications for all candidates
  await prisma.notification.createMany({
    data: workerIds.map((workerId) => ({
      userId: workerId,
      type: "NEW_JOB_MATCH",
      payload: { jobId },
    })),
  })

  // TODO: Send push notifications via Supabase/Firebase
  // TODO: Send SMS via Twilio for urgent jobs
}

export async function suggestPrice(
  city: string,
  categorySlug: string,
  languages: string[]
): Promise<{ price: number; low: number; high: number }> {
  // Get recent completed jobs in the same category and city
  const recentJobs = await prisma.job.findMany({
    where: {
      city,
      status: "COMPLETED",
      category: {
        slug: categorySlug,
      },
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
    select: {
      priceMXN: true,
    },
    take: 50,
  })

  if (recentJobs.length === 0) {
    // Default pricing by category
    const defaults: Record<string, number> = {
      guide: 200,
      driver: 250,
      translator: 180,
      porter: 120,
    }
    const basePrice = defaults[categorySlug] || 150

    return {
      price: basePrice,
      low: basePrice * 0.8,
      high: basePrice * 1.2,
    }
  }

  // Calculate median price
  const prices = recentJobs.map((j) => j.priceMXN).sort((a, b) => a - b)
  const median = prices[Math.floor(prices.length / 2)]

  // Premium language multiplier
  const premiumLangs = ["ja", "zh", "de", "fr"]
  const hasPremiumLang = languages.some((lang) => premiumLangs.includes(lang))
  const multiplier = hasPremiumLang ? 1.2 : 1.0

  const price = Math.round(median * multiplier)

  return {
    price,
    low: Math.round(price * 0.8),
    high: Math.round(price * 1.3),
  }
}
