#!/bin/sh

# Provide a dummy DATABASE_URL for build time if not set
# This allows Prisma to generate the client without a real database connection
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://user:password@localhost:5432/myjob"
fi

# Generate Prisma client
npx prisma generate
