# پرامپت برای Google AI Studio

> این مخزن یک اسکلت اولیه (React + TypeScript + Vite + Tailwind) دارد. متن زیر را در AI Studio (حالت Build) بدهید.

```text
This repository already contains a starter skeleton of "ClientFlow", a lightweight
Persian (RTL) CRM for small businesses (clinics, shops).

Read these files first:
- README.md
- src/types.ts           (data model, keep these types)
- src/data/seed.ts       (seed data, expand it)
- src/utils/jalali.ts    (Jalali date helpers)
- src/utils/overlap.ts   (overlap + Iranian mobile validation)
- docs/ClientFlow_Project_Specification.md (full requirements, for context only)

TASK (MVP, frontend only, mock data in memory + localStorage):
Build these pages using the existing sidebar layout in src/App.tsx, split into
src/pages/*.tsx and add a simple store (React context or zustand-like hook):

1. Dashboard: cards (customers, today's appointments, no-show rate, overdue orders)
   + two Recharts charts (appointments per week, orders by status).
2. Customers: searchable table, add/edit modal, tags, detail page with timeline
   (interactions, appointments, orders, tickets).
3. Appointments: weekly Jalali calendar. Create appointment (customer, service,
   resource, time). Use hasConflict() to block overlapping appointments for the same
   resource, with a clear Persian error. Statuses: booked, confirmed, done, noshow, cancelled.
4. Orders: list + create; status flow new -> confirmed -> shipped -> delivered
   (or cancelled); keep OrderStatusLog history; highlight orders past promisedAt.
5. Tasks: "today" and "overdue" lists; mark done.
6. Tickets: simple tickets with priority and status.
7. Automation: list rules with active toggle. Implement a small rule runner that
   runs on a timer and writes simulated SMS to an Outbox page
   (e.g. 24h before a confirmed appointment; order not updated for 48h -> create task).
8. Settings: business name, working hours, role switch (Admin/Staff).
   Staff cannot see Automation and Settings or delete customers.

REQUIREMENTS
- Persian UI, RTL, Vazirmatn font, Jalali dates, Persian digits (use utils/jalali.ts).
- Validate Iranian mobile numbers with isValidIranMobile().
- Expand the seed data: 30 customers, 5 services, 3 resources, 40 appointments,
  25 orders, 10 tickets. All fictional.
- Keep code simple, typed, and organised (components, pages, hooks, store, utils).
- Do not add a backend. Do not use real SMS or external APIs.
- At the end, list the files you created or changed.
```

## پرامپت‌های بعدی
1. `Add import/export of customers from CSV with column mapping and an error report.`
2. `Add NPS survey after a completed appointment or delivered order, with a report page.`
3. `Add a "clinic" industry pack: patient file fields, consent checkbox, follow-up visit rule.`
4. `Add a "shop" industry pack: products, coupon codes, abandoned-order follow-up rule.`
5. `Export the whole app state as JSON (for a future ASP.NET Core + SQL Server backend).`
