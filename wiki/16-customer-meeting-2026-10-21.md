# 16 — Customer meeting 2026-10-21

Seven change requests from the customer meeting on 2026-10-21. All seven are deployed to production
(commit `0bfff69`, 2026-10-21). Migration `029` was applied to `hughome-pilot` the same day via the SQL
Editor. Still open: the `THAIBULKSMS_SMS_*` variables on Vercel (step 2 below).

| # | Customer's words (summary) | What changed | Where |
|---|---|---|---|
| M1 | Phone numbers carry a dash everywhere: `xxx-xxxxxxx` | `formatThaiPhone()` is used on every admin and LIFF screen that shows a customer or Maker phone, and in the team email. Phone inputs (LIFF onboarding, Maker form) insert the dash while typing. Storage and matching are unchanged: the local 10 digits, via `normalizeThaiPhone`. The guide sheet in the sales template shows dashed examples. The parser already accepted both forms. | `src/lib/phone.ts` (`formatThaiPhone`, `formatThaiPhoneInput`), the pages listed in the M1 note below |
| M2 | Excel export has a tick option for sort order: by date or by points. The new-customer report uses date as its main order | `/admin/reports` has a radio choice for each report: date (the default) or points. Customer report: registration date oldest first, or points balance highest first. Batch report: purchase date oldest first, or points highest first. Ties keep the date order and then the file order. The chosen order is written in the notes sheet. | `build-reports.js` (`sort` is required, `REPORT_SORTS`), both report routes (`?sort=date\|points`, default `date`), `/admin/reports` |
| M3 | Customer code is not shown in the new-customer report | The `รหัสลูกค้า` column is removed from the customer export. The weekly batch report keeps it. | `CUSTOMER_COLUMNS` in `build-reports.js`, `reports/users/excel` |
| M4 | Customer codes are imported from an Excel file with the phone number as the match key | The import already existed (`/admin/customer-codes`, Q1). New: on `/admin/users` a manager can download "customers without a code" as an xlsx file (A code blank · B phone `xxx-xxxxxxx` · C name · D registration date). The manager fills in column A from the billing system, so the codes match SCG, and uploads the file through the existing import. The users page also has a "เฉพาะยังไม่มีรหัส" (no code yet) filter. | `GET /api/admin/users/missing-codes/excel` (`users.edit`), `/admin/users`, `?missing_code=1` on `GET /api/admin/users` |
| M5 | The users page searches mainly by phone | Input that holds only digits, dashes, spaces, `+` or brackets is treated as a phone search. The dashes are stripped before matching, so `081-2345678` finds the stored `0812345678`. A leading `66` becomes `0`. The same digits also match an all-digit customer code. Any other text searches name and code as before. | `GET /api/admin/users`, `SearchBar` placeholder |
| M6 | Customers are only notified when points are about to expire, and only by SMS | The `points-expiry-warning` cron now sends an **SMS through the ThaiBulkSMS SMS API** instead of a LINE push. **Timing confirmed by the customer the same day: once, 30 days before expiry.** The cron now runs daily at 09:00 Bangkok and looks 30 days ahead, so a lot is warned on the first day it enters that window, exactly 30 days before it expires. It dedupes per `(user, lot expires_at)` under the new kind `expiry_warning_sms` (migration `029`), so each lot is warned once. Lots that expire on the same day for one user go into one SMS. Lots from different batches, which expire on different days, get one SMS each. At the first run after deploy, lots that already have fewer than 30 days left are warned that day. The birthday cron was removed from `vercel.json`. The route still exists, and LINE push stays off (`NOTIFICATIONS_ENABLED=false`, Q7). | `src/lib/thaibulksms-sms.ts`, `src/app/api/cron/points-expiry-warning/route.ts`, `029_expiry_warning_sms.sql`, `env.ts`, `vercel.json` |
| M7 | Notification bell at the top right for each role: what they must go in and approve or press, with a red dot on each tab | `GET /api/admin/inbox` counts the open work that the caller's permissions let them act on. The counts are read live from the real tables, so no new table and no migration are needed, and an item disappears as soon as its status changes. The bell sits in a desktop top bar and in the mobile header. Each sidebar item shows a red count badge. The counts refresh every 60 s, on window focus and on every page change. | `src/app/api/admin/inbox/route.ts`, `src/components/admin/AdminInboxBell.tsx`, `src/app/admin/layout.tsx` |

### M1 — screens that format the phone

`/admin/users` (card and detail modal), `/admin/redemptions` (list and QR scan), `/admin/batches`
(the preview rows), `/admin/customer-codes`, `/admin/sales-reps`, `/admin/reports`, LIFF `/profile`,
the LIFF onboarding input, the team email for a redemption (`team-notify.ts`), and both Excel
reports (already done since `wiki/15` F4).

### M7 — what each permission sees

| Permission | Item | Page |
|---|---|---|
| `batches.approve` | batches in `pending_approval` | `/admin/batches` |
| `batches.upload` | batches in `previewed` (checked but not sent to the approver) | `/admin/batches` |
| `redemptions.process` | redemptions `requested` · redemptions `approved` (waiting to be prepared) | `/admin/redemptions` |
| `issues.manage` | issue reports `open` | `/admin/issues` |
| `users.edit` | onboarded customers with no `customer_code` | `/admin/users?no_code=1` |

super_admin sees every item. If one count query fails, only that item is dropped and the error is
logged; the rest of the bell still works.

## Before deploy

1. Paste `supabase/migrations/029_expiry_warning_sms.sql` into the SQL Editor of `hughome-pilot`
   (`vltzkxmblmrvsmaookhl`). Check the project name in the header first (see `wiki/15` "Deploy order").
   Rollback: `rollback/029_expiry_warning_sms.down.sql`.
2. Add `THAIBULKSMS_SMS_KEY`, `THAIBULKSMS_SMS_SECRET` and `THAIBULKSMS_SMS_SENDER` on Vercel Production.
   These are the **SMS API** key and secret, not the OTP Manager app. Without them the cron returns
   500 on the 1st of the month. It does not skip silently.
3. Deploy. The SMS cron runs every day at 09:00 Bangkok time.

If the code goes out before `029`, the SMS is sent but the `notification_log` insert fails the CHECK
(the error is logged and the cron does not fail). As a result, the same customers get the SMS again
the next day. Apply `029` first.

## Open questions for the customer (business calls, not guessed)

- **M6 sender name and SMS credit.** Which approved sender name should be used? Which account pays
  for the credit? The OTP uses the shared `OTP_SMS` sender, and own-sender approval is still open
  (`wiki/09`).
- **M6 wording.** Timing is settled (once, 30 days before). The message is
  `<ชื่อสาขา>: N แต้มของคุณจะหมดอายุ <วันที่> แลกของรางวัลใน LINE ก่อนหมดอายุ`, about 2 SMS segments.
  Does the wording need to change?
- **M2 scope.** The sort choice was added to both reports on `/admin/reports`. The download button on
  `/admin/batches` still uses date order. "รายงานลูกค้าสมัครใหม่" (the new-customer report) was read
  as the customer export. That export still lists **all** customers, while the on-screen table lists
  only customers who registered in the chosen range. Confirm whether the Excel file should also be
  limited to registrations in the range.
