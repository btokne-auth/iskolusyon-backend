# Security testing results (manuscript Chapter 3 to Chapter 4)

Date: October 7, 2026. Tester: Pauline Xavier Mira Estira (developer).
Method: OWASP Web Security Testing Guide categories, as listed in the manuscript's
Chapter 3 test plan (pp. 42-45). User Acceptance Testing is not part of this file.

## How the tests were run

- **Build tested:** the production build (`next build --webpack`, `next start`) of branch
  `security-hardening`, Next.js 16.3.8.
- **Database:** a local stand-in for Supabase's API with sample applicants (Bianca, Carlo,
  Jasmine, Lebron, Trisha, Aca) and one account per role (Super Admin, Admin, Registrar,
  LGU). The live Supabase project was not touched.
- **How:** an automated script sent real HTTP requests the way an attacker would (no
  sign-in, wrong roles, edited cookies, forged tokens, disguised files, requests from
  another website), and a real Chromium browser was used for the stored-XSS, cross-site
  form and inactivity tests. Sign-in emails were captured instead of sent.
- **Result:** 63 of 63 tests passed.
- **Still to repeat by hand on the live Preview** (screenshots for Chapter 4): see
  "Manual checks on the live site" at the end.

## Results

### Authentication and Brute-Force (11/11 passed)

| ID | Test | Expected | Actual result | Result |
|---|---|---|---|---|
| A1 | Admin sign-in locks after 5 wrong passwords (same email) | 6th try refused with 429 + wait message | 401,401,401,401,401,429 | PASS |
| A2 | Locked email stays locked even with the RIGHT password | 429 while locked | 429 "Too many attempts. Please try again in about 15 minutes." | PASS |
| A3 | Applicant sign-in locks after 5 wrong passwords | 6th try 429 | 401,401,401,401,401,429 | PASS |
| A4 | Right admin password alone does NOT open the console (MFA) | requiresCode, no session cookie | 200 requiresCode=true sessionCookie=false | PASS |
| A5 | The step-2 cookie alone cannot call admin APIs | 401 | 401 | PASS |
| A6 | Admin code cancelled after 5 wrong codes | 5th wrong code: restart required; right code then refused | 401,401,401,401,401 restart=true; right code after = 401 | PASS |
| A7 | Expired admin code is refused (10-minute window) | 401 expired | 401 "That code has expired. Please sign in again to get a new one." | PASS |
| A8 | A new admin code can be requested only once a minute | 2nd resend within a minute = 429 | 200, 429 | PASS |
| A9 | Sign-up code always goes to the email typed at step 1 (no redirecting it) | email sent to the account email, not the attacker one | sent to victim@x.test | PASS |
| A10 | Sign-up code can be resent only once a minute | 2nd send within a minute = 429 | 200, 429 | PASS |
| A11 | Weak passwords are refused at sign-up | 400 | 400 "Password must be at least 8 characters and include a number," | PASS |

### Authorization and Access Control (10/10 passed)

| ID | Test | Expected | Actual result | Result |
|---|---|---|---|---|
| B1 | No sign-in: every admin API refuses | all 401 | 401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401 | PASS |
| B2 | Applicant session: every admin API refuses | all 401/403 | 401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401 | PASS |
| B3 | Registrar session: admin APIs refuse, Registrar API allowed | admin 401/403; registrar-allowance 200 | 401,401,401,401,401,401,401,401,401,401,401,401,403,403,401,401,401,401,401 / own 200 | PASS |
| B4 | LGU session: admin APIs refuse, only LGU reports allowed | admin 401/403; lgu-reports 200; registrar 403 | 401,401,401,401,401,401,401,401,401,401,401,401,403,403,401,401,401,401,401 / lgu 200 / registrar 403 | PASS |
| B5 | Admins (institutional) cannot open LGU-only or Registrar-only functions | 403 | lgu-reports 403, registrar-allowance 403 | PASS |
| B6 | Regular Admin cannot use Super Admin functions | all 403 | 403,403,403,403,403 | PASS |
| B7 | Edited cookie (Admin changes itself to Super Admin) is rejected | 401 | 401 | PASS |
| B8 | Applicant only ever gets their OWN application (IDOR) | Carlo asking for Bianca gets Carlo | 200 contains Bianca=false Carlo=true | PASS |
| B9 | Applicant only sees their OWN documents | no other applicant's files | 200 has Bianca's files=false | PASS |
| B10 | Admin pages redirect to sign-in without a session | 307 to /admin/login | 307 /admin/login?next=%2Fadmin | PASS |

### Session Management (10/10 passed)

