import { describe, expect, it } from 'vitest';
import type { CommissionRuleConfig, CommissionTier } from '../types';
import { computeCommissionAmount, computeSteppedCommission } from '../utils/crmHelpers';

describe('Commission Calculation', () => {
  const tiers: CommissionTier[] = [
    { id: 't1', upToAmount: 10_000_000, ratePct: 5 },
    { id: 't2', upToAmount: 30_000_000, ratePct: 8 },
    { id: 't3', upToAmount: null, ratePct: 12 },
  ];

  it('computes progressive stepped commission accurately across tiers', () => {
    // 50,000,000 split into:
    // 0..10M @ 5% = 500,000
    // 10M..30M (20M) @ 8% = 1,600,000
    // 30M..50M (20M) @ 12% = 2,400,000
    // Total = 4,500,000
    const res = computeSteppedCommission(50_000_000, tiers);
    expect(res.total).toBe(4_500_000);
    expect(res.breakdown).toHaveLength(3);
    expect(res.breakdown[0].commission).toBe(500_000);
    expect(res.breakdown[1].commission).toBe(1_600_000);
    expect(res.breakdown[2].commission).toBe(2_400_000);
  });

  it('returns zero commission for zero or negative won amount', () => {
    expect(computeSteppedCommission(0, tiers).total).toBe(0);
    expect(computeSteppedCommission(-5000, tiers).total).toBe(0);
  });

  it('supports flat percentage mode and stepped mode via computeCommissionAmount', () => {
    const flatRule: CommissionRuleConfig = {
      mode: 'percentage',
      flatRatePct: 7.5,
      autoCreateLedgerOnWon: true,
    };
    const flat = computeCommissionAmount(20_000_000, tiers, flatRule);
    expect(flat.total).toBe(1_500_000);
    expect(flat.breakdown).toHaveLength(1);

    const steppedRule: CommissionRuleConfig = {
      mode: 'tiered',
      flatRatePct: 0,
      autoCreateLedgerOnWon: true,
    };
    const stepped = computeCommissionAmount(20_000_000, tiers, steppedRule);
    // 10M * 5% (500k) + 10M * 8% (800k) = 1,300,000
    expect(stepped.total).toBe(1_300_000);
  });
});
