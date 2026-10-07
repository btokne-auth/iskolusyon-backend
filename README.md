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
| Application Information & Process | Step-by-step application, document upload with text detection and upload steps, auto-fill from documents, draft saving, final Submit once the requirements are complete (sections lock after it) |
| Status of Application & Verification | Document status tracking, re-upload requests, deficiency alerts, upload history inside each upload area |
| Notifications | Email and portal notifications (registration, login codes, submission, exam schedules, results, endorsements), appeals and rescheduling requests |
| Guest | Scholarship information, announcements, About Us and contact details, FAQ |
| Admin UI Dashboard | Admin accounts and roles (Super Admin, Admin, Office of the Registrar, LGU view only), applicant search and filters, global activity log, system settings |
| Applicant Information & Results | Applicant profiles, one-admin-at-a-time review, exam score entry, status updates, result notices, disqualification handling, end-of-cycle archive |
| Statistical Data & Reporting | Demographic charts, applicant status analytics, allowance distribution (Office of the Registrar), CHED Form 3 PDF export and release to the LGU |

## How it's built

- **App:** [Next.js](https://nextjs.org) 16 (App Router), deployed on **Vercel**
- **Database and file storage:** **Supabase** (Postgres + Storage)
- **Email:** **Resend**, sending from the `iskolusyon.dev` domain
- **OCR:** a separate service, [`iskolusyon-ocr-worker`](https://github.com/btokne-auth/iskolusyon-ocr-worker)
  (Express + Tesseract.js), running on **Render**
- **Security:** see [Cybersecurity principles](#cybersecurity-principles) below
- **Screens:** works on computers, tablets and phones (on small screens the menu opens from a Menu button)

### How a document upload works

1. The applicant picks a file. The browser checks its type and size and computes its
   SHA-256 fingerprint.
2. The app checks the file again (type, size and image quality), stores it in Supabase
   Storage, computes its own SHA-256 hash and compares it with the browser's, and marks
   the document **Processing**.
3. The app wakes the OCR worker, which reads the document, saves the detected text and
   its confidence, and marks the document **Verified** or **Needs review**.
4. For a Birth Certificate or Voter's ID, the fields it recognizes (name, birth date,
   address, precinct and so on) fill in any empty inputs on the applicant's form.

## Cybersecurity principles

From the manuscript's Chapter 3 (Cybersecurity Principles). ✅ = built,
⬜ = not built yet or only partly. Each one is confirmed during the security testing below.
To mark an item done, change its ⬜ to ✅.

**Progress (Oct 7, 2026): 26 of 26 built.** Security work: PR #33.

### Confidentiality

- ✅ Email-verified registration (a code is sent to the applicant's email at sign-up)
- ✅ Multi-factor login for applicants: password, then a one-time code by email (expires, limited attempts)
- ✅ Multi-factor login for every console account (Super Admin, Admin, Registrar, LGU): password, then a 6-digit code by email (10-minute expiry, one use, 5 tries)
- ✅ HTTPS/TLS for all traffic (served by Vercel over HTTPS)
- ✅ Encryption at rest: contact numbers, parents' employment and Medical Status are encrypted by the app (AES-256-GCM) before saving, on top of Supabase's own disk encryption

### Integrity

- ✅ SHA-256 hash of every uploaded document, computed in the browser and on the server and compared
- ✅ Upload validation: file type (PDF, JPG, PNG), 10 MB limit, image quality check, safe storage file names
- ✅ Content check: the file's own bytes must be a real PDF, JPG or PNG matching its type; PDFs with scripts or attached files are refused

### Availability

- ✅ Centralized web system: application status and notifications are available to applicants and admins throughout the cycle
- ✅ Pages update by themselves (document status, activity log, statistics)
- ✅ OCR worker wake-up retries, plus a scheduled keep-awake during development hours (free hosting plan)

### Least privilege

- ✅ Separate roles: applicant, Admin, Super Admin, Office of the Registrar, LGU (view only)
- ✅ The server refuses every action outside a role (not only hidden buttons)
- ✅ Applicants can only see and change their own application
- ✅ Submitted profile sections are locked; corrections go through the Guidance Office

### Session management

- ✅ Signed session cookies (httpOnly, secure in production, SameSite=Lax)
- ✅ Sessions expire on the server (admins after 8 hours, applicants after 12 hours)
- ✅ Sign-out after inactivity (admins 30 minutes, applicants 60 minutes), with a warning one minute before

### Cross-site request forgery (CSRF)

- ✅ Anti-CSRF token on every state-changing request, plus a same-site Origin check

### Audit logging

- ✅ Activity log of admin actions, sign-ins (including failed ones) and document processing, visible to Super Admins
- ✅ Admin edits to applicant data are logged with the old and new values

### Also in place

- ✅ Rate limiting on sign-in, login codes, password reset codes, sign-ups, uploads, saves and submits
- ✅ Plain error messages everywhere, with a short reference code (details stay in the server log)
- ✅ Browser security headers (HSTS, nosniff, no framing, Referrer-Policy, Permissions-Policy)
- ✅ Row Level Security on all 15 tables, so Supabase's public key can't read or change any row (Oct 7, 2026)
- ✅ Older applicants' contact, employment and medical fields encrypted too (one-time script, Oct 7, 2026: 59 values in 9 applications)

## Testing

From the manuscript's Chapter 3 test plan. ✅ = done, ⬜ = not done yet. Most security
tests are planned for one dedicated testing phase; results go into Chapter 4.


**Progress (Oct 7, 2026):**

| Testing area | Done |
|---|---|
| Security testing (OWASP Web Security Testing Guide) | 11 of 11 |
| Compatibility testing | 3 of 5 |
| Functional testing | 1 of 2 |
| User acceptance testing | 0 of 1 |

### Security testing (OWASP Web Security Testing Guide)

Automated run on a production build, Oct 7, 2026: 63 of 63 passed. Full results in
[docs/security-testing.md](docs/security-testing.md).

- ✅ Authentication and brute-force testing (lockout thresholds, rate limiting, code expiry)
- ✅ Authorization and access control testing (each role, including direct requests to admin addresses)
- ✅ Session management testing (expiry, cookie flags, hijacking and fixation)
- ✅ Input validation and injection testing (SQL injection, XSS on registration, login and uploads)
- ✅ File upload security testing (disguised files, oversized files, path traversal in file names)
- ✅ Data transmission and encryption testing (HTTPS everywhere, encryption at rest)
- ✅ CSRF testing (profile updates, re-uploads, admin approvals)
- ✅ Security misconfiguration testing (debug endpoints, verbose errors, default settings)
- ✅ Manual checks on the Vercel Preview (Oct 7, 2026): admin emailed code and wrong-code counter, admin edits still save, contact number stored as `enc:v1:...` in Supabase, fake PNG refused, cookie flags, idle warning
- ✅ Checked again on iskolusyon.dev after merging PR #33: encrypted numbers shown normally to admins, Dashboard works with Row Level Security on
- ✅ `http://iskolusyon.dev` opens as https (Oct 7, 2026); the whole .dev domain is on browsers' HTTPS-only (HSTS preload) list, and the app also sends its own HSTS header

### Compatibility testing

- ✅ Phone: Samsung Galaxy A73 5G, Chrome (Oct 6, 2026): homepage, login, applicant portal, admin console
- ✅ Laptop browser resized to tablet and phone widths (Oct 6, 2026): menus, header, tables and panels
- ✅ Laptop browser at full width: layout unchanged after the small-screen changes
- ⬜ Other browsers: Edge, Firefox, Safari
- ⬜ Other devices: an iPhone and a tablet

### Functional testing

- ✅ Each feature checked by hand on its Vercel Preview before merging (during development)
- ⬜ Full run across the five functional areas: account management, document submission, qualification matching, notifications, admin dashboard

### User acceptance testing

- ⬜ With applicant respondents and the Head Administrator (ISO/IEC 25010 and the four-point usability survey)

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
OCR worker settings, plus `FIELD_ENCRYPTION_KEY` (64 hex characters; the same value as in
Vercel). Ask the developer for the values. Never commit this file. Losing
`FIELD_ENCRYPTION_KEY` makes the encrypted fields unreadable, so keep a safe copy.

### Database

Table changes are in `docs/migrations/`, one SQL file per change, named by date. Run them
in order in Supabase's SQL editor.

The first Super Admin account can be created with:

```bash
node scripts/seed-admin-account.mjs "Full Name" admin@example.com "password"
```

After that, Super Admins add other admins from the Admin Accounts page.

## Credits

| Name | Contribution |
| --- | --- |
| **Pauline Xavier Estira** | Full-stack development of the whole system: all 9 modules, system architecture, backend and database, OCR worker, security features, UI/UX redesign of the applicant portal and admin console, phone and tablet support, deployment and testing |
| **Ivy Shine Villarin** | Initial UI mockups (an HTML prototype used as an early design reference; the final interface was redesigned during development) |
