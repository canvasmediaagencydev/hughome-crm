# 06 — RBAC

29 permissions, 6 roles. Seeded by migrations `012` and `018`.
Constants live in `src/types/admin.ts` as `PERMISSIONS`.

## Enforcement

```ts
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'

const admin = await requirePermission(PERMISSIONS.BATCHES_COMMIT)
// throws 'Unauthorized: ...' or 'Forbidden: ...'
```

`super_admin` bypasses the check in `admin-auth.ts` and is *also* granted every permission in the
database — belt and braces, so a direct database query gives the same answer as the app.

Every API route must catch and map:

```ts
const message = error instanceof Error ? error.message : ''
if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
if (message.startsWith('Forbidden'))    return NextResponse.json({ error: 'Forbidden' },    { status: 403 })
```

Pages use the `useAdminAuth` hook to hide what the user cannot use — but hiding a menu is not
security. The endpoint must check too.

## Permissions

```
dashboard.view
users.view / edit / manage_points / manage_notes / manage_tags
tags.view / manage
rewards.view / create / edit / delete
redemptions.view / process / deliver
batches.view / upload / commit / approve / review / void   ← approve new in migration 024 (Sprint 9R)
campaigns.view / manage        ← replaced promos.* in migration 018
salesreps.view / manage        ← new in migration 018
notifications.manage
reports.view
settings.edit
admins.manage
sales.entry                    ← reserved, no UI
```

There are no `receipts.*` permissions. That flow is deleted.

## Roles

| Role | Permissions |
|---|---|
| `super_admin` | everything |
| `manager` | `dashboard.view`, `reports.view`, `batches.view/approve/review/void`, `redemptions.*`, `users.view`, `campaigns.view`, `salesreps.view` — the **Approver** |
| `accounting` | `batches.view/upload`, `campaigns.view`, `salesreps.view/manage`, `users.view` — `batches.commit` **removed in 024**: accounting submits, the approver releases points |
| `sales_staff` | `sales.entry`, `users.view` — reserved; real salespeople have no login |
| `reward_manager` | `rewards.*`, `redemptions.view/process/deliver` |
| `customer_support` | `users.view/edit/manage_notes`, `redemptions.view` |

`accounting` deliberately **cannot** manage campaigns — see
[05 — Security & anti-fraud](05-security-and-anti-fraud.md).

`batches.commit` still exists as a key (super_admin only) but no route checks it any more —
`POST /api/admin/batches/:id/commit` requires `batches.approve`. `batches.review` (post-approval
spot-check) is unassigned to any route until Q12 is answered.

Note the name collision hazard: `sales_staff` is an `admin_roles.name` value, which is why the
salesperson table is called `sales_reps`.

## Adding an admin page

1. Add the permission in a new migration (never edit `012` or `018`)
2. Add the constant to `PERMISSIONS` in `src/types/admin.ts`
3. Add the category to `PermissionCategory` if it is new
4. Guard the API route with `requirePermission`
5. Guard the page with `useAdminAuth` and render a "no permission" card otherwise
6. Add the nav entry in `src/app/admin/layout.tsx` with a `show:` predicate
