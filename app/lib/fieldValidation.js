// Oct 21 2026: input validation for the applicant's own typed details.
//
// Found during the Oct 20 final defense and the night before: sign-up and the
// profile sections accepted a birthdate of today, a mobile number missing a
// digit, "1234 567 8990", an address in Cabuyao, gibberish in Place of Birth /
// Citizenship / Religion, "test)___" as a completion year, and one-word
// answers to the essay questions.
//
// Pure functions, no imports, so the SAME rules run in the browser (instant
// feedback in the sign-up wizard and the portal) and on the server (sign-up
// 'save' and the portal's 'submit-section'), where they can't be skipped.
//
// Each validate* function takes the same object shape the forms already send
// (personalInfo / academicInfo / familyInfo) and returns a list of
// { field, message }. An empty list means everything checked is fine. Blank
// optional fields are never an error here; "required" is still handled by the
// existing checks in the forms and on the server.

// The 54 barangays of Calamba City (the sign-up wizard's Barangay of Residence
// dropdown). Moved here from ApplicantAuth.js so the server can check it too.
export const CALAMBA_BARANGAYS = [
  'Bagong Kalsada', 'Bañadero', 'Banlic', 'Barandal', 'Barangay 1', 'Barangay 2', 'Barangay 3',
  'Barangay 4', 'Barangay 5', 'Barangay 6', 'Barangay 7', 'Batino', 'Bubuyan', 'Bucal', 'Bunggo',
  'Burol', 'Camaligan', 'Canlubang', 'Halang', 'Hornalan', 'Kay-Anlog', 'La Mesa', 'Laguerta',
  'Lawa', 'Lecheria', 'Lingga', 'Looc', 'Mabato', 'Majada Labas', 'Makiling', 'Mapagong', 'Masili',
  'Maunong', 'Mayapa', 'Milagrosa', 'Paciano Rizal', 'Palingon', 'Palo-Alto', 'Pansol', 'Parian',
  'Prinza', 'Punta', 'Puting Lupa', 'Real', 'Saimsim', 'Sampiruhan', 'San Cristobal', 'San Jose',
  'San Juan', 'Sirang Lupa', 'Sucol', 'Turbina', 'Ulango', 'Uwisan',
]

export const CALAMBA_ONLY_MESSAGE =
  'Iskolusyon scholarships are only for residents of Calamba City (CCC Scholar Guidelines).'

// The sign-up and portal address field only takes the house number and
// street; the barangay comes from the dropdown and the city is fixed to
// Calamba City, so typing another town is refused instead of "fixed".
export const ADDRESS_OTHER_PLACE_MESSAGE =
  'Only Calamba City addresses are accepted. Type just your house number and street; the barangay and city (Calamba City) are filled in for you.'

// Cities, municipalities and provinces an applicant near Calamba might type.
// Used only to catch an address that clearly says it is somewhere else.
const OTHER_PLACES = [
  'cabuyao', 'santa rosa', 'sta rosa', 'sta. rosa', 'binan', 'biñan', 'san pedro', 'los banos', 'los baños',
  'bay laguna', 'calauan', 'victoria laguna', 'san pablo', 'pila', 'santa cruz', 'sta cruz', 'sta. cruz',
  'tanauan', 'santo tomas', 'sto tomas', 'sto. tomas', 'lipa', 'batangas', 'cavite', 'silang', 'carmona',
  'general trias', 'dasmarinas', 'dasmariñas', 'imus', 'bacoor', 'tagaytay', 'muntinlupa',
  'manila', 'quezon city', 'makati', 'taguig', 'pasig', 'paranaque', 'parañaque', 'las pinas', 'las piñas',
  'pasay', 'mandaluyong', 'caloocan', 'valenzuela', 'marikina', 'rizal province', 'antipolo', 'cainta',
  'bulacan', 'pampanga', 'quezon province', 'lucena', 'cebu', 'davao',
]

