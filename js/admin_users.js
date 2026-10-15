// admin_users.js - Comprehensive User Management & Role-Based Access Control System
import { supabase } from './supabase.js';

// Application State
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
let itemsPerPage = 10;
let currentAdminId = null;
let currentAdminRole = 'admin';

// Currently Selected Users for Modals
let currentEditingUser = null;
let currentStatusUser = null;
let currentDetailUser = null;
let pendingConfirmCallback = null;

// DOM Elements
const tbody = document.getElementById('users-tbody');
const searchInput = document.getElementById('searchInput');
const roleFilter = document.getElementById('roleFilter');
const statusFilter = document.getElementById('statusFilter');
const sortBySelect = document.getElementById('sortBy');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const refreshUsersBtn = document.getElementById('refreshUsersBtn');
const exportUsersBtn = document.getElementById('exportUsersBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const activeFilterCountText = document.getElementById('activeFilterCountText');

// Pagination Elements
const pageInfo = document.getElementById('pagination-info');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const pageNumbers = document.getElementById('pageNumbers');

// Stat Elements
const statTotalUsers = document.getElementById('statTotalUsers');
const statSpecialists = document.getElementById('statSpecialists');
const statAdmins = document.getElementById('statAdmins');
const statVolunteers = document.getElementById('statVolunteers');
const statRestricted = document.getElementById('statRestricted');

// Role Modal Elements
const roleModal = document.getElementById('roleEditModal');
const closeRoleModalBtn = document.getElementById('closeRoleModalBtn');
const cancelRoleModalBtn = document.getElementById('cancelRoleModalBtn');
const saveRoleBtn = document.getElementById('saveRoleBtn');
const modalRoleSelect = document.getElementById('modalRoleSelect');
const optSuperAdmin = document.getElementById('optSuperAdmin');
const selfRoleWarning = document.getElementById('selfRoleWarning');
const superAdminRestrictedNotice = document.getElementById('superAdminRestrictedNotice');

// Status Modal Elements
const statusModal = document.getElementById('statusEditModal');
const closeStatusModalBtn = document.getElementById('closeStatusModalBtn');
const cancelStatusModalBtn = document.getElementById('cancelStatusModalBtn');
const saveStatusBtn = document.getElementById('saveStatusBtn');
const modalStatusSelect = document.getElementById('modalStatusSelect');
const modalStatusNote = document.getElementById('modalStatusNote');
const selfStatusWarning = document.getElementById('selfStatusWarning');

// Details Modal Elements
const profileModal = document.getElementById('profileDetailsModal');
const closeDetailsModalBtn = document.getElementById('closeDetailsModalBtn');
const closeDetailsModalBtn2 = document.getElementById('closeDetailsModalBtn2');
const saveProfileDetailsBtn = document.getElementById('saveProfileDetailsBtn');
const copyUserIdBtn = document.getElementById('copyUserIdBtn');
const viewFullCrmLink = document.getElementById('viewFullCrmLink');

// Confirmation Dialog Elements
const confirmModal = document.getElementById('confirmActionModal');
const confirmDialogTitle = document.getElementById('confirmDialogTitle');
const confirmDialogMessage = document.getElementById('confirmDialogMessage');
const confirmIcon = document.getElementById('confirmIcon');
const actionConfirmBtn = document.getElementById('actionConfirmBtn');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');

/**
 * 1. RBAC Authentication & Session Enforcement
 */
async function checkAuth() {
    if (!supabase) {
        window.location.href = 'login.html';
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        window.location.href = 'login.html';
        return;
    }

    currentAdminId = session.user.id;

    // Load admin profile to verify privileged authorization
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentAdminId)
        .single();

    if (error || !profile) {
        console.error("User management error fetching admin profile:", error);
        window.location.href = '../unauthorized.html';
        return;
    }

    const rawRole = profile.role || 'user';
    currentAdminRole = rawRole.toLowerCase().trim().replace(/\s+/g, '_');

    if (!['admin', 'super_admin'].includes(currentAdminRole)) {
        window.location.href = '../unauthorized.html';
        return;
    }

    console.log(`User Management: Authenticated as [${currentAdminRole}] (${currentAdminId})`);
}

/**
 * 2. Load Real Supabase Users
 */
