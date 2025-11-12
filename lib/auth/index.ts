import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { authConfig } from "./config"
import { prisma } from "@/lib/db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  ...authConfig,
})

// Helper functions for route protection
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function requireRole(role: "TOURIST" | "WORKER" | "ADMIN") {
  const session = await requireAuth()
  if (session.user.role !== role) {
    throw new Error("Forbidden")
  }
  return session
}

export async function requireTourist() {
  return requireRole("TOURIST")
}

export async function requireWorker() {
  return requireRole("WORKER")
}

export async function requireAdmin() {
  return requireRole("ADMIN")
}
