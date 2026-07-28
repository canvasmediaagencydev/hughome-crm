/**
 * สร้าง docs/Hughome_Sales_Staff_Template.xlsx (ไฟล์ "ตัวอย่าง" สำหรับดู/ส่งให้ลูกค้าตรวจ)
 *
 *   node scripts/generate-sales-template.js --staff "S01:สมชาย ใจดี,S02:วรรณภา ช่วยชุบ"
 *
 * ⚠️ ไฟล์ที่พนักงานขายใช้จริงต้องโหลดจาก GET /api/admin/batches/template
 *    เพราะ dropdown ต้อง generate จาก sales_reps ที่ is_active=true ณ ตอนนั้น
 *    สคริปต์นี้รับรายชื่อผ่าน CLI เท่านั้น — ไม่มี default list โดยเจตนา
 *    (รายชื่อ hardcode = พนักงานที่ลาออกแล้วยังถูกคีย์ต่อได้)
 *
 * ตัว builder อยู่ที่ src/lib/excel/build-template.js — ใช้ร่วมกับ API route ไฟล์เดียวกัน
 */
const path = require('path')
const fs = require('fs')
const { buildSalesTemplate, repLabel, HEADERS, SPEC } = require('../src/lib/excel/build-template')

function parseStaffArg(argv) {
  const i = argv.indexOf('--staff')
  if (i === -1 || !argv[i + 1]) {
    throw new Error(
      'ต้องระบุรายชื่อพนักงานขาย:\n' +
        '  node scripts/generate-sales-template.js --staff "S01:สมชาย ใจดี,S02:วรรณภา ช่วยชุบ"\n' +
        'รูปแบบ: รหัส:ชื่อ คั่นด้วยคอมม่า'
    )
  }
  return argv[i + 1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf(':')
      if (sep < 1 || sep === entry.length - 1) {
        throw new Error(`รูปแบบพนักงานขายผิด: "${entry}" (ต้องเป็น รหัส:ชื่อ)`)
      }
      return { code: entry.slice(0, sep).trim(), full_name: entry.slice(sep + 1).trim() }
    })
}

async function main() {
  const reps = parseStaffArg(process.argv)
  const wb = buildSalesTemplate(reps) // validate ซ้ำ (code ซ้ำ / มีตัวคั่น) อยู่ข้างใน

  const outDir = path.join(__dirname, '..', 'docs')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'Hughome_Sales_Staff_Template.xlsx')
  await wb.xlsx.writeFile(outFile)

  console.log('written:', outFile)
  console.log('columns:', HEADERS.join(' | '))
  console.log('sales reps in dropdown:', reps.map(repLabel).join(', '))
  console.log('limits:', `${(SPEC.limits.maxFileBytes / 1024 / 1024).toFixed(0)} MB / ${SPEC.limits.maxDataRows} แถว`)
}

main().catch((err) => {
  console.error('\n' + err.message + '\n')
  process.exit(1)
})