| ID | Test | Expected | Actual result | Result |
|---|---|---|---|---|
| C1 | Session cookies are HttpOnly, SameSite and Secure on HTTPS | HttpOnly; SameSite=lax; Secure set when NODE_ENV=production | iskolusyon_admin=<signed>; Path=/; Expires=Wed, 07 Oct 2026 11:43:53 GMT; Max-Age=28800; Secure; HttpOnly; SameSite=lax | PASS |
| C2 | Admin session ends after 30 minutes idle (server-side) | 29 min = 200, 31 min = 401 | 200, 401 | PASS |
| C3 | Applicant session ends after 60 minutes idle | 59 min = 200, 61 min = 401 | 200, 401 | PASS |
| C4 | Sessions have a hard limit even when active (admin 8 h, applicant 12 h) | both 401 | 401, 401 | PASS |
| C5 | A copied cookie without timestamps (old format) no longer works | 401 | 401 | PASS |
| C6 | Only real activity extends the session (background polling does not) | no refresh without x-user-active; refresh with it | polling refreshed=false, active refreshed=true | PASS |
| C7 | Expired admin page visit goes to sign-in with an explanation | 307 /admin/login?...expired=1 | 307 /admin/login?next=%2Fadmin&expired=1 | PASS |
| C8 | Session fixation: a cookie planted before sign-in is replaced by a new server-signed one | different value after sign-in | new cookie issued=true | PASS |
| C9 | Sign-out clears the session cookie | Max-Age=0 | iskolusyon_admin=; Path=/; Max-Age=0 | PASS |
| C10 | Idle warning appears, then the admin is signed out automatically | warning at 29 min, sign-in page at 30 min | warning shown=true; ended at /admin/login?expired=1 | PASS |

### Input Validation and Injection (6/6 passed)

| ID | Test | Expected | Actual result | Result |
|---|---|---|---|---|
| D1 | SQL injection in the sign-in email is treated as plain text | 401 wrong login, never 500 or a bypass | 401,401,401 | PASS |
| D2 | SQL-like text saved in a form field is stored as plain text | saved literally; table still there | 200; applications rows=7 | PASS |
| D3 | Wildcard name ("%") cannot list other applicants' old files | no other applicant's rows | 200 leaked=false | PASS |
| D4 | Sign-in page never forwards to another website (?next=) | stays on /admin | /admin / /admin / /admin/../../x / /admin/results | PASS |
| D5 | Over-long request text is cut (appeal details max 2,000 chars) | stored length <= 2000 | 200 stored 2000 | PASS |
| D6 | Stored XSS: a script typed as a name is shown as text in the admin console | no script runs | script ran=false, escaped text on page=true | PASS |

### File Upload Security (11/11 passed)

| ID | Test | Expected | Actual result | Result |
|---|---|---|---|---|
| E1 | Program disguised as a PNG (birthcert.png, image/png) is refused | 400 | 400 "This file is not a real PDF, JPG or PNG (its contents do not match its" | PASS |
| E2 | Program disguised as a PDF is refused | 400 | 400 | PASS |
| E3 | Real PNG sent as "PDF" (type mismatch) is refused | 400 | 400 | PASS |
| E4 | PDF carrying JavaScript is refused | 400 | 400 "This PDF contains scripts or attached files, which are not a" | PASS |
| E5 | Unsupported types (.exe, .html, .svg) are refused | all 400 | 400,400,400 | PASS |
| E6 | Oversized file (11 MB) is refused | 400/413 | 413 | PASS |
| E7 | Path traversal in the file name is neutralized | stored name has no "/" or ".." | 200 stored as "1791344634270-passwd.png" | PASS |
| E8 | Double extension is fixed to the real type | "cv.pdf.exe" (really PNG) ends in .png | 200 "1791344634312-cv_pdf.png" | PASS |
| E9 | Valid document is accepted and SHA-256 hashed | 200 + 64-char hash | 200 hash=579a625f24ccfb0c... | PASS |
| E10 | Uploading without signing in is refused | 401 | 401 | PASS |
| E11 | Upload flooding is limited (30 per 10 minutes) | 31st upload = 429 | 429 | PASS |

### Data Transmission and Encryption (5/5 passed)

| ID | Test | Expected | Actual result | Result |
|---|---|---|---|---|
| F1 | HTTPS is enforced by browsers (HSTS, 2 years, subdomains) | Strict-Transport-Security header | max-age=63072000; includeSubDomains; preload | PASS |
| F2 | Contact, financial and medical fields are stored encrypted (AES-256-GCM) | database holds enc:v1:..., never the number | 200; contact_number in DB = enc:v1:RkmFpZUKhGDZpxdl:thAeRu+Fk9... | PASS |
| F3 | The applicant still sees their own real values | portal gets 09171234567 | contact=09171234567, medical=Asthma | PASS |
| F4 | Admins still see the real values in the applicant window | admin detail gets 09171234567 | contact=09171234567, sibling=09170000000 | PASS |
| F5 | An encrypted value edited directly in the database is rejected (integrity) | shown blank, not altered data | contact after tampering = "" | PASS |

