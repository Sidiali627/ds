const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function getFiles(dir, ext) {
    let res = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
            if (!full.includes('node_modules') && !full.includes('.git') && !full.includes('.gemini') && !full.includes('scratch')) {
                res = res.concat(getFiles(full, ext));
            }
        } else if (file.endsWith(ext)) {
            res.push(full);
        }
    }
    return res;
}

const jsFiles = getFiles(rootDir, '.js');
const htmlFiles = getFiles(rootDir, '.html');

const report = {
    totalJs: jsFiles.length,
    totalHtml: htmlFiles.length,
    brokenScriptRefs: [],
    brokenStyleRefs: [],
    brokenPageLinks: [],
    missingSupabaseCDN: [],
    missingGuardInProtected: [],
    adminPagesStatus: [],
    specialistPagesStatus: []
};

// 1. Check HTML links, scripts, and styles
for (const h of htmlFiles) {
    const relHtml = path.relative(rootDir, h).replace(/\\/g, '/');
    const content = fs.readFileSync(h, 'utf8');
    const dir = path.dirname(h);

    // check scripts
    const scriptSrcs = [...content.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
    for (const s of scriptSrcs) {
        const src = s[1];
        if (!src.startsWith('http') && !src.startsWith('//')) {
            const cleanSrc = src.split('?')[0].split('#')[0];
            const resolved = path.resolve(dir, cleanSrc);
            if (!fs.existsSync(resolved)) {
                report.brokenScriptRefs.push({ page: relHtml, ref: src });
            }
        }
    }

    // check styles
    const styleHrefs = [...content.matchAll(/<link[^>]+href=["']([^"']+)["']/gi)];
    for (const s of styleHrefs) {
        const href = s[1];
        if (!href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#') && (href.endsWith('.css') || href.includes('.css?'))) {
            const cleanHref = href.split('?')[0].split('#')[0];
            const resolved = path.resolve(dir, cleanHref);
            if (!fs.existsSync(resolved)) {
                report.brokenStyleRefs.push({ page: relHtml, ref: href });
            }
        }
    }

    // check broken local html links in a tags
    const aHrefs = [...content.matchAll(/<a[^>]+href=["']([^"']+\.html(?:#[^"']*)?)["']/gi)];
    for (const a of aHrefs) {
        const rawHref = a[1];
        const href = rawHref.split('#')[0].split('?')[0];
        if (!href.startsWith('http') && !href.startsWith('//') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')) {
            const resolved = path.resolve(dir, href);
            if (!fs.existsSync(resolved)) {
                report.brokenPageLinks.push({ page: relHtml, link: rawHref });
            }
        }
    }

    // check Supabase CDN dependency
    const usesSupabase = content.includes('supabase.js') || content.includes('guard.js') || content.includes('auth.js');
    const hasSupabaseCDN = content.includes('@supabase/supabase-js');
    if (usesSupabase && !hasSupabaseCDN) {
        report.missingSupabaseCDN.push(relHtml);
    }

    // Check protected portals
    if (relHtml.startsWith('admin/')) {
        const hasGuard = content.includes('guard.js');
        report.adminPagesStatus.push({ page: relHtml, hasGuard });
        if (!hasGuard && !relHtml.includes('login.html')) {
            report.missingGuardInProtected.push(relHtml);
        }
    }

    if (relHtml.startsWith('specialist/')) {
        const hasGuard = content.includes('guard.js');
        report.specialistPagesStatus.push({ page: relHtml, hasGuard });
        if (!hasGuard) {
            report.missingGuardInProtected.push(relHtml);
        }
    }
}

fs.writeFileSync(path.join(__dirname, 'audit_output.json'), JSON.stringify(report, null, 2));
console.log('AUDIT_DONE');
console.log('Broken Scripts:', report.brokenScriptRefs.length);
console.log('Broken Styles:', report.brokenStyleRefs.length);
console.log('Broken Links:', report.brokenPageLinks.length);
console.log('Missing Supabase CDN:', report.missingSupabaseCDN.length);
console.log('Missing Guard in Protected:', report.missingGuardInProtected.length);
