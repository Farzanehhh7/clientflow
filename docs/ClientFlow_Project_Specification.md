# ClientFlow — مستند جامع پروژه (SRS + معماری + مهارت‌ها)

> **پلتفرم ماژولار مدیریت ارتباط با مشتری، گردش کار و اتوماسیون** برای کسب‌وکارهای کوچک تا بزرگ
> نسخه ۱٫۰ | تاریخ: آبان ۱۴۰۵ (نوامبر ۲۰۲۶) | پروژه نمونه‌کار (Portfolio) با داده فرضی

---

## فهرست

1. معرفی و چشم‌انداز
2. دامنه، پرسونا و سناریوهای کلیدی
3. نگاشت پروژه به آگهی‌های شغلی
4. معماری و پشته فناوری (۲۰۲۶)
5. نیازمندی‌های کارکردی (FR)
6. نیازمندی‌های غیرکارکردی (NFR)
7. بسته‌های صنعتی
8. قابلیت‌های هوش مصنوعی (۲۰۲۶)
9. زیرساخت، استقرار و DevOps
10. یکپارچگی‌ها
11. امنیت و حریم خصوصی
12. تست و تضمین کیفیت
13. مستندات و خروجی‌های نمونه‌کار
14. ماتریس مهارت‌ها
15. نقشه راه و فازبندی
16. ریسک‌ها
17. معیار پذیرش و تعریف «انجام شد»
18. نحوه معرفی در رزومه و مصاحبه
19. واژه‌نامه

---

## ۱. معرفی و چشم‌انداز

### ۱.۱ بیانیه مسئله
کسب‌وکارهای ایرانی (از آرایشگاه تک‌نفره تا شرکت چندشعبه‌ای) مشتریان، نوبت‌ها، سفارش‌ها و پیگیری‌هایشان را در Excel، دفترچه، واتساپ و حافظه پراکنده می‌کنند. نتیجه: مشتری گم‌شده، پیگیری فراموش‌شده، سفارش دیرکرد، فروش از دست رفته.

### ۱.۲ راه‌حل
یک پلتفرم **«پیکربندی‌محور»** با هسته مشترک و **بسته‌های صنعتی** که:
- در **کمتر از ۱۰ دقیقه** برای یک کسب‌وکار جدید راه‌اندازی می‌شود (ویزارد).
- **کارهای تکراری را خودکار** می‌کند (یادآوری، پیگیری، نظرسنجی، هشدار تأخیر).
- با **گردش کار** فرایندهای چندمرحله‌ای و تأییدیه‌ها را مدیریت می‌کند.
- روی **زیرساخت محلی** (Windows/IIS/SQL Server) و بدون وابستگی اجباری به سرویس خارجی کار می‌کند.
- با **دستیار هوشمند** (AI) از داده خودِ کسب‌وکار پاسخ می‌دهد و کار را سریع‌تر می‌کند.

### ۱.۳ اهداف
| # | هدف | شاخص موفقیت |
|---|---|---|
| G1 | پوشش نیازمندی ۳ آگهی هدف (BPMS، CRM، کلینیک) و مشاغل مشابه | ۱۰۰٪ ماتریس بخش ۳ |
| G2 | استقرار خودکار روی Windows Server + IIS + SQL Server | نصب کامل با یک اسکریپت < ۲۰ دقیقه |
| G3 | پشتیبانی از ≥ ۳ بسته صنعتی کامل و ≥ ۵ بسته سبک | دمو زنده |
| G4 | عملکرد مناسب تا ۱ میلیون مشتری برای هر Tenant (در تست) | p95 < ۳۰۰ms برای لیست‌ها |
| G5 | نمایش مهارت‌های ۲۰۲۶ (AI، Observability، Security، Cloud-native) | بخش ۸ و ۹ |

### ۱.۴ خارج از دامنه (Non-Goals)
- حسابداری رسمی کامل (فقط فاکتور/پرداخت ساده)
- ساخت درگاه پرداخت/پیامک واقعی (فقط اتصال Sandbox/Mock)
- اپلیکیشن موبایل بومی (PWA کافی است)
- استفاده از **داده واقعی بیمار/مشتری**؛ فقط داده فرضی

---

## ۲. دامنه، پرسونا و سناریوها

### ۲.۱ پرسونا
| پرسونا | نقش | نیاز اصلی |
|---|---|---|
| **سارا** | مسئول پذیرش کلینیک | نوبت‌دهی سریع، یادآوری، ثبت پرونده |
| **مریم** | کارشناس CRM/فروش | قیف فروش، پیگیری سفارش، پورسانت |
| **علی** | کارشناس استقرار/پشتیبانی | نصب، مهاجرت داده، تیکت، آموزش |
| **دکتر کشاورز** | مدیر/پزشک | گزارش غیبت، رضایت، درآمد |
| **نگار** | مدیر محتوا | تقویم محتوا، ریلز، نتیجه محتوا |
| **مدیر سیستم (Admin)** | IT مشتری | کاربر، نقش، Backup، لاگ |
| **صاحب کسب‌وکار کوچک** | تک‌نفره | سادگی؛ ۳ منو؛ بدون پیچیدگی |
| **مدیر فروش سازمانی** | شرکت ۲۰۰ نفره | چند شعبه، SLA، SSO، گزارش‌های پیشرفته |

### ۲.۲ سناریوهای کلیدی (User Stories نمونه)
1. به‌عنوان **پذیرش**، می‌خواهم نوبت مراجع را با انتخاب خدمت و پزشک ثبت کنم و سیستم از رزرو همپوشان جلوگیری کند.
2. به‌عنوان **کارشناس CRM**، می‌خواهم سفارش غیرحضوری را از ثبت تا تحویل با وضعیت‌ها پیگیری کنم و مشتری پیامک وضعیت بگیرد.
3. به‌عنوان **کارشناس استقرار**، می‌خواهم داده Excel مشتری را وارد کنم، خطاها را ببینم و Rollback کنم.
4. به‌عنوان **مدیر**، می‌خواهم سفارش‌های بدون به‌روزرسانی بیش از ۴۸ ساعت هشدار بدهند.
5. به‌عنوان **مدیر محتوا**، می‌خواهم تقویم ریلز/پست را با وضعیت (ایده ← انتشار) و نتایج (بازدید، لید) ببینم.
6. به‌عنوان **کاربر عادی**، می‌خواهم از دستیار هوشمند بپرسم «مشتریانی که ۳ ماه است نیامده‌اند کیست؟» و جواب دقیق با لینک بگیرم.
7. به‌عنوان **Admin**، می‌خواهم فیلد جدیدی به فرم مشتری اضافه کنم بدون برنامه‌نویس.
8. به‌عنوان **مدیر**، می‌خواهم تأیید تخفیف بالای ۲۰٪ از مدیر فروش بگیرم (گردش کار تأیید).

---

## ۳. نگاشت پروژه به آگهی‌های شغلی

### ۳.۱ آگهی ۱: کارشناس استقرار و پشتیبانی نرم‌افزار اداری (BPMS)
| نیازمندی آگهی | پوشش در پروژه | بخش |
|---|---|---|
| نصب، آموزش، استقرار، پشتیبانی | اسکریپت نصب، Runbook، مستند آموزش، تیکت | ۹، ۱۳ |
| ویندوز و موارد کاربردی | Windows Server، Services، Task Scheduler، Firewall، Event Viewer | ۹ |
| وب و IIS | Site، Binding، AppPool، SSL، ARR/URL Rewrite، لاگ IIS | ۹ |
| مفاهیم پایگاه داده | طراحی دیتابیس (سند جداگانه) | DB doc |
| TSQL و SQL Server | SP، View، Index، Job، Backup، RLS، Temporal | DB doc |
| BPMS/گردش کار | موتور Workflow، BPMN، SLA، تأییدیه | FR-WF |
| مسئولیت‌پذیری، نتیجه‌محوری | KPIها، SLA تیکت، گزارش | FR-SUP |
| یادگیری و خلاقیت | AI، اتوماسیون | بخش ۸ |
| کار تیمی | Git Flow، Code Review، Documentation | ۹، ۱۲ |
| پشتیبانی نرم‌افزار تحت وب | Support Center، Runbook، Postmortem | ۱۳ |

### ۳.۲ آگهی ۲: کارشناس CRM (امتحانی هوم)
| نیازمندی | پوشش |
|---|---|
| مدیریت و پیگیری سفارش غیرحضوری از ثبت تا تحویل | ماژول سفارش + وضعیت + تاریخچه + پیامک (FR-ORD) |
| پاسخگویی به مشتریان (تماس/پیام) | ثبت تعامل، تیکت، پاسخ آماده (FR-CRM، FR-SUP) |
| ثبت و به‌روزرسانی اطلاعات در CRM | ماژول مشتری، Import، Dedup |
| پیگیری رضایت مشتری | نظرسنجی NPS/CSAT خودکار |
| پیگیری سفارش‌های در جریان و هماهنگی با واحدها | وظایف، گردش کار، SLA، هشدار |
| Excel متوسط | Import/Export، گزارش Excel، داشبورد |
| پورسانت/فروش | قیف، تارگت، Commission |
| دقت در ثبت اطلاعات | اعتبارسنجی، Dedup، Audit |

