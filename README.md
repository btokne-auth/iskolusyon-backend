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

From the manuscript's Chapter 3 (Cybersecurity Principles). Checked items are built;
unchecked items are not built yet or only partly. Each one is confirmed during the
security testing below.

### Confidentiality

- [x] Email-verified registration (a code is sent to the applicant's email at sign-up)
- [x] Multi-factor login for applicants: password, then a one-time code by email (expires, limited attempts)
- [ ] Multi-factor login for admins (admins sign in with a password only, with rate limiting)
- [x] HTTPS/TLS for all traffic (served by Vercel over HTTPS)
- [ ] Encryption at rest for sensitive fields (only the hosting platform's own storage encryption; no field-level encryption yet)

### Integrity

- [x] SHA-256 hash of every uploaded document, computed in the browser and on the server and compared
- [x] Upload validation: file type (PDF, JPG, PNG), 10 MB limit, image quality check, safe storage file names
- [ ] Content check that a file really is the type it claims to be (beyond its declared type and the image check)

### Availability

- [x] Centralized web system: application status and notifications are available to applicants and admins throughout the cycle
- [x] Pages update by themselves (document status, activity log, statistics)
- [x] OCR worker wake-up retries, plus a scheduled keep-awake during development hours (free hosting plan)

### Least privilege

- [x] Separate roles: applicant, Admin, Super Admin, Office of the Registrar, LGU (view only)
- [x] The server refuses every action outside a role (not only hidden buttons)
- [x] Applicants can only see and change their own application
- [x] Submitted profile sections are locked; corrections go through the Guidance Office

### Session management

- [x] Signed session cookies (httpOnly, secure in production, SameSite=Lax)
- [x] Sessions expire (applicants after 7 days, admins after 8 hours)
- [ ] Sign-out after a period of inactivity

### Cross-site request forgery (CSRF)

- [ ] Anti-CSRF tokens on state-changing actions (SameSite=Lax cookies give partial protection today)

### Audit logging

- [x] Activity log of admin actions, sign-ins (including failed ones) and document processing, visible to Super Admins
- [x] Admin edits to applicant data are logged with the old and new values

### Also in place

- [x] Rate limiting on sign-in, login codes and password reset codes
- [x] Error pages never show the raw error, only a short reference code
- [ ] Plain error messages everywhere (some rare server errors still pass the database's own message through)
- [ ] Limits on how often one applicant can save or submit

## Testing

From the manuscript's Chapter 3 test plan. Most security tests are planned for one
dedicated testing phase; results go into Chapter 4.

### Security testing (OWASP Web Security Testing Guide)

- [ ] Authentication and brute-force testing (lockout thresholds, rate limiting, code expiry)
- [ ] Authorization and access control testing (each role, including direct requests to admin addresses)
- [ ] Session management testing (expiry, cookie flags, hijacking and fixation)
- [ ] Input validation and injection testing (SQL injection, XSS on registration, login and uploads)
- [ ] File upload security testing (disguised files, oversized files, path traversal in file names)
- [ ] Data transmission and encryption testing (HTTPS everywhere, encryption at rest)
- [ ] CSRF testing (profile updates, re-uploads, admin approvals)
- [ ] Security misconfiguration testing (debug endpoints, verbose errors, default settings)

### Compatibility testing

- [x] Phone: Samsung Galaxy A73 5G, Chrome (Oct 6, 2026): homepage, login, applicant portal, admin console
- [x] Laptop browser resized to tablet and phone widths (Oct 6, 2026): menus, header, tables and panels
- [x] Laptop browser at full width: layout unchanged after the small-screen changes
- [ ] Other browsers: Edge, Firefox, Safari
- [ ] Other devices: an iPhone and a tablet

### Functional testing

- [x] Each feature checked by hand on its Vercel Preview before merging (during development)
- [ ] Full run across the five functional areas: account management, document submission, qualification matching, notifications, admin dashboard

### User acceptance testing

- [ ] With applicant respondents and the Head Administrator (ISO/IEC 25010 and the four-point usability survey)

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

## Credits

| Name | Contribution |
| --- | --- |
| **Pauline Xavier Estira** | Full-stack development of the whole system: all 9 modules, system architecture, backend and database, OCR worker, security features, UI/UX redesign of the applicant portal and admin console, phone and tablet support, deployment and testing |
| **Ivy Shine Villarin** | Initial UI mockups (an HTML prototype used as an early design reference; the final interface was redesigned during development) |
