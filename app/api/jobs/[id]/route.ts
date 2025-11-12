import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

const updateJobSchema = z.object({
  title: z.string().min(5).optional(),
  description: z.string().min(10).optional(),
  priceMXN: z.number().positive().optional(),
  status: z.enum([
    "DRAFT",
    "PENDING_MATCHING",
    "ACCEPTED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELED",
    "DISPUTED",
    "REFUNDED",
  ]).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        category: true,
        tourist: {
          include: {
            profile: true,
          },
        },
        worker: {
          include: {
            profile: true,
            worker: true,
          },
        },
        bids: {
          include: {
            worker: {
              include: {
                profile: true,
              },
            },
          },
          orderBy: {
            amountMXN: "asc",
          },
        },
        payments: true,
        reviews: true,
        dispute: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Check access rights
    const isOwner = job.touristId === session.user.id
    const isWorker = job.workerId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isOwner && !isWorker && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error("Get job error:", error)
    return NextResponse.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const data = updateJobSchema.parse(body)

    // Find job
    const job = await prisma.job.findUnique({
      where: { id },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Check permissions
    const isTourist = job.touristId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isTourist && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Update job
    const updated = await prisma.job.update({
      where: { id },
      data,
      include: {
        category: true,
        tourist: {
          include: {
            profile: true,
          },
        },
        worker: {
          include: {
            profile: true,
          },
        },
      },
    })

    return NextResponse.json({ job: updated })
  } catch (error) {
    console.error("Update job error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update job" },
      { status: 500 }
    )
  }
}
