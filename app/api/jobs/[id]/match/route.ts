import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: jobId } = await params

    // Verify worker role and KYC status
    const worker = await prisma.workerProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!worker) {
      return NextResponse.json(
        { error: "Worker profile not found" },
        { status: 400 }
      )
    }

    if (worker.kycStatus !== "VERIFIED") {
      return NextResponse.json(
        { error: "KYC verification required" },
        { status: 403 }
      )
    }

    // Find job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        category: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Verify job is still available
    if (job.status !== "PENDING_MATCHING") {
      return NextResponse.json(
        { error: "Job is no longer available" },
        { status: 400 }
      )
    }

    // Check if worker has required skills
    if (!worker.skills.includes(job.category.slug)) {
      return NextResponse.json(
        { error: "Missing required skills" },
        { status: 400 }
      )
    }

    // Accept the job (first come, first served)
    const updated = await prisma.job.update({
      where: {
        id: jobId,
        status: "PENDING_MATCHING", // Double-check status hasn't changed
      },
      data: {
        workerId: session.user.id,
        status: "ACCEPTED",
      },
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
      },
    })

    // Notify tourist
    await prisma.notification.create({
      data: {
        userId: job.touristId,
        type: "JOB_ACCEPTED",
        payload: { jobId: job.id, workerId: session.user.id },
      },
    })

    // Create system message in chat
    await prisma.message.create({
      data: {
        jobId: job.id,
        senderId: session.user.id,
        type: "SYSTEM",
        body: "Worker has accepted the job",
      },
    })

    return NextResponse.json({ job: updated })
  } catch (error: any) {
    console.error("Match job error:", error)

    // Handle race condition where another worker already accepted
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "Job was just accepted by another worker" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Failed to accept job" },
      { status: 500 }
    )
  }
}
