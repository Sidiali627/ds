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

const htmlFiles = getFiles(rootDir, '.html');
const jsFiles = getFiles(rootDir, '.js');

// Map which JS files are loaded by which HTML files
const jsToHtmlMap = {};
for (const h of htmlFiles) {
    const relHtml = path.relative(rootDir, h).replace(/\\/g, '/');
    const content = fs.readFileSync(h, 'utf8');
    const dir = path.dirname(h);

    const scriptSrcs = [...content.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
    for (const s of scriptSrcs) {
        const src = s[1];
        if (!src.startsWith('http') && !src.startsWith('//')) {
            const cleanSrc = src.split('?')[0].split('#')[0];
            const resolved = path.resolve(dir, cleanSrc);
            const relJs = path.relative(rootDir, resolved).replace(/\\/g, '/');
            if (!jsToHtmlMap[relJs]) jsToHtmlMap[relJs] = [];
            if (!jsToHtmlMap[relJs].includes(relHtml)) jsToHtmlMap[relJs].push(relHtml);
        }
    }
}

// Dynamically injected IDs from components
const dynamicallyInjectedIds = new Set([
    'admin-sidebar-root', 'admin-header-root', 'specialist-sidebar-root', 'specialist-header-root',
    'main-header', 'main-footer', 'toast-container', 'theme-toggle-btn', 'sidebar-logout-btn',
    'close-sidebar-btn', 'sidebar-overlay', 'main-sidebar'
]);

const missingIdReports = [];

for (const [jsFile, htmlList] of Object.entries(jsToHtmlMap)) {
    const fullJs = path.join(rootDir, jsFile);
    if (!fs.existsSync(fullJs)) continue;
    const jsContent = fs.readFileSync(fullJs, 'utf8');

    // Find all document.getElementById('xyz')
    const idMatches = [...jsContent.matchAll(/document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)];
    const uniqueIds = [...new Set(idMatches.map(m => m[1]))];

    for (const id of uniqueIds) {
        if (dynamicallyInjectedIds.has(id)) continue;

        // Check if ANY of the loading HTML files contains this id
        let foundInAny = false;
        for (const h of htmlList) {
            const fullH = path.join(rootDir, h);
            const htmlContent = fs.readFileSync(fullH, 'utf8');
            if (htmlContent.includes(`id="${id}"`) || htmlContent.includes(`id='${id}'`)) {
                foundInAny = true;
                break;
            }
        }

        if (!foundInAny) {
            // Check if it's called with safe navigation (e.g. ?. or if(el))
            // Let's check regex for unchecked assignments
            const unsafeRegex = new RegExp(`document\\.getElementById\\(\\s*['"]${id}['"]\\s*\\)\\.(innerText|innerHTML|value|src|style|addEventListener|disabled)`, 'g');
            const isUnsafe = unsafeRegex.test(jsContent);

            missingIdReports.push({
                js: jsFile,
                id: id,
                loadedBy: htmlList,
                isUnsafe: isUnsafe
            });
        }
    }
}

console.log('Total Missing ID references:', missingIdReports.length);
const unsafeOnes = missingIdReports.filter(m => m.isUnsafe);
console.log('Unsafe (Directly crashes):', unsafeOnes.length);
console.log(JSON.stringify(unsafeOnes, null, 2));

fs.writeFileSync(path.join(__dirname, 'missing_ids_report.json'), JSON.stringify(missingIdReports, null, 2));
