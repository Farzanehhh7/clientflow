# ClientFlow — Changelog

All notable phases and engineering milestones of ClientFlow CRM.

---

## [1.14.0] — Phase 14: Quality, Scale Performance, Accessibility, PWA & Backend Readiness
### Added
- **Automated Testing Suite (Vitest + Testing Library)**:
  - Unit tests for appointment overlap & buffer detection (`overlap.test.ts`), automation rule engine (`ruleEngine.test.ts`), business-hours SLA calculations (`sla.test.ts`), progressive/flat commission math (`commission.test.ts`), receivables aging buckets (`aging.test.ts`), customer deduplication scoring (`dedup.test.ts`), Jalali calendar & date presets (`jalali.test.ts`), and Iranian mobile/National ID/postal/custom-field validators (`validators.test.ts`).
  - 10,000-customer scale benchmark (`scale10k.test.ts`) verifying sub-second generation, `O(N+M)` stats aggregation, fuzzy search, bucketed deduplication, and virtual window slicing.
  - Component/E2E workflow tests (`e2eWorkflows.test.tsx`) + Playwright scenario blueprint (`docs/E2E_SCENARIOS.md`).
- **GitHub Actions CI**: Added `.github/workflows/ci.yml` running `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
- **Architecture & Backend Docs**: Added `ARCHITECTURE.md`, `DATA_MODEL.md`, `API_CONTRACT.md`, and `CHANGELOG.md`.

### Changed / Optimized
- **10k Performance & Virtualization**: Added `useDebouncedValue`, `computeVirtualWindow` virtualized table rendering in `CustomersPage` with `React.memo` rows, `O(N+M)` batch stats calculation (`computeAllCustomerStatsMap`), and prefix/suffix bucketed deduplication (`customerRepository.ts`).
- **Route Code Splitting**: Converted secondary routes in `App.tsx` to `React.lazy` + `<Suspense>` and configured Vite `manualChunks`.
- **Accessibility & Mobile Responsive Pass**: Enhanced `Modal` focus capture/restoration, `aria-current="page"` nav links, skip-to-content link, Escape key support for mobile drawer, and explicit `aria-label` attributes on table row actions.
- **PWA Offline Shell**: Added Workbox `navigateFallback: '/index.html'` + accessible offline read-only shell notice in `usePWA.tsx` and `App.tsx`.

---

## [1.13.0] — Phase 13: Extended Industry Packs & Pack Manager
- Added 10 full Industry Pack configs (Restaurant, Car Service, Law/Accounting, Travel Agency, Pharmacy, Wholesale, Real Estate, Gym, School, Hotel), each shipping terminology, modules, custom fields, pipeline/order flows, KPIs, 3 automation rules, 1 workflow, 3 templates, 3 starter reports, and realistic Persian seed data.
- Added **Pack Manager** (`PackManagerPage`) with live preview, diff-safe install, and "Export Current Setup as New Pack".

## [1.12.0] — Phase 12: AI Assistant & Guardrails
- Integrated `@google/genai` reading `VITE_GEMINI_API_KEY` with graceful Persian rule-based fallbacks.
- Added docked tenant-aware AI assistant with RBAC retrieval, record deep links, timeline summarization, ticket triage/reply draft, lead scoring, whitelisted NL-to-filter, SMS/content drafting, PII redaction, AI Usage audit log, and 10-question Persian evaluation suite.

## [1.11.0] — Phase 11: Administration, Multi-Tenancy & Security UX
- Added Users/Roles permission matrix, Teams, hierarchical Branches & `own`/`team`/`branch`/`all` scoping, business settings, diff-aware Industry Pack switching, versioned JSON backup/restore migrations, 10–10k demo scale generator, localStorage multi-tenant switcher, session lock screen, PII masking, data-access log, and Soft Delete + Trash/Restore.

## [1.10.0] — Phase 10: Simulated Integrations & OpenAPI
- Added Telephony/VoIP call log, click-to-call, incoming-call popup; SMS & Chat adapter outbox with retries; Sandbox Payment Gateway redirect/callback/verify; Iranian accounting software mapping & export (Sepidar/Holoo/Rahkaran/Mahak); HMAC webhooks + incoming simulator + OpenAPI 3.0 contract generator + WordPress/embed guide.

## [1.9.0] — Phase 9: Reporting, Custom Dashboards & Jalali BI
- Added Recharts analytics (revenue trends, sales funnel, cohort retention, breakdowns, aging, SLA/NPS trend, no-show), role-based customizable dashboards, no-code Report Builder (CSV/XLSX/Print), KPI targets vs actual, and Jalali date range picker with Shamsi presets.

## [1.8.0] — Phase 8: Marketing, Loyalty & Content Calendar
- Added A/B multi-channel campaigns with ROI tracking, UTM attribution & embeddable landing form builder, Loyalty Club (points, Bronze/Silver/Gold/VIP tiers, rewards, occasion codes, referrals), Content Calendar, and consent-tagged Media Asset Library.

## [1.7.0] — Phase 7: Automation & BPMS Workflow Engine
- Added visual Rule Builder (triggers, AND/OR/NOT + relative-time conditions, multi-actions), dry-run simulation, cooldown/dedup/quiet-hours/opt-out enforcement, Jalali template variables, Workflow Designer (stages, approvals, decisions, waits, bottleneck report), and safe background scheduler with Automation Health monitor.

## [1.6.0] — Phase 6: Support, SLA Engine, Knowledge Base & Customer Portal
- Added omnichannel Ticketing with internal notes, canned responses & duplicate merge; business-hours-aware SLA engine with live countdowns/warnings/escalation; versioned KB with article suggestion while replying; NPS/CSAT/CES post-event surveys; and public `/portal` lookup route.

## [1.1.0–1.5.0] — Phases 1–5: Foundation, Customer 360, Booking, Sales Pipeline & Commerce
- Built RTL Jalali UI, modular Repository architecture, Customer 360° & dedup merge wizard, No-Code Custom Fields & Entities, resource/buffer-aware Appointments calendar, Sales Pipeline/Quotes/Stepped Commissions, Multi-channel Orders, Invoices, Partial Payments & Sayadi Cheques.
