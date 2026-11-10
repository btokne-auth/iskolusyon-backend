// Landing page content (Oct 8 2026 redesign).
// Everything here is the same wording the previous landing page used, except:
//  - STEP_GUIDES 2-6 were rewritten to match how the system actually works
//    (portal menu names, document statuses, 10 MB limit, onsite exam, real
//    result labels). Step 1 is unchanged.
//  - Transferee units: 26, as in Appendix J p. 94 and app/lib/matching.js
//    (the old page said 28, which did not match CCC's guidelines).
// **double asterisks** mark bold words; <Rich> in page.js renders them.

export const STEPS = [
  {
    "title": "Create Account",
    "desc": "Confirm you live in Calamba, then sign up with your email"
  },
  {
    "title": "Fill Profile",
    "desc": "Enter your personal, academic, and financial information"
  },
  {
    "title": "Upload Docs",
    "desc": "Submit required documents securely through the portal"
  },
  {
    "title": "Check Qualification",
    "desc": "View your scholarship qualification based on submitted documents"
  },
  {
    "title": "Take Exam",
    "desc": "Complete the scholarship qualifying exam on schedule"
  },
  {
    "title": "Result & Medical",
    "desc": "See your result; passers take a medical exam before enrollment"
  }
]

export const STEP_GUIDES = [
  {
    "title": "Create Account / Login",
    "draft": false,
    "groups": [
      {
        "label": "New to Iskolusyon",
        "items": [
          "Click the **Sign Up** button on the navigation bar or homepage.",
          "A **Data Privacy Consent** screen will appear. Read it carefully and click **I Agree** to proceed.",
          "**Residency check first:** answer that you live in Calamba City and upload a **Voter’s ID or COMELEC Voter’s Certification** (yours, or your parent’s or guardian’s). The system reads it and looks for a Calamba address. If it is not confirmed, you cannot continue and the file is not kept.",
          "Once confirmed, enter your **email address** and create a secure **password**. Your address and precinct number are filled in from the Voter’s ID; check them.",
          "Fill in the rest of the registration form with your **personal information**. Ensure all details are accurate, as these will be used for your scholarship application.",
          "Enter the one-time code sent to your email and click **Verify & Create Account**.",
          "You are then asked to **log in** with your new email and password (and another emailed code) before you continue your application."
        ]
      },
      {
        "label": "Already have an account",
        "items": [
          "Click the **Log In** button on the navigation bar.",
          "Enter your registered **email address** and **password**.",
          "Click **Send Verification Code**. A one-time code will be sent to your email for security.",
          "Enter the code and click **Verify & Log In** to access your account dashboard."
        ]
      }
    ],
    "note": "Make sure to use a valid and accessible email address. Check your spam/junk folder if you don&apos;t receive the code within a few minutes."
  },
  {
    "title": "Fill Out Your Profile",
    "draft": true,
    "groups": [
      {
        "label": null,
        "items": [
          "Log in and open **My Profile** from the portal menu.",
          "Fill in **Personal Information**: your name, date of birth, civil status, contact details and address.",
          "Fill in **Educational Background**: your school, strand or program, and graduation year.",
          "Fill in **Family & Financial Information**: your parents or guardian and your household details.",
          "Each section is saved as you go, so you can come back and finish later.",
          "Check every entry. The office compares your answers against your documents."
        ]
      }
    ],
    "note": "**Health & Wellness** is filled in later, during enrollment, once you pass."
  },
  {
    "title": "Upload Required Documents",
    "draft": true,
    "groups": [
      {
        "label": null,
        "items": [
          "Prepare the documents for your applicant type: First Year, Transferee, or Old Curriculum and ALS. See **Admission Requirements** below.",
          "Scan or photograph each one clearly. Accepted files are **PDF, JPG or PNG**, up to **10 MB** each.",
          "Upload each file in its labeled slot.",
          "The system reads each document and checks it. Its status shows **Processing**, then **System check passed** or **Needs review**. It becomes **Verified** once the Guidance Office confirms it.",
          "If a document needs review, upload a clearer copy with **Change**.",
          "When every section is complete, click **Submit your application**."
        ]
      }
    ],
    "note": "Fake or edited documents are not accepted. The admissions office checks every submission."
  },
  {
    "title": "Check Your Qualification",
    "draft": true,
    "groups": [
      {
        "label": null,
        "items": [
          "After you submit, your application shows **Awaiting review** while the office checks it.",
          "Follow each document on **Documents & Status**.",
          "Once your documents are complete and valid, you receive your official **application number**.",
          "Qualified applicants are placed in an exam batch. You get an email when your schedule is ready."
        ]
      }
    ],
    "note": "Schedules go by batch. The first 100 complete submissions form the first batch, and later applicants are scheduled on other days."
  },
  {
    "title": "Take the Qualifying Exam",
    "draft": true,
    "groups": [
      {
        "label": null,
        "items": [
          "Open **Exam Schedule** in the portal to see your batch, date, time and venue. The same details are emailed to you.",
          "Come to City College of Calamba on your schedule. The exam is taken **onsite**.",
          "Your **exam permit** is issued onsite, and your photo is taken to verify your identity.",
          "Can’t make it for a valid reason? Request a new schedule in **Appeals & Rescheduling**."
        ]
      }
    ],
    "note": "Missing your exam without an approved reschedule forfeits your application."
  },
  {
    "title": "Track Your Result & Take the Medical Exam",
    "draft": true,
    "groups": [
      {
        "label": null,
        "items": [
          "Results are announced on this website. Check your **Dashboard** and **Messages**.",
          "Your result shows as **Passed**, **Qualified (Probationary)**, **Waitlisted**, **Not Qualified** or **Forfeited**.",
          "If you passed, take your **medical exam**. It is required before enrollment; **Messages** tells you when and where.",
          "After the medical exam, proceed with **official enrollment** and bring your **original documents**.",
          "Once enrolled, fill in **Health & Wellness** in the portal and follow your allowance in **Scholar’s Allowance**."
        ]
      }
    ],
    "note": "You also get an email each time your application status changes."
  }
]

