const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../css/admin.css');
const newCssPath = path.join(__dirname, 'new_css.css');

const currentCss = fs.readFileSync(cssPath, 'utf8');
const newCss = fs.readFileSync(newCssPath, 'utf8');

fs.writeFileSync(cssPath, currentCss + '\n\n' + newCss, 'utf8');
console.log('Appended successfully');
