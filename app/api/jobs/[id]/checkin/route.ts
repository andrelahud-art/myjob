import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { generateOTP, hashOTP, verifyOTP } from "@/lib/utils/otp"

const checkinSchema = z.object({
  otp: z.string().length(6),
  action: z.enum(["generate", "verify"]),
})

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
    const body = await req.json()
    const data = checkinSchema.parse(body)

    // Find job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        tourist: true,
        worker: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Verify job is in ACCEPTED status
    if (job.status !== "ACCEPTED") {
      return NextResponse.json(
        { error: "Job must be in ACCEPTED status" },
        { status: 400 }
      )
    }

    if (data.action === "generate") {
      // Only tourist can generate check-in OTP
      if (session.user.id !== job.touristId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Generate new OTP
      const otp = generateOTP()
      const hashedOTP = hashOTP(otp)

      // Update job with check-in OTP
      await prisma.job.update({
        where: { id: jobId },
        data: {
          checkInOTP: hashedOTP,
        },
      })

      // Send OTP via SMS (TODO: implement Twilio)
      // await sendSMS(job.worker.phone, `Your check-in OTP: ${otp}`)

      return NextResponse.json({
        message: "Check-in OTP generated and sent to worker",
        otp, // In production, don't return OTP (only send via SMS)
      })
    } else {
      // Verify OTP - worker provides OTP to start job
      if (session.user.id !== job.workerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (!job.checkInOTP) {
        return NextResponse.json(
          { error: "No check-in OTP generated" },
          { status: 400 }
        )
      }

      // Verify OTP
      if (!verifyOTP(data.otp, job.checkInOTP)) {
        return NextResponse.json({ error: "Invalid OTP" }, { status: 400 })
      }

      // Update job to IN_PROGRESS
      const updated = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "IN_PROGRESS",
          checkInOTP: null, // Clear used OTP
        },
        include: {
          category: true,
          tourist: {
            include: { profile: true },
          },
          worker: {
            include: { profile: true },
          },
        },
      })

      // Notify tourist
      await prisma.notification.create({
        data: {
          userId: job.touristId,
          type: "JOB_STARTED",
          payload: { jobId: job.id },
        },
      })

      // Create system message
      await prisma.message.create({
        data: {
          jobId: job.id,
          senderId: session.user.id,
          type: "SYSTEM",
          body: "Job has started",
        },
      })

      return NextResponse.json({
        message: "Job started successfully",
        job: updated,
      })
    }
  } catch (error) {
    console.error("Check-in error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Check-in failed" },
      { status: 500 }
    )
  }
}