// "N/A", "NA", "None", "-" count as left blank (the forms' own placeholders
// suggest N/A for rows that don't apply, e.g. a spouse or guardian).
function str(v) {
  const s = typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim()
  return /^(n\s*\/?\s*a|none|not applicable|-+)$/i.test(s) ? '' : s
}

function plain(v) {
  return str(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
}

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/
const PLACE_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'()#/-]*$/

function letterCount(v) {
  return (str(v).match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length
}

// 0917 123 4567, 0917-123-4567, +63 917 123 4567 and 639171234567 are all
// accepted; anything else (missing a digit, 1234 567 8990) is not.
export function normalizeMobile(value) {
  const digits = str(value).replace(/[\s()-]/g, '').replace(/^\+/, '')
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`
  return digits
}

// Oct 21 2026: phone inputs always start with 09. Typing 9171234567 or
// pasting +63 917 123 4567 becomes 0917 123 4567; at most 11 digits, shown
// in the app's 4-3-4 grouping. A lone "0" or an empty field is left alone so
// the field can still be cleared.
export function formatMobileInput(value) {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (digits === '' || digits === '0') return digits
  if (digits.startsWith('63')) digits = `0${digits.slice(2)}`
  else if (digits.startsWith('9')) digits = `0${digits}`
  if (!digits.startsWith('09')) digits = `09${digits.replace(/^0+/, '')}`
  digits = digits.slice(0, 11)
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean).join(' ')
}

export function isValidMobile(value) {
  return /^09\d{9}$/.test(normalizeMobile(value))
}

export function mentionsOtherPlace(address, { strict = false } = {}) {
  const p = ` ${plain(address).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `
  if (!strict && p.includes(' calamba ')) return null
  for (const place of OTHER_PLACES) {
    const key = ` ${place.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `
    if (p.includes(key)) return place
  }
  return null
}

// Oct 25 2026: the Family & Financial table takes parents' birthdates as
// MM/DD/YYYY text (the applicant's own uses a date picker, YYYY-MM-DD).
// Both are accepted, plus YYYY/MM/DD.
function parseDate(dateStr) {
  const v = str(dateStr)
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(v)
  if (m) return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v)
  if (m) return { y: Number(m[3]), mo: Number(m[1]), d: Number(m[2]) }
  return null
}

// Oct 25 2026: every birthdate is now a calendar picker (YYYY-MM-DD). Older
// parent/sibling dates were saved as MM/DD/YYYY text; this turns those into
// the picker's format so they still show. Anything else shows as empty.
export function toDateInputValue(value) {
  const parsed = parseDate(value)
  if (!parsed) return ''
  // Oct 25 2026: the year is padded to 4 digits too. While a year is being
  // typed, the picker reports "0001-12-02", "0019-12-02"...; turning that
  // into "1-12-02" made the picker reset and wipe what was typed.
  const pad = (n, len = 2) => String(n).padStart(len, '0')
  return `${pad(parsed.y, 4)}-${pad(parsed.mo)}-${pad(parsed.d)}`
}

// The latest / earliest dates a birthdate picker allows (Manila time).
// latestBirthdate(15) = exactly 15 years ago, so a 15-year-old is the
// youngest that can be picked; latestBirthdate() = yesterday (siblings).
// earliestBirthdate(65) = 65 years ago.
function yearsAgo(years, now = new Date()) {
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  manila.setUTCFullYear(manila.getUTCFullYear() - years)
  return manila
}
export function latestBirthdate(minAge = 0, now = new Date()) {
  const d = yearsAgo(minAge, now)
  if (minAge === 0) d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
export function earliestBirthdate(maxAge, now = new Date()) {
  const d = yearsAgo(maxAge + 1, now)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function ageOn(dateStr, today = new Date()) {
  const parsed = parseDate(dateStr)
  if (!parsed) return null
  const { y, mo, d } = parsed
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  // Manila date, so "today" doesn't depend on the server's time zone.
  const now = new Date(today.getTime() + 8 * 60 * 60 * 1000)
  const ny = now.getUTCFullYear()
  const nm = now.getUTCMonth() + 1
  const nd = now.getUTCDate()
  const isFutureOrToday = y > ny || (y === ny && (mo > nm || (mo === nm && d >= nd)))
  let age = ny - y
  if (nm < mo || (nm === mo && nd < d)) age -= 1
  return { age, isFutureOrToday }
}

export const MIN_APPLICANT_AGE = 15
export const MAX_APPLICANT_AGE = 65

export function birthdateError(dateStr, { minAge = MIN_APPLICANT_AGE, maxAge = MAX_APPLICANT_AGE, who = 'your' } = {}) {
  if (!str(dateStr)) return null
  const info = ageOn(dateStr)
  if (!info) return who === 'your' ? 'Please enter a valid date of birth.' : `Please pick ${who} date of birth from the calendar.`
  if (info.isFutureOrToday) return who === 'your' ? 'The date of birth cannot be today or a future date.' : `${capitalize(who)} date of birth cannot be today or a future date.`
  if (info.age < minAge) return who === 'your' ? `Applicants must be at least ${minAge} years old. Please check your date of birth.` : `Please check ${who} date of birth.`
  if (info.age > maxAge) return `Please check ${who} date of birth.`
  return null
}

// Oct 25 2026: keyboard-mash answers ("akjsdjasd", "sjhajkhsd") have a run
// of 5 or more consonants inside a word, which real Filipino and English
// names, schools and job words don't; so does a chunk typed 3 times in a
// row ("asdasdasd"). A light check, not a dictionary.
function looksLikeGibberish(v) {
  return str(v)
    .toLowerCase()
    .split(/[^a-zà-öø-ÿ]+/)
    .some((word) => /[bcdfghjklmnpqrstvwxz]{5,}/.test(word) || /(.)\1{3,}/.test(word) || /(.{2,4})\1{2,}/.test(word))
}

function nameError(value, label, { required = false } = {}) {
  const v = str(value)
  if (!v) return required ? `Please enter ${label}.` : null
  if (v.length > 60) return `${capitalize(label)} is too long.`
  if (!NAME_RE.test(v)) return `${capitalize(label)} can only contain letters, spaces, periods, apostrophes and hyphens.`
  if (letterCount(v) < 2) return `Please enter a complete ${label}.`
  if (looksLikeGibberish(v)) return `Please check ${label}: it doesn't look like a real entry.`
  return null
}

// Nov 2026 (panel revisions S6): free-text answers like Honors / Awards may
// have a few numbers ("Top 10", "1st place") but not mashed keys or long
// runs of the same character or of digits.
function looksLikeJunk(v) {
  const s = str(v)
  const compact = s.replace(/\s+/g, '')
  if (!compact) return false
  if (/(.)\1{3,}/.test(compact)) return true
  if (/\d{5,}/.test(compact)) return true
  const digits = (compact.match(/\d/g) || []).length
  const letters = (compact.match(/[a-zà-öø-ÿ]/gi) || []).length
  return letters < 3 || digits > letters
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function wordsError(value, label, { min = 3, max = 60, letters = 3 } = {}) {
  const v = str(value)
  if (!v) return null
  if (v.length < min || letterCount(v) < letters) return `Please enter a complete ${label}.`
  if (v.length > max) return `${capitalize(label)} is too long (${max} characters at most).`
  if (/\d/.test(v)) return `${capitalize(label)} should not contain numbers.`
  if (!NAME_RE.test(v.replace(/,/g, ''))) return `${capitalize(label)} can only contain letters and spaces.`
  if (looksLikeGibberish(v)) return `Please check ${label}: it doesn't look like a real entry.`
  return null
}

function placeError(value, label, { min = 3, max = 150 } = {}) {
  const v = str(value)
  if (!v) return null
  if (v.length < min || letterCount(v) < 3) return `Please enter a complete ${label}.`
  if ((v.match(/\d/g) || []).length > letterCount(v)) return `Please enter a complete ${label}.`
  if (v.length > max) return `${capitalize(label)} is too long.`
  if (!PLACE_RE.test(v)) return `${capitalize(label)} has characters that aren't allowed.`
  if (looksLikeGibberish(v)) return `Please check ${label}: it doesn't look like a real entry.`
  return null
}

function essayError(value, label, min = 20) {
  const v = str(value)
  if (!v) return null
  const words = v.split(/\s+/).filter((w) => letterCount(w) > 0).length
  if (v.length < min || words < 4) return `Please write a fuller answer for ${label} (at least ${min} characters).`
  return null
}

function yearError(value, label) {
  const v = str(value)
  if (!v) return null
  if (!/^\d{4}$/.test(v)) return `${capitalize(label)} must be a 4-digit year (e.g. 2024).`
  const y = Number(v)
  const max = new Date().getFullYear() + 1
  if (y < 1950 || y > max) return `Please check ${label}.`
  return null
}

function mobileError(value, label) {
  if (!str(value)) return null
  if (!isValidMobile(value)) return `${capitalize(label)} must be an 11-digit mobile number starting with 09 (e.g. 0917 123 4567).`
  return null
}

function push(list, field, message) {
  if (message) list.push({ field, message })
}

// Address rule shared by sign-up and the portal. With a Calamba barangay
// picked, the address may leave the city out (it is added on save, see
// withCalambaCity), but it may never name another city.
export function addressError(address, barangay) {
  const v = str(address)
  if (!v) return null
  if (v.length < 5 || letterCount(v) < 3) return 'Please enter your complete address (house no., street or subdivision).'
  if (v.length > 200) return 'Your address is too long.'
  // Oct 21 2026: "Cabuyao, Calamba" or "Sta. Rosa" is refused even when
  // "Calamba" is also typed; the city is fixed, so no other town belongs here.
  if (mentionsOtherPlace(v, { strict: true })) return ADDRESS_OTHER_PLACE_MESSAGE
  if (str(barangay) && !CALAMBA_BARANGAYS.includes(str(barangay))) return CALAMBA_ONLY_MESSAGE
  // Just "Calamba" / "Brgy. Real, Calamba City" with no house or street.
  const b = plain(barangay)
  let rest = plain(v).replace(/\b(calamba|city|laguna|philippines|brgy|barangay|bgy)\b/g, ' ')
  if (b) rest = rest.split(b).join(' ')
  if (!/\d/.test(rest) && letterCount(rest) < 3) {
    return 'Please type your house number and street or subdivision. The barangay and city are filled in for you.'
  }
  return null
}

// "123 Rizal St." + "Real" -> "123 Rizal St., Brgy. Real, Calamba City".
// Only when the address names no other place, so a Cabuyao address saved as a
// draft is never quietly turned into a Calamba one.
export function withCalambaCity(address, barangay) {
  const v = str(address)
  if (!v) return v
  if (mentionsOtherPlace(v, { strict: true })) return v
  // A typed ", Calamba City, Laguna" at the end is dropped and re-added in
  // the standard form, so the result never says Calamba twice.
  const street = v.replace(/[,\s]*calamba(\s+city)?([,\s]+laguna)?[,.\s]*$/i, '').replace(/[,\s]+$/, '')
  if (!street) return v
  if (/calamba/i.test(street)) return v
  const b = str(barangay)
  const brgy = b && CALAMBA_BARANGAYS.includes(b) && !plain(street).includes(plain(b)) ? `, Brgy. ${b}` : ''
  return `${street}${brgy}, Calamba City`
}

// ---------- Personal Information (sign-up step 3 and the portal) ----------
export function validatePersonalInfo(pi, { signup = false } = {}) {
  const p = pi && typeof pi === 'object' ? pi : {}
  const errors = []
  push(errors, 'lastName', nameError(p.lastName, 'your last name'))
  push(errors, 'firstName', nameError(p.firstName, 'your first name'))
  push(errors, 'middleName', nameError(p.middleName, 'your middle name'))
  push(errors, 'dateOfBirth', birthdateError(p.dateOfBirth))
  push(errors, 'contactNumber', mobileError(p.contactNumber, 'contact number'))
  push(errors, 'address', addressError(p.address, p.barangay))
  if (signup && str(p.barangay) && !CALAMBA_BARANGAYS.includes(str(p.barangay))) {
    push(errors, 'barangay', 'Please choose your barangay in Calamba City.')
  }
  const years = str(p.residencyYears)
  if (years) {
    const age = ageOn(p.dateOfBirth)?.age
    if (!/^\d{1,2}$/.test(years)) push(errors, 'residencyYears', 'Years of residency must be a whole number.')
    else if (age !== undefined && age !== null && Number(years) > age) push(errors, 'residencyYears', 'Years of residency cannot be more than your age.')
  }
  if (signup) return errors

  push(errors, 'placeOfBirth', placeError(p.placeOfBirth, 'place of birth', { max: 100 }))
  push(errors, 'citizenship', wordsError(p.citizenship, 'citizenship', { max: 40 }))
  push(errors, 'religion', wordsError(p.religion, 'religion', { min: 3, max: 50 }))
  if (str(p.voterPrecinct) && !/^\d{3,5}[A-Za-z]{0,2}$/.test(str(p.voterPrecinct).replace(/\s+/g, ''))) {
    push(errors, 'voterPrecinct', "Voter's precinct number looks like 0142A (numbers, then up to 2 letters).")
  }
  push(errors, 'spouseName', nameError(p.spouseName, "your spouse's name"))
  push(errors, 'spouseContact', mobileError(p.spouseContact, "spouse's contact number"))
  push(errors, 'hobbies', str(p.hobbies) && letterCount(p.hobbies) < 3 ? 'Please describe your hobbies and interests.' : null)
  push(errors, 'motivation', essayError(p.motivation, 'Motivation for Applying'))
  push(errors, 'selfDescription', essayError(p.selfDescription, 'Self-Description'))
  push(errors, 'tenYears', essayError(p.tenYears, 'Ten-Year Aspiration'))
  return errors
}

// ---------- Educational Background ----------
export function validateAcademicInfo(ai, { dateOfBirth } = {}) {
  const a = ai && typeof ai === 'object' ? ai : {}
  // Nov 2026 (panel revisions S6): years that make sense for this person.
  const birthYear = parseDate(dateOfBirth)?.y || null
  const edu = a.edu && typeof a.edu === 'object' ? a.edu : {}
  const errors = []
  const levels = [
    ['prim', 'elementary'],
    ['sec', 'senior high'],
    ['tert', 'college'],
  ]
  let lastYear = 0
  for (const [key, label] of levels) {
    const lvl = edu[key] || {}
    push(errors, `${key}.school`, placeError(lvl.school, `${label} school name`))
    push(errors, `${key}.address`, placeError(lvl.address, `${label} school address`, { max: 200 }))
    const honors = str(lvl.honors)
    if (honors && (honors.length > 100 || looksLikeGibberish(honors) || looksLikeJunk(honors))) push(errors, `${key}.honors`, `Please check the ${label} honors / awards (a short, real entry, or N/A).`)
    const ye = yearError(lvl.year, `${label} completion year`)
    push(errors, `${key}.year`, ye)
    if (!ye && str(lvl.year)) {
      const y = Number(str(lvl.year))
      if (y < lastYear) push(errors, `${key}.year`, `The ${label} completion year should not be earlier than the level before it.`)
      else if (birthYear && key === 'prim' && y < birthYear + 10) push(errors, `${key}.year`, `The elementary completion year looks too early for your date of birth (${birthYear}).`)
      else if (birthYear && y < birthYear + 10) push(errors, `${key}.year`, `The ${label} completion year looks too early for your date of birth (${birthYear}).`)
      lastYear = Math.max(lastYear, y)
    }
  }
  // Oct 25 2026: a Transferee must name the college they're transferring from.
  if (str(a.applyingAs) === 'Transferee' && !str((edu.tert || {}).school)) {
    push(errors, 'tert.school', 'Transferees must fill in their previous college (Tertiary / College column).')
  }
  push(errors, 'techVocSchool', placeError(a.techVocSchool, 'technical/vocational school name'))
  push(errors, 'techVocCourse', placeError(a.techVocCourse, 'technical/vocational course name'))
  push(errors, 'techVocAddress', placeError(a.techVocAddress, 'technical/vocational school address', { max: 200 }))
  // Nov 2026 (panel revisions S2): the First Year grade question.
  if (str(a.applyingAs) === 'First Year' && !['Yes', 'No'].includes(str(a.shsFailingGrade))) {
    push(errors, 'shsFailingGrade', 'Please answer: do you have any grade below 75 in your latest Senior High report card?')
  }
  const gwa = str(a.transfereeGwa)
  if (gwa && (!/^\d(\.\d{1,2})?$/.test(gwa) || Number(gwa) < 1 || Number(gwa) > 5)) {
    push(errors, 'transfereeGwa', 'GWA must be between 1.00 and 5.00 (e.g. 1.75).')
  }
  const units = str(a.transfereeUnitsPassed)
  if (units && (!/^\d{1,3}$/.test(units) || Number(units) > 250)) {
    push(errors, 'transfereeUnitsPassed', 'Units passed must be a whole number from 0 to 250.')
  }
  return errors
}

// ---------- Family & Financial Information ----------
export function validateFamilyInfo(fi, { dateOfBirth } = {}) {
  const f = fi && typeof fi === 'object' ? fi : {}
  const errors = []
  // Nov 2026 (panel revisions S6): a parent is older than the applicant.
  const applicantBirth = parseDate(dateOfBirth)
  for (const [key, label] of [['mother', "mother's"], ['father', "father's"], ['guardian', "guardian's"]]) {
    push(errors, `${key}Name`, nameError(f[`${key}Name`], `your ${label} name`))
    push(errors, `${key}Contact`, mobileError(f[`${key}Contact`], `${label} contact number`))
    push(errors, `${key}Citizenship`, wordsError(f[`${key}Citizenship`], `${label} citizenship`, { max: 40 }))
    const dobProblem = birthdateError(f[`${key}Dob`], { minAge: 15, maxAge: 110, who: `your ${label}` })
    push(errors, `${key}Dob`, dobProblem)
    const parentBirth = parseDate(f[`${key}Dob`])
    if (!dobProblem && key !== 'guardian' && parentBirth && applicantBirth && applicantBirth.y - parentBirth.y < 12) {
      push(errors, `${key}Dob`, `Please check your ${label} date of birth. It should be at least 12 years before yours.`)
    }
    push(errors, `${key}Education`, wordsError(f[`${key}Education`], `${label} educational attainment`, { max: 60 }))
    push(errors, `${key}Employment`, wordsError(f[`${key}Employment`], `${label} employment status`, { max: 60 }))
  }
  push(errors, 'emergencyContact', nameError(f.emergencyContact, 'the emergency contact person'))
  push(errors, 'emergencyContactNumber', mobileError(f.emergencyContactNumber, 'emergency contact number'))
  const n = str(f.numSiblings)
  if (n && (!/^\d{1,2}$/.test(n) || Number(n) > 20)) push(errors, 'numSiblings', 'Number of siblings must be a whole number from 0 to 20.')
  return errors
}

// One readable sentence for a toast or banner.
export function errorSummary(errors) {
  const unique = [...new Set(errors.map((e) => e.message))]
  return unique.join(' ')
}
