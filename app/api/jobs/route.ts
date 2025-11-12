import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { nanoid } from "nanoid"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

const createJobSchema = z.object({
  categoryId: z.string(),
  title: z.string().min(5),
  description: z.string().min(10),
  languages: z.array(z.string()),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  city: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  priceMXN: z.number().positive(),
  isHourly: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const data = createJobSchema.parse(body)

    // Verify category exists
    const category = await prisma.serviceCategory.findUnique({
      where: { id: data.categoryId },
    })

    if (!category || !category.active) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      )
    }

    // Create job
    const job = await prisma.job.create({
      data: {
        code: nanoid(8).toUpperCase(),
        touristId: session.user.id,
        categoryId: data.categoryId,
        title: data.title,
        description: data.description,
        languages: data.languages,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        city: data.city,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        priceMXN: data.priceMXN,
        isHourly: data.isHourly,
        status: "PENDING_MATCHING",
      },
      include: {
        category: true,
        tourist: {
          include: {
            profile: true,
          },
        },
      },
    })

    // TODO: Trigger matching algorithm via Inngest

    return NextResponse.json({ job })
  } catch (error) {
    console.error("Create job error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create job" },
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

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const role = session.user.role

    let jobs

    if (role === "TOURIST") {
      jobs = await prisma.job.findMany({
        where: {
          touristId: session.user.id,
          ...(status && { status: status as any }),
        },
        include: {
          category: true,
          worker: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    } else if (role === "WORKER") {
      jobs = await prisma.job.findMany({
        where: {
          workerId: session.user.id,
          ...(status && { status: status as any }),
        },
        include: {
          category: true,
          tourist: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    } else {
      // Admin can see all jobs
      jobs = await prisma.job.findMany({
        where: {
          ...(status && { status: status as any }),
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
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      })
    }

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error("Get jobs error:", error)
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    )
  }
}
