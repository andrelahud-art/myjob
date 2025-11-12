import { randomInt } from "crypto"

export function generateOTP(): string {
  return randomInt(100000, 999999).toString()
}

export function hashOTP(otp: string): string {
  // In production, use bcrypt or similar
  // For now, simple hash for demo
  return Buffer.from(otp).toString("base64")
}

export function verifyOTP(input: string, hashed: string): boolean {
  const inputHash = hashOTP(input)
  return inputHash === hashed
}
