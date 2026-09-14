/**
 * ตรวจว่า cron ทุกตัว (และ /api/admin/quota) ปฏิเสธ request ที่ไม่มี/ผิด CRON_SECRET
 *
 *   node scripts/verify-cron-auth.js http://localhost:3000
 *   node scripts/verify-cron-auth.js https://pilot-phase1.vercel.app
 *
 * ไม่แตะ DB · ไม่ยิงด้วย secret จริง (จะ trigger push จริง) — ตรวจแค่ 401
 */
const base = process.argv[2]
if (!base) {
  console.error('ระบุ base URL: node scripts/verify-cron-auth.js http://localhost:3000')
  process.exit(2)
}

const CRONS = [
  '/api/cron/expire-points-monthly',
  '/api/cron/points-expiry-warning',
  '/api/cron/birthday-greetings',
  '/api/cron/reconcile-balances',
]
const REMOVED = ['/api/cron/expire-points', '/api/cron/points-expiry-reminder']

let pass = 0
const failures = []
const check = (label, cond, detail) => {
  if (cond) {
    pass++
    console.log('  ✅ ' + label)
  } else {
    failures.push(label + (detail ? ` — ${detail}` : ''))
    console.log('  ❌ ' + label + (detail ? ` — ${detail}` : ''))
  }
}

async function status(path, headers) {
  const r = await fetch(base + path, { headers, redirect: 'manual' })
  return r.status
}

;(async () => {
  console.log(`ตรวจ ${base}\n`)
  for (const p of CRONS) {
    const none = await status(p)
    check(`${p} ไม่มี header → 401`, none === 401, String(none))
    const wrong = await status(p, { authorization: 'Bearer definitely-not-the-secret' })
    check(`${p} secret ผิด → 401`, wrong === 401, String(wrong))
    const bearerless = await status(p, { authorization: 'not-a-bearer' })
    check(`${p} รูปแบบผิด → 401`, bearerless === 401, String(bearerless))
  }
  for (const p of REMOVED) {
    const s = await status(p)
    check(`${p} (cron เก่า) ถูกถอดแล้ว → 404`, s === 404, String(s))
  }
  const q = await status('/api/admin/quota')
  check('/api/admin/quota ไม่มี token → 401', q === 401, String(q))

  console.log(`\n${pass} ผ่าน · ${failures.length} ตก`)
  process.exit(failures.length ? 1 : 0)
})().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
