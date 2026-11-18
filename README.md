# ClientFlow

پلتفرم ساده و ماژولار مدیریت مشتری (CRM) با نوبت‌دهی، سفارش، پیگیری و اتوماسیون؛ مناسب کلینیک، فروشگاه و کسب‌وکارهای کوچک.

> 🚧 وضعیت: اسکلت اولیه (فاز ۱: پروتوتایپ فرانت‌اند با داده نمونه)

## اجرا

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## ساختار

```
clientflow/
├─ index.html
├─ metadata.json            # برای Google AI Studio
├─ package.json / vite.config.ts / tsconfig.json
├─ AI_STUDIO_PROMPT.md      # پرامپت آماده برای ساخت صفحات
├─ src/
│  ├─ main.tsx, App.tsx     # لی‌اوت RTL با سایدبار
│  ├─ types.ts              # مدل داده
│  ├─ data/seed.ts          # داده فرضی اولیه
│  ├─ utils/jalali.ts       # تاریخ شمسی
│  ├─ utils/overlap.ts      # جلوگیری از نوبت همپوشان + اعتبارسنجی موبایل
│  └─ pages/                # صفحات (توسط AI ساخته می‌شود)
├─ docs/                    # نیازمندی‌ها و طراحی دیتابیس
├─ backend/                 # فاز ۲: ASP.NET Core
├─ database/                # فاز ۲: SQL Server
└─ scripts/                 # فاز ۲: PowerShell استقرار
```

## نقشه راه
- [x] اسکلت پروژه
- [ ] فاز ۱: صفحات MVP (مشتری، نوبت، سفارش، پیگیری، تیکت، اتوماسیون، داشبورد)
- [ ] فاز ۲: بک‌اند ASP.NET Core + SQL Server + IIS
- [ ] فاز ۳: Workflow، بسته‌های صنعتی، AI

جزئیات کامل: `docs/ClientFlow_Project_Specification.md` و `docs/ClientFlow_Database_Design.md`

## نکته
همه داده‌ها فرضی هستند. هیچ داده واقعی مشتری/بیمار وارد نشود.

## مجوز
MIT
