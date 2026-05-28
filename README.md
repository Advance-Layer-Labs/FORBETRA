# Forbetra

Real-time 360 coaching platform that combines structured weekly self-reflection with continuous stakeholder feedback, AI-synthesized insights, and coach-facing intelligence.

**Live:** https://app.forbetra.com

## Setup

**Prerequisites:** Node.js 22+ (see `.nvmrc`), npm

```bash
git clone https://github.com/Advance-Layer-Labs/FORBETRA.git
cd FORBETRA
npm install
```

Copy `.env.example` to `.env` and fill in the values (get secrets from another team member):

```bash
cp .env.example .env
```

Set up the database and seed test data:

```bash
npx prisma migrate dev
npm run seed:comprehensive
```

Start the dev server:

```bash
npm run dev
```

Open http://localhost:5173.

## Key Commands

| Command                      | Description                |
| ---------------------------- | -------------------------- |
| `npm run dev`                | Start dev server           |
| `npm run build`              | Production build           |
| `npm run lint`               | Check formatting + linting |
| `npm run format`             | Auto-format all files      |
| `npm run check`              | Svelte type checking       |
| `npx prisma migrate dev`     | Create/apply migrations    |
| `npx prisma studio`          | Visual database browser    |
| `npm run seed:comprehensive` | Seed full test data        |
| `npm run seed:clean`         | Remove seed data           |

## Stack

- **Frontend:** SvelteKit, Svelte 5, Tailwind CSS 4
- **Backend:** Node.js 22, TypeScript (strict)
- **Database:** PostgreSQL (Neon) via Prisma
- **Auth:** Clerk
- **Email:** SendGrid
- **SMS:** Twilio
- **AI:** Anthropic Claude
- **Deploy:** Vercel

## Project Structure

```
src/
├── lib/           # Components, notifications, prompts, utils, validation
├── jobs/          # Cron job logic
├── routes/
│   ├── admin/     # Admin dashboard
│   ├── coach/     # Coach dashboard, invitations, session view
│   ├── individual/# Individual hub, insights, stakeholders
│   ├── onboarding/# 5-step onboarding wizard
│   ├── stakeholder/# Feedback submission (token-based)
│   └── api/       # Jobs, webhooks, debug endpoints
prisma/            # Schema, migrations, config
docs/              # Roadmap, reviews, planning
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategy, PR process, and development guidelines.