### ۳.۳ آگهی ۳: کارشناس پشتیبانی سایت (کلینیک پوست و مو)
| نیازمندی | پوشش |
|---|---|
| پشتیبانی سایت کلینیک | سایت وردپرس + Webhook به CRM + راهنمای پشتیبانی |
| نرم‌افزار مدیریت و CRM کلینیک | بسته کلینیک: نوبت، پرونده، پیگیری |
| ثبت داده و پرونده‌ها | ماژول پرونده، فیلد پویا، رازداری |
| تولید محتوا (پست و ریلز) | ماژول تقویم محتوا + پیج نمونه |
| ویرایش عکس و فیلم نمونه‌کار | Asset Library + پروژه محتوایی |

### ۳.۴ مشاغل دیگر قابل‌پوشش
تحلیلگر کسب‌وکار (BA)، تحلیلگر داده/BI، کارشناس اتوماسیون اداری، Customer Success، Implementation Consultant، مدیر محصول Junior، برنامه‌نویس .NET Junior، DevOps Junior، Product Support Engineer، مدیر فروش، دیجیتال مارکتینگ، کارشناس امنیت اطلاعات Junior، AI Automation Specialist.

---

## ۴. معماری و پشته فناوری (۲۰۲۶)

### ۴.۱ معماری منطقی
```
                    ┌───────────────────────────────────┐
                    │   کاربران (Web PWA / موبایل)       │
                    └───────────────┬───────────────────┘
                                    │ HTTPS
                       ┌────────────▼────────────┐
                       │  Reverse Proxy (IIS/ARR  │
                       │  یا YARP) + WAF + TLS    │
                       └────────────┬────────────┘
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
 ┌──────▼──────┐          ┌─────────▼─────────┐        ┌────────▼────────┐
 │  Frontend   │          │   API (ASP.NET     │        │  Worker Service │
 │ React/Next  │◄────────►│   Core 10, REST +  │        │  (Hangfire/     │
 │ RTL, Jalali │          │   OpenAPI, SignalR)│        │  Quartz)        │
 └─────────────┘          └─────────┬─────────┘        │ Outbox، Scheduler│
                                    │                  │ Automation، SMS  │
        ┌───────────────────────────┼────────┐         └────────┬────────┘
        │                           │        │                  │
 ┌──────▼──────┐   ┌────────────────▼──┐  ┌──▼───────┐   ┌──────▼───────┐
 │ SQL Server  │   │ Redis (Cache،     │  │ Object   │   │ Message Bus  │
 │ 2022/2025   │   │ Rate-limit، Lock) │  │ Storage  │   │ (اختیاری:    │
 │ (+Replica)  │   └───────────────────┘  │ (MinIO)  │   │ RabbitMQ)    │
 └─────────────┘                          └──────────┘   └──────────────┘
        │
 ┌──────▼───────────────────────────────┐
 │ Observability: OpenTelemetry → Grafana│
 │ (Loki/Tempo/Prometheus) + Seq/ELK     │
 └───────────────────────────────────────┘
```

### ۴.۲ سبک معماری
- **Modular Monolith** (نه Microservices زودهنگام): هر ماژول مرز مشخص (Bounded Context)، ارتباط از طریق Interface و Domain Event؛ قابل‌استخراج به سرویس در آینده.
- **Clean/Hexagonal Architecture + CQRS سبک** (MediatR یا جایگزین): Command/Query جدا برای گزارش‌ها.
- **Event-driven داخلی** با Outbox.
- **API-first:** OpenAPI 3.1، نسخه‌بندی (`/api/v1`).
- **Multi-tenant** با Tenant Resolver (Subdomain/Header/JWT Claim).

### ۴.۳ پشته پیشنهادی (قابل‌جایگزینی)
| لایه | انتخاب اصلی | جایگزین |
|---|---|---|
| Backend | **C# / .NET 10 (LTS)** + ASP.NET Core Minimal API/Controllers | Node.js (NestJS)، Python (FastAPI) |
| ORM | EF Core 10 + Dapper برای گزارش | |
| DB | **SQL Server 2022/2025** | PostgreSQL (در صورت نیاز Linux) |
| Frontend | **React 19 + TypeScript + Vite** (یا Next.js)، TanStack Query، Zustand، Tailwind، shadcn/ui | Blazor، Vue 3 |
| UI فارسی | RTL، فونت Vazirmatn، تقویم شمسی (`dayjs` + `jalaliday` / `Intl` با `fa-IR-u-ca-persian`) | |
| Real-time | SignalR | WebSocket |
| Job/Scheduler | Hangfire یا Quartz.NET | Windows Service |
| Workflow | موتور داخلی (Stage/Transition) + دیاگرام BPMN | Elsa Workflows، Camunda 8، Flowable |
| Cache | Redis (یا Memurai روی ویندوز) | MemoryCache |
| Search | SQL Full-Text + (اختیاری) Meilisearch/OpenSearch | |
| فایل | MinIO/Disk | |
| Auth | ASP.NET Identity + OpenIddict/Keycloak (OIDC) | |
| AI | LLM Gateway + RAG (بخش ۸) | |
| CI/CD | **GitHub Actions** / GitLab CI | Azure DevOps |
| کانتینر | Docker (اختیاری؛ IIS هدف اصلی) | |
| IaC | **PowerShell DSC / Ansible / Terraform** | |
| مانیتورینگ | **OpenTelemetry + Grafana/Prometheus/Loki** + Seq | ELK |
| تست | xUnit، Playwright، k6، tSQLt، Testcontainers | |

> **نسخه سبک (Low-code):** EspoCRM/SuiteCRM + n8n + SQL Server گزارش‌ها + IIS؛ برای کسی که برنامه‌نویس نیست (مطابق گفتگوی قبل).

---

## ۵. نیازمندی‌های کارکردی (FR)

> اولویت: **M** = Must، **S** = Should، **C** = Could

### ۵.۱ FR-CORE: هسته و Tenant
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-CORE-01 | ثبت و مدیریت Tenant با پلن و Feature Flag | M |
| FR-CORE-02 | ویزارد راه‌اندازی: نوع کسب‌وکار، اندازه، شعب، نصب Industry Pack | M |
| FR-CORE-03 | تنظیمات Tenant: منطقه زمانی، ارز، تقویم شمسی/میلادی، لوگو، ساعات کاری، تعطیلات | M |
| FR-CORE-04 | چند شعبه با سلسله‌مراتب و دسترسی مبتنی بر شعبه | S |
| FR-CORE-05 | شماره‌گذاری قابل‌پیکربندی (پیشوند، طول، سال شمسی) | M |
| FR-CORE-06 | حالت Solo (رابط ساده) و Enterprise (کامل) با Feature Flag | S |
| FR-CORE-07 | Export/Import کامل پیکربندی Tenant (JSON) | S |
| FR-CORE-08 | Clone Tenant برای محیط تست/آموزش (Sandbox) | C |

### ۵.۲ FR-IAM: هویت و دسترسی
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-IAM-01 | ثبت‌نام/ورود با ایمیل یا موبایل + OTP | M |
| FR-IAM-02 | RBAC با نقش قابل‌تعریف و دسترسی سطح ماژول/عملیات/فیلد/رکورد (Own/Team/Branch/All) | M |
| FR-IAM-03 | MFA (TOTP، SMS) | M |
| FR-IAM-04 | SSO با OIDC/SAML/LDAP/Active Directory | S |
| FR-IAM-05 | مدیریت Session و دستگاه‌ها، ابطال از راه دور | S |
| FR-IAM-06 | سیاست رمز عبور، قفل حساب، تشخیص ورود مشکوک | M |
| FR-IAM-07 | API Key با Scope و انقضا | M |
| FR-IAM-08 | جانشینی (Delegation) در مرخصی | C |
| FR-IAM-09 | Impersonation امن برای پشتیبان (با ثبت Audit و رضایت) | S |
| FR-IAM-10 | ماسک خودکار داده حساس برای نقش‌های محدود | M |

### ۵.۳ FR-CFG: پیکربندی پویا (قلب انعطاف)
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-CFG-01 | تعریف موجودیت جدید (Entity Builder) بدون کد | M |
| FR-CFG-02 | فیلد پویا با انواع: متن، عدد، تاریخ شمسی، انتخابی، چندانتخابی، فایل، پول، تلفن، کد ملی، Lookup، فرمول | M |
| FR-CFG-03 | قوانین اعتبارسنجی، یکتایی، الزامی، شرطی (نمایش فیلد بر اساس فیلد دیگر) | M |
| FR-CFG-04 | فرم‌ساز Drag & Drop با بخش‌بندی و تب | S |
| FR-CFG-05 | نماها: جدول، کانبان، تقویم، کارت، نقشه با فیلتر/مرتب‌سازی ذخیره‌شده | M |
| FR-CFG-06 | روابط پویا (۱:۱، ۱:N، N:M) بین موجودیت‌ها | S |
| FR-CFG-07 | فیلد محاسباتی/فرمولی | S |
| FR-CFG-08 | نسخه‌بندی پیکربندی و Rollback | C |
| FR-CFG-09 | نصب/ارتقای Industry Pack بدون از دست رفتن شخصی‌سازی‌ها | M |