async function loadUsers() {
    if (!supabase) return;

    // Show Loading Skeletons
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center" style="padding: 2.5rem;">
                <div class="skeleton" style="height: 24px; width: 60%; margin: 8px auto;"></div>
                <div class="skeleton" style="height: 24px; width: 80%; margin: 8px auto;"></div>
                <div class="skeleton" style="height: 24px; width: 50%; margin: 8px auto;"></div>
            </td>
        </tr>
    `;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        allUsers = data || [];
        updateDashboardMetrics(allUsers);
        applyFilters();

    } catch (err) {
        console.error("Error loading users from Supabase:", err);
        window.showToast?.('تعذر تحميل بيانات المستخدمين من قاعدة البيانات', 'error');
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 3rem;">
                    <div style="font-size: 2.5rem; margin-bottom: 8px;">⚠️</div>
                    <strong style="color: var(--danger-color); display: block; font-size: 1.1rem; margin-bottom: 6px;">
                        حدث خطأ أثناء تحميل الحسابات
                    </strong>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9rem;">
                        يرجى التحقق من الاتصال بقاعدة البيانات والمحاولة مجدداً.
                    </p>
                    <button class="btn btn-primary" onclick="window.reloadUsers()" style="padding: 6px 16px;">
                        إعادة المحاولة ↺
                    </button>
                </td>
            </tr>
        `;
    }
}

/**
 * Update Dashboard Metric Cards
 */
function updateDashboardMetrics(users) {
    if (!statTotalUsers) return;

    statTotalUsers.innerText = users.length;

    const specialistsCount = users.filter(u => {
        const r = normalizeRole(u.role);
        return ['specialist', 'doctor', 'psychologist', 'nutritionist'].includes(r);
    }).length;
    statSpecialists.innerText = specialistsCount;

    const adminsCount = users.filter(u => {
        const r = normalizeRole(u.role);
        return ['admin', 'super_admin'].includes(r);
    }).length;
    statAdmins.innerText = adminsCount;

    const volunteersCount = users.filter(u => normalizeRole(u.role) === 'volunteer').length;
    statVolunteers.innerText = volunteersCount;

    const restrictedCount = users.filter(u => ['banned', 'suspended'].includes(u.account_status)).length;
    statRestricted.innerText = restrictedCount;
}

/**
 * 3. Filter & Sort Logic
 */
function applyFilters() {
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();
    const roleTerm = roleFilter?.value || 'all';
    const statusTerm = statusFilter?.value || 'all';
    const sortOrder = sortBySelect?.value || 'newest';

    filteredUsers = allUsers.filter(user => {
        const normRole = normalizeRole(user.role);
        const normStatus = user.account_status || 'active';

        // Search Match
        const nameMatch = (user.full_name || '').toLowerCase().includes(searchTerm);
        const emailMatch = (user.email || '').toLowerCase().includes(searchTerm);
        const phoneMatch = (user.phone || '').toLowerCase().includes(searchTerm);
        const wilayaMatch = (user.wilaya || '').toLowerCase().includes(searchTerm);
        const idMatch = (user.id || '').toLowerCase().includes(searchTerm);
        const matchesSearch = !searchTerm || nameMatch || emailMatch || phoneMatch || wilayaMatch || idMatch;

        // Role Match
        let matchesRole = true;
        if (roleTerm !== 'all') {
            if (roleTerm === 'specialist') {
                matchesRole = ['specialist', 'doctor', 'psychologist', 'nutritionist'].includes(normRole);
            } else {
                matchesRole = normRole === roleTerm;
            }
        }

        // Status Match
        let matchesStatus = true;
        if (statusTerm !== 'all') {
            matchesStatus = normStatus === statusTerm;
        }

        return matchesSearch && matchesRole && matchesStatus;
    });

    // Sorting
    filteredUsers.sort((a, b) => {
        switch (sortOrder) {
            case 'newest':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            case 'oldest':
                return new Date(a.created_at || 0) - new Date(b.created_at || 0);
            case 'name_asc':
                return (a.full_name || '').localeCompare(b.full_name || '', 'ar');
            case 'name_desc':
                return (b.full_name || '').localeCompare(a.full_name || '', 'ar');
            case 'role': {
                const rank = { super_admin: 1, admin: 2, specialist: 3, volunteer: 4, user: 5 };
                return (rank[normalizeRole(a.role)] || 99) - (rank[normalizeRole(b.role)] || 99);
            }
            case 'status': {
                const rank = { active: 1, inactive: 2, suspended: 3, banned: 4 };
                return (rank[a.account_status || 'active'] || 99) - (rank[b.account_status || 'active'] || 99);
            }
            default:
                return 0;
        }
    });

    // Summary Text and Reset Button
    if (activeFilterCountText) {
        activeFilterCountText.innerText = `يعرض ${filteredUsers.length} من أصل ${allUsers.length} حساب مسجل`;
    }
    if (resetFiltersBtn) {
        const hasFilters = searchTerm || roleTerm !== 'all' || statusTerm !== 'all' || sortOrder !== 'newest';
        resetFiltersBtn.style.display = hasFilters ? 'inline-block' : 'none';
    }

    currentPage = 1;
    renderTable();
}

