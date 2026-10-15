const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const results = {
    jsSyntaxErrors: [],
    missingElements: [],
    brokenLinks: [],
    missingAltImages: [],
    missingScripts: []
};

// Helper: recursively find files
function getFiles(dir, ext) {
    let res = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('.gemini')) {
                res = res.concat(getFiles(fullPath, ext));
            }
        } else if (file.endsWith(ext)) {
            res.push(fullPath);
        }
    }
    return res;
}

const jsFiles = getFiles(rootDir, '.js');
const htmlFiles = getFiles(rootDir, '.html');

console.log(`Auditing ${jsFiles.length} JS files and ${htmlFiles.length} HTML files...`);

// 1. Audit JS Syntax
jsFiles.forEach(file => {
    try {
        execSync(`node -c "${file}"`, { stdio: 'pipe' });
    } catch (e) {
        results.jsSyntaxErrors.push({ file, error: e.stderr.toString() });
    }
});

// 2. Audit Broken Links & Missing Alt Images in HTML
htmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');

    // Check broken hrefs to local html files
    const hrefMatches = content.matchAll(/href=["']([^"']+\.html)["']/g);
    for (const match of hrefMatches) {
        const target = match[1];
        if (!target.startsWith('http') && !target.startsWith('#')) {
            const resolvedPath = path.resolve(path.dirname(file), target);
            if (!fs.existsSync(resolvedPath)) {
                results.brokenLinks.push({ file: path.relative(rootDir, file), link: target });
            }
        }
    }

    // Check img without alt
    const imgMatches = content.matchAll(/<img\s+([^>]*?)>/gi);
    for (const match of imgMatches) {
        const tag = match[0];
        if (!tag.includes('alt=')) {
            results.missingAltImages.push({ file: path.relative(rootDir, file), tag });
        }
    }
});

// Print Results Summary
console.log("\n================ AUDIT SUMMARY ================");
console.log(`JS Syntax Errors: ${results.jsSyntaxErrors.length}`);
results.jsSyntaxErrors.forEach(err => console.log(`  - ${err.file}: ${err.error}`));

console.log(`Broken Links: ${results.brokenLinks.length}`);
results.brokenLinks.forEach(b => console.log(`  - ${b.file} -> ${b.link}`));

console.log(`Images Missing Alt: ${results.missingAltImages.length}`);
console.log(`===============================================\n`);

// Save audit results to JSON
fs.writeFileSync(path.join(rootDir, 'audit_report.json'), JSON.stringify(results, null, 2));