### Cross-Site Request Forgery (5/5 passed)

| ID | Test | Expected | Actual result | Result |
|---|---|---|---|---|
| G1 | State-changing requests without the anti-CSRF token are refused | all 403 | 403,403,403,403,403 (incl. document re-upload) | PASS |
| G2 | A wrong token is refused | 403 | 403 | PASS |
| G3 | Requests from another website are refused even with a token | 403 for Origin and Sec-Fetch-Site | 403, 403 | PASS |
| G4 | The same request WITH the right token works (control) | 200 | 200 | PASS |
| G5 | Real attack page on another site auto-submits a form while the admin is signed in | blocked; settings unchanged | responses=403; applications_open still true | PASS |

### Security Misconfiguration (5/5 passed)

| ID | Test | Expected | Actual result | Result |
|---|---|---|---|---|
| H1 | Server errors do not reveal database details | generic message + Ref code, no table names | 500 {"error":"Something went wrong on our side. Please try again in a moment. (Ref: QS4QW3)"} | PASS |
| H2 | Security headers on every reply; no X-Powered-By | nosniff, DENY, CSP, Referrer, Permissions | all present; x-powered-by=null | PASS |
| H3 | No exposed debug or secret files | all 404 | /.env=404 /.env.local=404 /.git/config=404 /api/debug=404 /api/test=404 /package.json=404 /next.config.ts=404 /docs/migrations/2026-10-07-security-hardening.sql | PASS |
| H4 | Browser source maps are not published | 404 for .map files | /_next/static/chunks/webpack-ef5151c9904bfd4b.js.map = 404 | PASS |
| H5 | Production dependencies have no known vulnerabilities | npm audit --omit=dev: 0 | found 0 vulnerabilities | PASS |

## What was built or fixed for these tests (October 7, 2026)

| Chapter 3 item | Before | After |
|---|---|---|
| MFA (Authentication) | Applicants only | Every console account (Super Admin, Admin, Registrar, LGU) also needs a 6-digit emailed code: 10-minute expiry, one use, 5 tries, 1 resend per minute |
| Sign-up email verification | The code could be redirected to another inbox | The code always goes to the email typed at step 1 (A9) |
| Session management | 7-day applicant / 8-hour admin sessions, checked only by the browser | Server-checked: admin 30 min idle / 8 h max, applicant 60 min idle / 12 h max; only real activity extends it; warning 1 minute before |
| CSRF | SameSite=Lax cookies only | Anti-CSRF token on every POST/PUT/PATCH/DELETE plus an Origin / Sec-Fetch-Site check |
| File upload | Trusted the browser's file type | Checks the real file content, refuses disguised programs and PDFs with scripts, safe file names with the real extension, 413 for oversized files |
| Encryption at rest | Supabase disk encryption only | Contact numbers, parents' employment and Medical Status encrypted by the app (AES-256-GCM) before saving |
| Verbose errors | 82 replies passed raw database errors to the browser | Plain message plus a reference code; the details stay in the server log |
| Security headers | Default | HSTS, nosniff, X-Frame-Options DENY, CSP frame-ancestors, Referrer-Policy, Permissions-Policy; no X-Powered-By |
| Rate limiting | Sign-in and codes only | Also uploads, saves/submits, OCR wake-ups, appeal requests, sign-ups |
| Dependencies | Next.js 16.3.4 (known advisory), sharp 0.35.4 | Next.js 16.3.8, sharp 0.35.5; `npm audit --omit=dev`: 0 vulnerabilities |
| Input validation | `?next=` could send a signed-in admin to another site; `%` in a name acted as a wildcard | Both fixed (D3, D4) |

Earlier security work (also Chapter 4 evidence): PR #8, #12 (Activity Log for Super Admins
only), #13 (sign-in rate limiting), #14 (applicants can only change their own application),
#15 (uploads need sign-in), #19 (one admin per applicant at a time), #22, #26 (Registrar
and LGU roles refused by every admin route), #28, #29, #30, #32.

## Manual checks on the live site

Do these on the Vercel Preview of `security-hardening` (and again on iskolusyon.dev after
merging), and screenshot each one:

1. Admin sign-in: password, then the emailed code. Try a wrong code once (shows "4 tries left").
2. Leave the admin console idle: the "Still there?" box appears at 29 minutes and the
   sign-in page says why you were signed out at 30 minutes.
3. Browser DevTools > Application > Cookies: `iskolusyon_admin` shows HttpOnly, Secure,
   SameSite Lax.
4. Open `http://iskolusyon.dev` (http, not https): the browser ends up on https.
5. Supabase Table Editor > applications: `contact_number` shows `enc:v1:...` for an
   applicant who saved after the update (or after running the one-time script).
6. Upload a renamed file (for example a .txt renamed to .png): the portal refuses it.
