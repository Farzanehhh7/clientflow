# ClientFlow — Playwright-Style E2E Test Scenarios

This specification documents the critical end-to-end user journeys verified via Vitest + React Testing Library (`src/__tests__/e2eWorkflows.test.tsx`) and ready for Playwright browser execution in CI.

---

## Scenario 1: Customer Lifecycle & Fuzzy Search at Scale
1. **Given** the user navigates to **Customers** (`فهرست مشتریان`).
2. **When** the user clicks **مشتری جدید**, enters name (`کیانا سپهری`) and normalized mobile (`09127654321`), and submits the Zod-validated modal form.
3. **Then** the dialog (`role="dialog"`) closes cleanly, the customer appears in the virtualized table, and typing `کیانا` in the debounced search bar (`aria-label="جستجوی مشتریان"`) filters to the matching record.

## Scenario 2: Accessible Modal Keyboard Navigation
1. **Given** any modal dialog (`CustomerFormModal`, `CommandPaletteModal`, `iOS Install Guide`) is opened.
2. **When** focus enters the dialog and the user presses `Escape`.
3. **Then** `onClose()` triggers immediately, the modal unmounts, and focus restores to the trigger element.

## Scenario 3: Appointment Booking Conflict & Buffer Guard
1. **Given** an existing appointment for `res1` (`10:00–11:00`) using a service with `15m` post-buffer.
2. **When** a booking attempt overlaps the service window or buffer gap (`11:10–11:40`).
3. **Then** `hasConflict` returns `true` and blocks double-booking while permitting slots on other resources (`res2`) or after `11:15`.

## Scenario 4: Diff-Safe Industry Pack Switching Without Data Loss
1. **Given** an admin has created customer `مشتری ماندگار` in the `clinic` pack.
2. **When** the admin switches the active pack to `restaurant` (`switchIndustryPack('restaurant')`).
3. **Then** pack terminology, modules, and custom fields switch cleanly while `state.customers` retains all previously saved records.

## Scenario 5: Support SLA Breach, Public Customer Portal & Offline Shell
1. **Given** a high-priority ticket exceeds business-hours `firstResponseMin`.
2. **Then** SLA status transitions `ok` → `warning` → `breached`, escalates cleanly, and remains queryable on `/portal` via tracking code + OTP.
3. **When** `navigator.onLine === false` or simulated offline mode is enabled, Workbox serves `/index.html` and displays the accessible `role="status"` offline cached shell banner.
