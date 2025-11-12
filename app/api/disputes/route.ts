import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

const createDisputeSchema = z.object({
  jobId: z.string(),
  reason: z.string().min(10),
  evidence: z
    .object({
      photos: z.array(z.string()).optional(),
      description: z.string().optional(),
    })
    .optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const data = createDisputeSchema.parse(body)

    // Find job
    const job = await prisma.job.findUnique({
      where: { id: data.jobId },
      include: {
        dispute: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Verify user is tourist or worker
    const isTourist = job.touristId === session.user.id
    const isWorker = job.workerId === session.user.id

    if (!isTourist && !isWorker) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if dispute already exists
    if (job.dispute) {
      return NextResponse.json(
        { error: "Dispute already exists for this job" },
        { status: 400 }
      )
    }

    // Check if job is in a disputable status
    const disputableStatuses = ["IN_PROGRESS", "COMPLETED", "ACCEPTED"]
    if (!disputableStatuses.includes(job.status)) {
      return NextResponse.json(
        { error: "Job is not in a disputable status" },
        { status: 400 }
      )
    }

    // Create dispute
    const dispute = await prisma.dispute.create({
      data: {
        jobId: data.jobId,
        openedById: session.user.id,
        reason: data.reason,
        evidence: data.evidence || {},
        status: "OPEN",
      },
    })

    // Update job status
    await prisma.job.update({
      where: { id: data.jobId },
      data: {
        status: "DISPUTED",
      },
    })

    // Notify other party
    const otherPartyId = isTourist ? job.workerId : job.touristId

    if (otherPartyId) {
      await prisma.notification.create({
        data: {
          userId: otherPartyId,
          type: "DISPUTE_OPENED",
          payload: {
            jobId: data.jobId,
            disputeId: dispute.id,
          },
        },
      })
    }

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    })

    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "DISPUTE_OPENED_ADMIN",
        payload: {
          jobId: data.jobId,
          disputeId: dispute.id,
          openedById: session.user.id,
        },
      })),
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DISPUTE_OPENED",
        entity: "Dispute",
        entityId: dispute.id,
        meta: {
          jobId: data.jobId,
          reason: data.reason,
        },
      },
    })

    return NextResponse.json({ dispute })
  } catch (error) {
    console.error("Create dispute error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create dispute" },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can list all disputes
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const disputes = await prisma.dispute.findMany({
      where: {
        ...(status && { status: status as any }),
      },
      include: {
        job: {
          include: {
            tourist: {
              include: { profile: true },
            },
            worker: {
              include: { profile: true },
            },
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ disputes })
  } catch (error) {
    console.error("Get disputes error:", error)
    return NextResponse.json(
      { error: "Failed to fetch disputes" },
      { status: 500 }
    )
  }
}
