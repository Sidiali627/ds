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

const results = {
    missingAssetFiles: [],
    unresolvedOnclickHandlers: [],
    brokenNavLinks: []
};

// 1. Check images and media sources
for (const h of htmlFiles) {
    const content = fs.readFileSync(h, 'utf8');
    const dir = path.dirname(h);
    const relHtml = path.relative(rootDir, h).replace(/\\/g, '/');

    // img src
    const imgMatches = [...content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    for (const img of imgMatches) {
        const src = img[1];
        if (!src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('//')) {
            const cleanSrc = src.split('?')[0].split('#')[0];
            const resolved = path.resolve(dir, cleanSrc);
            if (!fs.existsSync(resolved)) {
                results.missingAssetFiles.push({ page: relHtml, asset: src });
            }
        }
    }

    // onclick functions
    const onclickMatches = [...content.matchAll(/onclick=["']([a-zA-Z0-9_]+)\(/gi)];
    for (const oc of onclickMatches) {
        const fnName = oc[1];
        // check if this fn exists in window or scripts
        // we will check if fnName is defined in any linked script or inline script
        if (['close', 'alert', 'confirm', 'history', 'open', 'print', 'showToast'].includes(fnName)) continue;
        let found = content.includes(fnName);
        if (!found) {
            // search in all js files
            for (const j of jsFiles) {
                const jc = fs.readFileSync(j, 'utf8');
                if (jc.includes(fnName)) {
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            results.unresolvedOnclickHandlers.push({ page: relHtml, handler: fnName });
        }
    }
}

console.log('Missing Assets:', results.missingAssetFiles.length);
results.missingAssetFiles.forEach(m => console.log('  -', m.page, '->', m.asset));

console.log('Unresolved onlick:', results.unresolvedOnclickHandlers.length);
results.unresolvedOnclickHandlers.forEach(u => console.log('  -', u.page, '->', u.handler));

fs.writeFileSync(path.join(__dirname, 'dom_audit.json'), JSON.stringify(results, null, 2));
