# Iskolusyon

A web-based scholarship management system for **City College of Calamba (CCC)**.
Capstone project `2026IT005`.

Iskolusyon moves CCC's scholarship application process online. Applicants are screened
against the CCC Scholar Guidelines at sign-up, before an account exists (Calamba residency
from a Voter's ID, academic standing and, for First Year applicants, the report card). Those
who pass get a temporary applicant account with a reference number, fill in their profile and
upload their documents. The system reads each document (OCR) and checks it against rules,
fingerprints it (SHA-256), and gives the Guidance Office one place to confirm documents,
record exam results and send updates.

Live site: [iskolusyon.dev](https://iskolusyon.dev)

> **Status (Nov 12, 2026):** final defense held Oct 20–23, 2026. The panel's revisions
> (S1–S8, M1–M5 on the Revision Compliance Form) are built and merged (PRs #51–#59).

---

## Modules

| Module | What it covers |
| --- | --- |
| User Account | Eligibility check before sign-up (Voter's ID, academic standing, report card), temporary applicant account with a reference number (`REF-000046`), email verification, a required first sign-in with a one-time code, profile management, password reset |
| Scholarship Matching & Filtering | Rule-based eligibility screening from the CCC Scholar Guidelines: Calamba residency from a Voter's ID (the applicant's own, or a parent's/guardian's), First Year grade rule (no grade below 75), transferee standing (GWA 2.25 or better, at least 26 units, no failing grade), program grade rules; eligible program listing, conflict detection, document hash matching, an eligibility checklist for the applicant and a rules checklist for staff |
| Application Information & Process | Step-by-step application, document upload with text detection and upload steps, auto-fill from documents, draft saving, final Submit once the requirements are complete (sections lock after it) |
| Status of Application & Verification | Document status tracking, re-upload requests, deficiency alerts, upload history inside each upload area; admins see the latest upload of each document first, with older ones folded underneath |
| Notifications | Email and portal notifications (registration, login codes, submission, exam schedules, results, endorsements), appeals and rescheduling requests |
| Guest | Scholarship information, announcements, About Us and contact details, FAQ |
| Admin UI Dashboard | Roles by function (System Admin, Guidance Head, Guidance Staff, Registrar), applicant search by name, application number or reference number, filters and sorting, status legend, global activity log, document integrity check, cycle settings |
| Applicant Information & Results | Applicant profiles, one-admin-at-a-time review, staff Confirm for documents ("Confirm all that passed"), exam scores entered by hand or imported/exported as CSV, status updates, result notices, disqualification handling, end-of-cycle archive with a zip download and removal of non-accepted applicants' data |
| Statistical Data & Reporting | Demographic charts (year level and department), applicant status analytics, allowance distribution (Office of the Registrar), CHED Form 3 PDF export in application-number order, which CCC sends to the LGU |

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
3. The app wakes the OCR worker, which reads the document and saves the detected text.
4. A rule check (`app/lib/documentContentCheck.js`) looks for the words expected on that
   document type, the City of Calamba with no other city named (Voter's ID), the
   applicant's last name, and any grade below 75 (report card). A document that meets
   every check is **System check passed**; otherwise it is **Needs review**. The decision
   is a rule, not an OCR confidence score.
5. A document is **Verified by staff** only after the Guidance Office confirms it. An
   applicant becomes Eligible for Exam only after the report card or transcript is confirmed.
6. For a Birth Certificate or Voter's ID, the fields it recognizes (name, birth date,
   address, precinct and so on) fill in any empty inputs on the applicant's form.

At sign-up the same check runs before any account exists. A file that fails (another city,
a grade below 75, not a voter record) is deleted right away; only an anonymous count goes
to the Activity Log.

### Roles

| Role | Can | Cannot |
| --- | --- | --- |
| System Admin | Admin accounts, Activity Log, system settings | Open applicant records |
| Guidance Head | Open/close applications, release results, archive cycles, remove non-accepted data, review applicants | Manage admin accounts |
| Guidance Staff | Review applicants, confirm or flag documents, record exam results | Open/close applications, release results, archive |
| Registrar | Post allowance releases | Open applicant records |

The server enforces these, not only the menu.

### Data retention

Applicant accounts are temporary. At the end of a cycle the Guidance Head archives it
(optionally downloading a zip of the applicant and document lists), then can remove the
data of applicants who were not accepted, including their files and accounts (typed
`REMOVE <cycle>` plus the password). Passers and Qualified Probationary students are kept
(`app/lib/dataRetention.js`).

## Cybersecurity principles

From the manuscript's Chapter 3 (Cybersecurity Principles). ✅ = built,
⬜ = not built yet or only partly. Each one is confirmed during the security testing below.
To mark an item done, change its ⬜ to ✅.

**Progress (Oct 15, 2026): 28 of 28 built.** Security work: PR #33, plus the integrity re-check (PR #38) and applicant activity logging (PR #39).

### Confidentiality

- ✅ Email-verified registration (a code is sent to the applicant's email at sign-up)
- ✅ Multi-factor login for applicants: password, then a one-time code by email (expires, limited attempts)
- ✅ Multi-factor login for every console account (System Admin, Guidance Head, Guidance Staff, Registrar): password, then a 6-digit code by email (10-minute expiry, one use, 5 tries)
- ✅ HTTPS/TLS for all traffic (served by Vercel over HTTPS)
- ✅ Encryption at rest: contact numbers, parents' employment, Medical Status and the special classification answers (LGBTQI+, disability, solo parent, Indigenous Peoples, underprivileged sector) are encrypted by the app (AES-256-GCM) before saving, on top of Supabase's own disk encryption

### Integrity

- ✅ SHA-256 hash of every uploaded document, computed in the browser and on the server and compared
- ✅ Upload validation: file type (PDF, JPG, PNG), 10 MB limit, image quality check, safe storage file names
- ✅ Content check: the file's own bytes must be a real PDF, JPG or PNG matching its type; PDFs with scripts or attached files are refused
- ✅ Stored files re-checked against their saved SHA-256: when an admin opens an applicant, with one click for all documents, and once a day through Vercel's scheduler; the database refuses any change to a saved hash (Oct 12, 2026)

### Availability

- ✅ Centralized web system: application status and notifications are available to applicants and admins throughout the cycle
- ✅ Pages update by themselves (document status, activity log, statistics)
- ✅ OCR worker wake-up retries, plus a scheduled keep-awake during development hours (free hosting plan)

### Least privilege

- ✅ Separate roles by function: applicant, System Admin, Guidance Head, Guidance Staff, Registrar (Nov 9, 2026; the System Admin cannot open applicant records). The LGU view-only login was removed on Oct 15, 2026 at the client's request; CCC sends the CHED Form 3 file to the LGU itself
- ✅ The server refuses every action outside a role (not only hidden buttons)
- ✅ Applicants can only see and change their own application
- ✅ Submitted profile sections are locked; corrections go through the Guidance Office

### Session management

- ✅ Signed session cookies (httpOnly, secure in production, SameSite=Lax)
- ✅ Sessions expire on the server (admins after 8 hours, applicants after 12 hours)
- ✅ Sign-out after inactivity (admins 30 minutes, applicants 60 minutes), with a warning two minutes before

### Cross-site request forgery (CSRF)

- ✅ Anti-CSRF token on every state-changing request, plus a same-site Origin check

### Audit logging

- ✅ Activity log of admin actions, sign-ins (including failed ones) and document processing, visible to the System Admin
- ✅ Admin edits to applicant data are logged with the old and new values
- ✅ Applicant actions are logged too: account created, sign-ins and failed sign-ins, lockouts, password resets, submissions and requests (Oct 12, 2026)

### Also in place

- ✅ Rate limiting on sign-in, login codes, password reset codes, sign-ups, uploads, saves and submits
- ✅ Plain error messages everywhere, with a short reference code (details stay in the server log)
- ✅ Browser security headers (HSTS, nosniff, no framing, Referrer-Policy, Permissions-Policy)
- ✅ Row Level Security on all 15 tables, so Supabase's public key can't read or change any row (Oct 7, 2026)
- ✅ Older applicants' contact, employment and medical fields encrypted too (one-time script, Oct 7, 2026: 59 values in 9 applications)

## Testing

From the manuscript's Chapter 3 test plan. ✅ = done, ⬜ = not done yet. Most security
tests are planned for one dedicated testing phase; results go into Chapter 4.


**Progress (Nov 12, 2026):**

| Testing area | Done |
|---|---|
| Security testing (OWASP Web Security Testing Guide) | 11 of 11 |
| Compatibility testing | 3 of 5 |
| Functional testing | 2 of 2 |
| OCR accuracy testing | 1 of 1 |
| User acceptance testing | 1 of 1 |

### Security testing (OWASP Web Security Testing Guide)

Automated run on a production build, Oct 7, 2026: 63 of 63 passed. Full results in
[docs/security-testing.md](docs/security-testing.md). The same suite has been re-run before
each later merge as it grew; latest run, Oct 15, 2026 (PR #43): 76 of 76 passed (adds the
document integrity checks, applicant activity logging, the Voter's ID and program rules, and
the LGU login removal).

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
- ✅ Scenario-based test cases on the deployed site (Nov 2026): Calamba and non-Calamba applicants, passing and failing grades, clear and unclear documents, complete and incomplete applications, First Year and transferee. Testing is done by hand in real browsers on the Vercel Preview and iskolusyon.dev; no emulator is used

### OCR accuracy testing

- ✅ 275 images (25 sample documents × 11 photo conditions), Nov 10, 2026: 89.5% agreement, **0 of 165** other-city or non-voter documents wrongly accepted, 29 of 110 Calamba documents flagged for review (all from side shadow, very blurry or very low resolution photos). Details in [docs/ocr-testing/accuracy-2026-11](docs/ocr-testing/accuracy-2026-11/README.md)

### User acceptance testing

- ✅ With applicant respondents and the Head Administrator (ISO/IEC 25010 and the four-point usability survey), on the flow before eligibility screening moved to sign-up. A repeat with the new flow is recommended

## Recent changes

| PR | What changed |
| --- | --- |
| #59 | Panel revision polish: wording (no early "scholar", "Qualified as a Student (Probationary)"), status legend, role duties in the sidebar, stricter form checks, rules checklist and "what the system checked" for staff, Confirm all that passed, archive zip download, homepage "From applicant to scholar" |
| #58 | Reference number (`REF-000046`) on sign-up, in the portal and in admin search |
| #57 | Data retention: archived cycles, removal of non-accepted applicants' data |
| #56 | Homepage: new six-step guide with eligibility first, FAQ updates |
| #55 | Two-stage application: academic screening and report card check at sign-up, transferee rules, staff Confirm before Eligible for Exam, cycle settings for the Guidance Head |
| #54 | Residency check requires the City of Calamba (OCR accuracy test), street and precinct read from sentence-style certificates, age from date of birth, Applicant Results and Statistics count like the Dashboard |
| #53 | Admin roles by function: System Admin, Guidance Head, Guidance Staff, Registrar |
| #51, #52 | Voter's ID checked before an account is created; Calamba residents-only notice on the homepage |
| #50 | Final Submit waits until the required documents are verified |
| #46–#49 | Input validation, stricter OCR auto-verify, profile photo check, birthdate rules, College Yes/No, the real reason a document needs review |
| #44, #45 | Registrar interview changes (read confirmations, "Sex at birth"), Dashboard step counter |
| #43 | From the client's Oct 15, 2026 interview: one Voter's ID requirement (the applicant's own, or a parent's/guardian's), the 2nd priority program can't repeat the 1st, sibling list moved under Number of Siblings and Proof of Income under Applicant's Employment, application-number order in CHED Form 3 and the Dashboard, "Not yet submitted" in Statistics, LGU login removed, latest upload shown first to admins |
| #42 | Link preview image and description for iskolusyon.dev |
| #41 | UI polish from the Suggestions Log (top bar, footer, code boxes, admin panels); removed the unused "Keep me signed in" option |
| #40 | Eligibility Check card for applicants; "Not answered" in locked questions |
| #39 | Special classification questions (encrypted), Data Privacy Consent date, applicant notice when a document is flagged, applicant activity in the Activity Log, Department chart |
| #38 | Document integrity re-check (SHA-256) and Dashboard cards for documents to review |
| #37 | Live password strength meter, one password rule for applicants and admins |
| #35, #36 | Landing page redesign |
| #34 | Removed the SMS updates checkbox (email is the agreed channel) |
| #33 | Security hardening: MFA for console accounts, CSRF tokens, encryption at rest, upload content checks, security headers, Row Level Security |

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

The first System Admin account can be created with:

```bash
node scripts/seed-admin-account.mjs "Full Name" admin@example.com "password"
```

After that, the System Admin adds the other console accounts from the Admin Accounts page.

## Credits

| Name | Contribution |
| --- | --- |
| **Pauline Xavier Estira** | Full-stack development of the whole system: all 9 modules, the panel revisions, system architecture, backend and database, OCR worker, security features, UI/UX redesign of the applicant portal and admin console, phone and tablet support, deployment and testing |
| **Ivy Shine Villarin** | Initial UI mockups (an HTML prototype used as an early design reference; the final interface was redesigned during development) |