/**
 * 4. Render Table with Pagination
 */
function renderTable() {
    tbody.innerHTML = '';

    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 3.5rem 1rem;">
                    <div class="empty-state">
                        <div class="empty-state-icon" style="font-size: 2.8rem; margin-bottom: 12px;">👥</div>
                        <div class="empty-state-title" style="font-weight: 800; font-size: 1.2rem; margin-bottom: 6px;">لا توجد حسابات مطابقة</div>
                        <div class="empty-state-desc" style="color: var(--text-secondary); max-width: 400px; margin: 0 auto 1.25rem;">
                            لم يتم العثور على أي مستخدم يطابق معايير البحث والتصفية المحددة.
                        </div>
                        <button class="btn btn-outline" onclick="window.resetFilters()" style="padding: 6px 16px;">
                            إعادة ضبط الفلاتر ↺
                        </button>
                    </div>
                </td>
            </tr>
        `;
        updatePagination(0);
        return;
    }

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIdx, endIdx);

    paginatedUsers.forEach(user => {
        const tr = document.createElement('tr');
        
        // Date formatting in Arabic
        const dateObj = new Date(user.created_at);
        const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'غير معروف';

        const initial = user.full_name ? user.full_name.trim().charAt(0).toUpperCase() : 'U';
        const normRole = normalizeRole(user.role);
        const roleBadgeInfo = getRoleBadgeInfo(normRole);
        const statusInfo = getStatusBadgeInfo(user.account_status);

        tr.innerHTML = `
            <td>
                <div class="user-info-cell">
                    <div class="avatar-sm" style="background: var(--brand-accent, #0284c7); color: white; font-weight: 800;">
                        ${initial}
                    </div>
                    <div class="user-info-text">
                        <strong>${escapeHTML(user.full_name || 'بدون اسم')}</strong>
                        <span>${user.phone || (user.wilaya ? `📍 ${user.wilaya}` : 'لا يوجد هاتف')}</span>
                    </div>
                </div>
            </td>
            <td>
                <span style="color: ${user.email ? 'var(--text-primary)' : 'var(--text-tertiary)'}; font-size: 0.9rem;">
                    ${user.email ? escapeHTML(user.email) : 'غير متوفر'}
                </span>
            </td>
            <td>
                <span class="status-badge ${roleBadgeInfo.badgeClass}">
                    ${roleBadgeInfo.icon} ${roleBadgeInfo.label}
                </span>
            </td>
            <td>
                <span class="status-badge ${statusInfo.badgeClass}">
                    <span class="status-dot-indicator ${statusInfo.dotClass}"></span>
                    ${statusInfo.label}
                </span>
            </td>
            <td style="color: var(--text-secondary); font-size: 0.88rem;">
                ${formattedDate}
            </td>
            <td>
                <div class="table-action-btns">
                    <button class="btn btn-outline view-details-btn" data-id="${user.id}" style="padding: 4px 10px; font-size: 0.82rem;" title="عرض التفاصيل الكاملة">
                        🔍 تفاصيل
                    </button>
                    <button class="btn btn-outline edit-role-btn" data-id="${user.id}" style="padding: 4px 10px; font-size: 0.82rem;" title="تعديل الدور والصلاحيات">
                        🛡️ الصلاحية
                    </button>
                    <button class="btn btn-outline edit-status-btn" data-id="${user.id}" style="padding: 4px 10px; font-size: 0.82rem;" title="تعديل حالة الحساب">
                        ⚖️ الحالة
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Attach Event Handlers
    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const uid = e.currentTarget.getAttribute('data-id');
            openProfileModal(uid);
        });
    });

    document.querySelectorAll('.edit-role-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const uid = e.currentTarget.getAttribute('data-id');
            openRoleModal(uid);
        });
    });

    document.querySelectorAll('.edit-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const uid = e.currentTarget.getAttribute('data-id');
            openStatusModal(uid);
        });
    });

    updatePagination(totalPages);
}

/**
 * Update Pagination Controls
 */