### ۵.۴ FR-CRM: مشتری
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-CRM-01 | پروفایل ۳۶۰ درجه: اطلاعات، تعاملات، سفارش‌ها، نوبت‌ها، تیکت‌ها، فاکتورها در یک صفحه | M |
| FR-CRM-02 | مشتری حقیقی/حقوقی، مخاطبین، آدرس‌های متعدد | M |
| FR-CRM-03 | برچسب، سگمنت ایستا/پویا با قانون | M |
| FR-CRM-04 | ثبت تعامل (تماس، پیامک، واتساپ، حضوری، یادداشت) با زمان‌بندی و نتیجه | M |
| FR-CRM-05 | شناسایی و ادغام مشتریان تکراری (Dedup) | M |
| FR-CRM-06 | امتیازدهی مشتری (دستی/قانونی/AI) | S |
| FR-CRM-07 | چرخه عمر (Lead → Active → VIP → Churned) | S |
| FR-CRM-08 | مدیریت رضایت‌نامه (Opt-in پیامک/ایمیل) و لاگ | M |
| FR-CRM-09 | ورود انبوه از Excel/CSV با Mapping، پیش‌نمایش، گزارش خطا و Rollback | M |
| FR-CRM-10 | جستجوی سراسری سریع (نام، موبایل، کد ملی، شماره سفارش) با تحمل غلط املایی فارسی | M |
| FR-CRM-11 | Timeline یکپارچه فعالیت‌ها | M |
| FR-CRM-12 | درخت روابط (معرف، خانواده، همکار) | C |
| FR-CRM-13 | تقویم تولد و مناسبت‌ها و پیام خودکار | S |

### ۵.۵ FR-SAL: فروش
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-SAL-01 | مدیریت سرنخ با منبع، امتیاز، تخصیص خودکار (Round-robin/بر اساس قانون) | M |
| FR-SAL-02 | قیف قابل‌تعریف با مراحل، احتمال و SLA مرحله | M |
| FR-SAL-03 | فرصت فروش، مبلغ، تاریخ پیش‌بینی، دلیل باخت | M |
| FR-SAL-04 | کانبان Drag & Drop | M |
| FR-SAL-05 | محصول/خدمت، دسته‌بندی، لیست قیمت، تخفیف، کوپن | M |
| FR-SAL-06 | پیش‌فاکتور/پیشنهاد قیمت با نسخه، تأیید و خروجی PDF | M |
| FR-SAL-07 | تارگت فروش و داشبورد تحقق | S |
| FR-SAL-08 | محاسبه پورسانت (درصدی/پله‌ای/ترکیبی) و تأیید پرداخت | S |
| FR-SAL-09 | تبدیل خودکار سرنخ ← مشتری ← فرصت | M |
| FR-SAL-10 | پیش‌بینی فروش (Forecast) | C |

### ۵.۶ FR-ORD: سفارش و عملیات
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-ORD-01 | ثبت سفارش از کانال‌های مختلف (تلفن، سایت، اینستاگرام، فروشگاه) | M |
| FR-ORD-02 | چرخه وضعیت: ثبت ← تأیید ← آماده‌سازی ← ارسال ← تحویل ← بسته؛ لغو/مرجوعی | M |
| FR-ORD-03 | تاریخچه تغییر وضعیت (Append-only) | M |
| FR-ORD-04 | Snapshot قیمت و نام محصول در سفارش | M |
| FR-ORD-05 | ارسال جزئی، کد رهگیری، شرکت حمل | S |
| FR-ORD-06 | مرجوعی و استرداد | S |
| FR-ORD-07 | هشدار تأخیر (سفارش بدون تغییر > X ساعت، تحویل‌نشده بعد از تاریخ وعده) | M |
| FR-ORD-08 | انبار ساده: موجودی، حرکت، هشدار کمبود | C |
| FR-ORD-09 | Idempotency برای جلوگیری از ثبت دوباره | M |
| FR-ORD-10 | پیامک وضعیت خودکار در هر مرحله | M |
| FR-ORD-11 | پروژه/وظیفه/ثبت زمان (برای استقرار و خدمات) | S |
| FR-ORD-12 | قرارداد، تمدید و هشدار انقضا، لایسنس | S |

### ۵.۷ FR-APT: نوبت‌دهی
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-APT-01 | تعریف خدمت، مدت، فاصله بین نوبت‌ها، منبع (پزشک/اتاق/دستگاه) | M |
| FR-APT-02 | ساعات کاری هفتگی، مرخصی، تعطیلات (تقویم شمسی/رسمی) | M |
| FR-APT-03 | تقویم روزانه/هفتگی/ماهانه، Drag & Drop | M |
| FR-APT-04 | جلوگیری قطعی از رزرو همپوشان (در سطح DB) | M |
| FR-APT-05 | نوبت‌دهی آنلاین از سایت/لینک اختصاصی | S |
| FR-APT-06 | وضعیت‌ها: رزرو، تأیید، پذیرش، انجام، غیبت، لغو | M |
| FR-APT-07 | یادآوری ۲۴ ساعت و ۲ ساعت قبل + تأیید با پاسخ پیامک | M |
| FR-APT-08 | لیست انتظار و پر کردن خودکار نوبت لغوشده | C |
| FR-APT-09 | پیش‌بینی احتمال غیبت (AI) | C |
| FR-APT-10 | پیگیری پس از ویزیت (ویزیت کنترل، نظرسنجی) | M |
| FR-APT-11 | پرونده مراجع: فرم‌های پویا، پیوست عکس/آزمایش، رضایت‌نامه | M (کلینیک) |

### ۵.۸ FR-SUP: پشتیبانی
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-SUP-01 | تیکت از چند کانال (ایمیل، فرم سایت، پیامک، دستی، API) | M |
| FR-SUP-02 | اولویت، دسته، تخصیص، تیم، برچسب | M |
| FR-SUP-03 | SLA: زمان پاسخ اول و حل، ساعات کاری، هشدار پیش از نقض، Escalation | M |
| FR-SUP-04 | مکالمه، یادداشت داخلی، پاسخ آماده، پیوست | M |
| FR-SUP-05 | پایگاه دانش با نسخه‌بندی، پیشنهاد مقاله به کارشناس | M |
| FR-SUP-06 | شکایات و رسیدگی با ریشه‌یابی | S |
| FR-SUP-07 | نظرسنجی NPS/CSAT/CES خودکار | M |
| FR-SUP-08 | ادغام تیکت‌های مرتبط، تشخیص تکراری | S |
| FR-SUP-09 | پرتال مشتری (ثبت و پیگیری تیکت) | C |
| FR-SUP-10 | گزارش تحلیلی: زمان حل، ریشه‌های پرتکرار، بار کارشناس | M |

### ۵.۹ FR-WF: گردش کار (BPMS)
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-WF-01 | طراح گردش کار بصری (Stage، Transition، Condition) | M |
| FR-WF-02 | انواع گام: Task، Approval، Decision، Wait، Timer، Sub-process، End | M |
| FR-WF-03 | تخصیص به کاربر/نقش/تیم، Claim، Reassign | M |
| FR-WF-04 | تأیید چندمرحله‌ای (ترتیبی/موازی/یکی از چند نفر) | M |
| FR-WF-05 | SLA هر گام، هشدار و Escalation | M |
| FR-WF-06 | نسخه‌بندی (Draft/Published)؛ Instanceهای در جریان به نسخه خود می‌مانند | M |
| FR-WF-07 | ورود/خروج BPMN 2.0 (حداقل نمایش دیاگرام) | S |
| FR-WF-08 | تاریخچه کامل و تحلیل گلوگاه (Process Mining ساده) | S |
| FR-WF-09 | فرم اختصاصی هر گام | S |
| FR-WF-10 | فراخوانی اتوماسیون/Webhook در گام | M |
| FR-WF-11 | شبیه‌سازی/تست گردش کار قبل از انتشار | C |

### ۵.۱۰ FR-AUT: اتوماسیون
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-AUT-01 | قانون «اگر ← آنگاه»: Trigger (ایجاد، تغییر فیلد، تغییر مرحله، زمان‌بندی، Webhook، رویداد) | M |
| FR-AUT-02 | شرط‌های ترکیبی (AND/OR/NOT)، مقایسه فیلد، زمان نسبی (`now+24h`) | M |
| FR-AUT-03 | اکشن‌ها: پیامک، ایمیل، وظیفه، تغییر فیلد/مرحله، تخصیص، Webhook، AI Summary | M |
| FR-AUT-04 | قالب پیام با متغیر و پیش‌نمایش | M |
| FR-AUT-05 | جلوگیری از اجرای تکراری (Dedup/Cooldown) و حلقه بی‌نهایت | M |
| FR-AUT-06 | لاگ اجرا، دلیل Skip/Fail، اجرای مجدد دستی | M |
| FR-AUT-07 | حالت آزمایشی (Dry-run) | S |
| FR-AUT-08 | کتابخانه قانون‌های آماده برای هر Industry Pack | M |
| FR-AUT-09 | ساعات سکوت (Quiet Hours) و احترام به Opt-out | M |
| FR-AUT-10 | محدودیت نرخ و بودجه ارسال | S |

