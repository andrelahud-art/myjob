import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

const sendMessageSchema = z.object({
  body: z.string().min(1),
  type: z.enum(["TEXT", "IMAGE", "SYSTEM"]).default("TEXT"),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { jobId } = await params

    // Verify access to job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const hasAccess =
      job.touristId === session.user.id ||
      job.workerId === session.user.id ||
      session.user.role === "ADMIN"

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: { jobId },
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error("Get messages error:", error)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { jobId } = await params
    const body = await req.json()
    const data = sendMessageSchema.parse(body)

    // Verify access to job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const hasAccess =
      job.touristId === session.user.id || job.workerId === session.user.id

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        jobId,
        senderId: session.user.id,
        type: data.type,
        body: data.body,
      },
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
    })

    // Notify other party
    const recipientId =
      session.user.id === job.touristId ? job.workerId : job.touristId

    if (recipientId) {
      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: "NEW_MESSAGE",
          payload: {
            jobId,
            messageId: message.id,
            senderId: session.user.id,
          },
        },
      })
    }

    // TODO: Trigger real-time update via Supabase Realtime or Pusher

    return NextResponse.json({ message })
  } catch (error) {
    console.error("Send message error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}
