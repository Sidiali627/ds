const fs = require('fs');
const path = require('path');

const adminDir = path.resolve(__dirname, '../admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.html') && f !== 'login.html');

let updated = 0;
for (const f of files) {
    const full = path.join(adminDir, f);
    let html = fs.readFileSync(full, 'utf8');
    if (!html.includes('guard.js')) {
        const target = '<script type="module" src="../js/admin_components.js"></script>';
        const replacement = '<script type="module" src="../js/guard.js"></script>\n    <script type="module" src="../js/admin_components.js"></script>';
        if (html.includes(target)) {
            html = html.replace(target, replacement);
            fs.writeFileSync(full, html);
            updated++;
        }
    }
}
console.log('UPDATED_ADMIN_HTML_GUARD:', updated);
