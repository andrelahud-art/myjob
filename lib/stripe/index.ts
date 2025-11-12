import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
})

/**
 * Create a Stripe Connect account for a worker
 */
export async function createConnectedAccount(userId: string, email: string) {
  const account = await stripe.accounts.create({
    type: "standard",
    email,
    country: "MX",
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      userId,
    },
  })

  return account
}

/**
 * Create account link for onboarding
 */
export async function createAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  })

  return accountLink
}

/**
 * Create PaymentIntent for escrow
 */
export async function createPaymentIntent(
  amountMXN: number,
  jobId: string,
  touristId: string
) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountMXN * 100, // Convert to cents
    currency: "mxn",
    capture_method: "automatic",
    metadata: {
      jobId,
      touristId,
    },
    automatic_payment_methods: {
      enabled: true,
    },
  })

  return paymentIntent
}

/**
 * Transfer funds to worker's connected account
 */
export async function transferToWorker(
  amountMXN: number,
  connectedAccountId: string,
  jobId: string,
  feeMXN: number
) {
  const netAmount = amountMXN - feeMXN

  const transfer = await stripe.transfers.create({
    amount: netAmount * 100, // Convert to cents
    currency: "mxn",
    destination: connectedAccountId,
    metadata: {
      jobId,
    },
  })

  return transfer
}

/**
 * Create refund
 */
export async function createRefund(
  paymentIntentId: string,
  amountMXN?: number,
  reason?: string
) {
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountMXN && { amount: amountMXN * 100 }),
    reason: (reason as any) || "requested_by_customer",
  })

  return refund
}

/**
 * Get account details
 */
export async function getAccountDetails(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId)
  return account
}

/**
 * Calculate platform fee (15% take rate by default)
 */
export function calculatePlatformFee(amountMXN: number, takeRate: number = 0.15): number {
  return Math.round(amountMXN * takeRate)
}
