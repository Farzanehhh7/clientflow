# ClientFlow — System Architecture

> Modular, Multi-Tenant Persian RTL CRM & Operations Platform built for Solo Practitioners through Multi-Branch Enterprises, engineered with Repository & Provider Abstraction for zero-rewrite migration to ASP.NET Core + SQL Server.

---

## 1. Architectural Principles

1. **Configuration-Over-Branching (Industry Packs)**:
   - Business verticals (`clinic`, `salon`, `shop`, `service`, `b2b`, `restaurant`, `car_service`, `law_accounting`, `travel_agency`, `pharmacy`, `wholesale`, `realestate`, `gym`, `school`, `hotel`) are declarative `PackTemplate` configurations (`src/data/packs.ts`, `packsExtendedA.ts`, `packsExtendedB.ts`).
   - Installing or switching a pack updates terminology, enabled modules, custom fields, pipeline/order flows, KPI goals, automation rules, workflows, templates, and starter reports **without data loss** and with pre-install diff preview (`src/utils/packDiff.ts`).
2. **Repository & Adapter Pattern (Backend-Readiness)**:
   - UI pages and hooks communicate with clean interfaces (`src/data/repositories/types.ts`, `src/data/repositories/customerRepository.ts`) rather than coupling directly to storage implementation.
   - Multi-tenant keys (`tenantId`), optimistic concurrency (`version`), actor metadata (`createdBy`, `updatedAt`), soft deletion (`isDeleted`, `deletedAt`), and idempotency keys (`recentIdempotencyKeys`) mirror ASP.NET Core / SQL Server schemas (`docs/ClientFlow_Database_Design.md`).
3. **External Service Adapters**:
   - **Telephony/VoIP** (`src/services/providers/telephonyAdapter.ts`): `ITelephonyProvider`
   - **Messaging** (`src/services/providers/messagingAdapters.ts`): `ISmsProvider`, `IChatProvider`
   - **Payment Gateway** (`src/services/providers/paymentGatewayAdapter.ts`): `IPaymentGatewayProvider`
   - **Webhooks & Accounting Export** (`src/services/providers/webhookAndOpenApi.ts`): HMAC-SHA256 signing & Sepidar/Holoo/Rahkaran/Mahak mapping
4. **AI Assistant with Guardrails** (`src/services/aiService.ts`, `src/utils/aiGuardrails.ts`, `src/utils/aiRetrieval.ts`):
   - Reads `import.meta.env.VITE_GEMINI_API_KEY` cleanly with deterministic rule-based Persian fallbacks when unavailable.
   - PII redaction (mobiles, national IDs, emails, cards) prior to LLM dispatch, RBAC-scoped retrieval over tenant state, prompt-injection framing, AI usage telemetry, and settings kill switch.

---

## 2. Frontend Layer Map

```
src/
├── App.tsx                     # AppShell, lazy route Suspense, RBAC nav, Solo/Enterprise switch, lock screen
├── main.tsx                    # React mount + VitePWA service worker registration
├── types.ts                    # Complete TypeScript domain schema (AppState & 60+ entities)
├── store/
│   └── useClientFlowStore.tsx  # Centralized multi-tenant state, LocalStorage persistence, background automation ticker
├── data/
│   ├── packs.ts                # Core industry packs + registry + buildPackFromState export
│   ├── packsExtendedA.ts       # Restaurant, Car Service, Law/Accounting, Travel, Pharmacy packs
│   ├── packsExtendedB.ts       # Wholesale, Real Estate, Gym, School, Hotel packs
│   ├── dashboardCatalog.ts     # Persona dashboards (Admin/Manager/Sales/Support/Receptionist)
│   ├── seed.ts                 # Multi-pack initial data generator
│   └── repositories/           # Repository interfaces & LocalStorage implementations
├── services/
│   ├── aiService.ts            # Gemini SDK + Persian fallback engine + NL-to-filter whitelist
│   └── providers/              # Telephony, SMS, Chat, Payment Gateway, OpenAPI/Webhooks
├── hooks/
│   ├── useCustomerCore.ts      # Customer filtering, O(N+M) stats batching, dedup, CSV/XLSX export
│   └── useDebounce.ts          # Reusable input debounce hook
├── utils/
│   ├── overlap.ts              # Appointment range overlap, service buffer expansion, holiday/time-off checks
│   ├── slaEngine.ts            # Business-hours SLA countdown & KB suggestion scoring
│   ├── automationEngine.ts     # AND/OR/NOT conditions, relative times, quiet hours, cooldown, dry-run
│   ├── crmHelpers.ts           # Stats, segmentation, stepped commissions, quote financials, aging report
│   ├── jalali.ts               # Shamsi calendar math, range presets, Toman formatting
│   ├── validators.ts           # Iranian mobile, National ID Mod-11, postal code, Zod schemas
│   ├── security.ts             # RBAC matrix, branch/team/own scoping, PII masking, password policy
│   ├── backupMigration.ts      # Versioned JSON tenant export/import with migrations
│   ├── demoGenerator.ts        # Scale dataset generator (10 / 100 / 1,000 / 10,000 customers)
│   ├── virtualWindow.ts        # Fixed-height window slicing for 10k+ row tables
│   └── usePWA.tsx              # Install prompt, iOS instructions, offline read-only shell indicator
├── pages/                      # Lazy-loaded route pages + public /portal route
└── components/                 # Accessible modals, virtualized tables, charts, report builder, AI chat
```

---

## 3. Performance & Offline PWA Strategy

- **Code Splitting & Lazy Routes**: All secondary route pages are loaded via `React.lazy` + `<Suspense>` inside `App.tsx`. Vendor libraries (`recharts`, `xlsx`, `@google/genai`, `react/react-dom`, `dayjs/lucide/zod`) are split via `vite.config.ts` `manualChunks`.
- **10,000-Customer Scale Readiness**:
  - `CustomersPage` virtualizes rows using `computeVirtualWindow` and `React.memo` row components so only ~20 visible rows mount in the DOM.
  - Search queries are debounced via `useDebouncedValue`.
  - `computeAllCustomerStatsMap` aggregates orders/appointments/surveys/interactions in `O(N + M)` instead of `O(N * M)`.
  - `findDuplicates` uses 3-character Persian prefix/suffix bucketing to detect duplicates in sub-second time at 10,000 customers.
- **PWA Offline Read-Only Shell**:
  - `vite-plugin-pwa` (Workbox `generateSW`) precaches HTML/JS/CSS/fonts/icons with `navigateFallback: '/index.html'`, keeping cached UI + LocalStorage data inspectable when offline alongside an `OfflineIndicator` banner.

---

## 4. Target Backend Migration Architecture (ASP.NET Core)

- **API Layer**: ASP.NET Core 8/9 Controllers implementing `API_CONTRACT.md` endpoints (`Authorization: Bearer` JWT, `X-Tenant-Id` claim validation, `Idempotency-Key`, `ETag`/`RowVersion`).
- **Domain & Persistence**: EF Core 8/9 backed by SQL Server 2022+ schemas (`iam`, `crm`, `book`, `sales`, `ops`, `supp`, `auto`, `mkt`, `bi`) with Row-Level Security on `TenantId` and Outbox pattern for guaranteed SMS/webhook delivery.
