import { getPackSalesConfig, INDUSTRY_PACKS } from '../data/packs';
import type { AppState, IndustryPack, PackTemplate } from '../types';

export type PackSwitchDiff = {
  targetPack: PackTemplate;
  currentPackName: string;
  targetPackName: string;
  newCustomFields: { key: string; label: string; entity?: string }[];
  keptCustomFieldsCount: number;
  newCustomEntities: { key: string; name: string }[];
  newServices: { name: string; price: number }[];
  newProducts: { name: string; price: number }[];
  newRules: { name: string }[];
  newWorkflows: { title: string }[];
  oldPipelineName: string;
  newPipelineName: string;
  oldStagesLabels: string[];
  newStagesLabels: string[];
  preservedCustomerRecords: number;
  preservedOrdersCount: number;
  preservedCustomFieldValuesCount: number;
};

export function computePackSwitchDiff(state: AppState, targetKey: IndustryPack): PackSwitchDiff | null {
  const targetPack =
    INDUSTRY_PACKS.find((p) => p.key === targetKey) ??
    state.customPacks.find((p) => p.key === targetKey);
  if (!targetPack) return null;

  const currentPack =
    INDUSTRY_PACKS.find((p) => p.key === state.settings.industryPack) ??
    state.customPacks.find((p) => p.key === state.settings.industryPack);

  const existingFieldKeys = new Set(state.customFieldDefs.map((f) => f.key));
  const newCustomFields = targetPack.customFields
    .filter((f) => !existingFieldKeys.has(f.key))
    .map((f) => ({ key: f.key, label: f.label, entity: f.entity }));

  const existingEntKeys = new Set(state.customEntityDefs.map((e) => e.key));
  const newCustomEntities = targetPack.customEntities
    .filter((e) => !existingEntKeys.has(e.key))
    .map((e) => ({ key: e.key, name: e.name }));

  const existingSvcNames = new Set(state.services.map((s) => s.name));
  const newServices = targetPack.services
    .filter((s) => !existingSvcNames.has(s.name))
    .map((s) => ({ name: s.name, price: s.price }));

  const existingProdNames = new Set(state.products.map((p) => p.name));
  const newProducts = targetPack.products
    .filter((p) => !existingProdNames.has(p.name))
    .map((p) => ({ name: p.name, price: p.price }));

  const existingRuleNames = new Set(state.rules.map((r) => r.name));
  const newRules = targetPack.rules
    .filter((r) => !existingRuleNames.has(r.name))
    .map((r) => ({ name: r.name }));

  const existingWfKeys = new Set(state.workflowDefinitions.map((w) => w.key));
  const newWorkflows = (targetPack.workflowTemplates ?? [])
    .filter((w) => !existingWfKeys.has(w.key))
    .map((w) => ({ title: w.title }));

  const oldSales = getPackSalesConfig(state.settings.industryPack, state.customPacks);
  const newSales = getPackSalesConfig(targetKey, state.customPacks);

  const preservedCustomFieldValuesCount = state.customers.filter(
    (c) => !c.isDeleted && c.customFields && Object.keys(c.customFields).length > 0,
  ).length;

  return {
    targetPack,
    currentPackName: currentPack?.name ?? state.settings.industryPack,
    targetPackName: targetPack.name,
    newCustomFields,
    keptCustomFieldsCount: state.customFieldDefs.length,
    newCustomEntities,
    newServices,
    newProducts,
    newRules,
    newWorkflows,
    oldPipelineName: oldSales.pipelineName,
    newPipelineName: newSales.pipelineName,
    oldStagesLabels: state.pipelineStages.map((s) => s.label),
    newStagesLabels: newSales.defaultStages.map((s) => s.label),
    preservedCustomerRecords: state.customers.filter((c) => !c.isDeleted).length,
    preservedOrdersCount: state.orders.filter((o) => !o.isDeleted).length,
    preservedCustomFieldValuesCount,
  };
}
