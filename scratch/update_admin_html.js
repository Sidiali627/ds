const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '../admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.html') && f !== 'index.html');

files.forEach(file => {
    const filePath = path.join(adminDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Add script to head if missing
    if (!content.includes('admin_components.js')) {
        content = content.replace('</head>', '    <script type="module" src="../js/admin_components.js"></script>\n</head>');
    }

    // Replace aside
    const asideRegex = /<aside class="admin-sidebar">[\s\S]*?<\/aside>/;
    if (asideRegex.test(content)) {
        content = content.replace(asideRegex, '<div id="admin-sidebar-root"></div>');
    }

    // Replace header
    const headerRegex = /<header class="admin-header">[\s\S]*?<\/header>/;
    if (headerRegex.test(content)) {
        content = content.replace(headerRegex, '<div id="admin-header-root"></div>');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
});
