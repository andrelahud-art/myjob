import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { generateOTP, hashOTP, verifyOTP } from "@/lib/utils/otp"

const checkoutSchema = z.object({
  otp: z.string().length(6),
  action: z.enum(["generate", "verify"]),
  evidence: z
    .object({
      notes: z.string().optional(),
      photos: z.array(z.string()).optional(),
    })
    .optional(),
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
    const data = checkoutSchema.parse(body)

    // Find job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        tourist: true,
        worker: true,
        payments: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Verify job is in IN_PROGRESS status
    if (job.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Job must be in IN_PROGRESS status" },
        { status: 400 }
      )
    }

    if (data.action === "generate") {
      // Only worker can generate checkout OTP
      if (session.user.id !== job.workerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Generate new OTP
      const otp = generateOTP()
      const hashedOTP = hashOTP(otp)

      // Update job with checkout OTP
      await prisma.job.update({
        where: { id: jobId },
        data: {
          checkOutOTP: hashedOTP,
        },
      })

      // Send OTP via SMS to tourist
      // await sendSMS(job.tourist.phone, `Your checkout OTP: ${otp}`)

      return NextResponse.json({
        message: "Checkout OTP generated and sent to tourist",
        otp, // In production, don't return OTP
      })
    } else {
      // Verify OTP - tourist provides OTP to complete job
      if (session.user.id !== job.touristId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (!job.checkOutOTP) {
        return NextResponse.json(
          { error: "No checkout OTP generated" },
          { status: 400 }
        )
      }

      // Verify OTP
      if (!verifyOTP(data.otp, job.checkOutOTP)) {
        return NextResponse.json({ error: "Invalid OTP" }, { status: 400 })
      }

      // Update job to COMPLETED
      const updated = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          checkOutOTP: null, // Clear used OTP
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

      // Release payment to worker (if payment exists and is in escrow)
      const escrowPayment = job.payments.find(
        (p) => p.status === "ESCROW_HELD"
      )

      if (escrowPayment && job.workerId) {
        // TODO: Create Stripe Transfer to worker's connected account
        // For now, just update payment status
        await prisma.payment.update({
          where: { id: escrowPayment.id },
          data: {
            status: "TRANSFERRED",
            workerId: job.workerId,
          },
        })

        // Create audit log
        await prisma.auditLog.create({
          data: {
            action: "PAYMENT_RELEASED",
            entity: "Payment",
            entityId: escrowPayment.id,
            meta: {
              jobId: job.id,
              workerId: job.workerId,
              amount: escrowPayment.amountMXN,
            },
          },
        })
      }

      // Notify worker
      await prisma.notification.create({
        data: {
          userId: job.workerId!,
          type: "JOB_COMPLETED",
          payload: { jobId: job.id },
        },
      })

      // Create system message
      await prisma.message.create({
        data: {
          jobId: job.id,
          senderId: session.user.id,
          type: "SYSTEM",
          body: "Job completed successfully. Payment released to worker.",
        },
      })

      return NextResponse.json({
        message: "Job completed and payment released",
        job: updated,
      })
    }
  } catch (error) {
    console.error("Checkout error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    )
  }
}