function updatePagination(totalPages) {
    if (filteredUsers.length === 0) {
        pageInfo.innerText = 'يعرض 0 حساب';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        pageNumbers.innerHTML = '';
        return;
    }

    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredUsers.length);
    pageInfo.innerText = `يعرض ${start} إلى ${end} من أصل ${filteredUsers.length} حساب`;

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;

    pageNumbers.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        if (totalPages <= 6 || i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            btn.innerText = i;
            btn.addEventListener('click', () => {
                currentPage = i;
                renderTable();
            });
            pageNumbers.appendChild(btn);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const span = document.createElement('span');
            span.innerText = '...';
            span.style.padding = '0.4rem';
            pageNumbers.appendChild(span);
        }
    }
}

/**
 * 5. Role Management Modal Logic & Privilege Escalation Protection
 */
function openRoleModal(userId) {
    currentEditingUser = allUsers.find(u => u.id === userId);
    if (!currentEditingUser) return;

    const normRole = normalizeRole(currentEditingUser.role);
    const roleInfo = getRoleBadgeInfo(normRole);

    document.getElementById('modalUserName').innerText = currentEditingUser.full_name || 'بدون اسم';
    document.getElementById('modalUserEmail').innerText = currentEditingUser.email || 'البريد الإلكتروني غير متوفر';
    document.getElementById('modalUserAvatar').innerText = currentEditingUser.full_name ? currentEditingUser.full_name.charAt(0) : 'U';

    const currentBadge = document.getElementById('modalCurrentRoleBadge');
    currentBadge.className = `status-badge ${roleInfo.badgeClass}`;
    currentBadge.innerText = `${roleInfo.icon} ${roleInfo.label}`;

    modalRoleSelect.value = normRole;

    // Escalation Security Constraints
    const isSelf = currentAdminId === currentEditingUser.id;
    const isTargetSuper = normRole === 'super_admin';
    const isActorSuper = currentAdminRole === 'super_admin';

    // 1. Cannot modify own role
    if (isSelf) {
        selfRoleWarning.style.display = 'block';
        modalRoleSelect.disabled = true;
        saveRoleBtn.disabled = true;
    } else {
        selfRoleWarning.style.display = 'none';
        modalRoleSelect.disabled = false;
        saveRoleBtn.disabled = false;
    }

    // 2. Only Super Admin can assign or touch Super Admin
    if (!isActorSuper) {
        if (optSuperAdmin) {
            optSuperAdmin.disabled = true;
            optSuperAdmin.text = 'مدير نظام عام (Super Admin) - يتطلب ترخيص مدير عام';
        }
        superAdminRestrictedNotice.style.display = 'block';

        if (isTargetSuper) {
            modalRoleSelect.disabled = true;
            saveRoleBtn.disabled = true;
            superAdminRestrictedNotice.innerHTML = `
                <strong style="color: #b91c1c; display: block; margin-bottom: 2px;">⛔ حماية حساب Super Admin</strong>
                <span style="font-size: 0.82rem; color: #b91c1c;">لا تملك صلاحية تعديل حساب مدير نظام عام. فقط مدراء النظام العام يملكون هذه الصلاحية.</span>
            `;
        }
    } else {
        if (optSuperAdmin) {
            optSuperAdmin.disabled = false;
            optSuperAdmin.text = 'مدير نظام عام (Super Admin) - كامل الصلاحيات';
        }
        superAdminRestrictedNotice.style.display = 'none';
    }

    roleModal.classList.add('active');
}

function closeRoleModal() {
    roleModal.classList.remove('active');
    currentEditingUser = null;
}

/**
 * 6. Status Management Modal Logic
 */
function openStatusModal(userId) {
    currentStatusUser = allUsers.find(u => u.id === userId);
    if (!currentStatusUser) return;

    const currentStatus = currentStatusUser.account_status || 'active';
    const statusInfo = getStatusBadgeInfo(currentStatus);

    document.getElementById('modalStatusUserName').innerText = currentStatusUser.full_name || 'بدون اسم';
    document.getElementById('modalStatusUserEmail').innerText = currentStatusUser.email || 'البريد غير متوفر';
    document.getElementById('modalStatusUserAvatar').innerText = currentStatusUser.full_name ? currentStatusUser.full_name.charAt(0) : 'U';

    const badgeEl = document.getElementById('modalCurrentStatusBadge');
    badgeEl.className = `status-badge ${statusInfo.badgeClass}`;
    badgeEl.innerHTML = `<span class="status-dot-indicator ${statusInfo.dotClass}"></span> ${statusInfo.label}`;

    modalStatusSelect.value = currentStatus;
    if (modalStatusNote) modalStatusNote.value = '';

    // Self-Ban Protection
    const isSelf = currentAdminId === currentStatusUser.id;
    if (isSelf) {
        selfStatusWarning.style.display = 'block';
        modalStatusSelect.disabled = true;
        saveStatusBtn.disabled = true;
    } else {
        selfStatusWarning.style.display = 'none';
        modalStatusSelect.disabled = false;
        saveStatusBtn.disabled = false;
    }

    statusModal.classList.add('active');
}

