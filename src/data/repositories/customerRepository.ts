import type {
  AppState,
  ConsentLog,
  CsvImportBatch,
  Customer,
  CustomerRelation,
  CustomerSavedView,
  CustomerSegment,
} from '../../types';
import { compactPersian, levenshtein, normalizePersian } from '../../utils/persianSearch';
import { normalizeDigits, normalizeIranMobile } from '../../utils/validators';
import {
  type CustomerRepository,
  type DuplicateCandidate,
  type RepositoryContext,
  stampCreateMeta,
  stampUpdateMeta,
} from './types';

export const DEFAULT_TENANT_ID = 'tenant_default_1';

/**
 * LocalStorage/in-memory implementation of CustomerRepository.
 * Designed so an ASP.NET Core + SQL Server REST adapter can swap in without touching UI pages.
 */
export class LocalStorageCustomerRepository implements CustomerRepository {
  constructor(private readonly getState: () => AppState) {}

  list(includeDeleted = false): Customer[] {
    const items = this.getState().customers;
    return includeDeleted ? items : items.filter((c) => !c.isDeleted);
  }

  getById(id: string): Customer | undefined {
    return this.getState().customers.find((c) => c.id === id && !c.isDeleted);
  }

  create(data: Omit<Customer, 'id' | 'createdAt'>, ctx: RepositoryContext): Customer {
    const nowIso = new Date().toISOString();
    return stampCreateMeta(
      {
        ...data,
        id: `c_${Date.now()}`,
        createdAt: nowIso,
      },
      ctx,
      nowIso,
    );
  }

  update(
    id: string,
    patch: Partial<Customer>,
    ctx: RepositoryContext,
    expectedVersion?: number,
  ): { ok: boolean; error?: string; customer?: Customer } {
    const current = this.getById(id);
    if (!current) return { ok: false, error: 'مشتری یافت نشد.' };
    if (
      expectedVersion !== undefined &&
      current.version !== undefined &&
      current.version !== expectedVersion
    ) {
      return { ok: false, error: 'تضاد نسخه (Optimistic Concurrency): رکورد توسط کاربر دیگری تغییر یافته است.' };
    }
    const updated = stampUpdateMeta({ ...current, ...patch }, ctx);
    return { ok: true, customer: updated };
  }

  softDelete(id: string, ctx: RepositoryContext): boolean {
    const current = this.getById(id);
    if (!current) return false;
    void stampUpdateMeta({ ...current, isDeleted: true, deletedAt: new Date().toISOString() }, ctx);
    return true;
  }

  findDuplicates(customers: Customer[]): DuplicateCandidate[] {
    const active = customers.filter((c) => !c.isDeleted);
    const seenPairs = new Set<string>();
    const candidates: DuplicateCandidate[] = [];

    const addPair = (a: Customer, b: Customer, reason: DuplicateCandidate['reason'], score: number) => {
      const pairKey = [a.id, b.id].sort().join('::');
      if (seenPairs.has(pairKey)) return;
      seenPairs.add(pairKey);
      candidates.push({ a, b, reason, score });
    };

    // 1. Exact normalized phone match
    const byPhone = new Map<string, Customer[]>();
    // 2. Exact normalized nationalId match
    const byNationalId = new Map<string, Customer[]>();

    for (const c of active) {
      const p = normalizeIranMobile(c.phone);
      if (p) {
        const arr = byPhone.get(p) ?? [];
        arr.push(c);
        byPhone.set(p, arr);
      }
      const nid = c.nationalId ? normalizeDigits(c.nationalId).trim() : '';
      if (nid.length === 10) {
        const arr = byNationalId.get(nid) ?? [];
        arr.push(c);
        byNationalId.set(nid, arr);
      }
    }

    for (const list of byPhone.values()) {
      for (let i = 0; i < list.length - 1; i++) {
        addPair(list[i], list[i + 1], 'شماره موبایل یکسان', 100);
      }
    }

    for (const list of byNationalId.values()) {
      for (let i = 0; i < list.length - 1; i++) {
        addPair(list[i], list[i + 1], 'کد ملی یکسان', 95);
      }
    }

    // 3. Name similarity (normalized + Levenshtein <= 2 for non-short names)
    for (let i = 0; i < active.length; i++) {
      const a = active[i];
      const nameA = compactPersian(a.name);
      if (nameA.length < 4) continue;
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j];
        const nameB = compactPersian(b.name);
        if (nameB.length < 4) continue;
        if (nameA === nameB) {
          addPair(a, b, 'شباهت نام و نام خانوادگی', 88);
          continue;
        }
        if (Math.abs(nameA.length - nameB.length) <= 2) {
          const normA = normalizePersian(a.name);
          const normB = normalizePersian(b.name);
          const dist = levenshtein(normA, normB);
          if (dist <= 2 && Math.min(normA.length, normB.length) >= 6) {
            addPair(a, b, 'شباهت نام و نام خانوادگی', 80 - dist * 5);
          }
        }
      }
    }

    return candidates.sort((x, y) => y.score - x.score);
  }

  listConsentLogs(customerId?: string): ConsentLog[] {
    const logs = this.getState().consentLogs ?? [];
    const filtered = customerId ? logs.filter((l) => l.customerId === customerId) : logs;
    return filtered.filter((l) => !l.isDeleted);
  }

  listSavedViews(userKey?: string): CustomerSavedView[] {
    const views = (this.getState().customerSavedViews ?? []).filter((v) => !v.isDeleted);
    return userKey ? views.filter((v) => v.userKey === userKey || v.userKey === 'all') : views;
  }

  saveView(
    view: Omit<CustomerSavedView, 'id' | 'createdAt'>,
    ctx: RepositoryContext,
  ): CustomerSavedView {
    const nowIso = new Date().toISOString();
    return stampCreateMeta(
      {
        ...view,
        id: `view_${Date.now()}`,
        createdAt: nowIso,
      },
      ctx,
      nowIso,
    );
  }

  deleteView(_id: string): void {
    // Handled through store mutation so React state and localStorage stay synchronized
  }

  listSegments(): CustomerSegment[] {
    return (this.getState().customerSegments ?? []).filter((s) => !s.isDeleted);
  }

  listRelations(customerId?: string): CustomerRelation[] {
    const all = (this.getState().customerRelations ?? []).filter((r) => !r.isDeleted);
    if (!customerId) return all;
    return all.filter((r) => r.fromCustomerId === customerId || r.toCustomerId === customerId);
  }

  listImportBatches(): CsvImportBatch[] {
    return (this.getState().csvImportBatches ?? []).filter((b) => !b.isDeleted);
  }
}
