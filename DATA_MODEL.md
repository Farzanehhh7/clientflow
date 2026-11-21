# ClientFlow — Domain Data Model (`src/types.ts`)

> All tenant-scoped entities extend `BaseEntityMeta`:
> `tenantId?: string`, `updatedAt?: string`, `createdBy?: string`, `isDeleted?: boolean`, `deletedAt?: string`, `version?: number`

---

## 1. Entity Groups & Core Tables

### 1.1 Identity, Multi-Tenancy & RBAC (`iam`)
| Entity | Key Fields | Description |
|---|---|---|
| `Branch` | `id`, `name`, `code`, `parentBranchId?`, `isHeadquarters?`, `city?`, `active` | Hierarchical branch tree for multi-branch data scoping |
| `TeamDefinition` | `id`, `name`, `branchId?`, `leaderUserId?`, `memberUserIds[]` | Operational teams (Sales, Support, Reception) |
| `RoleDefinition` | `id`, `key`, `name`, `dataScope` (`own`\|`team`\|`branch`\|`all`), `permissions` | Resource-level CRUD + export permissions + PII access |
| `CrmUser` | `id`, `name`, `email`, `phone`, `roleId`, `branchId`, `teamId?`, `active` | CRM operator account mapped to role/branch/team |
| `DataAccessLogEntry` | `id`, `actorName`, `customerId`, `customerName`, `action`, `piiMasked`, `at` | Audit trail for viewing/exporting customer PII |
| `AuditLogEntry` | `id`, `actorRole`, `action`, `entityType`, `entityId`, `summary`, `at` | Immutable entity mutation log |

### 1.2 Customer Core & Custom Schema (`crm`)
| Entity | Key Fields | Description |
|---|---|---|
| `Customer` | `id`, `personType`, `name`, `companyName?`, `phone`, `email?`, `nationalId?`, `economicCode?`, `lifecycle`, `source?`, `ownerName?`, `branchId?`, `tags[]`, `contacts[]`, `addresses[]`, `attachments[]`, `consentSms`, `consentEmail`, `loyaltyPoints`, `lifetimePoints`, `referralCode?`, `referredByCustomerId?`, `birthDateJalali?`, `customFields` | Master 360° individual or organization customer profile |
| `CustomerRelation` | `id`, `fromCustomerId`, `toCustomerId`, `relationType`, `note?` | Household, employer, referral, or subsidiary graph links |
| `CustomerSegment` | `id`, `name`, `segmentType`, `logic`, `conditions[]`, `staticCustomerIds[]` | Dynamic rule-based or static customer segments |
| `CustomerSavedView` | `id`, `name`, `userKey`, `filters` | Whitelisted saved view filter definitions |
| `ConsentLog` | `id`, `customerId`, `channel`, `granted`, `reason?`, `actorName`, `at` | SMS/Email/WhatsApp opt-in/opt-out ledger |
| `Interaction` | `id`, `customerId`, `channel`, `text`, `outcome?`, `followUpAt?`, `at` | Calls, SMS, WhatsApp, visits, internal notes |
| `CustomFieldDef` | `id`, `key`, `label`, `type`, `entity`, `options[]`, `required`, `unique`, `visibleWhen?`, `formulaExpr?`, `validation?` | Dynamic no-code schema fields across 6 entities |
| `CustomEntityDef` / `CustomEntityRecord` | `id`, `key`, `name`, `fields[]`, `values` | No-code industry objects (Vehicle, Property, Case, Batch) |

### 1.3 Scheduling & Resources (`book`)
| Entity | Key Fields | Description |
|---|---|---|
| `Service` | `id`, `name`, `durationMin`, `price`, `bufferBeforeMin?`, `bufferAfterMin?` | Bookable services with pre/post buffer rules |
| `Resource` | `id`, `name`, `role`, `color`, `branchId?` | Practitioners, rooms, bays, advisors, instructors |
| `Appointment` | `id`, `customerId`, `serviceId`, `resourceId`, `start`, `end`, `status`, `branchId?`, `notes?` | Conflict-checked bookings (`booked`, `confirmed`, `done`, `cancelled`, `noshow`) |
| `OfficialHoliday` / `ResourceTimeOff` / `WaitlistEntry` | `dateKey`, `resourceId`, `preferredDateKey` | Holiday blackouts, leave blocks, standby waitlist |

### 1.4 Sales Pipeline, Quotes & Commissions (`sales`)
| Entity | Key Fields | Description |
|---|---|---|
| `SalesLead` | `id`, `name`, `phone`, `source`, `score`, `estimatedAmount`, `ownerName`, `status`, `utmSource?`, `utmCampaign?` | Inbound leads with UTM attribution and AI/heuristic scoring |
| `SalesPipeline` & `PipelineStageConfig` | `id`, `key`, `label`, `probability`, `order`, `stagnantAfterDays?` | Configurable deal pipelines & win probabilities |
| `Opportunity` | `id`, `title`, `customerId`, `stage`, `amount`, `expectedCloseAt`, `ownerName`, `stageEnteredAt` | Active deals moving across stages with stagnation alerts |
| `Quote` & `PriceList` | `id`, `quoteNo`, `customerId`, `items[]`, `discountPct`, `taxPct`, `status`, `requiresApproval` | Multi-revision quotes with manager approval threshold (>20%) |
| `CommissionTier` & `CommissionRuleConfig` & `CommissionLedgerEntry` | `upToAmount`, `ratePct`, `mode`, `commissionAmount`, `status` | Flat or progressive stepped commission rules & payout ledger |

