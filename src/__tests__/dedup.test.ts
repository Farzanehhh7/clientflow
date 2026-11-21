import { describe, expect, it } from 'vitest';
import { LocalStorageCustomerRepository } from '../data/repositories/customerRepository';
import { createInitialState } from '../data/seed';
import type { Customer } from '../types';
import { makeSampleNationalId } from '../utils/validators';

describe('Customer Deduplication & Similarity Scoring', () => {
  it('detects phone (100), nationalId (95), and fuzzy Persian name (70-88) duplicates while ignoring deleted', () => {
    const state = createInitialState();
    const repo = new LocalStorageCustomerRepository(() => state);
    const nid = makeSampleNationalId(123456);

    const customers: Customer[] = [
      {
        id: 'c1',
        name: 'سارا محمدی',
        phone: '+989121112233',
        nationalId: nid,
        tags: [],
        createdAt: '2026-05-01T10:00:00Z',
      },
      {
        id: 'c2',
        name: 'سرکار خانم سارا',
        phone: '۰۹۱۲۱۱۱۲۲۳۳', // Same normalized mobile
        tags: [],
        createdAt: '2026-05-02T10:00:00Z',
      },
      {
        id: 'c3',
        name: 'مشتری دیگر',
        phone: '09129998877',
        nationalId: nid, // Same national ID
        tags: [],
        createdAt: '2026-05-03T10:00:00Z',
      },
      {
        id: 'c4',
        name: 'امیرحسین رضایی',
        phone: '09123334455',
        tags: [],
        createdAt: '2026-05-04T10:00:00Z',
      },
      {
        id: 'c5',
        name: 'امیرحسین رضائی', // Arabic yeh / minor variant -> normalized exact or Levenshtein <= 2
        phone: '09124445566',
        tags: [],
        createdAt: '2026-05-05T10:00:00Z',
      },
      {
        id: 'c_del',
        name: 'امیرحسین رضایی',
        phone: '+989121112233',
        isDeleted: true,
        tags: [],
        createdAt: '2026-05-06T10:00:00Z',
      },
    ];

    const dupes = repo.findDuplicates(customers);

    const phonePair = dupes.find(
      (d) => [d.a.id, d.b.id].sort().join(':') === 'c1:c2',
    );
    expect(phonePair?.score).toBe(100);
    expect(phonePair?.reason).toBe('شماره موبایل یکسان');

    const nidPair = dupes.find(
      (d) => [d.a.id, d.b.id].sort().join(':') === 'c1:c3',
    );
    expect(nidPair?.score).toBe(95);
    expect(nidPair?.reason).toBe('کد ملی یکسان');

    const namePair = dupes.find(
      (d) => [d.a.id, d.b.id].sort().join(':') === 'c4:c5',
    );
    expect(namePair?.score).toBeGreaterThanOrEqual(70);
    expect(namePair?.reason).toBe('شباهت نام و نام خانوادگی');

    // Deleted customer should never appear in duplicate candidates
    expect(dupes.some((d) => d.a.id === 'c_del' || d.b.id === 'c_del')).toBe(false);
  });
});