export const PROGRAM_DEPARTMENTS = [
  {
    "name": "Department of Business and Accounting",
    "programs": [
      "Bachelor of Science in Accounting Information System",
      "Bachelor of Science in Accountancy"
    ]
  },
  {
    "name": "Department of Teacher Education",
    "programs": [
      "Bachelor of Early Childhood Education",
      "Bachelor of Secondary Education Major in Filipino",
      "Bachelor of Secondary Education Major in English",
      "Bachelor of Elementary Education",
      "Bachelor of Secondary Education Major in Social Studies",
      "Bachelor of Secondary Education Major in Science",
      "Bachelor of Secondary Education Major in Mathematics"
    ]
  },
  {
    "name": "Department of Computing and Informatics",
    "programs": [
      "Bachelor of Science in Computer Science",
      "Bachelor of Science in Information Technology"
    ]
  },
  {
    "name": "Department of Arts and Sciences",
    "programs": [
      "Bachelor of Science in Psychology"
    ]
  }
]

export const QUALIFICATIONS = [
  "No student shall be denied admission to this College by reason of age, sex, nationality, religious belief, or political affiliation. However, all students seeking admission must be subject to the regulations for admission prescribed by the City College of Calamba–Academic Personnel Council.",
  "Academically qualified and deserving applicants must be a resident of the City of Calamba and have graduated from any public or private schools recognized by the Department of Education (DepEd) or are transferees from a tertiary institution recognized by Commission on Higher Education (CHED) with good academic and moral standing.",
  "Residents of the City of Calamba and have a Voter’s ID or COMELEC Voter’s Certificate. For non-registered voters, a parent or guardian’s voter ID will do."
]

export const REQ_TABS = [
  {
    "label": "First Year",
    "items": [
      "One (1) Photocopy of latest Grade 11 or 12 (1st or 2nd semester) Report Card/Form, if available",
      "One (1) Photocopy of PSA/NSO/Local Birth Certificate",
      "One (1) Photocopy of Applicant/Parents’/Guardian’s Voter’s Identification or Certification",
      "One (1) 3 pcs. 2x2 Picture (white background)"
    ],
    "transfereeRules": [],
    "note": null
  },
  {
    "label": "Transferee",
    "items": [
      "One (1) Photocopy of PSA/NSO/Local Birth Certificate",
      "One (1) Photocopy of Applicant/Parents’/Guardian’s Voter’s Identification or Certification",
      "One (1) 3 pcs. 2x2 Picture (white background)"
    ],
    "transfereeRules": [
      "The applicant does not have a failing grade in any semester from their previous school/s.",
      "The applicants have passed at least 26 academic units with a general weighted average of 2.25 or better for all collegiate academic units they have taken.",
      "The applicant will have to complete not less than 50% of the remaining units in his/her program at the college.",
      "The Program Director has the prerogative regarding the admission of transferees with exceptional cases, i.e., the same will be dealt with on a case-to-case basis, grades of 5.0, dropped, and INC."
    ],
    "note": null
  },
  {
    "label": "Old Curriculum & ALS",
    "items": [],
    "transfereeRules": [],
    "note": "In cases, the prospective student graduated High School on/or before 2017, where K-12 has not been implemented yet, additional requirements need to be satisfied. Specifically, Forms 137 (for evaluation copy) or 138 depending on the availability will be required for submission. For ALS completers, they will be required to undergo the senior high school curriculum."
  }
]

