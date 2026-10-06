// Oct 1 2026: rules for admins editing an applicant's submitted profile
// data (progress table rows "Applicant Profile Edit & Save Controls" and
// "Applicant Detail with Personal Information View/Edit", Ivy's rows).
//
// Per Ivy's comment on those rows: the client checks documents manually,
// and when something is wrong or the applicant asks for a change, an admin
// (Guidance) fixes it. Only the "Submitted Documents & Profile Data" fields
// are editable; General Information is read-only and simply shows the
// updated values. Pau decided (Oct 1): any admin can edit, the applicant gets
// a portal message (no email), and every edit is logged with old -> new.
//
// Shared by the admin modal (which inputs to show) and the API (what to
// accept), so both always agree.

import { PROFILE_CATEGORIES } from '@/app/lib/applicantProfileSchema'

export const PROGRAM_OPTIONS = [
  'Bachelor of Science in Accounting Information System',
  'Bachelor of Science in Accountancy',
  'Bachelor of Early Childhood Education',
  'Bachelor of Secondary Education Major in Filipino',
  'Bachelor of Secondary Education Major in English',
  'Bachelor of Elementary Education',
  'Bachelor of Secondary Education Major in Social Studies',
  'Bachelor of Secondary Education Major in Science',
  'Bachelor of Secondary Education Major in Mathematics',
  'Bachelor of Science in Computer Science',
  'Bachelor of Science in Information Technology',
  'Bachelor of Science in Psychology',
]

const YES_NO = ['Yes', 'No']

// Same choices as the applicant's own form (app/portal/page.js).
export const SELECT_OPTIONS = {
  sex: ['Male', 'Female'],
  civil_status: ['Single', 'Married', 'Widowed', 'Separated'],
  lgbtqi_member: YES_NO,
  applying_as: ['First Year', 'Transferee', 'Old Curriculum and ALS Completer'],
  term_applying: ['Term 1', 'Term 2'],
  program_choice_1: PROGRAM_OPTIONS,
  program_choice_2: [...PROGRAM_OPTIONS, 'None of the above'],
  tech_voc: YES_NO,
  transferee_failing_grade: YES_NO,
  fam_only_child: YES_NO,
  fam_sibling_currentstudent: YES_NO,
  fam_sibling_graduate: YES_NO,
  fam_working_student: YES_NO,
}

// Stored as numbers.
export const INTEGER_FIELDS = new Set(['residency_years', 'fam_num_siblings', 'transferee_units_passed'])
export const DECIMAL_FIELDS = new Set(['transferee_gwa', 'shs_math_science_lowest'])

export const DATE_FIELDS = new Set(['date_of_birth'])

// Long free-text answers get a bigger limit and a text area.
export const LONG_TEXT_FIELDS = new Set(['motivation', 'self_description', 'ten_years_plan', 'disability', 'hobbies', 'health_condition'])

// Never editable here: the account email is the applicant's login, and the
// two list fields (organizations, siblings) are edited by the applicant.
const NOT_EDITABLE = new Set(['applicant_email'])

// Health details are logged as "changed" without the values themselves.
export const PRIVATE_LOG_FIELDS = new Set(['health_condition', 'disability'])

export const EDITABLE_FIELDS = new Map()
for (const cat of PROFILE_CATEGORIES) {
  for (const stack of cat.stacks) {
    for (const field of stack.fields) {
      if (field.format || NOT_EDITABLE.has(field.key)) continue
      EDITABLE_FIELDS.set(field.key, field.label)
    }
  }
}

export function isEditableStack(stack) {
  return stack.fields.some((f) => EDITABLE_FIELDS.has(f.key))
}

// Turns one submitted value into what gets stored, or { error }.
export function cleanValue(key, raw) {
  const label = EDITABLE_FIELDS.get(key)
  const text = raw === null || raw === undefined ? '' : String(raw).trim()
  if (text === '') return { value: null }
  if (SELECT_OPTIONS[key]) {
    return SELECT_OPTIONS[key].includes(text) ? { value: text } : { error: `${label}: pick one of the listed options.` }
  }
  if (INTEGER_FIELDS.has(key)) {
    return /^\d{1,4}$/.test(text) ? { value: Number(text) } : { error: `${label} must be a whole number.` }
  }
  if (key === 'shs_math_science_lowest') {
    const n = Number(text)
    return /^\d{2,3}(\.\d{1,2})?$/.test(text) && n >= 60 && n <= 100
      ? { value: n }
      : { error: `${label} must be a grade from 60 to 100.` }
  }
  if (DECIMAL_FIELDS.has(key)) {
    return /^\d{1,3}(\.\d{1,2})?$/.test(text) ? { value: Number(text) } : { error: `${label} must be a number like 85.5.` }
  }
  if (DATE_FIELDS.has(key)) {
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? { value: text } : { error: `${label} must be a valid date.` }
  }
  const max = LONG_TEXT_FIELDS.has(key) ? 2000 : 200
  return text.length <= max ? { value: text } : { error: `${label} is too long (up to ${max} characters).` }
}
