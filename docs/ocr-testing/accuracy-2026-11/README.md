# OCR accuracy test (Nov 10, 2026)

Panel revisions S2: "Show accuracy metrics: target OCR accuracy, the
auto-accept vs. manual-review threshold, examples of false flags, and how
lighting, camera position and unclear images are handled."

## What was tested

- **Engine:** Tesseract 5.3.4 (English), the same engine the OCR worker uses,
  default page segmentation. The worker also straightens and rotates pages
  first, so it should do at least as well as this.
- **Rule:** the system's own Voter's ID / Certification check,
  `app/lib/documentContentCheck.js` (COMELEC wording + City of Calamba, and
  no other city or municipality named).
- **Samples (25 documents, made by `make_samples.py`, all labeled
  "SAMPLE ... NOT AN OFFICIAL RECORD"):**
  - 10 Voter's Certifications from the City of Calamba (should pass)
  - 10 Voter's Certifications from other Laguna cities (should be refused),
    including one trap: a Cabuyao voter living on "Calamba Road"
  - 5 documents that are not voter records (Calamba barangay clearances,
    should be refused)
- **11 photo conditions per document (275 images):** clean, dim, blurry,
  tilted 8 degrees, angled (perspective), low resolution, heavy JPEG
  compression with noise, side shadow, very blurry, very dark, very low
  resolution.

## Results

| | Count |
|---|---|
| Images | 275 |
| Calamba documents correctly passed | 81 of 110 |
| Calamba documents wrongly flagged (false flags) | 29 of 110 |
| Other-city / non-voter documents wrongly passed (false accepts) | **0 of 165** |
| Other-city / non-voter documents correctly refused | 165 of 165 |
| Overall agreement | 89.5% |

By condition: clean, dim, blurry, tilted, angled, low resolution, compressed
and very dark were **100% correct**. All 29 false flags came from three
bad-photo conditions: **side shadow (10/10 flagged)**, **very blurry (10/10)**
and **very low resolution (9/10)**.

Before this test the rule only looked for the word "calamba" anywhere, and
the "Calamba Road, Cabuyao" trap was wrongly accepted in 6 of 7 conditions
(7 false accepts in 275). The rule now requires "City of Calamba" /
"Calamba City" and refuses a document that names another city: **0 false
accepts**, with no extra false flags.

## What it means for the design

- The system errs on the safe side: a bad photo is **flagged**, never
  wrongly accepted. The applicant is asked to upload a clearer photo; after
  two tries the page points them to the GCTCDO office.
- OCR does not have the ~99% needed to decide on its own (a document could
  also be forged or belong to someone else), so a **staff Confirm** is still
  what makes a document Verified. OCR reduces the work: it pre-fills fields,
  catches wrong or other-city documents, and sorts the pile into "confirm
  quickly" and "look closely".
- These are generated samples, not real phone photos; real accuracy should
  be re-measured with consenting applicants' documents.

## Re-running

```
python3 docs/ocr-testing/accuracy-2026-11/make_samples.py   # writes img/ and meta.json
# OCR each image with tesseract into txt/, then:
node docs/ocr-testing/accuracy-2026-11/score.mjs
```
