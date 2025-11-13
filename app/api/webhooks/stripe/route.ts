import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import Stripe from "stripe"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object)
        break

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object)
        break

      case "transfer.created":
        await handleTransferCreated(event.data.object)
        break

      case "charge.refunded":
        await handleChargeRefunded(event.data.object)
        break

      case "account.updated":
        await handleAccountUpdated(event.data.object)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook handler error:", error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findFirst({
    where: { intentId: paymentIntent.id },
    include: { job: true },
  })

  if (!payment) {
    console.error("Payment not found for intent:", paymentIntent.id)
    return
  }

  // Update payment status to ESCROW_HELD
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "ESCROW_HELD",
      chargeId: paymentIntent.latest_charge as string,
    },
  })

  // Update job paymentId if not set
  if (!payment.job.paymentId) {
    await prisma.job.update({
      where: { id: payment.jobId },
      data: {
        paymentId: payment.id,
        escrowId: paymentIntent.id,
      },
    })
  }

  // Notify both parties
  await prisma.notification.createMany({
    data: [
      {
        userId: payment.touristId,
        type: "PAYMENT_CONFIRMED",
        payload: { jobId: payment.jobId, paymentId: payment.id },
      },
      ...(payment.workerId
        ? [
            {
              userId: payment.workerId,
              type: "PAYMENT_SECURED",
              payload: { jobId: payment.jobId, paymentId: payment.id },
            },
          ]
        : []),
    ],
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "PAYMENT_SUCCEEDED",
      entity: "Payment",
      entityId: payment.id,
      meta: {
        jobId: payment.jobId,
        amount: payment.amountMXN,
        intentId: paymentIntent.id,
      },
    },
  })
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findFirst({
    where: { intentId: paymentIntent.id },
  })

  if (!payment) return

  // Notify tourist of payment failure
  await prisma.notification.create({
    data: {
      userId: payment.touristId,
      type: "PAYMENT_FAILED",
      payload: {
        jobId: payment.jobId,
        reason: paymentIntent.last_payment_error?.message,
      },
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "PAYMENT_FAILED",
      entity: "Payment",
      entityId: payment.id,
      meta: {
        jobId: payment.jobId,
        error: paymentIntent.last_payment_error ? {
          code: paymentIntent.last_payment_error.code,
          message: paymentIntent.last_payment_error.message,
          type: paymentIntent.last_payment_error.type,
        } : null,
      },
    },
  })
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  const jobId = transfer.metadata?.jobId

  if (!jobId) return

  const payment = await prisma.payment.findFirst({
    where: { jobId },
  })

  if (!payment) return

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "TRANSFERRED",
      transferId: transfer.id,
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "PAYMENT_TRANSFERRED",
      entity: "Payment",
      entityId: payment.id,
      meta: {
        jobId,
        transferId: transfer.id,
        amount: transfer.amount / 100,
      },
    },
  })
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const payment = await prisma.payment.findFirst({
    where: { chargeId: charge.id },
  })

  if (!payment) return

  const refund = charge.refunds?.data[0]
  const isPartial = refund && refund.amount < charge.amount

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: isPartial ? "PARTIALLY_REFUNDED" : "REFUNDED",
    },
  })

  // Notify tourist
  await prisma.notification.create({
    data: {
      userId: payment.touristId,
      type: "PAYMENT_REFUNDED",
      payload: {
        jobId: payment.jobId,
        amount: refund?.amount ? refund.amount / 100 : payment.amountMXN,
        isPartial,
      },
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "PAYMENT_REFUNDED",
      entity: "Payment",
      entityId: payment.id,
      meta: {
        jobId: payment.jobId,
        refundId: refund?.id,
        amount: refund?.amount,
        isPartial,
      },
    },
  })
}

async function handleAccountUpdated(account: Stripe.Account) {
  const paymentAccount = await prisma.paymentAccount.findFirst({
    where: { accountId: account.id },
  })

  if (!paymentAccount) return

  // Update payouts enabled status
  const payoutsEnabled = account.payouts_enabled === true

  await prisma.paymentAccount.update({
    where: { id: paymentAccount.id },
    data: {
      payoutsEnabled,
    },
  })

  // If payouts just got enabled, update worker KYC status
  if (payoutsEnabled) {
    await prisma.workerProfile.update({
      where: { userId: paymentAccount.userId },
      data: {
        kycStatus: "VERIFIED",
      },
    })

    // Notify worker
    await prisma.notification.create({
      data: {
        userId: paymentAccount.userId,
        type: "KYC_VERIFIED",
        payload: { accountId: account.id },
      },
    })
  }
}
