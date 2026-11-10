import fs from 'fs'
import { checkDocumentContent } from '../../../app/lib/documentContentCheck.js'
const meta = JSON.parse(fs.readFileSync('meta.json','utf8'))
const rows = []
for (const m of meta) {
  const text = fs.existsSync(`txt/${m.file.replace('.jpg','')}.txt`) ? fs.readFileSync(`txt/${m.file.replace('.jpg','')}.txt`,'utf8') : ''
  const r = checkDocumentContent({ documentType: 'voterid', extractedText: text, applicantName: '' })
  const outcome = m.expected_pass ? (r.passed ? 'correct_accept' : 'false_flag') : (r.passed ? 'false_accept' : 'correct_reject')
  rows.push({ ...m, passed: r.passed, reason: r.reason || '', outcome, chars: text.replace(/\s+/g,' ').trim().length })
}
fs.writeFileSync('results.json', JSON.stringify(rows, null, 1))
const by = (key) => { const g = {}; for (const r of rows) { (g[r[key]] ||= []).push(r) } return g }
const summ = (list) => { const c = { correct_accept:0, false_flag:0, false_accept:0, correct_reject:0 }; for (const r of list) c[r.outcome]++; const n=list.length; return { n, ...c, accuracy: ((c.correct_accept+c.correct_reject)/n*100).toFixed(1) } }
console.log('OVERALL', summ(rows))
for (const [k, list] of Object.entries(by('condition'))) console.log(k.padEnd(11), JSON.stringify(summ(list)))
for (const [k, list] of Object.entries(by('kind'))) console.log(k.padEnd(17), JSON.stringify(summ(list)))
console.log('FALSE ACCEPTS:', rows.filter(r=>r.outcome==='false_accept').map(r=>r.file).join(', '))
console.log('FALSE FLAGS:', rows.filter(r=>r.outcome==='false_flag').map(r=>`${r.file} (${r.reason})`).join('\n  '))
