import type {
  BaseEntityMeta,
  ConsentLog,
  CsvImportBatch,
  Customer,
  CustomerRelation,
  CustomerSavedView,
  CustomerSegment,
} from '../../types';

export interface RepositoryContext {
  tenantId: string;
  actorName: string;
}

export interface DuplicateCandidate {
  reason: 'شماره موبایل یکسان' | 'کد ملی یکسان' | 'شباهت نام و نام خانوادگی';
  score: number;
  a: Customer;
  b: Customer;
}

export interface CustomerRepository {
  list(includeDeleted?: boolean): Customer[];
  getById(id: string): Customer | undefined;
  create(
    data: Omit<Customer, 'id' | 'createdAt'>,
    ctx: RepositoryContext,
  ): Customer;
  update(
    id: string,
    patch: Partial<Customer>,
    ctx: RepositoryContext,
    expectedVersion?: number,
  ): { ok: boolean; error?: string; customer?: Customer };
  softDelete(id: string, ctx: RepositoryContext): boolean;
  findDuplicates(customers: Customer[]): DuplicateCandidate[];
  listConsentLogs(customerId?: string): ConsentLog[];
  listSavedViews(userKey?: string): CustomerSavedView[];
  saveView(view: Omit<CustomerSavedView, 'id' | 'createdAt'>, ctx: RepositoryContext): CustomerSavedView;
  deleteView(id: string): void;
  listSegments(): CustomerSegment[];
  listRelations(customerId?: string): CustomerRelation[];
  listImportBatches(): CsvImportBatch[];
}

export function stampCreateMeta<T extends BaseEntityMeta>(
  entity: T,
  ctx: RepositoryContext,
  nowIso = new Date().toISOString(),
): T {
  return {
    ...entity,
    tenantId: entity.tenantId ?? ctx.tenantId,
    updatedAt: nowIso,
    createdBy: entity.createdBy ?? ctx.actorName,
    isDeleted: false,
    version: entity.version ?? 1,
  };
}

export function stampUpdateMeta<T extends BaseEntityMeta>(
  entity: T,
  ctx: RepositoryContext,
  nowIso = new Date().toISOString(),
): T {
  return {
    ...entity,
    tenantId: entity.tenantId ?? ctx.tenantId,
    updatedAt: nowIso,
    createdBy: entity.createdBy ?? ctx.actorName,
    version: (entity.version ?? 1) + 1,
  };
}