### ۵.۱۱ FR-NOT: اعلان
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-NOT-01 | کانال‌ها: پیامک، ایمیل، In-App، Push (PWA)، واتساپ/ایتا/بله (اختیاری) | M |
| FR-NOT-02 | صف با Retry، Backoff و Dead-letter | M |
| FR-NOT-03 | گزارش تحویل (Delivery Report) | S |
| FR-NOT-04 | ترجیحات کاربر/مشتری و Opt-out | M |
| FR-NOT-05 | قالب چندزبانه (فارسی/انگلیسی) | S |
| FR-NOT-06 | حالت شبیه‌ساز برای دمو (بدون ارسال واقعی) | M |

### ۵.۱۲ FR-MKT: بازاریابی و محتوا
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-MKT-01 | کمپین پیامکی/ایمیلی روی سگمنت، زمان‌بندی، A/B | S |
| FR-MKT-02 | ردیابی منبع سرنخ و UTM و Attribution | M |
| FR-MKT-03 | فرم‌ساز سایت (Embed/Webhook) ← Lead | M |
| FR-MKT-04 | **تقویم محتوا**: ایده ← پیش‌نویس ← بازبینی ← زمان‌بندی ← انتشار؛ پلتفرم، نوع (پست/ریل/استوری/مقاله)، مسئول | M |
| FR-MKT-05 | ثبت نتایج هر محتوا (Reach، Engagement، Lead) و گزارش مؤثرترین محتوا | S |
| FR-MKT-06 | کتابخانه دارایی (Asset Library) برای عکس/ویدیو با برچسب و مجوز استفاده | S |
| FR-MKT-07 | وضعیت رضایت برای تصاویر «قبل/بعد» (کلینیک) | M (کلینیک) |
| FR-MKT-08 | پیشنهاد ایده/کپشن با AI | C |

### ۵.۱۳ FR-FIN: مالی ساده
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-FIN-01 | فاکتور از سفارش/قرارداد، مالیات، تخفیف | M |
| FR-FIN-02 | پرداخت نقدی/کارت/آنلاین/چک/حواله و تخصیص به فاکتور | M |
| FR-FIN-03 | مطالبات و سن بدهی و یادآوری سررسید | M |
| FR-FIN-04 | اتصال درگاه پرداخت (Sandbox) و Callback امن | S |
| FR-FIN-05 | مدیریت چک (دریافتی/وصول/برگشت) | C |
| FR-FIN-06 | خروجی برای نرم‌افزار حسابداری (Excel/API) | S |

### ۵.۱۴ FR-RPT: گزارش و داشبورد
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-RPT-01 | داشبورد قابل‌شخصی‌سازی با ویجت (KPI، نمودار، جدول) | M |
| FR-RPT-02 | گزارش‌ساز بدون کد (فیلتر، گروه‌بندی، ستون‌ها) | M |
| FR-RPT-03 | خروجی Excel/PDF/CSV | M |
| FR-RPT-04 | ارسال زمان‌بندی‌شده به ایمیل | M |
| FR-RPT-05 | KPIهای آماده: نرخ تبدیل، سفارش دیرکرد، نرخ غیبت، NPS، SLA، فروش به تفکیک کارشناس/منبع، LTV، Churn | M |
| FR-RPT-06 | Drill-down و فیلتر تقویم شمسی | S |
| FR-RPT-07 | مدل ستاره‌ای و اتصال Power BI/Metabase | S |
| FR-RPT-08 | Cohort و Retention | C |

### ۵.۱۵ FR-INT: یکپارچگی و API
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-INT-01 | REST API کامل با OpenAPI، احراز هویت OAuth2/API Key | M |
| FR-INT-02 | Webhook خروجی با امضا (HMAC)، Retry | M |
| FR-INT-03 | Webhook ورودی (سایت، پیام‌رسان) با اعتبارسنجی | M |
| FR-INT-04 | افزونه وردپرس/اسکریپت فرم برای ارسال Lead و نوبت | S |
| FR-INT-05 | Import/Export Excel و CSV | M |
| FR-INT-06 | اتصال n8n/Zapier-compatible و **MCP Server** برای عامل‌های AI | S |
| FR-INT-07 | Rate Limiting و Quota در API | M |

### ۵.۱۶ FR-ADM: مدیریت سیستم
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-ADM-01 | پنل مدیر: کاربر، نقش، تنظیمات، Industry Pack، Feature Flag | M |
| FR-ADM-02 | مشاهده Audit Log با فیلتر و Export | M |
| FR-ADM-03 | مانیتور سلامت (DB، صف، Job، دیسک) | M |
| FR-ADM-04 | مدیریت Backup/Restore (نمایش وضعیت و آخرین تست) | S |
| FR-ADM-05 | Retention و حذف/ناشناس‌سازی داده شخص (درخواست حریم خصوصی) | S |
| FR-ADM-06 | Wizard مهاجرت از Excel/نرم‌افزار قبلی | M |
| FR-ADM-07 | داده Demo/Sandbox قابل‌تولید | M |

### ۵.۱۷ FR-UX: تجربه کاربری
| ID | نیازمندی | اولویت |
|---|---|---|
| FR-UX-01 | RTL کامل، فونت فارسی، اعداد فارسی/لاتین قابل‌انتخاب | M |
| FR-UX-02 | تقویم شمسی در تمام فیلدها، فیلترها و گزارش‌ها | M |
| FR-UX-03 | ریسپانسیو و PWA (نصب روی موبایل، حالت آفلاین سبک برای مشاهده) | S |
| FR-UX-04 | حالت تاریک/روشن | S |
| FR-UX-05 | میانبر صفحه‌کلید و Command Palette (Ctrl+K) | S |
| FR-UX-06 | دسترس‌پذیری WCAG 2.2 AA | M |
| FR-UX-07 | چندزبانه (fa/en) با i18n | S |
| FR-UX-08 | Onboarding تعاملی و راهنمای درون‌برنامه | S |
| FR-UX-09 | بارگذاری سریع، Skeleton، Optimistic UI | S |

---

## ۶. نیازمندی‌های غیرکارکردی (NFR)

### ۶.۱ عملکرد (Performance)
| ID | نیازمندی | هدف قابل‌اندازه‌گیری |
|---|---|---|
| NFR-PERF-01 | زمان پاسخ API (خواندن ساده) | p95 < 200ms |
| NFR-PERF-02 | لیست‌ها با Pagination و فیلتر | p95 < 300ms روی ۱M رکورد |
| NFR-PERF-03 | جستجوی سراسری | p95 < 400ms |
| NFR-PERF-04 | بارگذاری اولیه صفحه (LCP) | < 2.5s روی 4G |
| NFR-PERF-05 | پردازش صف اعلان | ≥ 100 پیام/ثانیه/Worker |
| NFR-PERF-06 | اجرای قانون اتوماسیون پس از Trigger | < 10s (رویدادی) / ≤ 1 دقیقه (زمان‌بندی) |
| NFR-PERF-07 | ایمپورت ۱۰۰ هزار ردیف Excel | < 5 دقیقه، پردازش Streaming |
| NFR-PERF-08 | گزارش‌های سنگین (Star Schema) | < 5s |
| NFR-PERF-09 | بودجه Core Web Vitals | CLS < 0.1، INP < 200ms |

### ۶.۲ مقیاس‌پذیری
| ID | نیازمندی |
|---|---|
| NFR-SCAL-01 | پشتیبانی از ≥ ۱۰۰۰ Tenant در مدل مشترک و ≥ ۱۰۰ کاربر همزمان به ازای Tenant بزرگ (در تست بار) |
| NFR-SCAL-02 | API بدون حالت (Stateless)؛ مقیاس افقی پشت Load Balancer |
| NFR-SCAL-03 | Workerها چندنمونه‌ای با Lease/Lock (بدون اجرای دوباره) |
| NFR-SCAL-04 | مهاجرت Tenant از مدل A ← B ← C بدون Downtime طولانی |
| NFR-SCAL-05 | Partitioning و Retention برای جداول رو به رشد |

### ۶.۳ دسترس‌پذیری و پایداری
| ID | هدف |
|---|---|
| NFR-AVL-01 | Solo/Small: Uptime ≥ 99.0% | Medium: ≥ 99.5% | Large: ≥ 99.9% |
| NFR-AVL-02 | RPO/RTO بر اساس سطح (جدول DB doc بخش ۱۵) |
| NFR-AVL-03 | Health Check (Liveness/Readiness)، Graceful Shutdown |
| NFR-AVL-04 | Circuit Breaker، Retry با Jitter، Timeout روی همه Callهای بیرونی (Polly/Resilience) |
| NFR-AVL-05 | Degradation ملایم: خرابی پیامک/AI نباید کل سیستم را از کار بیندازد |
| NFR-AVL-06 | Zero-downtime deploy (Blue/Green یا Rolling با IIS Warm-up/ARR) |

