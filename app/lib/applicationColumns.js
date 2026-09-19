// Shared camelCase -> snake_case column mappers for the `applications`
// table. Split out of app/api/application/route.js on Sept 19, 2026 so
// applicantAccounts.js (signup verification, which creates the first
// `applications` row from staged Program Application / Personal
// Information) can reuse the exact same mapping instead of duplicating it.

export function personalInfoToColumns(personalInfo) {
  const pi = personalInfo && typeof personalInfo === 'object' ? personalInfo : {}
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    first_name: text(pi.firstName),
    middle_name: text(pi.middleName),
    last_name: text(pi.lastName),
    suffix: text(pi.suffix),
    date_of_birth: text(pi.dateOfBirth),
    place_of_birth: text(pi.placeOfBirth),
    sex: text(pi.sex),
    citizenship: text(pi.citizenship),
    religion: text(pi.religion),
    civil_status: text(pi.civilStatus),
    spouse_name: text(pi.spouseName),
    spouse_occupation: text(pi.spouseOccupation),
    spouse_contact: text(pi.spouseContact),
    contact_number: text(pi.contactNumber),
    address: text(pi.address),
    barangay: text(pi.barangay),
    residency_years: typeof pi.residencyYears === 'number' || /^\d+$/.test(String(pi.residencyYears || '').trim())
      ? Number(pi.residencyYears)
      : null,
    voter_precinct: text(pi.voterPrecinct),
    email_updates_opt_in: !!pi.emailUpdatesOptIn,
    sms_updates_opt_in: !!pi.smsUpdatesOptIn,
    lgbtqi_member: text(pi.lgbtqi),
    disability: text(pi.disability),
    hobbies: text(pi.hobbies),
    organizations: Array.isArray(pi.organizations)
      ? pi.organizations
          .map((o) => ({
            name: text(o && o.name),
            position: text(o && o.position),
            nature: text(o && o.nature),
            year: text(o && o.year),
          }))
          .filter((o) => o.name || o.position || o.nature || o.year)
      : [],
    motivation: text(pi.motivation),
    self_description: text(pi.selfDescription),
    ten_years_plan: text(pi.tenYears),
    terms_certified: !!pi.termsCertified,
    privacy_agreed: !!pi.privacyAgreed,
  }
}

export function academicInfoToColumns(academicInfo) {
  const ai = academicInfo && typeof academicInfo === 'object' ? academicInfo : {}
  const edu = ai.edu && typeof ai.edu === 'object' ? ai.edu : {}
  const prim = edu.prim || {}
  const sec = edu.sec || {}
  const tert = edu.tert || {}
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    applying_as: text(ai.applyingAs),
    term_applying: text(ai.termApplying),
    program_choice_1: text(ai.choice1),
    program_choice_2: text(ai.choice2),
    edu_prim_school: text(prim.school),
    edu_prim_address: text(prim.address),
    edu_prim_section: text(prim.section),
    edu_prim_year: text(prim.year),
    edu_prim_honors: text(prim.honors),
    edu_sec_school: text(sec.school),
    edu_sec_address: text(sec.address),
    edu_sec_section: text(sec.section),
    edu_sec_year: text(sec.year),
    edu_sec_honors: text(sec.honors),
    edu_tert_school: text(tert.school),
    edu_tert_address: text(tert.address),
    edu_tert_section: text(tert.section),
    edu_tert_year: text(tert.year),
    edu_tert_honors: text(tert.honors),
    tech_voc: text(ai.techVoc),
    tech_voc_school: text(ai.techVocSchool),
    tech_voc_course: text(ai.techVocCourse),
    tech_voc_address: text(ai.techVocAddress),
  }
}

// Health & Wellness panel — just the one free-text field Ivy's spec has
// (Medical Status). The Medical Examination Results/Certificate upload
// itself uses the existing `medcert` document type, so it needs no column
// here, same as every other document upload in this app.
export function healthInfoToColumns(healthInfo) {
  const hi = healthInfo && typeof healthInfo === 'object' ? healthInfo : {}
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    health_condition: text(hi.medicalStatus),
  }
}
