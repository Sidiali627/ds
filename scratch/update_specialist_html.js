const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../specialist');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const toastScript = `
    <!-- Global Toast Notification System -->
    <script>
        window.showToast = function(message, type = 'success') {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.style.cssText = 'position: fixed; bottom: 20px; left: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
                document.body.appendChild(container);
            }
            
            const toast = document.createElement('div');
            let bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';
            toast.style.cssText = \`background: \${bg}; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 10px; animation: toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;\`;
            toast.innerHTML = \`<span>\${message}</span>\`;
            container.appendChild(toast);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px)';
                toast.style.transition = 'all 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        };
    </script>
`;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Inject Script
    if (!content.includes('specialist_components.js')) {
        content = content.replace('</head>', '    <script type="module" src="../js/specialist_components.js"></script>\n</head>');
    }
    
    // Inject Toast
    if (!content.includes('window.showToast')) {
        content = content.replace('</body>', `${toastScript}\n</body>`);
    }

    // Replace old sidebar
    const asideRegex = /<aside class="admin-sidebar">[\s\S]*?<\/aside>/;
    if (asideRegex.test(content)) {
        content = content.replace(asideRegex, '<div id="specialist-sidebar-root"></div>');
    }

    // Replace header (assuming the header starts with <header class="content-header" or similar)
    // Looking at specialist/index.html, it had: <header class="content-header"
    const headerRegex1 = /<header class="content-header"[\s\S]*?<\/header>/;
    const headerRegex2 = /<header class="admin-header"[\s\S]*?<\/header>/;
    
    if (headerRegex1.test(content)) {
        content = content.replace(headerRegex1, '<div id="specialist-header-root"></div>');
    } else if (headerRegex2.test(content)) {
        content = content.replace(headerRegex2, '<div id="specialist-header-root"></div>');
    }

    // Some pages might not have a header, so we can just inject it inside <main class="admin-content"> if not present
    if (!content.includes('id="specialist-header-root"')) {
        content = content.replace(/<main class="admin-content">/, '<main class="admin-content">\n            <div id="specialist-header-root"></div>');
    }

    // Unify tables classes if they have <table class="data-table"> to use advanced-table
    content = content.replace(/class="data-table"/g, 'class="advanced-table"');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
});
