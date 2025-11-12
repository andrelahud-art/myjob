import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

const createReviewSchema = z.object({
  jobId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const data = createReviewSchema.parse(body)

    // Find job
    const job = await prisma.job.findUnique({
      where: { id: data.jobId },
      include: {
        reviews: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Verify job is completed
    if (job.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Can only review completed jobs" },
        { status: 400 }
      )
    }

    // Verify user is tourist or worker
    const isTourist = job.touristId === session.user.id
    const isWorker = job.workerId === session.user.id

    if (!isTourist && !isWorker) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Determine recipient
    const toUserId = isTourist ? job.workerId! : job.touristId

    // Check if already reviewed
    const existing = job.reviews.find(
      (r: typeof job.reviews[number]) => r.fromUserId === session.user.id && r.toUserId === toUserId
    )

    if (existing) {
      return NextResponse.json(
        { error: "You have already reviewed this job" },
        { status: 400 }
      )
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        jobId: data.jobId,
        fromUserId: session.user.id,
        toUserId,
        rating: data.rating,
        comment: data.comment,
      },
      include: {
        fromUser: {
          include: {
            profile: true,
          },
        },
        toUser: {
          include: {
            profile: true,
          },
        },
      },
    })

    // Update recipient's profile rating
    const userReviews = await prisma.review.findMany({
      where: { toUserId },
      select: { rating: true },
    })

    const totalRating = userReviews.reduce((sum, r) => sum + r.rating, 0)
    const avgRating = totalRating / userReviews.length

    await prisma.profile.update({
      where: { userId: toUserId },
      data: {
        rating: avgRating,
        ratingsCount: userReviews.length,
      },
    })

    // Notify recipient
    await prisma.notification.create({
      data: {
        userId: toUserId,
        type: "NEW_REVIEW",
        payload: {
          jobId: data.jobId,
          reviewId: review.id,
          rating: data.rating,
        },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "REVIEW_CREATED",
        entity: "Review",
        entityId: review.id,
        meta: {
          jobId: data.jobId,
          rating: data.rating,
          toUserId,
        },
      },
    })

    return NextResponse.json({ review })
  } catch (error) {
    console.error("Create review error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    )
  }
}
