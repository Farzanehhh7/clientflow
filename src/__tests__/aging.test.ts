import { describe, expect, it } from 'vitest';
import { computeReceivablesAgingReport } from '../utils/crmHelpers';

describe('Invoices Receivables Aging Report', () => {
  it('classifies open invoice balances into 0-30, 31-60, 61-90, and >90 day buckets', () => {
    const nowMs = Date.parse('2026-06-01T12:00:00.000Z');
    const dayMs = 24 * 3600_000;

    const invoices = [
      // Fully paid -> excluded
      { grandTotal: 5_000_000, paidAmount: 5_000_000, dueAt: new Date(nowMs - 45 * dayMs).toISOString(), isDeleted: false },
      // Soft deleted -> excluded
      { grandTotal: 9_000_000, paidAmount: 0, dueAt: new Date(nowMs - 100 * dayMs).toISOString(), isDeleted: true },
      // Future due date (not yet due) -> 0..30 current bucket (1,000,000 open)
      { grandTotal: 2_000_000, paidAmount: 1_000_000, dueAt: new Date(nowMs + 5 * dayMs).toISOString(), isDeleted: false },
      // 15 days past due -> 0..30 bucket (3,000,000 open)
      { grandTotal: 3_000_000, paidAmount: 0, dueAt: new Date(nowMs - 15 * dayMs).toISOString(), isDeleted: false },
      // 45 days past due -> 31..60 bucket (4,000,000 open)
      { grandTotal: 4_000_000, paidAmount: 0, dueAt: new Date(nowMs - 45 * dayMs).toISOString(), isDeleted: false },
      // 75 days past due -> 61..90 bucket (2,500,000 open)
      { grandTotal: 2_500_000, paidAmount: 0, dueAt: new Date(nowMs - 75 * dayMs).toISOString(), isDeleted: false },
      // 120 days past due -> 90+ bucket (6,000,000 open)
      { grandTotal: 6_000_000, paidAmount: 0, dueAt: new Date(nowMs - 120 * dayMs).toISOString(), isDeleted: false },
    ];

    const report = computeReceivablesAgingReport(invoices, nowMs);
    expect(report.totalOpen).toBe(16_500_000);
    expect(report.overdueInvoicesCount).toBe(4);

    const b0 = report.buckets.find((b) => b.key === '0_30');
    const b31 = report.buckets.find((b) => b.key === '31_60');
    const b61 = report.buckets.find((b) => b.key === '61_90');
    const b90 = report.buckets.find((b) => b.key === 'over_90');

    expect(b0?.amount).toBe(4_000_000);
    expect(b0?.count).toBe(2);
    expect(b31?.amount).toBe(4_000_000);
    expect(b61?.amount).toBe(2_500_000);
    expect(b90?.amount).toBe(6_000_000);
  });
});
