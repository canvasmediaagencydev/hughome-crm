# 15 — Customer feedback 2026-10-18

Four change requests the customer sent as one screenshot (2026-10-18). **All four are built and
deployed** (`5b017c5`), and migration `027` was applied on 2026-10-18 (`e2e-batch-flow.js` 35/35).

| # | Customer's words | What changed | Where |
|---|---|---|---|
| F1 | รหัสลูกค้าตรงนี้ขอไม่เป็นแบบไม่ล็อก (screenshot: `LP80ลก-024` rejected with "รูปแบบรหัสไม่ถูกต้อง") | The customer-code format is no longer locked. Any text up to 64 characters is accepted; only blank values and control characters are refused. Applies to the admin edit box and the code import. | `src/lib/customer-code.ts` |
| F2 | ตรง template ไม่ใส่เลขที่บิลค่ะ คอลัมน์ C | Template **v3**: the `เลขที่บิล` column is removed, so the sheet has 8 columns and every column after B moves one letter left. The parser no longer reads or checks bill numbers. The approval RPC no longer requires them (`027`). | `sales-columns.json` v3, `parse-sales-batch.ts`, `build-template.js`, upload route, `027_bill_no_optional.sql` |
| F3 | ตรงรายงานขอเรียกวันที่จาก ก่อน ไป หลัง | The weekly batch report is sorted by purchase date, oldest first. Rows with the same date keep their order from the file. The customer export was already sorted by registration date, oldest first. | `build-reports.js` `buildBatchReport` |
| F4 | ในรายงาน เบอร์โทรขอใส่เป็น xxx-xxxxxxx | Both Excel reports now show phone numbers as `081-2345678`. Any value that is not 10 digits is printed as bare digits. This reverses the earlier "10 digits, no dash, for vlookup" rule. | `build-reports.js` `reportPhone` |

## F2 — what the project owner accepted (2026-10-18)

The owner picked "remove column C" over "keep it optional", knowing that:

- **No duplicate-bill protection for new rows.** If the same purchase is keyed again in a later week,
  it earns points again. Inside one file, the parser still flags rows with the same phone, date and net
  amount (`duplicate_amount`, a warning only).
- **The batch report has no bill number** to match against the paper bill. A purchase can still be
  traced by purchase date, Maker, phone and amount.
- **v2 sheets are rejected** by the header check (`คอลัมน์ C: ต้องเป็น "เบอร์โทรลูกค้า"`), so a v2
  sheet fails with an error instead of being read with its columns shifted. Re-issue the v3 template
  from `/admin/batches` to every Maker.

Kept on purpose: the `bill_no` column, `pbl_bill_no_len` and `pbl_bill_no_active_idx`. Legacy
ledger rows keep their bill numbers, and they still block each other from being reused.

## Deploy order

> What actually happened on 2026-10-18: the code went out first, and the first run of `027` landed
> in the wrong Supabase project. Approvals failed with the old `missing purchase_date/bill_no/sales_rep_id`
> error (each batch rolled back, no points moved) until `027` was re-run on `vltzkxmblmrvsmaookhl`.
> Before pasting a migration, check the project name in the SQL Editor header (`hughome-pilot`).

1. Paste `supabase/migrations/027_bill_no_optional.sql` into the SQL Editor (pilot `vltzkxmblmrvsmaookhl`).
2. Deploy the code.
3. Download a fresh template and send it to the Makers.

If the code goes out before `027`, approving a v3 batch fails with
`missing purchase_date/bill_no/sales_rep_id`. The whole batch is rolled back, no points are awarded,
and nothing is half-done. Rollback file: `supabase/migrations/rollback/027_bill_no_optional.down.sql`.
It cannot run while any batch ledger row has a null `bill_no`.
