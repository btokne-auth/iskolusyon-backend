// "Submitted Documents & Profile Data" schema for the Dashboard applicant
// modal (Sept 22 2026) -- ported from Ivy's admin.html mockup's own
// CATEGORY_DEFS (REVISED-3_admin_with-mock-data.html, ~line 2492), which
// already lays out every field + doc grouped into numbered "stacks" under
// her 4 tabs. Field keys/labels below are taken directly from her object,
// remapped from her mockup-only field keys onto this app's real `applications`
// table columns (app/lib/applicationColumns.js) and real document types
// (app/lib/documentTypes.js) instead of her placeholder key names.
//
// Two honest deviations from her exact list, both noted where they happen:
// 1. This app's document types split into 6 real groups, not her 4 -- see
//    documentTypes.js. 'supportdoc' (her mockup has no equivalent) is
//    folded into Personal Information > Additional Information, the
//    closest real match (Special Demographics & Legal).
// 2. Her financial "Family's Annual Income" stack keys to a `siblingincome`
//    field this app never collects a number for -- only the Proof of
//    Income document itself, which is what the scholarship actually
//    requires. Relabeled "Sibling Information" and keyed to the real
//    fam_siblings list instead of a fabricated income figure.
//
// A stack with a `showIf` is conditionally rendered (e.g. transferee
// academic standing only applies to applying_as === 'Transferee').

