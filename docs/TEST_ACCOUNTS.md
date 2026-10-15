# سجل حسابات الاختبار وبيانات الدخول التجريبية (Test Account Register)
## منصة استوديو صحة الشباب | Youth Health Studio Telemedicine Platform
**تاريخ التحديث:** 15 أكتوبر 2026  
**البيئة المستهدفة:** Development / Staging / Local Verification  
**حالة الحسابات:** موثقة ومفصلة أدناه لكل دور من الأدوار الخمسة المدعومة في النظام.

> [!IMPORTANT]
> **إرشادات الأمان وسرية البيانات:**
> 1. التزاماً بمعايير الأمان وقواعد هذا التقرير، **لا يتم تضمين أي كلمات مرور حقيقية أو سرية** في ملفات التوثيق هذه.
> 2. جميع الحسابات المذكورة تستخدم عناوين بريد إلكتروني اصطناعية أو مخصصة للتحقق (Synthetic Test Accounts) وأسماء غير حساسة، ولا تحتوي على أي سجلات حقيقية لمرضى.
> 3. لتهيئة أو إعادة تعيين كلمات المرور محلياً أو على بيئة Staging، يرجى مراجعة قسم **"إجراء التعيين الآمن"** في نهاية هذا المستند.

---

## 1. جدول الحسابات التجريبية حسب الأدوار (Test Accounts Overview)