export const FAQ_DATA = [
  {
    "category": "Admissions",
    "subcategories": [
      {
        "name": "Application Process & Requirements",
        "items": [
          {
            "q": "Where can I find admission guidelines and schedules?",
            "a": "All official announcements such as qualifications, steps, and exam schedules are posted directly on this website. CCC-granted scholars shall receive specified announcements such as allowances."
          },
          {
            "q": "How do I start my application?",
            "a": "Applicants must fill out a step-by-step process from this website after account creation and upload scanned copies of their initial documents."
          },
          {
            "q": "Who is eligible to apply?",
            "a": "Applicants must be bonafide residents of Calamba and must have a voter’s registration (their own, or a parent’s or guardian’s). This is checked at the very start of sign-up: you upload the Voter’s ID or Voter’s Certification first, and an account is only created if it shows a Calamba address."
          },
          {
            "q": "Are there specific grade requirements?",
            "a": "There is no minimum grade requirement, but applicants must strictly have no failing grades on their academic record and must pass the entrance exam."
          },
          {
            "q": "What happens if my submitted requirements are incomplete?",
            "a": "You will only receive an official application number once your documents are identified as complete and valid."
          },
          {
            "q": "What is the penalty for using fake documents?",
            "a": "Submitting fake IDs or falsified documents is strictly prohibited and actively monitored by the admissions office."
          }
        ]
      },
      {
        "name": "Examination Details",
        "items": [
          {
            "q": "How do I get my exam permit?",
            "a": "The exam permit is issued onsite as verification that all requirements have been submitted. A photograph of the applicant will be taken onsite to verify identity."
          },
          {
            "q": "How are application and exam schedules assigned?",
            "a": "Schedules are by batch; the first 100 submissions are assigned to the first batch, and subsequent applicants are scheduled for different days."
          },
          {
            "q": "What if I miss my exam schedule?",
            "a": "Failing to attend your scheduled entrance examination will result in the forfeiture of your application. If you have a valid personal reason for missing it, rescheduling can be requested via your account in this website."
          }
        ]
      },
      {
        "name": "Results & Next Steps",
        "items": [
          {
            "q": "How are entrance exam results announced?",
            "a": "Examination results are announced via this website for applicants to review."
          },
          {
            "q": "What happens after passing the exam?",
            "a": "Passers are qualified as students of the City College and are issued a recommendation to take their medical exam, which is required before official enrollment. They become scholars once enrolled."
          }
        ]
      }
    ]
  },
  {
    "category": "Registrars",
    "subcategories": [
      {
        "name": "Document Submission",
        "items": [
          {
            "q": "Do I submit original documents or photocopies?",
            "a": "If you are a currently enrolled Senior High School student, you only need to submit photocopies during the admission phase. If you have already graduated or stopped studying, you must present original copies to avoid discrepancies. Original copies will be required for all applicants once they pass the exam and proceed to official enrollment."
          }
        ]
      }
    ]
  }
]

export const CONTACT_OFFICES = [
  {
    short: "GCTCDO",
    name: "Guidance, Counseling, Testing, and Career Dev't Office (GCTCDO)",
    hours: "Monday to Thursday and Saturday (7:00 AM to 5:00 PM)",
    days: [1, 2, 3, 4, 6],
    openHour: 7,
    closeHour: 17,
    address: "GCTCDO, 1st Floor, Admin Building, City College of Calamba",
    emails: [{ address: "gctcdo@ccc.edu.ph", note: null }],
    fb: { label: "CCC GCTCDC Official Facebook Page", href: "https://www.facebook.com/CCCGTCDC" },
  },
  {
    short: "REGISTRAR",
    name: "Office of the College Registrar",
    hours: "Monday to Thursday (7:00 AM to 6:00 PM)",
    days: [1, 2, 3, 4],
    openHour: 7,
    closeHour: 18,
    address: "Office of the College Registrar, 1st Floor, JMC Building, City College of Calamba",
    emails: [
      { address: "verify@ccc.edu.ph", note: "for student verification" },
      { address: "registrar@ccc.edu.ph", note: "main email" },
    ],
    fb: { label: "Office of the College Registrar Official Facebook Page", href: "https://www.facebook.com/profile.php?id=61551390461332" },
  },
]

// The sample applicant in the animated portal preview. Clearly sample data:
// the page labels it "Illustration of the portal with sample data."
export const STORY = {
  email: "juan.delacruz@gmail.com",
  pills: [["New account", "#E8EEFB", "#003CD0"], ["Profile in progress", "#E8EEFB", "#003CD0"], ["Uploading documents", "#E8EEFB", "#003CD0"], ["Under Review", "#FDF0DC", "#7a4f0c"], ["For Exam", "#EFE8FB", "#5B2BB5"], ["Passed", "#E6F2EA", "#1B6B3A"]],
  emails: [
    ["Verify your email", "Your Iskolusyon verification code is 482107. It expires in 10 minutes."],
    ["Profile saved", "Your personal, academic and financial information was saved. Next: upload your documents."],
    ["Documents received", "We received your 3 documents. The office will check them shortly."],
    ["Your documents are complete", "Your documents were identified as complete and valid. Your application number is 2027A-0142."],
    ["Your exam schedule is ready", "Batch 1. Check your portal for the date, time and room of your qualifying exam."],
    ["Exam results are out", "Congratulations! You passed the scholarship qualifying exam. Log in to see your next steps."],
  ],
  profile: [["Full name", "Juan Dela Cruz"], ["Barangay", "Brgy. Real, Calamba City"], ["Senior high school", "Calamba Senior High School"], ["1st choice program", "BS Information Technology"]],
  docs: ["PSA Birth Certificate", "Voter’s Certification", "Grade 12 Report Card"],
}
