import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { createConnectedAccount, createAccountLink } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user is a worker
    if (session.user.role !== "WORKER") {
      return NextResponse.json(
        { error: "Only workers can onboard" },
        { status: 403 }
      )
    }

    // Check if already has a payment account
    const existing = await prisma.paymentAccount.findFirst({
      where: {
        userId: session.user.id,
        provider: "stripe",
      },
    })

    if (existing) {
      // Create new account link for existing account
      const accountLink = await createAccountLink(
        existing.accountId,
        `${process.env.NEXTAUTH_URL}/worker/onboarding/return`,
        `${process.env.NEXTAUTH_URL}/worker/onboarding/refresh`
      )

      return NextResponse.json({
        accountLinkUrl: accountLink.url,
        accountId: existing.accountId,
      })
    }

    // Create new connected account
    const account = await createConnectedAccount(
      session.user.id,
      session.user.email!
    )

    // Save to database
    await prisma.paymentAccount.create({
      data: {
        userId: session.user.id,
        provider: "stripe",
        accountId: account.id,
        payoutsEnabled: false,
      },
    })

    // Create account link
    const accountLink = await createAccountLink(
      account.id,
      `${process.env.NEXTAUTH_URL}/worker/onboarding/return`,
      `${process.env.NEXTAUTH_URL}/worker/onboarding/refresh`
    )

    return NextResponse.json({
      accountLinkUrl: accountLink.url,
      accountId: account.id,
    })
  } catch (error) {
    console.error("Onboarding error:", error)
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 }
    )
  }
}
