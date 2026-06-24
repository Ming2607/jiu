#!/usr/bin/env node
/** 将前端静态文件同步到 docs/，供 GitHub Pages 使用 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');

const STATIC_FILES = [
  'index.html', 'admin.html', 'styles.css', 'data.js', 'app.js', 'admin.js',
  'config.js', 'regions.js', 'address.js', 'order-api.js',
];

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('  ✓', path.relative(ROOT, dest));
}

function copyDir(srcDir, destDir, filterRe) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    if (filterRe && !filterRe.test(name)) continue;
    const src = path.join(srcDir, name);
    if (fs.statSync(src).isDirectory()) continue;
    copyFile(src, path.join(destDir, name));
  }
}

console.log('\n构建 GitHub Pages → docs/\n');

if (fs.existsSync(DOCS)) {
  fs.rmSync(DOCS, { recursive: true });
}
fs.mkdirSync(DOCS);

for (const file of STATIC_FILES) {
  copyFile(path.join(ROOT, file), path.join(DOCS, file));
}

copyDir(path.join(ROOT, 'images'), path.join(DOCS, 'images'), /\.(jpe?g|webp|svg|png)$/i);
fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');

const config = fs.readFileSync(path.join(DOCS, 'config.js'), 'utf8');
if (config.includes('YOUR_VERCEL_URL')) {
  console.log('\n⚠️  请先在 config.js 中把 YOUR_VERCEL_URL 改成你的 Vercel 地址，再 push 到 GitHub\n');
} else {
  console.log('\n✓ 构建完成，docs/ 已就绪\n');
}
