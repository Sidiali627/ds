const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const htmlFiles = [];

function findHtmlFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if(!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('.gemini')) {
                findHtmlFiles(fullPath);
            }
        } else if (file.endsWith('.html')) {
            htmlFiles.push(fullPath);
        }
    }
}

findHtmlFiles(rootDir);

for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // 1. Determine relative path to js/theme.js
    const relativeDepth = file.replace(rootDir, '').split(path.sep).length - 2;
    const prefix = relativeDepth > 0 ? '../'.repeat(relativeDepth) : '';
    const scriptTag = `<script type="module" src="${prefix}js/theme.js"></script>`;

    // 2. Add script if not exists
    if (!content.includes('theme.js')) {
        content = content.replace('</head>', `    ${scriptTag}\n</head>`);
        changed = true;
    }

    // 3. Add Theme Switcher logic based on layout
    const switcherHTML = `<button class="theme-switcher" title="تبديل المظهر"></button>`;
    
    if (content.includes('class="admin-header-title"')) {
        // Admin or Specialist layout
        if (!content.includes('theme-switcher')) {
            // Add mobile hamburger and theme switcher to admin header
            const mobileBtn = `<button class="mobile-sidebar-toggle"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>`;
            
            // Inject them next to admin-header-title
            const regex = /(<div class="admin-header-title">.*?<\/div>)/s;
            content = content.replace(regex, `$1\n                <div style="display:flex; gap:10px; align-items:center;">\n                    ${switcherHTML}\n                    ${mobileBtn}\n                </div>`);
            changed = true;
        }
    } else if (content.includes('class="navbar"')) {
        // Public layout
        if (!content.includes('theme-switcher')) {
            const mobileBtn = `<button class="mobile-menu-btn"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>`;
            
            if (content.includes('class="auth-buttons"')) {
                // Prepend to auth-buttons
                content = content.replace(/<div class="auth-buttons">/, `<div class="auth-buttons">\n                    ${switcherHTML}`);
                // Add mobile menu btn after auth buttons
                content = content.replace(/(<\/div>\s*<\/nav>)/s, `    ${mobileBtn}\n                $1`);
                changed = true;
            }
        }
    }

    if (changed) {
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
}
console.log("Theme injection complete!");