### ۶.۴ امنیت (خلاصه، جزئیات بخش ۱۱)
OWASP ASVS L2، OWASP Top 10 (2025)، رمزنگاری در انتقال و ذخیره، Least Privilege، Secret Management، Audit غیرقابل‌انکار.

### ۶.۵ حریم خصوصی و انطباق
- Privacy by Design، Data Minimization، رضایت‌نامه، حق دسترسی/اصلاح/حذف، Retention.
- مناسب با قوانین ایران (قانون تجارت الکترونیک، الزامات حفاظت از داده، الزامات داده سلامت)؛ **داده در داخل کشور** ذخیره شود.
- ISO 27001/27701-aligned و GDPR-aware (برای مشتریان بین‌المللی احتمالی) — به‌عنوان چارچوب، نه ادعای گواهی.

### ۶.۶ قابلیت نگهداری
| ID | نیازمندی |
|---|---|
| NFR-MNT-01 | پوشش تست واحد هسته ≥ 70%، موتورهای Workflow/Automation ≥ 85% |
| NFR-MNT-02 | Static Analysis (SonarQube/Roslyn Analyzers)، Linter، Formatter در CI |
| NFR-MNT-03 | Architecture Tests (NetArchTest) برای اجبار مرز ماژول‌ها |
| NFR-MNT-04 | ADR (Architecture Decision Record) برای تصمیم‌های مهم |
| NFR-MNT-05 | Dependency Scanning و به‌روزرسانی خودکار (Dependabot/Renovate)، SBOM |
| NFR-MNT-06 | Conventional Commits، Semantic Versioning، Changelog خودکار |
| NFR-MNT-07 | Feature Flag (OpenFeature) برای انتشار تدریجی |

### ۶.۷ قابلیت مشاهده (Observability)
| ID | نیازمندی |
|---|---|
| NFR-OBS-01 | Structured Logging (Serilog) با CorrelationId و TenantId (بدون PII) |
| NFR-OBS-02 | Distributed Tracing با OpenTelemetry (API ← DB ← Worker ← Provider) |
| NFR-OBS-03 | متریک‌ها: Latency، Error rate، Queue depth، Job lag، SLA breach |
| NFR-OBS-04 | داشبورد Grafana + هشدار (Alert) برای SLO |
| NFR-OBS-05 | SLI/SLO تعریف‌شده و Error Budget |
| NFR-OBS-06 | Audit و Security Event جدا از لاگ فنی |
| NFR-OBS-07 | Synthetic Monitoring (چک سلامت زمان‌بندی‌شده) |

### ۶.۸ قابلیت استفاده و دسترس‌پذیری
WCAG 2.2 AA، پشتیبانی کیبورد، Screen Reader، کنتراست، پیام خطای قابل‌فهم فارسی، زمان آموزش کاربر جدید < ۳۰ دقیقه برای عملیات روزمره.

### ۶.۹ بین‌المللی‌سازی
i18n کامل، RTL/LTR، تقویم شمسی/میلادی/قمری، ارز چندگانه (ریال/تومان نمایش، تبدیل)، منطقه زمانی، قالب اعداد/تاریخ، مرتب‌سازی فارسی (Collation).

### ۶.۱۰ قابلیت حمل و استقرار
IIS (هدف اصلی)، Docker (اختیاری)، Self-contained Publish، پیکربندی با Environment Variable، Infrastructure as Code، بدون وابستگی اجباری به Cloud.

### ۶.۱۱ تاب‌آوری عملیاتی
Backup خودکار + تست Restore، Runbook برای هر خطای رایج، DR Drill فصلی، Chaos ساده (قطع SMS/Redis/DB Replica در محیط تست).

### ۶.۱۲ هزینه و پایداری (FinOps / Green)
بهینه‌سازی منابع، Cache، Archive داده سرد، پایش مصرف توکن AI و Quota به ازای Tenant.

---

## ۷. بسته‌های صنعتی

هر بسته: **موجودیت‌ها + فیلدها + فرم‌ها + قیف/گردش کار + قوانین اتوماسیون + قالب پیام + گزارش‌ها + داده Demo** (فایل JSON نسخه‌دار + اسکریپت نصب Idempotent).

| بسته | سطح | محتوای کلیدی |
|---|---|---|
| **clinic** (کلینیک/مطب) | کامل | مراجع، پرونده، خدمات، پزشک، نوبت، رضایت‌نامه، یادآوری، ویزیت کنترل، NPS، تقویم محتوا، رضایت تصویر |
| **shop** (فروشگاه آنلاین) | کامل | محصول، سفارش، ارسال، مرجوعی، پیامک وضعیت، سبد رهاشده، خرید مجدد، کوپن |
| **software** (شرکت نرم‌افزاری/IT) | کامل | مشتری، لایسنس، پروژه استقرار، Deployment، تیکت SLA، پایگاه دانش، تمدید قرارداد |
| **b2b** (خدماتی/پیمانکار/عمده) | متوسط | سرنخ، پیشنهاد قیمت، قرارداد، پیگیری، نماینده |
| **education** (آموزشگاه) | سبک | دانشجو، دوره، کلاس، حضور و غیاب، تمدید |
| **realestate** (املاک/خودرو) | سبک | ملک/خودرو، بازدید، مذاکره، تطبیق |
| **salon** (آرایشگاه/باشگاه) | سبک | عضو، اشتراک، رزرو، تبریک تولد |
| **restaurant** | سبک | منو، سفارش، باشگاه مشتریان |
| **freelancer** | سبک | کلاینت، پروژه، فاکتور، یادآوری پرداخت |

**قابلیت Pack Builder:** ساخت بسته جدید از پیکربندی فعلی Tenant (Export as Pack).

---

## ۸. قابلیت‌های هوش مصنوعی (روز ۲۰۲۶)

> اصل: **AI دستیار است، نه تصمیم‌گیر نهایی**؛ Human-in-the-loop، شفافیت، کنترل هزینه، حریم خصوصی.

### ۸.۱ فهرست قابلیت‌ها
| ID | قابلیت | توضیح | اولویت |
|---|---|---|---|
| AI-01 | **دستیار گفتگویی RAG** | پرسش و پاسخ از داده و پایگاه دانش Tenant با ارجاع به منبع | M |
| AI-02 | **Text-to-SQL ایمن / Natural-language Query** | «مشتریانی که ۳ ماه نیامده‌اند»؛ تولید کوئری فقط‌خواندنی روی View مجاز با اعتبارسنجی | S |
| AI-03 | خلاصه‌سازی تیکت/تعامل/تاریخچه مشتری | یک‌خطی و کامل | M |
| AI-04 | پیشنهاد پاسخ به تیکت و دسته‌بندی/اولویت خودکار | با تأیید انسان | M |
| AI-05 | امتیازدهی سرنخ و پیش‌بینی Churn/No-show | مدل سبک (XGBoost/ML.NET) + توضیح‌پذیری | S |
| AI-06 | Next Best Action | پیشنهاد گام بعدی برای کارشناس | C |
| AI-07 | تحلیل احساس (Sentiment) پیام‌ها | فارسی | S |
| AI-08 | تولید پیش‌نویس پیام/کپشن/ایده ریلز | با لحن برند | S |
| AI-09 | استخراج اطلاعات از متن آزاد/رسید/فرم (OCR + LLM) | | C |
| AI-10 | **Agent / Tool-calling**: عامل با ابزارهای محدود (ایجاد وظیفه، جستجوی مشتری) با تأیید کاربر | | S |
| AI-11 | **MCP Server** برای اتصال عامل‌های خارجی به API سیستم | | S |
| AI-12 | تشخیص تکراری هوشمند (Embedding) برای Dedup | | C |
| AI-13 | تبدیل گفتار به متن مکالمه تلفنی و خلاصه (STT فارسی) | | C |
| AI-14 | ساخت گردش کار/قانون اتوماسیون از توضیح متنی | «اگر نوبت غیبت شد، ... » ← پیش‌نویس JSON | C |

### ۸.۲ معماری AI
```
UI/API ──► AI Gateway (Policy، Quota، Redaction، Cache، Routing)
              ├─► مدل‌های محلی/خودمیزبان (Open-weight: Llama/Qwen/Gemma/Mistral via Ollama/vLLM) 
              ├─► مدل‌های ابری (اختیاری، با رضایت Tenant)
              └─► Embedding + Vector Store (SQL Server VECTOR / pgvector / Qdrant)
RAG: Ingestion ← Chunking ← Embedding ← Index ← Retrieve (Hybrid BM25+Vector) ← Rerank ← Generate + Citations
```
- **ایمنی:** حذف/ماسک PII پیش از ارسال به مدل بیرونی، تشخیص Prompt Injection، فیلتر خروجی، محدودیت ابزار (Allow-list)، **اجرای ACL در Retrieval** (کاربر فقط داده مجاز خود را ببیند).
- **کیفیت:** مجموعه ارزیابی (Eval set) فارسی، متریک Faithfulness/Relevance، نسخه‌بندی پرامپت، A/B، LLM-as-judge + بازبینی انسانی.
- **هزینه:** Quota توکن به ازای Tenant/پلن، Cache معنایی، مدل کوچک برای کارهای ساده.
- **شفافیت:** برچسب «تولیدشده توسط AI»، لاگ ورودی/خروجی (Redacted)، امکان خاموش‌کردن AI در Tenant.
- **قابلیت اطمینان:** Fallback بدون AI (سیستم بدون AI هم کامل کار کند).