export const PROFILE_CATEGORIES = [
  {
    key: 'personal',
    label: 'Personal Information',
    stacks: [
      {
        label: 'Profile Picture',
        fields: [],
        docTypes: ['profilepic'],
      },
      {
        label: 'Identity & Civil Status',
        fields: [
          { key: 'first_name', label: 'First Name' },
          { key: 'middle_name', label: 'Middle Name' },
          { key: 'last_name', label: 'Last Name' },
          { key: 'suffix', label: 'Suffix' },
          { key: 'date_of_birth', label: 'Date of Birth' },
          { key: 'place_of_birth', label: 'Place of Birth' },
          { key: 'sex', label: 'Sex' },
          { key: 'citizenship', label: 'Citizenship' },
          { key: 'religion', label: 'Religion' },
          { key: 'civil_status', label: 'Civil Status' },
          { key: 'spouse_name', label: "Spouse's Name" },
          { key: 'spouse_occupation', label: "Spouse's Occupation" },
          { key: 'spouse_contact', label: "Spouse's Contact Number" },
        ],
        docTypes: ['birthcert'],
      },
      {
        label: 'Contact & Residency',
        fields: [
          { key: 'applicant_email', label: 'Email Address' },
          { key: 'contact_number', label: 'Contact Number' },
          { key: 'address', label: 'Present Home Address' },
          { key: 'barangay', label: 'Barangay' },
          { key: 'residency_years', label: 'Years of Residency' },
          { key: 'voter_precinct', label: "Voter's Precinct No." },
        ],
        docTypes: ['voterid'],
      },
      {
        label: 'Additional Information',
        fields: [
          { key: 'lgbtqi_member', label: 'LGBTQI+ Community Member' },
          { key: 'disability', label: 'Physical/Behavioral Condition or Disability' },
          { key: 'hobbies', label: 'Hobbies and Interests' },
        ],
        // supportdoc has no equivalent stack in Ivy's mockup -- folded in
        // here as the closest real match (see file header).
        docTypes: ['supportdoc'],
      },
      {
        label: 'Organizational Involvement',
        fields: [{ key: 'organizations', label: 'Organizational Involvement', format: 'organizations' }],
        docTypes: [],
      },
      {
        label: 'Motivation and Aspirations Questions',
        fields: [
          { key: 'motivation', label: 'Motivation for Applying' },
          { key: 'self_description', label: 'Self-Description' },
          { key: 'ten_years_plan', label: 'Ten-Year Aspiration' },
        ],
        docTypes: [],
      },
    ],
  },
  {
    key: 'academic',
    label: 'Educational Background',
    stacks: [
      {
        label: 'Program Application',
        fields: [
          { key: 'applying_as', label: 'Applying As' },
          { key: 'term_applying', label: 'Term Applying In' },
        ],
        docTypes: [],
      },
      {
        label: 'Preferred Program',
        fields: [
          { key: 'program_choice_1', label: 'First Priority Program' },
          { key: 'program_choice_2', label: 'Second Priority Program' },
        ],
        docTypes: [],
      },
      {
        // Oct 6 2026: Appendix J p. 96 rule a. Only asked when a choice is
        // BSEd Mathematics or BSEd Science; admins check it against the
        // report card (Form 138) and can fix it here.
        label: 'BSEd Mathematics / Science Requirement',
        showIf: (row) =>
          ['Bachelor of Secondary Education Major in Mathematics', 'Bachelor of Secondary Education Major in Science'].includes(row?.program_choice_1) ||
          ['Bachelor of Secondary Education Major in Mathematics', 'Bachelor of Secondary Education Major in Science'].includes(row?.program_choice_2),
        fields: [{ key: 'shs_math_science_lowest', label: 'Lowest SHS Mathematics or Science Grade (85 or higher needed)' }],
        docTypes: [],
      },
      {
        label: 'Educational Background',
        fields: [
          { key: 'edu_prim_school', label: 'Primary/Elementary School Name' },
          { key: 'edu_prim_address', label: 'Primary/Elementary Address' },
          { key: 'edu_prim_section', label: 'Primary/Elementary Section/Strand/Program' },
          { key: 'edu_prim_year', label: 'Primary/Elementary Completion Year' },
          { key: 'edu_prim_honors', label: 'Primary/Elementary Honors/Awards Received' },
          { key: 'edu_sec_school', label: 'Secondary/Senior High School Name' },
          { key: 'edu_sec_address', label: 'Secondary/Senior High Address' },
          { key: 'edu_sec_section', label: 'Secondary/Senior High Section/Strand/Program' },
          { key: 'edu_sec_year', label: 'Secondary/Senior High Completion Year' },
          { key: 'edu_sec_honors', label: 'Secondary/Senior High Honors/Awards Received' },
          { key: 'edu_tert_school', label: 'Tertiary/College School Name' },
          { key: 'edu_tert_address', label: 'Tertiary/College Address' },
          { key: 'edu_tert_section', label: 'Tertiary/College Section/Strand/Program' },
          { key: 'edu_tert_year', label: 'Tertiary/College Completion Year' },
          { key: 'edu_tert_honors', label: 'Tertiary/College Honors/Awards Received' },
          { key: 'tech_voc', label: 'Technical/Vocational Course Taken' },
          { key: 'tech_voc_school', label: 'Technical/Vocational School Name' },
          { key: 'tech_voc_course', label: 'Technical/Vocational Course Name' },
          { key: 'tech_voc_address', label: 'Technical/Vocational School Address' },
        ],
        docTypes: ['form138'],
      },
      {
        // No stack for this in Ivy's mockup -- added because it's a real,
        // already-collected field this system needs for Appendix J's
        // transferee rule (app/lib/matching.js), and it belongs somewhere
        // an admin reviewing a transferee's academic background can see it.
        label: 'Transferee Academic Standing',
        showIf: (row) => row?.applying_as === 'Transferee',
        fields: [
          { key: 'transferee_gwa', label: 'General Weighted Average (GWA)' },
          { key: 'transferee_units_passed', label: 'Units Passed' },
          { key: 'transferee_failing_grade', label: 'Failing Grade in a Previous Semester?' },
        ],
        docTypes: [],
      },
    ],
  },
  {
    key: 'financial',
    label: 'Family & Financial Information',
    stacks: [
      {
        label: 'Family Information',
        fields: [
          { key: 'fam_mother_name', label: "Mother's Name" },
          { key: 'fam_mother_citizenship', label: "Mother's Citizenship" },
          { key: 'fam_mother_dob', label: "Mother's Date of Birth" },
          { key: 'fam_mother_contact', label: "Mother's Contact Number" },
          { key: 'fam_mother_education', label: "Mother's Highest Educational Attainment" },
          { key: 'fam_mother_employment', label: "Mother's Employment Status" },
          { key: 'fam_father_name', label: "Father's Name" },
          { key: 'fam_father_citizenship', label: "Father's Citizenship" },
          { key: 'fam_father_dob', label: "Father's Date of Birth" },
          { key: 'fam_father_contact', label: "Father's Contact Number" },
          { key: 'fam_father_education', label: "Father's Highest Educational Attainment" },
          { key: 'fam_father_employment', label: "Father's Employment Status" },
          { key: 'fam_guardian_name', label: "Guardian's Name" },
          { key: 'fam_guardian_citizenship', label: "Guardian's Citizenship" },
          { key: 'fam_guardian_dob', label: "Guardian's Date of Birth" },
          { key: 'fam_guardian_contact', label: "Guardian's Contact Number" },
          { key: 'fam_guardian_education', label: "Guardian's Highest Educational Attainment" },
          { key: 'fam_guardian_employment', label: "Guardian's Employment Status" },
          { key: 'fam_only_child', label: 'Only Child' },
          { key: 'fam_num_siblings', label: 'Number of Siblings' },
          { key: 'fam_sibling_currentstudent', label: 'Sibling Currently Enrolled at CCC' },
          { key: 'fam_sibling_graduate', label: 'Sibling Graduated from CCC' },
          { key: 'fam_emergency_contact', label: 'Person to be Notified in Case of Emergency' },
          { key: 'fam_emergency_contact_number', label: 'Emergency Contact Number' },
        ],
        docTypes: ['parentid'],
      },
      {
        label: "Applicant's Employment",
        fields: [{ key: 'fam_working_student', label: 'Working Student' }],
        docTypes: ['employmentcert'],
      },
      {
        // Ivy's mockup keys this stack to a sibling-income number this
        // system never collects (only the Proof of Income document) --
        // relabeled to match the real fam_siblings list instead of
        // fabricating a figure. See file header.
        label: 'Sibling Information',
        fields: [{ key: 'fam_siblings', label: 'Siblings', format: 'siblings' }],
        docTypes: ['indigency'],
      },
    ],
  },
  {
    key: 'health',
    label: 'Health & Wellness',
    stacks: [
      {
        label: 'Health Details',
        fields: [{ key: 'health_condition', label: 'Medical Status' }],
        docTypes: [],
      },
      {
        label: 'Required Document',
        fields: [],
        docTypes: ['medcert'],
      },
    ],
  },
]

const EMPTY_VALUE = 'Not provided'

// Formats one field's raw DB value for read-only display. Booleans, arrays
// (organizations / siblings) and plain scalars each need their own
// treatment; anything unset renders as an em dash rather than "null" or
// "undefined" leaking through.
export function formatFieldValue(row, field) {
  const value = row ? row[field.key] : undefined
  if (field.format === 'organizations') {
    const list = Array.isArray(value) ? value : []
    if (list.length === 0) return EMPTY_VALUE
    return list
      .map((o) => [o.name, o.position, o.nature, o.year].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join('; ')
  }
  if (field.format === 'siblings') {
    const list = Array.isArray(value) ? value : []
    if (list.length === 0) return EMPTY_VALUE
    return list
      .map((s) => [s.name, s.education, s.civilStatus].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join('; ')
  }
  if (value === null || value === undefined || value === '') return EMPTY_VALUE
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
