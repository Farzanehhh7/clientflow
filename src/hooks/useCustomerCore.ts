import { useCallback, useMemo, useState } from 'react';
import { getPackCustomerConfig } from '../data/packs';
import { LocalStorageCustomerRepository } from '../data/repositories/customerRepository';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  Customer,
  CustomerLifecycle,
  CustomerPersonType,
  CustomerSavedViewFilter,
} from '../types';
import {
  computeAllCustomerStatsMap,
  daysUntilJalaliMonthDay,
  evaluateSegment,
} from '../utils/crmHelpers';
import { exportCustomersToCsv, exportCustomersToXlsx } from '../utils/csv';
import { fuzzyMatchPersian } from '../utils/persianSearch';
import { filterByUserScope } from '../utils/security';

export const DEFAULT_CUSTOMER_FILTERS: CustomerSavedViewFilter = {
  query: '',
  selectedTag: 'همه',
  lifecycleFilter: 'all',
  activeSegmentId: 'all',
  personTypeFilter: 'all',
  ownerFilter: 'all',
  sortBy: 'createdAt',
  sortDir: 'desc',
};

export const LIFECYCLE_LABELS: Record<CustomerLifecycle, string> = {
  lead: 'سرنخ',
  active: 'فعال',
  vip: 'VIP',
  churned: 'ریزش‌کرده',
};

