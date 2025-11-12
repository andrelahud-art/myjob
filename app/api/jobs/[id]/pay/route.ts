import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { createPaymentIntent, calculatePlatformFee } from "@/lib/stripe"

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

    // Find job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payments: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Verify tourist is the owner
    if (job.touristId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if job is in acceptable status
    if (!["ACCEPTED", "PENDING_MATCHING"].includes(job.status)) {
      return NextResponse.json(
        { error: "Invalid job status for payment" },
        { status: 400 }
      )
    }

    // Check if payment already exists
    const existingPayment = job.payments.find(
      (p) => p.status === "ESCROW_HELD" || p.status === "REQUIRES_PAYMENT"
    )

    if (existingPayment) {
      return NextResponse.json(
        { error: "Payment already initiated for this job" },
        { status: 400 }
      )
    }

    // Calculate fees
    const platformFee = calculatePlatformFee(job.priceMXN)

    // Create PaymentIntent
    const paymentIntent = await createPaymentIntent(
      job.priceMXN,
      job.id,
      session.user.id
    )

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        jobId: job.id,
        touristId: session.user.id,
        workerId: job.workerId,
        provider: "stripe",
        intentId: paymentIntent.id,
        amountMXN: job.priceMXN,
        currency: "mxn",
        status: "REQUIRES_PAYMENT",
        feeMXN: platformFee,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PAYMENT_CREATED",
        entity: "Payment",
        entityId: payment.id,
        meta: {
          jobId: job.id,
          amount: job.priceMXN,
          platformFee,
        },
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      payment,
    })
  } catch (error) {
    console.error("Payment creation error:", error)
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    )
  }
}
