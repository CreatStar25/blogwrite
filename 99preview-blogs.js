/**
 * 本地预览 0_md_out 下的 .md：生成 HTML 并用浏览器打开，无需安装 npm 包。
 * 用法: node 99preview-blogs.js [--open]
 * 生成到 preview_out/，可用浏览器打开 preview_out/index.html；加 --open 时用系统默认浏览器打开。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);
const MD_OUT_DIR = path.join(ROOT_DIR, '0_md_out');
const PREVIEW_DIR = path.join(ROOT_DIR, 'preview_out');

const MARKED_CDN = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';

function getFrontmatter(content) {
    const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return {};
    const raw = m[1];
    const obj = {};
    for (const line of raw.split(/\r?\n/)) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        let val = line.slice(colon + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
            val = val.slice(1, -1);
        obj[key] = val;
    }
    return obj;
}

function collectMdFiles(dir, base = dir) {
    const list = [];
    if (!fs.existsSync(dir)) return list;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory() && !name.startsWith('.')) {
            list.push(...collectMdFiles(full, base));
        } else if (stat.isFile() && name.toLowerCase().endsWith('.md')) {
            const rel = path.relative(base, path.dirname(full));
            const subdir = rel ? rel.split(path.sep)[0] : name;
            list.push({ fullPath: full, name, subdir: subdir || name });
        }
    }
    return list;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeForScript(s) {
    return String(s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '')
        .replace(/\n/g, '\\n');
}

function buildPage(mdContent, fm, relPath) {
    const body = mdContent.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();
    const title = escapeHtml(fm.title || 'Preview');
    const bodyEscaped = escapeForScript(body);
    return `<!DOCTYPE html>
<html lang="${escapeHtml(fm.lang || 'en')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script src="${MARKED_CDN}"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 1.5rem; line-height: 1.6; }
    h1,h2,h3 { margin-top: 1.5em; }
    img { max-width: 100%; }
    pre, code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 4px; }
    pre { padding: 1rem; overflow: auto; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <p><a href="index.html">← 返回列表</a></p>
  <div id="content"></div>
  <script>
    (function() {
      var md = '${bodyEscaped}';
      document.getElementById('content').innerHTML = marked.parse(md);
    })();
  </script>
</body>
</html>`;
}

function main() {
    const openFlag = process.argv.includes('--open');

    if (!fs.existsSync(MD_OUT_DIR)) {
        console.log('⚠️ 0_md_out 不存在');
        process.exit(1);
    }

    const files = collectMdFiles(MD_OUT_DIR);

    if (files.length === 0) {
        console.log('⚠️ 未找到 .md 文件');
        process.exit(1);
    }

    if (fs.existsSync(PREVIEW_DIR)) {
        try {
            fs.rmSync(PREVIEW_DIR, { recursive: true });
        } catch (_) {}
    }
    fs.mkdirSync(PREVIEW_DIR, { recursive: true });

    const links = [];
    for (const { fullPath, name, subdir } of files) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const fm = getFrontmatter(content);
        const slug = fm.slug || name.replace(/\.md$/i, '');
        const outSub = path.join(PREVIEW_DIR, subdir);
        if (!fs.existsSync(outSub)) fs.mkdirSync(outSub, { recursive: true });
        const outPath = path.join(outSub, slug + '.html');
        const relPath = path.relative(PREVIEW_DIR, outPath).replace(/\\/g, '/');
        fs.writeFileSync(outPath, buildPage(content, fm, relPath), 'utf-8');
        links.push({ title: fm.title || name, href: relPath });
    }

    const indexHtml = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>博客预览 - 0_md_out</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    ul { list-style: none; padding: 0; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    li { margin: 0.5rem 0; }
  </style>
</head>
<body>
  <h1>📄 本地预览 (0_md_out)</h1>
  <p>点击下方链接查看渲染效果。</p>
  <ul>
${links.map(l => `    <li><a href="${escapeHtml(l.href)}">${escapeHtml(l.title)}</a></li>`).join('\n')}
  </ul>
</body>
</html>`;
    fs.writeFileSync(path.join(PREVIEW_DIR, 'index.html'), indexHtml, 'utf-8');

    console.log('✅ 已生成 preview_out/');
    console.log('   打开: ' + path.join(PREVIEW_DIR, 'index.html'));

    if (openFlag) {
        const indexFile = path.join(PREVIEW_DIR, 'index.html');
        try {
            const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
            execSync(`${cmd} "${indexFile}"`, { stdio: 'inherit' });
        } catch (e) {
            console.log('   无法自动打开浏览器，请手动打开上述路径。');
        }
    }
}

main();