### 1.5 Products, Orders, Invoices & Finance (`ops` / `fin`)
| Entity | Key Fields | Description |
|---|---|---|
| `Product` & `StockMovement` | `id`, `sku`, `name`, `price`, `stockQty`, `reorderPoint` | Catalog inventory & stock deductions/returns |
| `Order` & `OrderStatusLog` | `id`, `customerId`, `channel`, `items[]`, `discountAmount?`, `couponCode?`, `status`, `trackingCode?` | Multi-channel orders with item price snapshots |
| `Invoice` & `PaymentAllocation` | `id`, `invoiceNo`, `orderId`, `customerId`, `subtotal`, `discount`, `tax`, `grandTotal`, `paidAmount`, `status`, `dueAt` | Tax-aware invoices & partial/split payments |
| `SayadiCheque` & `PaymentTransaction` | `sayadiId`, `dueAt`, `status`, `gateway`, `refId` | Iranian Sayadi cheque lifecycle & online gateway sandbox txns |
| `Contract` & `WarrantyRecord` & `OrderReturn` | `contractNo`, `serialNo`, `expiryAt`, `refundAmount` | Retainers, subscriptions, warranties & RMA returns |

### 1.6 Support, Knowledge Base & VoIP (`supp`)
| Entity | Key Fields | Description |
|---|---|---|
| `Ticket` & `TicketMessage` | `id`, `trackingCode`, `customerId`, `subject`, `channel`, `priority`, `status`, `category?`, `assignee?`, `firstRespondedAt?`, `resolvedAt?`, `mergedIntoTicketId?`, `rootCause?` | Omnichannel tickets, complaints, internal notes, merge support |
| `SlaPolicy` | `priority`, `firstResponseMin`, `resolutionMin`, `warnPct` | Business-hours-aware SLA policies per priority |
| `KbArticle` | `id`, `title`, `category`, `body`, `visibility` (`public`\|`internal`), `version`, `helpfulCount` | Versioned KB supporting auto-suggestion in ticket replies |
| `NpsSurvey` | `id`, `customerId`, `surveyType` (`nps`\|`csat`\|`ces`), `score`, `comment?`, `triggerRefId?` | Auto-triggered post-visit/delivery/ticket surveys |
| `CallLogEntry` | `id`, `direction`, `phone`, `customerId?`, `status`, `durationSec`, `outcome?`, `recordingUrl?` | VoIP call logs and click-to-call outcome tracking |

### 1.7 Automation, Workflows, Marketing, BI & AI (`auto` / `mkt` / `bi`)
- **Automation (`Rule`, `MessageTemplate`, `OutboxMessage`, `AutomationRunLog`, `WebhookEndpoint`, `WebhookLogEntry`)**: Visual trigger/condition/action rules with cooldown/dedup, quiet hours, HMAC webhooks, and outbox queue.
- **BPMS Workflows (`WorkflowDefinition`, `WorkflowInstance`)**: Multi-step approval, task, decision, wait, and end nodes with per-step SLAs and bottleneck telemetry.
- **Marketing & Loyalty (`MarketingCampaign`, `LandingForm`, `UtmTouch`, `LoyaltyConfig`, `LoyaltyReward`, `LoyaltyTransaction`, `ContentItem`, `MediaAsset`)**: A/B campaigns, embed forms, points/tiers/rewards, content calendar, consent-tagged assets.
- **BI & Industry Packs (`SavedReportConfig`, `ScheduledReport`, `PackTemplate`, `AiUsageLogEntry`)**: Custom no-code report builder specs, exportable industry packs, PII-masked AI logs.

---

## 2. Core Relationships Diagram

```
Branch (1) ──< (N) CrmUser / Customer / Appointment / Order / Ticket / Opportunity
Customer (1) ──< (N) Contact / Address / Interaction / ConsentLog
Customer (1) ──< (N) Appointment ──> (1) Service & Resource
Customer (1) ──< (N) Opportunity ──< (N) Quote ──> (0..1) Order
Customer (1) ──< (N) Order ──< (N) Invoice ──< (N) PaymentAllocation / SayadiCheque
Customer (1) ──< (N) Ticket ──< (N) TicketMessage
Ticket.priority ──> SlaPolicy
Ticket (N) ──> KbArticle (suggested)
WorkflowDefinition (1) ──< (N) WorkflowInstance
Rule (1) ──< (N) AutomationRunLog / OutboxMessage
MarketingCampaign (0..1) ──> CustomerSegment
MarketingCampaign (1) ──< (N) UtmTouch ──> SalesLead
```
