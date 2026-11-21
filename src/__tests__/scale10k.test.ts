import { describe, expect, it } from 'vitest';
import { LocalStorageCustomerRepository } from '../data/repositories/customerRepository';
import { createInitialState } from '../data/seed';
import { computeAllCustomerStatsMap } from '../utils/crmHelpers';
import { generateScaleDataset } from '../utils/demoGenerator';
import { fuzzyMatchPersian } from '../utils/persianSearch';
import { computeVirtualWindow } from '../utils/virtualWindow';

describe('Performance & 10,000 Customer Scale Readiness', () => {
  it('generates, indexes, searches, deduplicates, and virtual-slices 10,000 customers smoothly', () => {
    const t0 = performance.now();
    const ds = generateScaleDataset(
      10000,
      'clinic',
      ['br1', 'br2'],
      ['مریم', 'سارا'],
      ['s1'],
      ['r1'],
      [{ id: 'p1', name: 'سرم مراقبتی', price: 750_000 }],
    );
    const genMs = performance.now() - t0;
    expect(ds.customers).toHaveLength(10000);
    expect(genMs).toBeLessThan(1500);

    // 1. O(N+M) batch stats calculation on 10k customers
    const baseState = createInitialState();
    baseState.customers = ds.customers;
    baseState.orders = ds.orders;
    baseState.appointments = ds.appointments;

    const tStats0 = performance.now();
    const statsMap = computeAllCustomerStatsMap(ds.customers, baseState);
    const statsMs = performance.now() - tStats0;
    expect(statsMap.size).toBe(10000);
    expect(statsMs).toBeLessThan(500);

    // 2. Fuzzy search across 10k customers
    const tSearch0 = performance.now();
    const matched = ds.customers.filter((c) => fuzzyMatchPersian([c.name, c.phone], 'سارا احمدی'));
    const searchMs = performance.now() - tSearch0;
    expect(matched.length).toBeGreaterThan(0);
    expect(searchMs).toBeLessThan(800);

    // 3. Bucketed deduplication across 10k customers (must NOT hit O(N^2) hang)
    const tDedup0 = performance.now();
    const repo = new LocalStorageCustomerRepository(() => baseState);
    const dupes = repo.findDuplicates(ds.customers);
    const dedupMs = performance.now() - tDedup0;
    expect(Array.isArray(dupes)).toBe(true);
    expect(dedupMs).toBeLessThan(2000);

    // 4. Virtualized window renders only ~25 rows out of 10,000
    const win = computeVirtualWindow({
      totalCount: ds.customers.length,
      scrollTop: 30_000, // scrolled down 500 rows @ 60px
      viewportHeight: 540,
      itemHeight: 60,
      overscan: 6,
    });
    expect(win.startIndex).toBe(494);
    expect(win.endIndex).toBe(515);
    expect(win.endIndex - win.startIndex).toBeLessThan(30);
    expect(win.topSpacerPx).toBe(494 * 60);
    expect(win.bottomSpacerPx).toBe((10000 - 515) * 60);
  });
});
