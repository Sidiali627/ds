# دليل التثبيت والتهيئة والتشغيل التشغيلي (Setup, Deployment & Testing Guide)
## استوديو صحة الشباب | Youth Health Studio Telemedicine Platform
**تاريخ التوثيق:** 15 أكتوبر 2026  
**الهدف:** توفير دليل عملي وتشغيلي شامل لكيفية إعداد المشروع محلياً، نشره على بيئات الاستضافة، ومزامنة إعدادات Supabase، وتشغيل الاختبارات.

---

## 1. دليل متغيرات البيئة (Environment Variables Reference)

يحتوي ملف [.env.example](file:///c:/Users/abdelilah/Desktop/studio%20project/.env.example) على النموذج الرسمي لمتغيرات البيئة المطلوبة:

| اسم المتغير (Variable Name) | النطاق (Scope) | مطلوب في المتصفح؟ | الوصف والغرض |
|---|---|:---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` أو `SUPABASE_URL` | عام / Client & Server | **نعم** | عنوان مشروع Supabase API الخاص بالمنصة (مثال: `https://xyz.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` أو `SUPABASE_ANON_KEY` | عام / Client & Server | **نعم** | المفتاح العام (Anon/Publishable Key) الآمن للاستخدام المباشر في المتصفح مع RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | سيرفر فقط (Server-Only) | **لا (محظور في المتصفح)** | مفتاح الصلاحيات الكاملة لعمليات الصيانة السيرفرية الخلفية الحصرية. |
| `RESEND_API_KEY` | سيرفر فقط (Server-Only) | **لا** | مفتاح الربط مع خدمة Resend لإرسال رسائل البريد الإلكتروني للمرضى والأطباء. |
| `EMAIL_FROM` | سيرفر فقط (Server-Only) | **لا** | اسم وعنوان البريد الإلكتروني المرسل (مثال: `Youth Health Studio <notifications@domain.org>`). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | سيرفر فقط (Server-Only) | **لا** | إعدادات خادم SMTP البديل في حال عدم استخدام Resend API. |

> [!CAUTION]
> **تحذير أمني صارم:** لا تقم أبداً بتضمين `SUPABASE_SERVICE_ROLE_KEY` أو كلمات مرور قواعد البيانات داخل كود الواجهات (Frontend) أو ملفات HTML/JS العامة.

---

## 2. الإعداد والتشغيل المحلي (Local Development Setup)

### المتطلبات المسبقة:
- بيئة تشغيل **Node.js** (الإصدار 18 فما فوق).
- خادم ويب محلي بسيط (Live Server أو `npx serve` أو `python -m http.server`).

### خطوات التشغيل:
1. **استنساخ المستودع والانتقال للمجلد:**
   ```bash
   cd "studio project"
   ```
2. **تثبيت التبعيات السيرفرية واختبارات الجودة (اختياري / لتشغيل حزم الفحص):**
   ```bash
   npm install
   ```
3. **تهيئة ملف البيئة المحلي:**
   ```bash
   cp .env.example .env
   ```
   *(قم بوضع بيانات مشروع Supabase الخاص بك في ملف `.env`)*
4. **تشغيل خادم الويب المحلي:**
   ```bash
   npx -y serve -l 3000 .
   ```
5. **الوصول للمنصة في المتصفح:**
   - بوابة الزوار والموقع العام: `http://localhost:3000/index.html`
   - تسجيل الدخول الموحد: `http://localhost:3000/login.html`
   - لوحة الإدارة: `http://localhost:3000/admin/index.html`
   - لوحة الأطباء: `http://localhost:3000/specialist/index.html`

---

## 3. تهيئة منصة Supabase السحابية (Supabase Cloud Configuration)

لضمان عمل كافة ميزات الاستشارات والسجلات الطبية وتذاكر الدعم بكفاءة كاملة:

### أ. تطبيق ترحيلات الجداول وسياسات RLS:
1. توجه إلى لوحة تحكم **Supabase Dashboard** للمشروع.
2. انتقل إلى **SQL Editor** -> اضغط على **New Query**.
3. قم بتنفيذ ملفات الترحيل المتوفرة في مجلد `supabase/migrations/` بالترتيب الزمني، وبشكل خاص:
   - [20240101000014_specialist_portal.sql](file:///c:/Users/abdelilah/Desktop/studio%20project/supabase/migrations/20240101000014_specialist_portal.sql): جداول الاستشارات والعيادات والسجلات الطبية.
   - [20240101000018_emr_and_health_records_hardening.sql](file:///c:/Users/abdelilah/Desktop/studio%20project/supabase/migrations/20240101000018_emr_and_health_records_hardening.sql): جداول EMR وملفات الحالات والتدوينات السريرية.
   - [20240101000019_prescriptions_and_printable_reports.sql](file:///c:/Users/abdelilah/Desktop/studio%20project/supabase/migrations/20240101000019_prescriptions_and_printable_reports.sql): الوصفات المهيكلة والتقارير القابلة للطباعة.
   - [20240101000020_notifications_and_email_hardening.sql](file:///c:/Users/abdelilah/Desktop/studio%20project/supabase/migrations/20240101000020_notifications_and_email_hardening.sql): الإشعارات وسجلات البريد.
   - [20240101000021_user_management_and_rbac_hardening.sql](file:///c:/Users/abdelilah/Desktop/studio%20project/supabase/migrations/20240101000021_user_management_and_rbac_hardening.sql): إدارة المستخدمين والصلاحيات والأدوار وزيادة التحصين.
   - [20240101000022_support_center_and_complaints.sql](file:///c:/Users/abdelilah/Desktop/studio%20project/supabase/migrations/20240101000022_support_center_and_complaints.sql): نظام تذاكر الدعم الفني والشكاوى والملاحظات الداخلية.

### ب. إعدادات روابط إعادة التوجيه (Auth Redirect URLs):
في لوحة Supabase: **Authentication** -> **URL Configuration**:
- **Site URL:** رابط موقعك المنشور (مثال: `https://youthhealthstudio.org`).
- **Redirect URLs:** أضف العناوين التالية:
  - `https://youthhealthstudio.org/dashboard.html`
  - `https://youthhealthstudio.org/login.html`
  - `https://youthhealthstudio.org/admin/index.html`
  - `https://youthhealthstudio.org/specialist/index.html`
  - وللتطوير المحلي: `http://localhost:3000/**` و `http://127.0.0.1:5500/**`.

### ج. تهيئة التغذية السريعة لحسابات الاختبار:
قم بتشغيل ملف [supabase/seed_test_accounts.sql](file:///c:/Users/abdelilah/Desktop/studio%20project/supabase/seed_test_accounts.sql) في نافذة SQL Editor لإنشاء وتأكيد الحسابات التجريبية للأدوار الخمسة فورياً.

---

## 4. إعداد المهام الخلفية المجدولة (Cron / Background Workers)

- **خدمة التذكير بالمواعيد الطبية:**
  - الملف: [services/reminder_service.js](file:///c:/Users/abdelilah/Desktop/studio%20project/services/reminder_service.js)
  - الغرض: فحص المواعيد القادمة خلال الـ 24 ساعة القادمة وإرسال تذكيرات عبر البريد وإشعارات المنصة تلقائياً مع منع التكرار.
  - إعداد مهمة Cron (كل 15 دقيقة):
    ```bash
    */15 * * * * cd /path/to/project && node services/reminder_service.js >> /var/log/yhs_reminders.log 2>&1
    ```

---

## 5. دليل تشغيل حزم الاختبار وضمان الجودة (Running Automated Tests)

يحتوي مجلد `scratch/` على حزم اختبارات آلية شاملة ومستقلة:

### 1. تشغيل حزمة تدقيق الجاهزية الشاملة (Phase 12 Audit):
```bash
node scratch/final_audit_inspection.cjs
```
*(يفحص البنية، الروابط، ملفات JS، سياسات RLS، وحراس المسارات والاتصال الفعلي بقاعدة البيانات)*

### 2. تشغيل حزمة اختبارات مركز الدعم والشكاوى (Phase 11):
```bash
node scratch/test_phase11_support.cjs
```
*(يختبر 57 سيناريو لعزل التذاكر، سرية الملاحظات الداخلية، والتحقق من صحة المدخلات)*

### 3. تشغيل حزمة اختبارات الصلاحيات وإدارة المستخدمين (Phase 10):
```bash
node scratch/test_phase10_rbac.cjs
```
*(يختبر 57 سيناريو لمنع الترقية الذاتية، حظر الحسابات، وفصل صلاحيات المشرف عن المدير العام)*

### 4. تشغيل الحزمة الكلية العامة للمنصة (Full Platform QA Suite):
```bash
node scratch/qa_full_suite.cjs
```
*(يختبر 73 سيناريو للتنقل، المصادقة، التجاوب العربي RTL، وعمليات الاستشارات والمواعيد)*

---

## 6. استكشاف الأخطاء وحلولها الشائعة (Troubleshooting)

| المشكلة المرصودة | السبب المحتمل | الحل الموصى به |
|---|---|---|
| **رسالة "Email not confirmed" عند تسجيل الدخول** | خيار تأكيد البريد مفعل في Supabase Cloud والحساب لم يضغط رابط التحقق. | إما تفعيل خيار Auto-Confirm في إعدادات Supabase Auth، أو تشغيل سكريبت `supabase/seed_test_accounts.sql` الذي يضبط `email_confirmed_at = now()`. |
| **رسالة "403 غير مصرح بالوصول" عند فتح لوحة الإدارة** | الحساب المسجل لا يمتلك دور `admin` أو `super_admin` في جدول `profiles`. | مراجعة جدول `profiles` وتعيين `role = 'admin'` أو استخدام حساب المدير العام الموثق. |
| **تعذر الاتصال بـ Supabase (Failed to fetch)** | حظر جدار ناري محلي، انقطاع الاتصال، أو عدم ضبط `SUPABASE_URL`. | التحقق من مفتاح Anon والاتصال في [js/config.js](file:///c:/Users/abdelilah/Desktop/studio%20project/js/config.js) وضمان إمكانية الوصول إلى نطاق Supabase. |
| **عدم ظهور الملاحظة الداخلية للمستخدم في مركز الدعم** | هذا هو السلوك الأمني المتوقع والصحيح 100% بموجب سياسة RLS ومحددات الخصوصية. | الملاحظات الإدارية الداخلية مخصصة حصرياً لفريق العمل ولا تظهر لأصحاب التذاكر نهائياً. |
