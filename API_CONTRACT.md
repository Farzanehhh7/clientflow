# ClientFlow — REST API Contract (ASP.NET Core Migration Blueprint)

> Base URL: `/api/v1`  
> Aligned with `src/data/repositories/*` and `src/services/providers/webhookAndOpenApi.ts`.

---

## 1. Common Headers & Conventions

| Header / Param | Purpose |
|---|---|
| `Authorization: Bearer <jwt>` | Signed JWT carrying `sub`, `tenantId`, `roleId`, `branchId`, `dataScope` |
| `X-Tenant-Id` | Explicit tenant isolation check validated against JWT claim |
| `Idempotency-Key` | Required on `POST` mutations for orders, payments, and tickets |
| `If-Match` / `version` | Optimistic concurrency token (`RowVersion`) returning `409 Conflict` on mismatch |
| `?page=1&pageSize=50&q=...` | Standardized cursor/page pagination & normalized Persian search |

### Standard Error Envelope (`application/problem+json`)
```json
{
  "type": "https://api.clientflow.ir/errors/conflict",
  "title": "Concurrency conflict",
  "status": 409,
  "detail": "تضاد نسخه: رکورد توسط کاربر دیگری تغییر یافته است.",
  "traceId": "00-..."
}
```

---

## 2. Endpoints per Repository / Controller

### 2.1 IAM & Multi-Tenancy (`AuthController`, `TenantsController`, `UsersController`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Authenticate operator and return JWT + active role/branch scope |
| `GET` | `/tenants/current` | Fetch business settings, numbering formats, working hours, holidays |
| `PUT` | `/tenants/current/settings` | Update business profile, tax rate, currency, security & AI toggles |
| `GET/POST/PUT` | `/users`, `/roles`, `/teams`, `/branches` | Manage RBAC permission matrix, team assignments, and branch tree |
| `GET` | `/audit/access-logs` | PII data-access and entity audit history |

### 2.2 Customer Repository (`CustomersController`)
| Method | Path | Maps To |
|---|---|---|
| `GET` | `/customers` | `CustomerRepository.list()` + segment/lifecycle/tag/search filters |
| `GET` | `/customers/{id}` | `CustomerRepository.getById(id)` (360° profile + timeline) |
| `POST` | `/customers` | `CustomerRepository.create(dto, ctx)` |
| `PATCH` | `/customers/{id}` | `CustomerRepository.update(id, patch, ctx, expectedVersion)` |
| `DELETE` | `/customers/{id}` | `CustomerRepository.softDelete(id, ctx)` (moves to Trash) |
| `POST` | `/customers/{id}/restore` | Restore soft-deleted customer |
| `GET` | `/customers/duplicates` | `CustomerRepository.findDuplicates()` returning scored candidate pairs |
| `POST` | `/customers/merge` | Merge primary + duplicate customer & repoint FKs atomically |
| `GET/POST` | `/customers/saved-views` | `listSavedViews()` / `saveView()` |
| `GET/POST` | `/customers/segments` | `listSegments()` / dynamic segment evaluator |
| `GET/POST` | `/customers/{id}/consents` | `listConsentLogs()` / opt-in-opt-out updates |

### 2.3 Scheduling (`AppointmentsController`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/appointments?from=...&to=...&resourceId=...` | List calendar slots with holiday/time-off overlays |
| `POST` | `/appointments` | Create booking after server-side `hasConflict()` + buffer check (`409` on collision) |
| `PATCH` | `/appointments/{id}/status` | Transition `booked` -> `confirmed` -> `done` / `noshow` -> triggers NPS survey |
| `GET/POST` | `/services`, `/resources`, `/holidays`, `/waitlist` | Manage bookable catalog, staff resources, holidays, waitlist |

### 2.4 Sales & Commissions (`LeadsController`, `OpportunitiesController`, `QuotesController`)
| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/leads` | Capture inbound leads with UTM attribution, round-robin assignment, scoring |
| `POST` | `/leads/{id}/convert` | Atomically convert lead -> Customer + Opportunity |
| `GET/POST/PATCH` | `/opportunities` | Kanban stage progression, win/loss reasons, auto-creates commission ledger on `won` |
| `GET/POST` | `/quotes`, `/quotes/{id}/approve` | Manage versioned quotes + manager approval gate when discount > threshold |
| `GET/POST` | `/commissions/ledger` | View & mark stepped/flat commission payouts |

### 2.5 Orders, Invoices & Finance (`OrdersController`, `InvoicesController`, `PaymentsController`)
| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/orders` | Multi-channel order creation with stock validation & `Idempotency-Key` |
| `PATCH` | `/orders/{id}/status` | Order workflow (`new` -> `confirmed` -> `shipped` -> `delivered`) |
| `GET/POST` | `/invoices` | Issue tax invoices from orders & compute aging (`computeReceivablesAgingReport`) |
| `POST` | `/invoices/{id}/payments` | Record partial/split cash, POS, card, or Sayadi cheque allocation |
| `POST` | `/payments/gateway/initiate` & `/callback` | Sandbox / Zarinpal / IDPay redirect + verify flow |
| `GET` | `/accounting/export?preset=sepidar` | Export mapped accounting voucher CSV/XLSX |

### 2.6 Support, SLA, Knowledge Base & Public Portal (`TicketsController`, `KbController`, `PortalController`)
| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/tickets` | Omnichannel ticket queue with live business-hours SLA status |
| `POST` | `/tickets/{id}/messages` | Customer reply or internal note; sets `firstRespondedAt` |
| `POST` | `/tickets/merge` | Merge duplicate tickets cleanly |
| `GET/POST` | `/kb/articles` | Versioned articles (`public` / `internal`) + suggestion endpoint |
| `POST` | `/surveys/nps` | Record NPS / CSAT / CES survey responses |
| `POST` | `/portal/otp/request` & `/portal/lookup` | Anonymous Customer Portal lookup by phone + tracking code + OTP |

### 2.7 Automation, Workflows, Reports & Integrations (`AutomationController`, `WorkflowsController`, `ReportsController`, `WebhooksController`)
| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/automation/rules`, `/automation/rules/{id}/dry-run` | Manage visual rules + dry-run preview without side effects |
| `GET/POST` | `/workflows/definitions`, `/workflows/instances` | Publish workflow versions & advance approval/task/decision steps |
| `POST` | `/reports/run` & `/reports/export` | Execute custom BI queries (whitelisted fields, CSV/XLSX export) |
| `GET/POST` | `/voip/calls` | Log PBX inbound/outbound calls & click-to-call events |
| `POST` | `/webhooks/incoming` | Ingest external events verified via `X-ClientFlow-Signature` (HMAC-SHA256) |
| `GET` | `/openapi.json` | Export dynamic OpenAPI 3.0 contract |
| `GET/POST` | `/packs`, `/backup/export`, `/backup/import` | Install/export Industry Packs & full versioned tenant backup |
