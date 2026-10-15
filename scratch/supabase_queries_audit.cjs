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
const sqlFiles = getFiles(rootDir, '.sql');

// 1. Extract known tables from SQL migrations
const knownTables = new Set();
for (const s of sqlFiles) {
    const content = fs.readFileSync(s, 'utf8');
    const tableMatches = [...content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi)];
    for (const m of tableMatches) {
        knownTables.add(m[1].toLowerCase());
    }
}

// standard supabase tables that might exist
knownTables.add('profiles');
knownTables.add('users');

console.log('Known SQL tables (' + knownTables.size + '):', [...knownTables].sort().join(', '));

// 2. Extract all supabase.from('...') calls in JS
const queryUsage = {};
const unknownTablesUsed = [];

for (const j of jsFiles) {
    const relJs = path.relative(rootDir, j).replace(/\\/g, '/');
    const content = fs.readFileSync(j, 'utf8');

    const matches = [...content.matchAll(/\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)];
    for (const m of matches) {
        const tbl = m[1].toLowerCase();
        if (!queryUsage[tbl]) queryUsage[tbl] = [];
        if (!queryUsage[tbl].includes(relJs)) queryUsage[tbl].push(relJs);

        if (!knownTables.has(tbl)) {
            unknownTablesUsed.push({ file: relJs, table: tbl });
        }
    }
}

console.log('\nTables accessed in JS code (' + Object.keys(queryUsage).length + '):');
for (const [tbl, files] of Object.entries(queryUsage)) {
    console.log(`  - ${tbl}: used in ${files.length} file(s)`);
}

console.log('\nUnknown / Unmatched Tables in JS:');
console.log(JSON.stringify(unknownTablesUsed, null, 2));

fs.writeFileSync(path.join(__dirname, 'supabase_audit.json'), JSON.stringify({
    knownTables: [...knownTables],
    tablesAccessed: queryUsage,
    unknownTables: unknownTablesUsed
}, null, 2));
