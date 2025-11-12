# FixMyJob.mx - On-Demand Physical Micro-Jobs Platform

FixMyJob.mx is a production-ready MVP platform connecting tourists with local service workers (guides, translators, drivers, helpers) in Mexico. Built for World Cup 2026 and beyond.

## 🎯 Core Features

- **Role-based System**: Tourists, Workers, and Admins
- **Real-time Job Matching**: Geolocation-based worker discovery with intelligent scoring
- **Secure Payments**: Stripe Connect with escrow & automated payouts
- **KYC Verification**: Worker verification via Stripe Connect
- **OTP Check-in/out**: SMS-based job start/end verification
- **Chat System**: Real-time messaging per job
- **Reviews & Ratings**: Mutual feedback system
- **Dispute Resolution**: Evidence-based mediation
- **Multi-language**: Spanish, English, Portuguese (i18n ready)

## 🏗️ Architecture

### Stack

- **Frontend**: Next.js 15 (App Router), React Server Components, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes + Server Actions
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (Credentials + OAuth)
- **Payments**: Stripe Connect Standard (Mexico)
- **Real-time**: Supabase Realtime / Pusher (ready)
- **Background Jobs**: Inngest (ready)
- **Observability**: Sentry + audit logs

### Database Models

- User, Profile, TouristProfile, WorkerProfile
- Job, Bid, ServiceCategory
- Payment, PaymentAccount
- Review, Message, Dispute
- Notification, AuditLog, Verification

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Stripe account (with Connect enabled)
- Supabase account (optional, for real-time)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npm run db:generate

# Run migrations (when DB is ready)
npm run db:migrate

# Seed database with test data
npm run db:seed

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Test Credentials (after seeding)

```
Tourist: tourist@fixmyjob.mx / Demo1234!
Worker:  worker1@fixmyjob.mx / Demo1234!
Admin:   admin@fixmyjob.mx / Admin1234!
```

## 📁 Project Structure

```
myjob/
├── app/
│   ├── api/
│   │   ├── auth/              # NextAuth + registration
│   │   ├── jobs/              # Job CRUD, match, pay, checkin/out
│   │   ├── chat/              # Messaging
│   │   ├── reviews/           # Rating system
│   │   ├── disputes/          # Dispute management
│   │   ├── worker/            # Worker onboarding (Stripe)
│   │   └── webhooks/          # Stripe webhooks
│   ├── (pages)/               # Frontend routes (to be built)
│   └── layout.tsx
├── lib/
│   ├── auth/                  # NextAuth config + helpers
│   ├── db.ts                  # Prisma client
│   ├── stripe/                # Stripe utilities
│   ├── matching/              # Worker matching algorithm
│   └── utils/                 # OTP, helpers
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data
├── components/                # React components (to be built)
├── types/                     # TypeScript types
└── .env.example
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - Register user (tourist/worker)
- `GET /api/auth/session` - Get current session

### Jobs

- `POST /api/jobs` - Create job (tourist)
- `GET /api/jobs` - List my jobs (filtered by role)
- `GET /api/jobs/[id]` - Get job details
- `PATCH /api/jobs/[id]` - Update job
- `POST /api/jobs/[id]/match` - Accept job (worker)
- `POST /api/jobs/[id]/pay` - Create payment (tourist)
- `POST /api/jobs/[id]/checkin` - Generate/verify check-in OTP
- `POST /api/jobs/[id]/checkout` - Generate/verify checkout OTP

### Chat

- `GET /api/chat/[jobId]` - Get messages
- `POST /api/chat/[jobId]` - Send message

### Reviews

- `POST /api/reviews` - Create review (after job completion)

### Disputes

- `POST /api/disputes` - Open dispute
- `GET /api/disputes` - List disputes (admin only)

### Worker

- `POST /api/worker/onboarding` - Create Stripe Connect account link

### Webhooks

- `POST /api/webhooks/stripe` - Stripe webhook handler

## 💳 Payment Flow

1. **Tourist creates job** → Status: `PENDING_MATCHING`
2. **Worker accepts** → Status: `ACCEPTED`
3. **Tourist pays** → Creates PaymentIntent → Status: `ESCROW_HELD`
4. **Check-in OTP** → Status: `IN_PROGRESS`
5. **Check-out OTP** → Status: `COMPLETED` → Transfer funds to worker
6. **Both review** → Update ratings

## 🧩 Matching Algorithm

Workers are scored based on:
- **Rating** (50%): User profile rating
- **Language overlap** (30%): Match with job requirements
- **Trust score** (20%): Number of completed jobs

Filters:
- Same city
- Within worker's radius (haversine distance)
- Required skills/category
- KYC verified

## 🔐 Security Features

- **OTP-based check-in/out**: Prevents fraud
- **Escrow payments**: Funds held until job completion
- **KYC via Stripe**: Worker verification
- **Audit logs**: All critical actions logged
- **Role-based access**: Strict permissions per endpoint
- **Input validation**: Zod schemas on all routes

## 🗺️ Pilot Cities

- Ciudad de México (CDMX)
- Guadalajara
- Monterrey
- León
- Cancún

## 📊 Business Model

- **Take rate**: 15% platform fee
- **Processing fees**: Passed to tourist (transparent)
- **Tips**: Optional, 95-100% to worker

## 🚧 TODO / Roadmap

### Frontend (Next Phase)

- [ ] Landing page (/)
- [ ] Job creation flow (/job/new)
- [ ] Job detail page with chat (/job/[code])
- [ ] User dashboard (/me)
- [ ] Worker profile setup
- [ ] Admin panel (/admin)

### Features

- [ ] Real-time chat (Supabase/Pusher integration)
- [ ] Push notifications (Firebase/APNS)
- [ ] SMS integration (Twilio)
- [ ] Image upload (S3/Supabase Storage)
- [ ] i18n with next-intl
- [ ] PWA setup
- [ ] Geofencing for pilot cities

### Background Jobs (Inngest)

- [ ] Match broadcast (notify workers)
- [ ] Auto-cancel unpaid jobs (15 min)
- [ ] Auto-complete timeout handling
- [ ] Daily metrics ETL
- [ ] Review reminders

### Monitoring

- [ ] Sentry integration
- [ ] Performance monitoring
- [ ] Analytics dashboard

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

## 📝 Environment Variables

See `.env.example` for all required variables.

**Critical**:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `STRIPE_SECRET_KEY` - Stripe secret key (Mexico)
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret

## 🛠️ Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Create migration
npm run db:migrate

# Push schema without migration
npm run db:push

# Seed database
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

## 🌐 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import to Vercel
3. Set environment variables
4. Connect to Supabase/Neon database
5. Add Stripe webhook endpoint: `https://your-domain.com/api/webhooks/stripe`

### Database

- **Supabase** (Postgres + Realtime + Storage)
- **Neon** (Serverless Postgres)
- **Railway** (Managed Postgres)

## 📄 License

Proprietary - FixMyJob.mx

## 🤝 Contributing

This is a proprietary project. For authorized contributors:

1. Create feature branch: `git checkout -b feature/name`
2. Commit changes: `git commit -m "Add feature"`
3. Push: `git push origin feature/name`
4. Open PR

## 📞 Support

- Email: support@fixmyjob.mx
- Documentation: https://docs.fixmyjob.mx (coming soon)

---

**Built with ❤️ for World Cup 2026**
