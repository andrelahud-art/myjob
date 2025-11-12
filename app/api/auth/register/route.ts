import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcrypt"
import { z } from "zod"
import { prisma } from "@/lib/db"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(["TOURIST", "WORKER"]).default("TOURIST"),
  languages: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = registerSchema.parse(body)

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existing) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hash(data.password, 10)

    // Create user with profile
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role,
        profile: {
          create: {
            fullName: data.fullName,
            languages: data.languages || ["es"],
          },
        },
        ...(data.role === "TOURIST" && {
          tourist: {
            create: {},
          },
        }),
        ...(data.role === "WORKER" && {
          worker: {
            create: {
              kycStatus: "UNVERIFIED",
            },
          },
        }),
      },
      include: {
        profile: true,
        tourist: true,
        worker: true,
      },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    )
  }
}