export function useCustomerCore() {
  const { state, saveCustomerView, deleteCustomerView, pushToast } = useClientFlow();
  const [filters, setFilters] = useState<CustomerSavedViewFilter>(DEFAULT_CUSTOMER_FILTERS);
  const [activeViewId, setActiveViewId] = useState<string>('');

  const repository = useMemo(
    () => new LocalStorageCustomerRepository(() => state),
    [state],
  );

  const packConfig = useMemo(
    () => getPackCustomerConfig(state.settings.industryPack, state.customFieldDefs),
    [state.settings.industryPack, state.customFieldDefs],
  );

  const branchCustomers = useMemo(() => {
    const all = repository.list(false);
    return filterByUserScope(
      all,
      state,
      (c) => c.ownerName,
      (c) => c.branchId,
    );
  }, [repository, state]);

  const statsMap = useMemo(
    () => computeAllCustomerStatsMap(branchCustomers, state),
    [branchCustomers, state],
  );

  const dynamicTags = useMemo(() => {
    const set = new Set<string>();
    branchCustomers.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return ['همه', ...Array.from(set)];
  }, [branchCustomers]);

  const ownersList = useMemo(() => {
    const set = new Set<string>(state.settings.salesTeam);
    branchCustomers.forEach((c) => {
      if (c.ownerName?.trim()) set.add(c.ownerName.trim());
    });
    return Array.from(set);
  }, [branchCustomers, state.settings.salesTeam]);

  const activeSegment = useMemo(
    () => state.customerSegments.find((s) => s.id === filters.activeSegmentId),
    [state.customerSegments, filters.activeSegmentId],
  );

  const filteredCustomers = useMemo(() => {
    const matched = branchCustomers.filter((c) => {
      if (filters.selectedTag !== 'همه' && !c.tags.includes(filters.selectedTag)) return false;
      if (filters.lifecycleFilter !== 'all' && (c.lifecycle ?? 'active') !== filters.lifecycleFilter) {
        return false;
      }
      if (filters.personTypeFilter !== 'all' && (c.personType ?? 'individual') !== filters.personTypeFilter) {
        return false;
      }
      if (filters.ownerFilter !== 'all' && (c.ownerName ?? '') !== filters.ownerFilter) {
        return false;
      }
      if (activeSegment) {
        const st = statsMap.get(c.id);
        if (st && !evaluateSegment(c, activeSegment, st)) return false;
      }
      if (!filters.query.trim()) return true;
      return fuzzyMatchPersian(
        [
          c.name,
          c.companyName,
          c.phone,
          c.email,
          c.nationalId,
          c.economicCode,
          c.ownerName,
          ...Object.values(c.customFields ?? {}),
          ...(c.contacts ?? []).map((ct) => `${ct.name} ${ct.phone}`),
        ],
        filters.query,
      );
    });

    const dir = filters.sortDir === 'asc' ? 1 : -1;
    return [...matched].sort((a, b) => {
      if (filters.sortBy === 'name') {
        return a.name.localeCompare(b.name, 'fa') * dir;
      }
      if (filters.sortBy === 'score') {
        return ((statsMap.get(a.id)?.score ?? 0) - (statsMap.get(b.id)?.score ?? 0)) * dir;
      }
      if (filters.sortBy === 'totalSpent') {
        return ((statsMap.get(a.id)?.totalSpent ?? 0) - (statsMap.get(b.id)?.totalSpent ?? 0)) * dir;
      }
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });
  }, [branchCustomers, filters, activeSegment, statsMap]);

  const duplicateCandidates = useMemo(
    () => repository.findDuplicates(branchCustomers),
    [repository, branchCustomers],
  );

  const occasionsList = useMemo(() => {
    const list: {
      customer: Customer;
      kind: 'birthday' | 'anniversary';
      jalaliDate: string;
      daysLeft: number;
    }[] = [];
    for (const c of branchCustomers) {
      if (c.birthDateJalali) {
        const d = daysUntilJalaliMonthDay(c.birthDateJalali);
        if (d !== null) list.push({ customer: c, kind: 'birthday', jalaliDate: c.birthDateJalali, daysLeft: d });
      }
      if (c.anniversaryDateJalali) {
        const d = daysUntilJalaliMonthDay(c.anniversaryDateJalali);
        if (d !== null) {
          list.push({ customer: c, kind: 'anniversary', jalaliDate: c.anniversaryDateJalali, daysLeft: d });
        }
      }
    }
    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [branchCustomers]);

  const userKey = state.settings.role;
  const savedViews = useMemo(
    () => repository.listSavedViews(userKey),
    [repository, userKey],
  );

  const updateFilter = useCallback(<K extends keyof CustomerSavedViewFilter>(
    key: K,
    value: CustomerSavedViewFilter[K],
  ) => {
    setActiveViewId('');
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setActiveViewId('');
    setFilters(DEFAULT_CUSTOMER_FILTERS);
  }, []);

  const applySavedView = useCallback((viewId: string) => {
    const target = savedViews.find((v) => v.id === viewId);
    if (!target) {
      setActiveViewId('');
      setFilters(DEFAULT_CUSTOMER_FILTERS);
      return;
    }
    setActiveViewId(target.id);
    setFilters({ ...DEFAULT_CUSTOMER_FILTERS, ...target.filters });
  }, [savedViews]);

  const handleSaveCurrentView = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveCustomerView({
      name: trimmed,
      userKey,
      filters: { ...filters },
    });
  }, [filters, saveCustomerView, userKey]);

  const applyFilterJson = useCallback((next: CustomerSavedViewFilter) => {
    setActiveViewId('');
    setFilters({ ...DEFAULT_CUSTOMER_FILTERS, ...next });
  }, []);

  const saveFilterViewDirect = useCallback(
    (name: string, filter: CustomerSavedViewFilter) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      saveCustomerView({
        name: trimmed,
        userKey,
        filters: { ...DEFAULT_CUSTOMER_FILTERS, ...filter },
      });
    },
    [saveCustomerView, userKey],
  );

  const handleDeleteSavedView = useCallback((id: string) => {
    if (activeViewId === id) setActiveViewId('');
    deleteCustomerView(id);
  }, [activeViewId, deleteCustomerView]);

  const exportFilteredCsv = useCallback(() => {
    const csvContent = exportCustomersToCsv(filteredCustomers);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('فایل CSV نمای فعلی با موفقیت ذخیره شد.');
  }, [filteredCustomers, pushToast]);

  const exportFilteredXlsx = useCallback(() => {
    exportCustomersToXlsx(
      filteredCustomers,
      `clientflow-customers-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    pushToast('فایل اکسل (XLSX) نمای فعلی با موفقیت ذخیره شد.');
  }, [filteredCustomers, pushToast]);

  const setPersonTypeFilter = useCallback(
    (v: 'all' | CustomerPersonType) => updateFilter('personTypeFilter', v),
    [updateFilter],
  );

  return {
    repository,
    packConfig,
    branchCustomers,
    statsMap,
    dynamicTags,
    ownersList,
    filters,
    activeViewId,
    savedViews,
    filteredCustomers,
    duplicateCandidates,
    occasionsList,
    updateFilter,
    setPersonTypeFilter,
    resetFilters,
    applySavedView,
    handleSaveCurrentView,
    applyFilterJson,
    saveFilterViewDirect,
    handleDeleteSavedView,
    exportFilteredCsv,
    exportFilteredXlsx,
  };
}
