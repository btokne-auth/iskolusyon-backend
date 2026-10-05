// Oct 5 2026: builds the CHED Form 3 PDF in the browser from rows that come
// from the server (app/lib/chedForm3.js). Used by the Dashboard's Export
// CHED Form 3 window (staff) and the LGU's Released reports page.
//
// Layout follows CCC's own Form 3 (manuscript Appendix K) and Ivy's Patch 5
// export: "Form 3" box, Republic of the Philippines / City College of Calamba
// header, Free Higher Education Billing Details, reference number and date,
// the admission-fees banner, then the table. Landscape A4. No seals, logos,
// signatures or other official marks are added (CCC signs the printed copy).
// The libraries are loaded only when someone downloads, so they don't slow
// down the admin pages.

const HEADERS = [
  'Sequence\nNumber',
  'Last Name',
  'Given Name',
  'Middle Name',
  'Sex at\nBirth\n(M/F)',
  'Birthdate\n(mm/dd/\nyyyy)',
  'Degree Program',
  'Year Level',
  'Email Address',
  'Phone Number',
  'Entrance/\nAdmission\nFees*',
  'Remarks\n(Passed or Failed)',
]

function longDate(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return String(ymd || '')
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function safeFilePart(text) {
  return String(text || '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'report'
}

export async function downloadForm3Pdf({ rows, referenceNumber, formDate }) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableModule.autoTable || autoTableModule.default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 8

  const drawHeader = () => {
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.rect(pageWidth - margin - 32, 4, 32, 7)
    doc.setFont('times', 'normal')
    doc.setFontSize(12)
    doc.text('Form 3', pageWidth - margin - 16, 8.7, { align: 'center' })

    doc.setFontSize(9)
    doc.text('Republic of the Philippines', pageWidth / 2, 11, { align: 'center' })
    doc.setFont('times', 'bolditalic')
    doc.setFontSize(14)
    doc.text('CITY COLLEGE OF CALAMBA', pageWidth / 2, 18, { align: 'center' })
    doc.setFont('times', 'italic')
    doc.setFontSize(9)
    doc.text('Old Municipal Site Brgy VII Poblacion Calamba City', pageWidth / 2, 23, { align: 'center' })
    doc.setFont('times', 'bold')
    doc.setFontSize(14)
    doc.text('FREE HIGHER EDUCATION BILLING DETAILS', pageWidth / 2, 31, { align: 'center' })

    const valueX = 205
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    doc.text('Free HE Billing Details Reference Number:', valueX, 40, { align: 'right' })
    doc.text(String(referenceNumber || ''), valueX + 2, 40)
    doc.text('Date:', valueX, 45, { align: 'right' })
    doc.text(longDate(formDate), valueX + 2, 45)
    doc.setLineWidth(0.4)
    doc.line(valueX + 2, 41, pageWidth - margin, 41)
    doc.line(valueX + 2, 46, pageWidth - margin, 46)

    doc.setLineWidth(0.5)
    doc.rect(margin, 50, pageWidth - margin * 2, 7)
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    doc.text('ADMISSION FEES (Based on Section 7, Rule II of the IRR of RA 10931)', margin + 2, 54.7)
  }

  autoTable(doc, {
    head: [HEADERS],
    body: rows.map((r) => [
      r.seq,
      r.lastName,
      r.givenName,
      r.middleName,
      r.sex,
      r.birthdate,
      r.program,
      r.yearLevel,
      r.email,
      r.phone,
      r.fee,
      r.remarks,
    ]),
    startY: 57,
    margin: { top: 12, left: margin, right: margin, bottom: 16 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 1.2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0], valign: 'middle' },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', font: 'times', fontSize: 7.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { cellWidth: 24 },
      2: { cellWidth: 24 },
      3: { cellWidth: 20 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 17 },
      6: { cellWidth: 54 },
      7: { halign: 'center', cellWidth: 13 },
      8: { cellWidth: 37 },
      9: { cellWidth: 21 },
      10: { halign: 'center', cellWidth: 15 },
      11: { halign: 'center' },
    },
    didDrawPage: (data) => {
      if (data.pageNumber === 1) drawHeader()
    },
  })

  // Footer on every page: the fee note, page number, and where it came from.
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('times', 'italic')
    doc.setFontSize(8)
    doc.text('* PHP 200.00 per applicant (Section 7, Rule II of the IRR of RA 10931).', margin, pageHeight - 8)
    doc.setFont('times', 'normal')
    doc.text(`${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.text('Generated from the Iskolusyon Scholarship System', pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  doc.save(`CHED-Form-3_${safeFilePart(referenceNumber)}_${safeFilePart(formDate)}.pdf`)
}