function closeStatusModal() {
    statusModal.classList.remove('active');
    currentStatusUser = null;
}

/**
 * 7. Profile 360 Details Modal
 */
function openProfileModal(userId) {
    currentDetailUser = allUsers.find(u => u.id === userId);
    if (!currentDetailUser) return;

    const normRole = normalizeRole(currentDetailUser.role);
    const roleInfo = getRoleBadgeInfo(normRole);
    const statusInfo = getStatusBadgeInfo(currentDetailUser.account_status);

    document.getElementById('detailTitleName').innerText = currentDetailUser.full_name || 'بدون اسم';
    document.getElementById('detailAvatar').innerText = currentDetailUser.full_name ? currentDetailUser.full_name.charAt(0) : 'U';
    document.getElementById('detailUserIdText').innerText = `ID: ${currentDetailUser.id}`;

    const roleBadge = document.getElementById('detailRoleBadge');
    roleBadge.className = `status-badge ${roleInfo.badgeClass}`;
    roleBadge.innerText = `${roleInfo.icon} ${roleInfo.label}`;

    const statusBadge = document.getElementById('detailStatusBadge');
    statusBadge.className = `status-badge ${statusInfo.badgeClass}`;
    statusBadge.innerHTML = `<span class="status-dot-indicator ${statusInfo.dotClass}"></span> ${statusInfo.label}`;

    // Fill form inputs for editing
    document.getElementById('detailFullNameInput').value = currentDetailUser.full_name || '';
    document.getElementById('detailPhoneInput').value = currentDetailUser.phone || '';
    document.getElementById('detailWilayaInput').value = currentDetailUser.wilaya || '';
    document.getElementById('detailGenderSelect').value = currentDetailUser.gender || '';
    document.getElementById('detailInternalNotes').value = currentDetailUser.internal_notes || '';

    // Fill system metadata cards
    document.getElementById('detailEmailVal').innerText = currentDetailUser.email || 'غير مسجل';
    
    const createdDate = new Date(currentDetailUser.created_at);
    document.getElementById('detailCreatedAtVal').innerText = !isNaN(createdDate) ? createdDate.toLocaleString('ar-EG') : 'غير معروف';

    const lastActive = currentDetailUser.last_active_at ? new Date(currentDetailUser.last_active_at) : null;
    document.getElementById('detailLastActiveVal').innerText = (lastActive && !isNaN(lastActive)) ? lastActive.toLocaleString('ar-EG') : 'لم يسجل نشاط';

    document.getElementById('detailBirthDateVal').innerText = currentDetailUser.birth_date || 'غير محدد';

    // Update Deep Link to CRM Profile
    if (viewFullCrmLink) {
        viewFullCrmLink.href = `crm_profile.html?id=${currentDetailUser.id}`;
    }

    profileModal.classList.add('active');
}

function closeProfileModal() {
    profileModal.classList.remove('active');
    currentDetailUser = null;
}

/**
 * 8. Confirmation Dialog Modal
 */
function showConfirmation(title, message, icon, onConfirm) {
    confirmDialogTitle.innerText = title;
    confirmDialogMessage.innerText = message;
    confirmIcon.innerText = icon || '⚠️';
    pendingConfirmCallback = onConfirm;
    confirmModal.classList.add('active');
}

function closeConfirmation() {
    confirmModal.classList.remove('active');
    pendingConfirmCallback = null;
}

/**
 * 9. Helpers & Badges
 */
function normalizeRole(role) {
    if (!role) return 'user';
    return String(role).toLowerCase().trim().replace(/\s+/g, '_');
}

