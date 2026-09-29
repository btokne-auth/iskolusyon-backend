# Iskolusyon

A web-based scholarship management system for **City College of Calamba (CCC)**.
Capstone project `2026IT005`.

Iskolusyon moves CCC's scholarship application process online: applicants create an
account, fill in their profile, and upload their documents; the system reads the
documents (OCR), fingerprints them (SHA-256), checks eligibility against CCC's rules,
and gives admins one place to review applicants, record results and send updates.

Live site: [iskolusyon.dev](https://iskolusyon.dev) (access is restricted during development).

> **Still in development.** Some features are still being built, so this README will be
> updated as the system changes.

---

## Modules

| Module | What it covers |
| --- | --- |
| User Account | Sign-up with email verification, login with a one-time code, profile management, password reset |
| Scholarship Matching & Filtering | Residency and voter checks, qualification evaluation, eligible program listing, document hash matching |
| Application Information & Process | Step-by-step application, document upload with text detection, auto-fill from documents, draft saving |
| Status of Application & Verification | Document status tracking, re-upload requests, deficiency alerts, application history |
| Notifications | Email notifications (registration, login codes, submission), rescheduling requests |
| Guest | Scholarship information, announcements, About Us and contact details, FAQ |
| Admin UI Dashboard | Admin accounts, applicant search and filters, global activity log, system settings |
| Applicant Information & Results | Applicant profiles, exam score entry, status updates, disqualification handling |
| Statistical Data & Reporting | Demographic charts and applicant status analytics |

## How it's built

- **App:** [Next.js](https://nextjs.org) 16 (App Router), deployed on **Vercel**
- **Database and file storage:** **Supabase** (Postgres + Storage)
- **Email:** **Resend**, sending from the `iskolusyon.dev` domain
- **OCR:** a separate service, [`iskolusyon-ocr-worker`](https://github.com/btokne-auth/iskolusyon-ocr-worker)
  (Express + Tesseract.js), running on **Render**
- **Security:** scrypt password hashing, signed session cookies, SHA-256 document hashing,
  one-time codes by email for applicant login

### How a document upload works

1. The applicant uploads a file. The app checks its type, size and quality, stores it in
   Supabase Storage, saves its SHA-256 hash, and marks it **Processing**.
2. The app wakes the OCR worker, which reads the document, saves the detected text and
   its confidence, and marks the document **Verified** or **Needs review**.
3. For a Birth Certificate or Voter's ID, the fields it recognizes (name, birth date,
   address, precinct and so on) fill in any empty inputs on the applicant's form.

## Running it locally

Requirements: Node.js 20 or later and a Supabase project.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

The `dev` and `build` scripts use `--webpack`, because Turbopack breaks `next/font/google`
in Next.js 16.2 and later.

### Settings

The app needs a `.env.local` file in the project root with the Supabase, Resend and
OCR worker settings. Ask the developer for the values. Never commit this file.

### Database

Table changes are in `docs/migrations/`, one SQL file per change, named by date. Run them
in order in Supabase's SQL editor.

The first Super Admin account can be created with:

```bash
node scripts/seed-admin-account.mjs "Full Name" admin@example.com "password"
```

After that, Super Admins add other admins from the Admin Accounts page.

## Team

| Name | Role |
| --- | --- |
| **Pauline Xavier Estira** | Full-stack development: all 9 modules, backend, database, OCR worker and deployment |
| **Ivy Shine Villarin** | UI mockups (HTML prototype used as the design reference) |