---

## ۹. زیرساخت، استقرار و DevOps

### ۹.۱ مهارت‌های استقرار (برای آگهی BPMS)
| حوزه | محتوا |
|---|---|
| **Windows Server 2022/2025** | نصب نقش‌ها (IIS، .NET Hosting Bundle)، Services، Task Scheduler، Event Viewer، Performance Monitor، Firewall، RDP امن، Group Policy پایه، Windows Update Policy |
| **IIS** | Site/Binding، Application Pool (Identity، Recycling، Idle Timeout، Rapid-fail)، SSL/TLS (Let's Encrypt/ACME یا CA داخلی)، URL Rewrite، ARR (Reverse Proxy/Load Balancing)، Compression، Request Filtering، HSTS، لاگ و تحلیل، Failed Request Tracing، خطاهای ۴۰۳/۴۰۴/۴۰۵/۴۱۳/۵۰۰.۱۹/۵۰۲.۵ و رفع آن‌ها |
| **SQL Server** | نصب و Configuration (MaxMemory، TempDB، MAXDOP، Cost Threshold)، Collation، Login/User/Role، SQL Agent Job، Maintenance، Backup/Restore، Always On، Query Store، Extended Events، Alert |
| **PowerShell** | اسکریپت نصب خودکار، DSC، Pester Test، Idempotent، Log |
| **شبکه** | DNS، DHCP، Subnet، NAT، Port، VPN، Reverse Proxy، Latency |
| **Linux/Container (مهارت جدید)** | Docker Compose برای Redis/MinIO/Grafana؛ Ubuntu Server پایه |
| **Runbook و SOP** | مستند هر عملیات: نصب، ارتقا، Rollback، Restore، پاسخ به حادثه |

### ۹.۲ اسکریپت‌های استقرار (خروجی)
1. `Install-Prereqs.ps1` — IIS، .NET Hosting، URL Rewrite، ARR، SQL Express/Developer، ابزارها
2. `Initialize-Database.ps1` — ساخت DB، اجرای Migration، Seed، کاربران با حداقل دسترسی
3. `Deploy-App.ps1` — ساخت Site/AppPool، Binding، Certificate، Environment Variables، Smoke Test
4. `Backup-Setup.ps1` — Job Backup + تست Restore + گزارش
5. `Healthcheck.ps1` — بررسی سرویس‌ها و ارسال هشدار
6. `Rollback.ps1` — بازگشت به نسخه قبل (Blue/Green یا Backup)
7. `Migrate-FromExcel.ps1/.py` — مهاجرت داده مشتری

### ۹.۳ CI/CD
```
Push → Lint/Format → Build → Unit Test → Static Analysis (SAST) → Dependency Scan (SCA) → Secret Scan
     → Integration Test (Testcontainers + SQL Server) → DB Migration Test → Docker/Publish Artifact
     → Deploy Staging (خودکار) → E2E (Playwright) + Smoke → Manual Approval → Deploy Prod (Blue/Green) → Post-deploy Check
```
- **Trunk-based** یا GitFlow ساده، PR Template، Code Review اجباری، Branch Protection، Conventional Commits.
- **محیط‌ها:** Dev، Staging، Prod (و Sandbox برای آموزش).
- **Supply Chain Security:** SBOM (CycloneDX)، امضای Artifact، قفل نسخه وابستگی، Dependabot.
- **IaC:** Ansible/DSC/Terraform برای ساخت محیط تکرارپذیر.

### ۹.۴ Observability و عملیات
- OpenTelemetry (Trace/Metric/Log) ← Prometheus + Grafana + Loki/Tempo (یا Seq).
- هشدار SLO: Error rate، Latency، Queue lag، Job failure، Disk، Backup failure، SLA breach.
- **Incident Management:** سطح‌بندی (SEV1–4)، On-call ساده، **Postmortem بدون سرزنش** با Action Item.
- **Capacity Planning:** پایش رشد DB و Queue.

---

## ۱۰. یکپارچگی‌ها

| سرویس | روش | یادداشت |
|---|---|---|
| پیامک ایرانی (کاوه‌نگار، ملی‌پیامک، …) | API Provider Abstraction | Adapter + Mock/Sandbox |
| ایمیل | SMTP/API | |
| واتساپ Business / ایتا / بله / تلگرام | Provider Adapter (اختیاری) | رعایت سیاست پلتفرم و رضایت |
| درگاه پرداخت (زرین‌پال، IDPay، …) | Sandbox + Callback امن + Verify | هرگز اعتماد به Callback بدون Verify |
| وردپرس/وب‌سایت | افزونه/Webhook/REST | |
| تقویم (ICS/Google/Outlook) | ICS Feed، OAuth | |
| حسابداری (هلو، سپیدار، …) | خروجی Excel/API | |
| BI | Power BI/Metabase روی View/Replica | |
| پیام‌رسان داخلی/Slack/Teams | Webhook | |
| n8n / Automation | Webhook + Custom Node | |
| تلفن/VoIP (Asterisk/Issabel) | Click-to-call، ثبت تماس | C |
| احراز هویت | OIDC (Keycloak)/AD/LDAP | |

**الگوی Provider:** `ISmsProvider`, `IPaymentGateway`… با Circuit Breaker، Fallback Provider، Timeout و Idempotency.

---

## ۱۱. امنیت و حریم خصوصی

### ۱۱.۱ چارچوب
OWASP ASVS L2، OWASP Top 10، OWASP API Security Top 10، CIS Benchmarks (Windows/SQL/IIS)، STRIDE Threat Modeling، Zero Trust.

### ۱۱.۲ کنترل‌ها
| دسته | کنترل |
|---|---|
| **احراز هویت** | Argon2id، MFA، Passkeys/WebAuthn (امکان)، Session کوتاه + Refresh Rotation، قفل حساب |
| **مجوزدهی** | RBAC + ABAC (شعبه/مالکیت)، Check در Service Layer، RLS در DB، تست مجوز خودکار |
| **ورودی/خروجی** | اعتبارسنجی Schema، پارامتری‌سازی، Encoding، CSP، Anti-CSRF، CORS سخت |
| **API** | Rate Limit، Quota، IDOR Protection (PublicId + بررسی Tenant)، Mass-assignment Protection، Pagination سقف‌دار |
| **رمزنگاری** | TLS 1.2+/1.3، HSTS، TDE، Always Encrypted، رمزنگاری فیلدهای حساس، مدیریت کلید (Key Rotation) |
| **Secrets** | Vault/DPAPI/Secret Store؛ هرگز در Git |
| **لاگ و ممیزی** | Audit تغییرناپذیر، DataAccessLog، SIEM-ready |
| **زیرساخت** | Hardening ویندوز/IIS (حذف هدرهای Server، غیرفعال کردن پروتکل‌های قدیمی)، Patch Management، Least Privilege، Network Segmentation |
| **Supply Chain** | SCA، SBOM، Pin versions |
| **Backup امن** | رمزگذاری، آفسایت، تست Restore |
| **AI Security** | Prompt Injection، Data Leakage، Tool Abuse، Output Handling (OWASP LLM Top 10) |
| **پاسخ به حادثه** | Playbook (نشت داده، حساب مخرب، باج‌افزار)، اطلاع‌رسانی |
| **تست امنیتی** | SAST، DAST (OWASP ZAP)، Pen-test ساده، Dependency Scan |

### ۱۱.۳ حریم خصوصی
- طبقه‌بندی داده (Public/Internal/Confidential/PII/Health).
- رضایت‌نامه و لاگ، حق دسترسی/اصلاح/حذف/Export (Data Subject Request).
- ناشناس‌سازی و Pseudonymization برای داده تست.
- **داده سلامت (کلینیک):** حداقل‌سازی، رمزنگاری، ثبت دسترسی، عدم افشا در لاگ/AI بدون رضایت.

---

## ۱۲. تست و تضمین کیفیت

| نوع | ابزار | هدف |
|---|---|---|
| Unit | xUnit/NUnit، FluentAssertions | منطق دامنه، موتور Workflow/Automation |
| Integration | Testcontainers (SQL Server)، WebApplicationFactory | API + DB واقعی |
| Contract | Pact/OpenAPI Diff | سازگاری API |
| DB | **tSQLt**، Migration Test، Schema Drift | SP، Trigger، Constraint |
| E2E/UI | **Playwright** | سناریوهای کلیدی (RTL، تقویم شمسی) |
| Performance/Load | **k6/JMeter** | NFR-PERF، Soak، Spike |
| Security | OWASP ZAP، Semgrep، Trivy | |
| Accessibility | axe-core، Lighthouse | WCAG |
| Chaos/Resilience | قطع Provider/Redis | Degradation ملایم |
| Mutation Testing | Stryker.NET | کیفیت تست (اختیاری) |
| Property-based | FsCheck | قوانین Automation/Workflow |
| UAT | سناریوی کاربری با پرسونا | پذیرش |
| AI Eval | مجموعه ارزیابی فارسی | کیفیت RAG |

**Test Data:** Bogus/Faker فارسی، ۱K / ۱۰۰K / ۱M رکورد، نسخه Anonymized.
**Test Pyramid:** ۷۰٪ واحد، ۲۰٪ یکپارچه، ۱۰٪ E2E.

---

## ۱۳. مستندات و خروجی‌های نمونه‌کار

| # | خروجی | توضیح |
|---|---|---|
| 1 | **README** (فارسی/انگلیسی) | معرفی، معماری، اجرای سریع |
| 2 | **SRS** (همین سند) + **DB Design** | |
| 3 | **ADRها** | تصمیم‌های معماری با دلیل |
| 4 | **ERD و Data Dictionary** | خودکار |
| 5 | **C4 Model** | Context/Container/Component |
| 6 | **BPMN** | ۳+ فرایند (پذیرش، سفارش، شکایت) + As-Is/To-Be |
| 7 | **OpenAPI** | مستند API + Postman Collection |
| 8 | **Runbook نصب و ارتقا** | مرحله‌به‌مرحله با اسکرین‌شات |
| 9 | **راهنمای کاربر نهایی** | PDF تصویری ۱۰+ صفحه |
| 10 | **ویدیوی آموزشی و دمو** | ۵ دقیقه + ۳ ویدیوی کوتاه |
| 11 | **پایگاه دانش نمونه** | ۱۵+ مقاله |
| 12 | **Case Study** | مسئله ← راه‌حل ← نتیجه (با عدد شبیه‌سازی‌شده) |
| 13 | **Postmortem نمونه** | یک «حادثه» شبیه‌سازی‌شده |
| 14 | **سایت معرفی (وردپرس)** + **پیج اینستاگرام نمونه** | محتوا و ریل «پشت‌صحنه» |
| 15 | **گزارش Benchmark** | قبل/بعد بهینه‌سازی TSQL، تست بار |
| 16 | **Threat Model** | STRIDE + کنترل‌ها |
| 17 | **Changelog و Release Notes** | |
| 18 | **اسکریپت‌های PowerShell و CI** | |

---

## ۱۴. ماتریس مهارت‌ها

### ۱۴.۱ مهارت‌های خواسته‌شده در آگهی‌ها
| مهارت | سطح هدف | کجا در پروژه |
|---|---|---|
| نصب/استقرار/آموزش/پشتیبانی | پیشرفته | بخش ۹، ۱۳ |
| Windows (کاربردی و Server) | پیشرفته | ۹.۱ |
| IIS | پیشرفته | ۹.۱ |
| مفاهیم پایگاه داده | پیشرفته | DB doc |
| **TSQL / SQL Server** | پیشرفته | DB doc |
| BPMS / BPMN / گردش کار | پیشرفته | FR-WF |
| CRM (ساخت، پیکربندی، استفاده) | پیشرفته | FR-CRM/SAL/AUT |
| Excel (Pivot، XLOOKUP، Power Query، Import/Export) | متوسط تا پیشرفته | FR-RPT، Import |
| پشتیبانی سایت (وردپرس) | متوسط | سایت دمو، Webhook |
| تولید محتوا، تدوین ریلز، طراحی، ویرایش عکس/ویدیو | متوسط | FR-MKT، پیج نمونه |
| ثبت دقیق داده و رازداری | پیشرفته | FR-CRM، امنیت |
| مهارت ارتباطی، مشتری‌مداری، پیگیری سفارش، مدیریت شکایت | پیشرفته | FR-SUP، اسکریپت‌های تماس |
| کار تیمی، مسئولیت‌پذیری، نتیجه‌محوری | — | Git/PR، KPI |
| فروش و پورسانت | متوسط | FR-SAL |

### ۱۴.۲ مهارت‌های فراتر و به‌روز ۲۰۲۶
| دسته | مهارت |
|---|---|
| **AI/LLM Engineering** | RAG، Embedding، Vector Search، Prompt Engineering، Evals، Guardrails، Tool-calling/Agents، **MCP**، مدل‌های Open-weight و Self-hosting، AI Gateway، هزینه توکن |
| **AI-assisted Development** | کار با دستیارهای کدنویسی (Claude Code و مشابه)، بازبینی کد تولیدشده، Prompting برای تست/Refactor، مستندسازی خودکار |
| **Automation** | n8n، Power Automate، Workflow Engines (Elsa/Camunda)، Event-driven Automation |
| **Backend مدرن** | .NET 10، Minimal API، CQRS، DDD، Modular Monolith، Outbox/Saga، Resilience (Polly)، gRPC، SignalR |
| **Frontend مدرن** | React 19/TypeScript، TanStack Query، Design System، PWA، RTL/i18n، Core Web Vitals، Accessibility |
| **Data** | SQL Server پیشرفته (Temporal، RLS، Ledger، JSON، Vector)، Star Schema، ETL/ELT، CDC، Columnstore، Power BI/Metabase، dbt (آشنایی) |
| **DevOps/Platform** | CI/CD، IaC، Docker، (آشنایی Kubernetes)، GitOps، SBOM، Secrets Management |
| **Observability/SRE** | OpenTelemetry، Grafana، SLI/SLO، Error Budget، Incident Response، Postmortem، Chaos Basics |
| **Security** | OWASP ASVS/API/LLM Top 10، Threat Modeling، Zero Trust، Hardening (CIS)، Pen-test پایه، Privacy Engineering |
| **Cloud-readiness** | معماری 12-Factor، قابلیت انتقال به Cloud (Azure/AWS) بدون قفل‌شدن |
| **Product & Business** | User Story، Jobs-To-Be-Done، Story Mapping، OKR/KPI، Customer Success، Onboarding، Pricing/Packaging، Analytics Product (Funnel/Cohort) |
| **BA/Process** | BPMN 2.0، DMN (جدول تصمیم)، Process Mining مقدماتی، As-Is/To-Be، Requirements (SRS/BRD) |
| **UX** | Figma، Design Tokens، Usability Test، Microcopy فارسی |
| **Content/Growth** | کپی‌رایتینگ، SEO فنی، Short-form Video، Analytics، A/B Test |
| **Soft Skills** | مستندنویسی، ارائه، مذاکره، مدیریت زمان، Customer Empathy، Async Collaboration |

---

## ۱۵. نقشه راه و فازبندی

| فاز | هفته | خروجی | معیار تحویل |
|---|---|---|---|
| **۰ — پایه** | ۱ | Repo، CI، ADR، زیرساخت، اسکریپت نصب | یک‌کلیک نصب روی VM |
| **۱ — هسته** | ۲–۳ | Tenant، IAM، RBAC، Audit، RLS، Migration | تست ایزولاسیون Tenant |
| **۲ — پیکربندی پویا** | ۴ | Entity/Field Builder، فرم، نما | ساخت موجودیت جدید بدون کد |
| **۳ — CRM و فروش** | ۵–۶ | مشتری، تعامل، قیف، محصول، پیش‌فاکتور | سناریوی ۲ |
| **۴ — سفارش و نوبت** | ۷ | سفارش، وضعیت، نوبت، Slot ضد همپوشانی | سناریوی ۱ و ۲ |
| **۵ — پشتیبانی** | ۸ | تیکت، SLA، KB، نظرسنجی | SLA Breach واقعی |
| **۶ — Workflow و Automation** | ۹–۱۰ | موتورها، اعلان، Outbox، Scheduler | سناریوی ۴ و ۸ |
| **۷ — گزارش و داشبورد** | ۱۱ | KPI، گزارش‌ساز، Export | NFR-PERF-08 |
| **۸ — Industry Packs** | ۱۲ | clinic، shop، software + ۳ سبک | نصب با ویزارد |
| **۹ — AI** | ۱۳–۱۴ | RAG، خلاصه، دسته‌بندی، Text-to-SQL ایمن | Eval ≥ هدف |
| **۱۰ — سخت‌سازی** | ۱۵ | امنیت، بار، Observability، DR | چک‌لیست NFR |
| **۱۱ — مستندات و نمایش** | ۱۶ | ویدیو، سایت، پیج، Case Study، رزومه‌ها | بخش ۱۳ |

**MVP (۸ هفته):** فاز ۰–۵ + یک بسته (clinic یا shop) + اتوماسیون پایه (یادآوری + پیامک وضعیت).
**اولویت اگر زمان کم است:** هسته ← CRM/سفارش/نوبت ← اتوماسیون ← تیکت ← بسته صنعتی ← گزارش ← AI.

---

## ۱۶. ریسک‌ها

| ریسک | احتمال | اثر | کاهش |
|---|---|---|---|
| دامنه بسیار بزرگ (Scope Creep) | بالا | بالا | MVP، فازبندی، «Must» اول، ۳ بسته کامل |
| پیچیدگی Workflow/Field پویا | متوسط | بالا | شروع ساده (JSON)، یا ابزار آماده (Elsa/EspoCRM) |
| محدودیت سرویس خارجی (پیامک/AI/Cloud) در ایران | بالا | متوسط | Provider Abstraction، Mock، مدل Self-hosted |
| ضعف عملکرد روی داده زیاد | متوسط | بالا | Index، Benchmark از ابتدا، Star Schema |
| نشت داده بین Tenant | کم | بحرانی | FK مرکب، RLS، تست خودکار ایزولاسیون |
| وابستگی بیش‌ازحد به AI | متوسط | متوسط | Fallback بدون AI، Human-in-the-loop |
| خستگی/ناتمامی پروژه | بالا | بالا | تحویل هفتگی، Demo هفتگی، MVP |
| ادعای بیش‌ازحد در رزومه | متوسط | بالا | فقط آنچه توضیح‌پذیر است؛ «پروژه شخصی» |
| قوانین حریم خصوصی/داده سلامت | متوسط | بالا | داده فرضی، Privacy by Design |

---

## ۱۷. معیار پذیرش و تعریف «انجام شد»

### ۱۷.۱ Definition of Done (هر قابلیت)
- [ ] کد Review شده و Merge
- [ ] تست واحد/یکپارچه سبز، پوشش مطابق NFR
- [ ] Migration تست‌شده و Rollback‌پذیر
- [ ] مجوزها و Audit پیاده‌شده
- [ ] اعتبارسنجی و پیام خطای فارسی
- [ ] RTL/تقویم شمسی بررسی‌شده
- [ ] Log/Trace/Metric افزوده
- [ ] مستندات (README/Runbook/OpenAPI) به‌روز
- [ ] اسکن امنیتی بدون یافته بحرانی/بالا
- [ ] Demo کوتاه ضبط‌شده

### ۱۷.۲ معیار پذیرش نهایی پروژه
1. نصب روی VM تازه با اسکریپت در < ۲۰ دقیقه، بدون دخالت دستی.
2. راه‌اندازی Tenant کلینیک با ویزارد در < ۱۰ دقیقه و اجرای سناریوهای ۱، ۴، ۵، ۸.
3. راه‌اندازی Tenant فروشگاه و اجرای سناریوی ۲ + اتوماسیون پیامک وضعیت.
4. راه‌اندازی Tenant نرم‌افزاری و اجرای سناریوی ۳ (مهاجرت از Excel) + تیکت SLA.
5. تست ایزولاسیون: کاربر Tenant A با هیچ روشی (UI/API/SQL Injection شبیه‌سازی‌شده) داده Tenant B را نمی‌بیند.
6. تست بار با ۱M مشتری، پاسخ مطابق NFR-PERF.
7. Backup و Restore موفق با گزارش.
8. دستیار AI به ≥ ۸۰٪ سؤالات مجموعه ارزیابی پاسخ صحیح با ارجاع می‌دهد و از داده Tenant دیگر چیزی نشان نمی‌دهد.
9. همه خروجی‌های بخش ۱۳ منتشر شده است.

---

## ۱۸. نحوه معرفی در رزومه و مصاحبه

### ۱۸.۱ یک‌خط (Elevator)
> «ClientFlow: پلتفرم ماژولار CRM و گردش کار روی IIS/SQL Server، چندمستاجری، با فیلد/فرم پویا، موتور Workflow و Automation، بسته‌های صنعتی (کلینیک، فروشگاه، نرم‌افزاری) و دستیار RAG؛ شامل اسکریپت استقرار خودکار، Observability و مستندات کامل.»

### ۱۸.۲ تأکید به تفکیک آگهی
| هدف | تیتر | برجسته کنید |
|---|---|---|
| **BPMS/استقرار** | «استقرار و پشتیبانی پلتفرم تحت وب با Workflow» | PowerShell، IIS، SQL Agent، Runbook، Migration از Excel، تیکت و SLA، آموزش |
| **CRM** | «طراحی CRM قابل‌پیکربندی با اتوماسیون پیگیری سفارش و رضایت» | سفارش، پیامک وضعیت، NPS، Excel، داشبورد |
| **کلینیک/پشتیبانی سایت** | «سامانه نوبت، پرونده، سایت و محتوای دیجیتال کلینیک» | Webhook سایت، رازداری، تقویم محتوا، ریلز |
| **BA/مدیر محصول** | «تحلیل نیازمندی و طراحی پلتفرم» | SRS، BPMN، User Story، KPI |
| **Data/BI** | «مدل داده و گزارش‌گیری» | TSQL، Star Schema، Benchmark |
| **AI Automation** | «دستیار RAG و اتوماسیون مبتنی بر AI» | Eval، Guardrail، MCP، Cost control |

### ۱۸.۳ پرسش‌های محتمل مصاحبه (آماده باشید)
1. FK مرکب TenantId چرا؟ RLS دقیقاً چطور کار می‌کند؟
2. چطور از Double-Booking جلوگیری کردید؟
3. Outbox چه مشکلی را حل می‌کند؟ اگر Worker وسط کار بمیرد؟
4. چرا JSON برای فیلد پویا؟ چطور Index کردید؟
5. یک کوئری کند را چطور تشخیص و رفع کردید؟ (عدد قبل/بعد)
6. چطور مطمئن می‌شوید AI داده Tenant دیگر را نشان نمی‌دهد؟
7. اگر مشتری خطای ۵۰۰.۱۹ یا ۵۰۲.۵ در IIS داد چه می‌کنید؟
8. Restore را تست کرده‌اید؟ RPO/RTO چقدر است؟
9. چرا Modular Monolith و نه Microservices؟
10. اگر امروز بخواهید یک چیز را بازنویسی کنید، کدام؟ (نشانه بلوغ)

### ۱۸.۴ صداقت حرفه‌ای
- پروژه را **«پروژه شخصی/نمونه‌کار»** معرفی کنید؛ اعداد را «نتیجه شبیه‌سازی/Benchmark» بنامید.
- فقط بخش‌هایی را بنویسید که واقعاً ساخته‌اید و می‌توانید زنده توضیح دهید.
- بهتر است «۳ بخش عمیق» را قوی نشان دهید تا «۳۰ بخش سطحی».

---

## ۱۹. واژه‌نامه

| اصطلاح | معنی |
|---|---|
| **Tenant** | یک کسب‌وکار/سازمان مشتری در پلتفرم |
| **RLS** | Row-Level Security؛ فیلتر خودکار سطر در دیتابیس |
| **RBAC/ABAC** | کنترل دسترسی مبتنی بر نقش/ویژگی |
| **BPMS/BPMN** | سامانه مدیریت فرایند / نمادگذاری مدل‌سازی فرایند |
| **SLA/SLO/SLI** | توافق/هدف/شاخص سطح خدمت |
| **Outbox/Inbox** | الگوی ارسال/دریافت مطمئن رویداد |
| **Idempotency** | اجرای چندباره = یک اثر |
| **RAG** | تولید پاسخ با بازیابی از منابع |
| **MCP** | Model Context Protocol؛ پروتکل اتصال ابزار/داده به عامل‌های AI |
| **Temporal Table** | جدول تاریخچه‌دار سیستمی در SQL Server |
| **ADR** | سند تصمیم معماری |
| **IaC** | زیرساخت به‌صورت کد |
| **SBOM** | فهرست اجزای نرم‌افزار |
| **NPS/CSAT/CES** | شاخص‌های رضایت و تلاش مشتری |
| **Industry Pack** | بسته پیکربندی مخصوص یک صنعت |
| **Human-in-the-loop** | تأیید انسان بر خروجی AI |

---

### پیوست الف — فهرست مهارت‌ها برای کپی در رزومه (کلیدواژه ATS)

**استقرار و پشتیبانی:** Deployment، Implementation، Technical Support، Troubleshooting، Runbook، SLA، Ticketing، Training، Documentation، Migration
**زیرساخت:** Windows Server، IIS، SSL/TLS، PowerShell، Active Directory (آشنایی)، Networking، Docker (آشنایی)
**دیتابیس:** SQL Server، T-SQL، Stored Procedure، Indexing، Query Optimization، Backup/Restore، SQL Agent، RLS، Temporal Tables، Star Schema، ETL
**BPM/CRM:** BPMS، BPMN 2.0، Workflow Automation، CRM Customization، Sales Pipeline، Customer Success، NPS/CSAT
**توسعه:** C#، .NET، ASP.NET Core، REST API، OpenAPI، EF Core، React، TypeScript، SignalR
**DevOps/امنیت:** CI/CD، GitHub Actions، IaC، OpenTelemetry، Grafana، OWASP، Threat Modeling، RBAC، Audit
**AI:** LLM، RAG، Embeddings، Vector Search، Prompt Engineering، AI Agents، MCP، Guardrails، n8n
**محتوا و وب:** WordPress، SEO، Content Calendar، Instagram Reels، CapCut/Premiere، Photoshop، Canva
**آنالیز:** Excel (Pivot، Power Query)، Power BI، KPI، Requirements Analysis، User Stories

---

*پایان سند — برای جزئیات مدل داده به فایل `ClientFlow_Database_Design.md` مراجعه کنید.*
