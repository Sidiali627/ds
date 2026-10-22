export const ROLE_GROUPS = {
    admin: ['admin', 'super_admin'],
    specialist: ['specialist', 'doctor', 'psychologist', 'nutritionist'],
    specialistPortal: ['specialist', 'doctor', 'psychologist', 'nutritionist', 'admin', 'super_admin'],
    youthHouseManagers: ['youth_house_manager', 'association_manager', 'coordinator', 'admin', 'super_admin']
};

export function normalizeRole(role) {
    return (role || 'user').toLowerCase().trim().replace(/\s+/g, '_');
}

export function hasRole(role, allowedRoles = []) {
    return allowedRoles.includes(normalizeRole(role));
}

export function isAdminRole(role) {
    return hasRole(role, ROLE_GROUPS.admin);
}

export function isSpecialistRole(role) {
    return hasRole(role, ROLE_GROUPS.specialist);
}

export function canAccessSpecialistPortal(role) {
    return hasRole(role, ROLE_GROUPS.specialistPortal);
}

export function canManageYouthHouse(role) {
    return hasRole(role, ROLE_GROUPS.youthHouseManagers);
}
