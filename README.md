# جدول | Jadval Studio

کارگاه داخلی طراحی جدول فارسی؛ بانک سؤال‌وجواب، دریافت آرشیو دارای مجوز، طراحی جدول، بازبینی و تحویل خروجی نهایی به [پیام جدول](https://github.com/nimania/payamejadval).

## وضعیت اجرا (مرحلهٔ واردسازی)
- `fetch_archive.py`: خواندن فهرست `catalog/index` و همهٔ بسته‌های `puzzlePacks/*` جدول انار از Firestore، سپس ذخیرهٔ مستقل هر جدول JSON.
- `build_database.py`: استخراج سؤال و جواب از جدول‌های JSON و ساخت پایگاه SQLite مستقل همراه با جدول‌های `puzzles`، `entries` و `occurrences`.
- `import_puzzles.py`: واردکنندهٔ محلی فایل‌های JSON دارای مجوز.
- `generate.py`: نمونهٔ اولیهٔ موتور تولید جدول (کیفیت خروجی هنوز برای انتشار خودکار تأیید نشده است).
- `sample.json`: نمونهٔ آزمایشی.

**داده‌های واقعی هنوز وارد نشده‌اند.** برای شروع انتقال باید گردش‌کار را از GitHub Actions اجرا کنیم.

## اجرای دریافت کامل آرشیو
۱. نیازی به تهیهٔ کلید یا ساخت Secret نیست؛ کلید عمومی وب Firebase از پیکربندی منتشرشدهٔ جدول انار استفاده می‌شود. این کلید مجوز دسترسی اضافه‌ای نمی‌دهد.
۲. در [Actions](https://github.com/nimania/jadval/actions/workflows/import-archive.yml)، گردش‌کار **Import licensed crossword archive** را با `Run workflow` اجرا کنید.
۳. خروجی اجرای موفق را از بخش **Artifacts** همان اجرا دریافت کنید: پوشهٔ `archive/raw` شامل جدول‌های اصلی JSON، فایل `archive/jadval.sqlite` شامل بانک استخراج‌شده و `archive/report.json` شامل آمار واقعی است.

**نکتهٔ حفاظت از داده:** آرشیو واقعی در این مرحله در git push نمی‌شود و فقط به شکل artifact با مدت نگهداری ۳۰ روز موجود است. برای نگهداری دائمی باید مخزن خصوصی/فضای ذخیره‌سازی مناسب تنظیم شود. پایگاه Firebase منبع تغییری نمی‌کند. اگر Firestore دریافت را رد کند، دسترسی معتبر یا خروجی پشتیبان از مالک داده لازم خواهد بود.

## اجرای محلی
```bash
python3 fetch_archive.py --output archive/raw
python3 build_database.py --archive archive/raw --db archive/jadval.sqlite --report archive/report.json
python3 generate.py --input sample.json --size 15 --count 3
```

## مرز انتشار
`nimania/jadval` فقط ابزار داخلی است. بانک خام، همهٔ پاسخ‌ها، و پیش‌نویس‌ها نباید به وب‌سایت مخاطبان ارسال شوند. `nimania/payamejadval` فقط جدول‌های انتخاب و تأییدشده را نمایش می‌دهد.

## کارهای باقیمانده
- اجرای موفق دریافت واقعی و خواندن گزارش شمارش جدول‌ها و مدخل‌ها.
- ساخت پنل دسته‌بندی و ویرایشگر حرفه‌ای راست‌به‌چپ.
- ارتقای الگوریتم تولید و اعتبارسنجی جدول‌های کامل.
- طراحی سازوکار انتشار جدول‌های تأییدشده از jadval به payamejadval.