function getRoleBadgeInfo(role) {
    switch (role) {
        case 'super_admin':
            return { label: 'مدير نظام عام (Super Admin)', badgeClass: 'super_admin', icon: '🛡️' };
        case 'admin':
            return { label: 'مدير (Admin)', badgeClass: 'admin', icon: '⚙️' };
        case 'specialist':
        case 'doctor':
        case 'psychologist':
        case 'nutritionist':
            return { label: 'طبيب / مختص (Specialist)', badgeClass: 'specialist', icon: '🩺' };
        case 'volunteer':
            return { label: 'متطوع (Volunteer)', badgeClass: 'volunteer', icon: '🤝' };
        case 'user':
        default:
            return { label: 'مستخدم عادي (User)', badgeClass: 'user', icon: '👤' };
    }
}

function getStatusBadgeInfo(status) {
    switch (status) {
        case 'banned':
            return { label: 'محظور', badgeClass: 'banned', dotClass: 'status-dot-banned' };
        case 'suspended':
            return { label: 'موقوف مؤقتاً', badgeClass: 'suspended', dotClass: 'status-dot-suspended' };
        case 'inactive':
            return { label: 'غير نشط', badgeClass: 'inactive', dotClass: 'status-dot-inactive' };
        case 'active':
        default:
            return { label: 'نشط', badgeClass: 'active', dotClass: 'status-dot-active' };
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

// Global functions for window access
window.reloadUsers = loadUsers;
window.resetFilters = () => {
    if (searchInput) searchInput.value = '';
    if (roleFilter) roleFilter.value = 'all';
    if (statusFilter) statusFilter.value = 'all';
    if (sortBySelect) sortBySelect.value = 'newest';
    applyFilters();
};

/**
 * 10. Initialization and Event Binding
 */
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadUsers();

    // Filters and Search Events
    searchInput?.addEventListener('input', applyFilters);
    roleFilter?.addEventListener('change', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);
    sortBySelect?.addEventListener('change', applyFilters);
    pageSizeSelect?.addEventListener('change', (e) => {
        itemsPerPage = parseInt(e.target.value) || 10;
        currentPage = 1;
        renderTable();
    });

    refreshUsersBtn?.addEventListener('click', loadUsers);
    resetFiltersBtn?.addEventListener('click', window.resetFilters);

    // Pagination Events
    prevBtn?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    nextBtn?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // Role Modal Close Events
    closeRoleModalBtn?.addEventListener('click', closeRoleModal);
    cancelRoleModalBtn?.addEventListener('click', closeRoleModal);
    roleModal?.addEventListener('click', (e) => {
        if (e.target === roleModal) closeRoleModal();
    });

    // Status Modal Close Events
    closeStatusModalBtn?.addEventListener('click', closeStatusModal);
    cancelStatusModalBtn?.addEventListener('click', closeStatusModal);
    statusModal?.addEventListener('click', (e) => {
        if (e.target === statusModal) closeStatusModal();
    });

    // Details Modal Close Events
    closeDetailsModalBtn?.addEventListener('click', closeProfileModal);
    closeDetailsModalBtn2?.addEventListener('click', closeProfileModal);
    profileModal?.addEventListener('click', (e) => {
        if (e.target === profileModal) closeProfileModal();
    });

    // Confirmation Modal Events
    cancelConfirmBtn?.addEventListener('click', closeConfirmation);
    confirmModal?.addEventListener('click', (e) => {
        if (e.target === confirmModal) closeConfirmation();
    });
    actionConfirmBtn?.addEventListener('click', async () => {
        if (pendingConfirmCallback) {
            const cb = pendingConfirmCallback;
            closeConfirmation();
            await cb();
        }
    });

    // Copy User ID Button
    copyUserIdBtn?.addEventListener('click', () => {
        if (currentDetailUser?.id) {
            navigator.clipboard.writeText(currentDetailUser.id).then(() => {
                window.showToast?.('تم نسخ معرف المستخدم (UUID) بنجاح!', 'success');
            }).catch(() => {
                window.showToast?.('تعذر نسخ المعرف إلى الحافظة', 'error');
            });
        }
    });

    // Save Role Handler
    saveRoleBtn?.addEventListener('click', () => {
        if (!currentEditingUser || !supabase) return;

        const newRole = modalRoleSelect.value;
        const oldRole = normalizeRole(currentEditingUser.role);
        if (newRole === oldRole) {
            closeRoleModal();
            return;
        }

        const roleLabels = {
            super_admin: 'مدير نظام عام (Super Admin)',
            admin: 'مدير (Admin)',
            specialist: 'طبيب / مختص (Specialist)',
            volunteer: 'متطوع (Volunteer)',
            user: 'مستخدم عادي (User)'
        };

        const targetName = currentEditingUser.full_name || 'هذا المستخدم';
        const roleLabel = roleLabels[newRole] || newRole;

        showConfirmation(
            'تأكيد تعديل الصلاحية',
            `هل أنت متأكد من تغيير صلاحية "${targetName}" إلى "${roleLabel}"؟ سيتم منح الصلاحيات فوراً.`,
            '🛡️',
            async () => {
                const originalText = saveRoleBtn.innerText;
                saveRoleBtn.innerText = 'جاري الحفظ...';
                saveRoleBtn.disabled = true;

                try {
                    // 1. Try secure RPC function first
                    let rpcSuccess = false;
                    try {
                        const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_update_user_role', {
                            target_user_id: currentEditingUser.id,
                            new_role: newRole
                        });
                        if (!rpcErr && rpcRes?.success) {
                            rpcSuccess = true;
                        }
                    } catch {
                        // RPC fallback
                    }

                    // 2. If RPC not available, use direct table update (protected by RLS & trigger)
                    if (!rpcSuccess) {
                        const { error } = await supabase
                            .from('profiles')
                            .update({ role: newRole })
                            .eq('id', currentEditingUser.id);

                        if (error) throw error;
                    }

                    // Audit log best-effort insertion
                    supabase.from('audit_logs').insert({
                        user_id: currentAdminId,
                        action_type: 'update_user_role',
                        entity_type: 'user',
                        entity_id: currentEditingUser.id,
                        metadata: { old_role: oldRole, new_role: newRole }
                    }).then(() => {}).catch(() => {});

                    window.showToast?.(`تم تحديث صلاحية الحساب إلى [${roleLabel}] بنجاح!`, 'success');
                    currentEditingUser.role = newRole;
                    closeRoleModal();
                    updateDashboardMetrics(allUsers);
                    renderTable();

                } catch (err) {
                    console.error("Save role error:", err);
                    window.showToast?.(err.message || 'فشل تحديث الصلاحية في قاعدة البيانات', 'error');
                } finally {
                    saveRoleBtn.innerText = originalText;
                    saveRoleBtn.disabled = false;
                }
            }
        );
    });

    // Save Status Handler
    saveStatusBtn?.addEventListener('click', () => {
        if (!currentStatusUser || !supabase) return;

        const newStatus = modalStatusSelect.value;
        const oldStatus = currentStatusUser.account_status || 'active';
        const statusNote = modalStatusNote?.value?.trim() || '';

        if (newStatus === oldStatus && !statusNote) {
            closeStatusModal();
            return;
        }

        const statusLabels = {
            active: 'نشط',
            inactive: 'غير نشط',
            suspended: 'موقوف مؤقتاً',
            banned: 'محظور'
        };

        const targetName = currentStatusUser.full_name || 'هذا المستخدم';
        const statusLabel = statusLabels[newStatus] || newStatus;
        const isRestricted = ['suspended', 'banned'].includes(newStatus);

        showConfirmation(
            isRestricted ? '⚠️ تأكيد تقييد الحساب' : 'تأكيد تغيير حالة الحساب',
            isRestricted 
                ? `تحذير: تغيير حالة حساب "${targetName}" إلى [${statusLabel}] سيمنع المستخدم من الدخول واستخدام خدمات المنصة فوراً. هل ترغب في المتابعة؟`
                : `هل أنت متأكد من تغيير حالة حساب "${targetName}" إلى [${statusLabel}]؟`,
            isRestricted ? '🚫' : '⚖️',
            async () => {
                const originalText = saveStatusBtn.innerText;
                saveStatusBtn.innerText = 'جاري التحديث...';
                saveStatusBtn.disabled = true;

                try {
                    // 1. Try secure RPC function first
                    let rpcSuccess = false;
                    try {
                        const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_update_user_status', {
                            target_user_id: currentStatusUser.id,
                            new_status: newStatus
                        });
                        if (!rpcErr && rpcRes?.success) {
                            rpcSuccess = true;
                        }
                    } catch {
                        // Fallback
                    }

                    // 2. Direct table update fallback
                    if (!rpcSuccess) {
                        const updatePayload = { account_status: newStatus };
                        if (statusNote) {
                            updatePayload.internal_notes = currentStatusUser.internal_notes 
                                ? `${currentStatusUser.internal_notes}\n[${new Date().toLocaleDateString('ar')}]: تغيير الحالة إلى ${statusLabel}: ${statusNote}`
                                : `[${new Date().toLocaleDateString('ar')}]: تغيير الحالة إلى ${statusLabel}: ${statusNote}`;
                        }

                        const { error } = await supabase
                            .from('profiles')
                            .update(updatePayload)
                            .eq('id', currentStatusUser.id);

                        if (error) throw error;
                    }

                    // Audit log best effort
                    supabase.from('audit_logs').insert({
                        user_id: currentAdminId,
                        action_type: 'update_account_status',
                        entity_type: 'user',
                        entity_id: currentStatusUser.id,
                        metadata: { old_status: oldStatus, new_status: newStatus, note: statusNote }
                    }).then(() => {}).catch(() => {});

                    window.showToast?.(`تم تحديث حالة الحساب إلى [${statusLabel}] بنجاح!`, 'success');
                    currentStatusUser.account_status = newStatus;
                    closeStatusModal();
                    updateDashboardMetrics(allUsers);
                    renderTable();

                } catch (err) {
                    console.error("Save status error:", err);
                    window.showToast?.(err.message || 'فشل تحديث حالة الحساب', 'error');
                } finally {
                    saveStatusBtn.innerText = originalText;
                    saveStatusBtn.disabled = false;
                }
            }
        );
    });

    // Save Profile Details Handler
    saveProfileDetailsBtn?.addEventListener('click', async () => {
        if (!currentDetailUser || !supabase) return;

        const fullName = document.getElementById('detailFullNameInput').value.trim();
        const phone = document.getElementById('detailPhoneInput').value.trim();
        const wilaya = document.getElementById('detailWilayaInput').value.trim();
        const gender = document.getElementById('detailGenderSelect').value;
        const internalNotes = document.getElementById('detailInternalNotes').value.trim();

        const originalText = saveProfileDetailsBtn.innerText;
        saveProfileDetailsBtn.innerText = 'جاري الحفظ...';
        saveProfileDetailsBtn.disabled = true;

        try {
            // 1. Try RPC function
            let rpcSuccess = false;
            try {
                const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_update_user_profile', {
                    target_user_id: currentDetailUser.id,
                    full_name_input: fullName,
                    phone_input: phone,
                    wilaya_input: wilaya,
                    gender_input: gender,
                    internal_notes_input: internalNotes
                });
                if (!rpcErr && rpcRes?.success) {
                    rpcSuccess = true;
                }
            } catch {
                // Fallback
            }

            // 2. Direct table update fallback
            if (!rpcSuccess) {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        full_name: fullName,
                        phone: phone,
                        wilaya: wilaya,
                        gender: gender,
                        internal_notes: internalNotes
                    })
                    .eq('id', currentDetailUser.id);

                if (error) throw error;
            }

            // Update in local memory
            currentDetailUser.full_name = fullName;
            currentDetailUser.phone = phone;
            currentDetailUser.wilaya = wilaya;
            currentDetailUser.gender = gender;
            currentDetailUser.internal_notes = internalNotes;

            window.showToast?.('تم حفظ بيانات المستخدم بنجاح!', 'success');
            closeProfileModal();
            renderTable();

        } catch (err) {
            console.error("Save profile details error:", err);
            window.showToast?.(err.message || 'حدث خطأ أثناء حفظ التعديلات', 'error');
        } finally {
            saveProfileDetailsBtn.innerText = originalText;
            saveProfileDetailsBtn.disabled = false;
        }
    });

    // Export CSV Handler
    exportUsersBtn?.addEventListener('click', () => {
        if (!allUsers || allUsers.length === 0) {
            window.showToast?.('لا توجد بيانات مستخدمين للتصدير', 'warning');
            return;
        }

        const targetList = filteredUsers.length > 0 ? filteredUsers : allUsers;
        let csvContent = '\uFEFFمعرف المستخدم,الاسم الكامل,البريد الإلكتروني,رقم الهاتف,الولاية,الدور,حالة الحساب,تاريخ التسجيل\n';

        targetList.forEach(u => {
            const id = `"${u.id || ''}"`;
            const name = `"${(u.full_name || '').replace(/"/g, '""')}"`;
            const email = `"${(u.email || '').replace(/"/g, '""')}"`;
            const phone = `"${(u.phone || '').replace(/"/g, '""')}"`;
            const wilaya = `"${(u.wilaya || '').replace(/"/g, '""')}"`;
            const role = `"${normalizeRole(u.role)}"`;
            const status = `"${u.account_status || 'active'}"`;
            const createdAt = `"${u.created_at || ''}"`;

            csvContent += `${id},${name},${email},${phone},${wilaya},${role},${status},${createdAt}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `yhs_users_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        window.showToast?.('تم تصدير ملف CSV بنجاح!', 'success');
    });
});
