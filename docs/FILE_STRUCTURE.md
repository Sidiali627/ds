# FILE_STRUCTURE.md

# هيكلة مشروع استوديو صحة الشباب
## Youth Health Studio

---

# الهدف

هذا الملف يشرح وظيفة جميع المجلدات والملفات داخل المشروع.

أي ملف جديد يجب أن يوضع في مكانه الصحيح.

عدم إنشاء ملفات عشوائية.

---

# هيكل المشروع

Youth Health Studio

│

├── index.html

├── about.html

├── articles.html

├── article.html

├── videos.html

├── podcasts.html

├── academy.html

├── surveys.html

├── consultations.html

├── appointments.html

├── campaigns.html

├── events.html

├── volunteers.html

├── certificates.html

├── gallery.html

├── contact.html

├── login.html

├── register.html

├── forgot-password.html

├── reset-password.html

├── dashboard.html

├── profile.html

├── settings.html

├── admin/

├── assets/

├── css/

├── js/

├── images/

├── icons/

├── fonts/

├── documents/

├── uploads/

└── README.md

---

# الصفحات العامة

## index.html

الصفحة الرئيسية.

---

## about.html

صفحة التعريف بالجمعية والنادي.

---

## articles.html

عرض جميع المقالات.

---

## article.html

عرض مقال واحد.

---

## videos.html

عرض الفيديوهات.

---

## podcasts.html

عرض البودكاست.

---

## academy.html

أكاديمية الصحة.

---

## surveys.html

الاستبيانات.

---

## consultations.html

الاستشارات.

---

## appointments.html

حجز المواعيد.

---

## campaigns.html

الحملات.

---

## events.html

الفعاليات.

---

## volunteers.html

بوابة المتطوعين.

---

## certificates.html

الشهادات.

---

## gallery.html

معرض الصور.

---

## contact.html

التواصل.

---

# المصادقة

## login.html

تسجيل الدخول.

---

## register.html

إنشاء حساب.

---

## forgot-password.html

استعادة كلمة المرور.

---

## reset-password.html

إعادة تعيين كلمة المرور.

---

# بوابة المستخدم

## dashboard.html

لوحة المستخدم.

---

## profile.html

الملف الشخصي.

---

## settings.html

إعدادات المستخدم.

---

# لوحة الإدارة

مجلد:

admin/

يحتوي على:

Dashboard

Users

Roles

Articles

Videos

Podcasts

Academy

Consultations

Appointments

Events

Campaigns

Volunteers

Certificates

Media

Messages

Notifications

Reports

Analytics

CMS

SEO

Settings

Audit Logs

System

---

# مجلد CSS

css/

يحتوي على:

style.css

variables.css

components.css

layout.css

responsive.css

animations.css

dark-mode.css

admin.css

forms.css

tables.css

dashboard.css

---

# مجلد JavaScript

js/

يحتوي على:

app.js

auth.js

supabase.js

config.js

security.js

cms.js

dashboard.js

profile.js

consultations.js

events.js

surveys.js

academy.js

volunteers.js

notifications.js

messages.js

analytics.js

charts.js

helpers.js

utils.js

validators.js

---

# مجلد الصور

images/

يحتوي على:

Logo

Hero

Articles

Events

Campaigns

Users

Gallery

Icons

Backgrounds

---

# مجلد الأيقونات

icons/

جميع أيقونات المشروع.

---

# مجلد الخطوط

fonts/

الخطوط الرسمية للمشروع.

---

# مجلد المستندات

documents/

يحتوي على:

الشهادات

ملفات PDF

الأدلة

النماذج

---

# مجلد الرفع

uploads/

يحفظ الملفات المرفوعة مؤقتاً قبل إرسالها إلى Supabase Storage.

---

# ملفات الإعداد

README.md

شرح المشروع.

AI_CONTEXT.md

شرح المشروع بالكامل.

DESIGN_SYSTEM.md

نظام التصميم.

ADMIN_CONTEXT.md

شرح لوحة الإدارة.

DATABASE_CONTEXT.md

قاعدة البيانات.

SECURITY.md

الحماية.

DEVELOPMENT_RULES.md

قواعد التطوير.

API_REFERENCE.md

واجهات البرمجة.

ROADMAP.md

خطة المشروع.

BRAND_GUIDELINES.md

الهوية البصرية.

COMPONENTS.md

مكتبة المكونات.

CMS_REFERENCE.md

مرجع نظام إدارة المحتوى.

FILE_STRUCTURE.md

هيكل المشروع.

---

# قواعد إنشاء الملفات

أي ملف جديد يجب أن:

• يحمل اسماً واضحاً.

• يوضع داخل المجلد المناسب.

• يكون موثقاً.

• يكون مرتبطاً بالملفات الأخرى عند الحاجة.

• لا يكرر وظيفة ملف موجود.

---

# الهدف النهائي

أي مطور أو ذكاء اصطناعي يستطيع فهم هيكل المشروع بالكامل بمجرد قراءة هذا الملف، ومعرفة مكان كل صفحة، وكل ملف، وكل مكون، دون الحاجة إلى استكشاف المشروع يدوياً.