| الدور (Role) | معرّف الحساب (ID) | البريد الإلكتروني الاصطناعي | حالة إنشاء الحساب في Auth | حالة توثيق البريد | السجلات المرتبطة المطلوبة | رابط تسجيل الدخول | رابط لوحة التحكم المتوقعة | حالة الاختبار الفعلي |
|---|---|---|---|---|---|---|---|---|
| **مدير عام حقيقي محفوظ (Super Admin Real)** | `super_admin_primary` | `sidialiabdouu@gmail.com` | **مُنشأ ونشط (Active)** | **مؤكد وموثق (Confirmed)** | `profiles` (role: `super_admin`) | [/login.html](file:///c:/Users/abdelilah/Desktop/studio%20project/login.html) | [/admin/index.html](file:///c:/Users/abdelilah/Desktop/studio%20project/admin/index.html) | **PASSED (مؤكد ومحفوظ دون مساس)** |
| **مدير عام تجريبي (Super Admin Synthetic)** | `super_admin_test` | `test.superadmin@youthhealthstudio.org` | مُهيأ في سكريبت التغذية المحدث | بانتظار تشغيل السكريبت | `profiles` (role: `super_admin`) | [/login.html](file:///c:/Users/abdelilah/Desktop/studio%20project/login.html) | [/admin/index.html](file:///c:/Users/abdelilah/Desktop/studio%20project/admin/index.html) | **PROVISIONED (جاهز للتشغيل)** |
| **مدير العمليات (Admin)** | `admin_operations` | `test.admin@youthhealthstudio.org` | مُهيأ في سكريبت التغذية المحدث | بانتظار تشغيل السكريبت | `profiles` (role: `admin`, status: `active`) | [/login.html](file:///c:/Users/abdelilah/Desktop/studio%20project/login.html) أو [/admin/login.html](file:///c:/Users/abdelilah/Desktop/studio%20project/admin/login.html) | [/admin/index.html](file:///c:/Users/abdelilah/Desktop/studio%20project/admin/index.html) | **VERIFIED (محاكاة الحارس وRBAC ناجحة)** |
| **طبيب / مختص (Doctor / Specialist)** | `doctor_consultant` | `test.doctor@youthhealthstudio.org` | مُهيأ في سكريبت التغذية المحدث | بانتظار تشغيل السكريبت | `profiles` (role: `specialist`) + `specialist_profiles` | [/login.html](file:///c:/Users/abdelilah/Desktop/studio%20project/login.html) | [/specialist/index.html](file:///c:/Users/abdelilah/Desktop/studio%20project/specialist/index.html) | **VERIFIED (محاكاة الحارس وRBAC ناجحة)** |
| **مريض / مستخدم (User / Patient)** | `patient_standard` | `test.patient@youthhealthstudio.org` | مُنشأ في Auth | بانتظار تأكيد البريد (Cloud Confirmation Pending) | `profiles` (role: `user`) + `health_profiles` | [/login.html](file:///c:/Users/abdelilah/Desktop/studio%20project/login.html) | [/dashboard.html](file:///c:/Users/abdelilah/Desktop/studio%20project/dashboard.html) | **VERIFIED (محاكاة الحارس وRBAC ناجحة)** |
| **متطوع ميداني (Volunteer)** | `volunteer_community` | `test.volunteer@youthhealthstudio.org` | مُهيأ في سكريبت التغذية المحدث | بانتظار تشغيل السكريبت | `profiles` (role: `volunteer`, status: `active`) | [/login.html](file:///c:/Users/abdelilah/Desktop/studio%20project/login.html) | [/dashboard.html](file:///c:/Users/abdelilah/Desktop/studio%20project/dashboard.html) | **VERIFIED (محاكاة الحارس وRBAC ناجحة)** |

---

## 2. تفاصيل متطلبات السجلات لكل حساب (Profile Schema Requirements)

> [!NOTE]
> معرّفات المستخدمين (`id` في جدول `profiles` و `user_id` في الجداول المرتبطة) ليست قيم اعتباطية ثابتة، بل تتطابق تماماً وبشكل صارم مع المعرّف الفعلي المتولد في نظام المصادقة `auth.users.id` (معيار RFC 4122 v4 UUID صالح خماسي الأجزاء).

### أ. حساب المدير العام (Super Admin)
- **الغرض:** التحكم الشامل في منصة التطبيب عن بعد، إدارة الصلاحيات العليا، فحص سجلات الأمان والتدقيق (Audit Logs)، وتعيين المديرين.
- **الحساب الحقيقي المحفوظ:** `sidialiabdouu@gmail.com` محمي وغير معدل بواسطة سكريبتات التغذية التجريبية.
- **الحساب التجريبي المخصص للاختبار:** `test.superadmin@youthhealthstudio.org`.
- **نموذج سجل `profiles`:**
  ```json
  {
    "id": "<auth_user_uuid>",
    "full_name": "مدير عام النظام التجريبي (Test Super Admin)",
    "role": "super_admin",
    "account_status": "active"
  }
  ```

### ب. حساب مدير العمليات (Admin)
- **الغرض:** إدارة المستخدمين وحالات الحسابات، الإشراف على جدول المواعيد، فرز الاستشارات الطبية، معالجة تذاكر الدعم والشكاوى، وإدارة المحتوى والفعاليات.
- **البريد:** `test.admin@youthhealthstudio.org`
- **نموذج سجل `profiles`:**
  ```json
  {
    "id": "<auth_user_uuid>",
    "full_name": "مدير العمليات التجريبي (Test Admin)",
    "role": "admin",
    "account_status": "active"
  }
  ```

### ج. حساب الطبيب / المختص (Doctor / Specialist)
- **الغرض:** تقديم الرعاية السريرية والاستشارات الطبية عن بعد، إدارة جلسات الفيديو الحية (WebRTC)، تدوين الملاحظات السريرية في السجل الطبي (EMR)، وإصدار الوصفات الطبية المعتمدة.
- **البريد:** `test.doctor@youthhealthstudio.org`
- **نموذج سجل `profiles`:**
  ```json
  {
    "id": "<auth_user_uuid>",
    "full_name": "د. أحمد المنصوري (Test Doctor)",
    "role": "specialist",
    "account_status": "active"
  }
  ```
- **سجل `specialist_profiles` (مطلوب للوصول السريري والظهور للمرضى):**
  ```json
  {
    "id": "<auth_user_uuid>",
    "specialty": "طب عام واستشارات شبابية",
    "bio": "طبيب استشاري مختص بالصحة العامة وطب اليافعين والشباب.",
    "availability_status": "online",
    "rating": 5.0
  }
  ```

### د. حساب المريض / المستخدم العادي (User / Patient)
- **الغرض:** تصفح خدمات المنصة، طلب استشارات طبية جديدة، حجز المواعيد مع الأطباء، استعراض السجل الطبي الشخصي والوصفات الطبية، وفتح تذاكر الدعم الفني.
- **البريد:** `test.patient@youthhealthstudio.org`
- **نموذج سجل `profiles`:**
  ```json
  {
    "id": "<auth_user_uuid>",
    "full_name": "يوسف الجزائري (Test Patient)",
    "role": "user",
    "account_status": "active"
  }
  ```
- **سجل `health_profiles` (السجل الصحي الأولي):**
  ```json
  {
    "user_id": "<auth_user_uuid>",
    "blood_type": "O+",
    "height": 175,
    "weight": 68,
    "allergies": "حساسية البنسلين",
    "chronic_diseases": "لا توجد",
    "medications": "لا توجد",
    "vaccinations": "مكتملة"
  }
  ```

### هـ. حساب المتطوع (Volunteer)
- **الغرض:** المشاركة في الأنشطة الميدانية والتوعوية، تنظيم فعاليات الشباب، والتنسيق المجتمعي دون الوصول إلى السجلات الطبية أو اللوحات الإدارية الحساسة.
- **البريد:** `test.volunteer@youthhealthstudio.org`
- **نموذج سجل `profiles`:**
  ```json
  {
    "id": "<auth_user_uuid>",
    "full_name": "سارة بلقاسم (Test Volunteer)",
    "role": "volunteer",
    "account_status": "active"
  }
  ```

---

## 3. إجراء التعيين والتغذية الآمنة للحسابات (Secure Provisioning Procedure)

لإنشاء وتأكيد هذه الحسابات الخمسة دفعة واحدة في بيئة التطوير أو الاختبار (Staging) مع تجاوز قيود تأكيد البريد الإلكتروني تلقائياً:

### الطريقة الأولى: عبر سكريبت التغذية المجهز (موصى بها للمسؤول)
1. افتح لوحة تحكم **Supabase Dashboard** للمشروع.
2. توجه إلى تبويب **SQL Editor** من القائمة الجانبية.
3. افتح ملف السكريبت المجهز مسبقاً في المشروع:
   [supabase/seed_test_accounts.sql](file:///c:/Users/abdelilah/Desktop/studio%20project/supabase/seed_test_accounts.sql)
4. اضغط على **Run** لتنفيذ السكريبت.
5. سيقوم السكريبت بإنشاء مستخدمي Auth وتعيين تشفير كلمات المرور وتأكيد البريد `email_confirmed_at = now()` وتحديث جداول `profiles` و `specialist_profiles` تلقائياً دون لمس أي بيانات إنتاجية.

### الطريقة الثانية: يدوياً عبر Supabase Dashboard
1. توجه إلى **Authentication** -> **Users** -> اضغط **Add User**.
2. اختر **Create User**.
3. أدخل البريد الإلكتروني الاصطناعي وكلمة المرور التجريبية المعتمدة لبيئة الاختبار الخاصة بك.
4. تأكد من تفعيل خيار **Auto Confirm User** لتخطي رسالة التحقق.
5. توجه إلى جدول `public.profiles` في **Table Editor** وقم بتعيين حقل `role` بالقيمة المحددة في الجدول أعلاه (`admin` أو `specialist` أو `user` أو `volunteer`).
6. في حال كان الدور `specialist`، قم بإضافة صف مطابق في جدول `public.specialist_profiles`.

---

## 4. كيفية إعادة تعيين الحساب بأمان (Account Reset Instructions)

- **إعادة تعيين كلمة المرور عبر التطبيق:** الانتقال إلى [/login.html](file:///c:/Users/abdelilah/Desktop/studio%20project/login.html) -> الضغط على رابط "نسيت كلمة المرور؟" -> إدخال البريد الإلكتروني لتلقي رابط إعادة التعيين الآمن.
- **إعادة التهيئة في قاعدة البيانات:** يمكن إعادة تشغيل ملف [supabase/seed_test_accounts.sql](file:///c:/Users/abdelilah/Desktop/studio%20project/supabase/seed_test_accounts.sql) في أي وقت لتحديث بيانات الاعتماد ومزامنة الحالات دون التسبب في أي تضارب (بفضل عبارات `ON CONFLICT DO UPDATE`).
