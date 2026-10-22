import { canManageYouthHouse, isAdminRole, normalizeRole } from './roles.js';

export const YOUTH_HOUSE_WORKFLOW_STATUSES = ['draft', 'pending_review', 'approved', 'published', 'rejected', 'changes_requested', 'archived'];
export const YOUTH_HOUSE_PUBLIC_STATUSES = ['approved', 'published'];

export function getPublicVisibilityStatuses() {
    return [...YOUTH_HOUSE_PUBLIC_STATUSES];
}

export function canAccessYouthHouseManager(session, role) {
    if (!session?.user?.id) return false;
    return canManageYouthHouse(role);
}

export function canEditYouthHouseRecord(record, sessionUserId, role) {
    if (!record || !sessionUserId) return false;
    if (isAdminRole(role)) return true;
    return record.manager_user_id === sessionUserId;
}

export function sanitizeYouthHouseText(value, max = 500) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function validateYouthHousePayload(payload = {}) {
    const errors = [];
    const slug = sanitizeYouthHouseText(payload.slug, 120).toLowerCase();
    const nameAr = sanitizeYouthHouseText(payload.name_ar, 180);
    const wilayaName = sanitizeYouthHouseText(payload.wilaya_name, 100);
    const communeName = sanitizeYouthHouseText(payload.commune_name, 100);
    const phone = sanitizeYouthHouseText(payload.phone, 40);

    if (!nameAr || nameAr.length < 3) errors.push('الاسم العربي مطلوب ويجب أن يكون 3 أحرف على الأقل.');
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push('المعرّف (slug) يجب أن يكون بحروف لاتينية صغيرة وأرقام وشرطات فقط.');
    if (phone && !/^[+0-9()\-\s]{6,40}$/.test(phone)) errors.push('رقم الهاتف غير صالح.');
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) errors.push('البريد الإلكتروني غير صالح.');
    if (payload.website_url && !/^https?:\/\//i.test(payload.website_url)) errors.push('رابط الموقع يجب أن يبدأ بـ http:// أو https://');
    if (!wilayaName) errors.push('الولاية مطلوبة.');
    if (!communeName) errors.push('البلدية مطلوبة.');

    return {
        isValid: errors.length === 0,
        errors,
        sanitized: {
            slug,
            name_ar: nameAr,
            name_fr: sanitizeYouthHouseText(payload.name_fr, 180),
            summary: sanitizeYouthHouseText(payload.summary, 1200),
            wilaya_code: sanitizeYouthHouseText(payload.wilaya_code, 8),
            wilaya_name: wilayaName,
            commune_name: communeName,
            address_line: sanitizeYouthHouseText(payload.address_line, 300),
            phone,
            email: sanitizeYouthHouseText(payload.email, 180).toLowerCase(),
            website_url: sanitizeYouthHouseText(payload.website_url, 255)
        }
    };
}

export function applyYouthHouseFilters(rows = [], { search = '', wilaya = '', commune = '' } = {}) {
    const needle = sanitizeYouthHouseText(search, 120).toLowerCase();
    const wilayaNeedle = sanitizeYouthHouseText(wilaya, 120).toLowerCase();
    const communeNeedle = sanitizeYouthHouseText(commune, 120).toLowerCase();

    return rows.filter((row) => {
        const haystack = [row.name_ar, row.name_fr, row.slug].map((v) => String(v || '').toLowerCase()).join(' ');
        if (needle && !haystack.includes(needle)) return false;
        if (wilayaNeedle && String(row.wilaya_name || '').toLowerCase() !== wilayaNeedle) return false;
        if (communeNeedle && String(row.commune_name || '').toLowerCase() !== communeNeedle) return false;
        return true;
    });
}

export function paginateYouthHouses(rows = [], page = 1, pageSize = 9) {
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (safePage - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return { items, total, totalPages, page: safePage, pageSize };
}

export { normalizeRole };
