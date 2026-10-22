const assert = require('assert');
const path = require('path');

(async () => {
    const helpersPath = path.resolve(__dirname, '../js/youth_houses_shared.mjs');
    const helpers = await import(`file://${helpersPath}`);

    const {
        canAccessYouthHouseManager,
        canEditYouthHouseRecord,
        getPublicVisibilityStatuses,
        validateYouthHousePayload,
        paginateYouthHouses,
        applyYouthHouseFilters
    } = helpers;

    // 1) Unauthenticated access boundary
    assert.equal(canAccessYouthHouseManager(null, 'admin'), false, 'Unauthenticated access must be denied');

    // 2) Authorized role access
    const fakeSession = { user: { id: 'u-1' } };
    assert.equal(canAccessYouthHouseManager(fakeSession, 'admin'), true, 'Admin should access manager workflow');
    assert.equal(canAccessYouthHouseManager(fakeSession, 'user'), false, 'Normal user should not access manager workflow');

    // 3) Public visibility statuses
    assert.deepEqual(getPublicVisibilityStatuses(), ['approved', 'published'], 'Public visibility must only expose approved/published statuses');

    // 4) Manager ownership boundary
    const rec = { manager_user_id: 'u-1' };
    assert.equal(canEditYouthHouseRecord(rec, 'u-1', 'youth_house_manager'), true, 'Manager can edit own record');
    assert.equal(canEditYouthHouseRecord(rec, 'u-2', 'youth_house_manager'), false, 'Manager cannot edit another manager record');

    // 5) Invalid form input
    const invalid = validateYouthHousePayload({
        slug: 'Bad Slug',
        name_ar: 'أ',
        wilaya_name: '',
        commune_name: '',
        email: 'broken-email',
        phone: 'abc'
    });
    assert.equal(invalid.isValid, false, 'Invalid payload must fail validation');
    assert.ok(invalid.errors.length >= 3, 'Validation should report multiple errors');

    // 6) Pagination/filter behavior
    const rows = [
        { slug: 'a', name_ar: 'دار الشباب الجزائر', wilaya_name: 'الجزائر', commune_name: 'الجزائر الوسطى' },
        { slug: 'b', name_ar: 'دار الشباب وهران', wilaya_name: 'وهران', commune_name: 'السانية' },
        { slug: 'c', name_ar: 'دار الشباب قسنطينة', wilaya_name: 'قسنطينة', commune_name: 'الخروب' }
    ];

    const filtered = applyYouthHouseFilters(rows, { search: 'وهران' });
    assert.equal(filtered.length, 1, 'Search filter should narrow down rows');

    const paged = paginateYouthHouses(rows, 2, 2);
    assert.equal(paged.items.length, 1, 'Pagination should return expected tail count');
    assert.equal(paged.totalPages, 2, 'Pagination should compute total pages');

    console.log('All youth house foundation smoke checks passed.');
})();
