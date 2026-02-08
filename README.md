# PixelLens - Smart Tracking & Pixel Auditor

A production-grade SaaS application for auditing GA4, GTM, and Meta Pixel implementations on e-commerce websites.

## Features

- 🔍 **Multi-Platform Auditing**: GA4, GTM, Meta Pixel, Consent Management, and CAPI
- 🏢 **Multi-Tenant Architecture**: Workspace-based with team management
- 💳 **Billing Integration**: Stripe-ready with plan limits and quotas
- 📊 **Comprehensive Reports**: Findings with severity, impact, and fix code snippets
- 🔗 **Shareable Reports**: Public links with optional password protection
- 🎨 **Agency Branding**: White-label reports with custom logos and colors
- 📈 **Usage Tracking**: Monitor scans per month and enforce limits
- 🔐 **Authentication**: NextAuth with magic link email authentication
- 🌓 **Dark Mode**: Full theme support
- ⚡ **Premium UX**: Skeleton loaders, toasts, smooth animations

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (production) / SQLite (development)
- **ORM**: Prisma
- **Auth**: NextAuth v5
- **UI**: TailwindCSS + shadcn/ui components
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Validation**: Zod
- **Payments**: Stripe

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL (for production) or SQLite will work for development

### Installation

1. **Clone and install dependencies**

```bash
cd pixel-lens
npm install
```

2. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL` - Leave as `file:./dev.db` for SQLite dev mode
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `NEXTAUTH_URL` - Set to `http://localhost:3000`
- Email settings (optional for dev, required for production)

3. **Initialize database**

```bash
npm run db:push
npm run db:seed
```

4. **Start development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Account

After seeding, you can access:
- Demo share link: [http://localhost:3000/app/shared/demo](http://localhost:3000/app/shared/demo)
- Login with: `demo@pixellens.com` (use magic link from console/logs)

## Project Structure

```
pixel-lens/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # NextAuth
│   │   ├── scans/        # Scan CRUD
│   │   └── workspaces/   # Workspace management
│   ├── app/              # Protected app pages
│   │   ├── dashboard/    # Dashboard
│   │   ├── scan/         # Run scan
│   │   ├── scans/        # Scan list & detail
│   │   └── settings/     # Settings
│   ├── login/            # Login page
│   ├── onboarding/       # Onboarding wizard
│   └── page.tsx          # Landing page
├── components/
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── scanner/          # Mock scanner logic
│   ├── services/         # Business logic
│   ├── auth.ts           # NextAuth config
│   ├── db.ts             # Prisma client
│   ├── plans.ts          # Plan limits
│   ├── session.ts        # Session helpers
│   ├── utils.ts          # Utilities
│   └── validations.ts    # Zod schemas
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed data
└── types/                # TypeScript types
```

## Database Schema

### Core Models

- **User**: Authentication and profile
- **Workspace**: Multi-tenant container with plan and branding
- **WorkspaceMember**: User-workspace relationship with roles
- **Scan**: Audit results with findings and timeline
- **ShareLink**: Public share links with optional password
- **Usage**: Monthly scan usage tracking
- **AuditLog**: Activity tracking

### Plans & Limits

| Plan | Scans/Month | Profiles | Share | Branding | Price |
|------|-------------|----------|-------|----------|-------|
| Free | 5 | Quick | ❌ | ❌ | $0 |
| Starter | 50 | Standard | ✅ | Basic | $49 |
| Pro | 300 | Deep | ✅ + 🔒 | Full | $149 |

## Development

### Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push schema to database
npm run db:migrate   # Create migration
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
```

### Adding a New UI Component

```bash
# Components are in components/ui/
# Follow shadcn/ui patterns
```

### Mock Scanner

The scanner is currently mocked for v1. To replace with real implementation:

1. Update `lib/scanner/mock-scanner.ts` with Playwright or similar
2. Implement actual page navigation and event capture
3. Update scan service to handle async queue processing

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Connect PostgreSQL (Vercel Postgres or external)
5. Deploy

### Environment Variables for Production

```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-secret"
EMAIL_SERVER_HOST="smtp.resend.com"
EMAIL_SERVER_PASSWORD="your-api-key"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### Database Migrations

For production, use migrations instead of `db:push`:

```bash
npx prisma migrate dev --name init
npx prisma migrate deploy
```

## Stripe Integration

The app is Stripe-ready but requires setup:

1. Create products and prices in Stripe Dashboard
2. Add price IDs to environment variables
3. Implement webhook handlers in `app/api/webhooks/stripe`
4. Implement checkout session creation in billing pages

## Security Features

- ✅ SSRF prevention (blocks localhost, private IPs)
- ✅ URL validation
- ✅ Multi-tenant data isolation
- ✅ Role-based access control
- ✅ Audit logging
- ⏳ Rate limiting (ready for implementation)
- ⏳ Password protection for share links (ready for implementation)

## Roadmap

- [ ] Real scanner with Playwright
- [ ] Email notifications
- [ ] Webhook API for external triggers
- [ ] Scan comparison feature
- [ ] Tag management
- [ ] Export to PDF
- [ ] Internationalization (i18n)
- [ ] API keys for programmatic access
- [ ] Scheduled scans

## License

Proprietary - All rights reserved

## Support

For issues and questions, please contact support@pixellens.com

---

Built with ❤️ using Next.js and modern web technologies.
