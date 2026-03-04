/**
 * 校验 0_md_out 下所有 .md 的 frontmatter 与基本格式，保证没有错误再复制/发布。
 * 用法: node 99validate-blogs.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);
const MD_OUT_DIR = path.join(ROOT_DIR, '0_md_out');

const REQUIRED_FRONTMATTER = ['title', 'description', 'slug', 'lang'];

function getFrontmatter(content) {
    const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return null;
    const raw = m[1];
    const obj = {};
    for (const line of raw.split(/\r?\n/)) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        let val = line.slice(colon + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
            val = val.slice(1, -1);
        if (val.startsWith('[')) {
            try {
                obj[key] = JSON.parse(val.replace(/'/g, '"'));
            } catch {
                obj[key] = val;
            }
        } else {
            obj[key] = val;
        }
    }
    return obj;
}

function validateOne(filePath) {
    const rel = path.relative(MD_OUT_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const errors = [];

    if (!content.trim()) {
        errors.push('文件为空');
        return { filePath: rel, errors };
    }

    if (!content.startsWith('---')) {
        errors.push('缺少 frontmatter 开始 ---');
        return { filePath: rel, errors };
    }

    const fmEnd = content.indexOf('---', 3);
    if (fmEnd === -1) {
        errors.push('缺少 frontmatter 结束 ---');
        return { filePath: rel, errors };
    }

    const fm = getFrontmatter(content);
    if (!fm) {
        errors.push('无法解析 frontmatter');
        return { filePath: rel, errors };
    }

    for (const key of REQUIRED_FRONTMATTER) {
        if (!(key in fm) || String(fm[key]).trim() === '') {
            errors.push(`缺少或为空: ${key}`);
        }
    }

    if (fm.lang && !/^[\w-]+$/.test(String(fm.lang))) {
        errors.push('lang 格式应为字母、数字或连字符');
    }

    if (fm.slug && !/^[\w-]+$/.test(String(fm.slug))) {
        errors.push('slug 格式应为字母、数字或连字符（SEO 友好）');
    }

    const body = content.slice(fmEnd + 3).trim();
    if (!body) {
        errors.push('正文为空');
    }

    return { filePath: rel, errors };
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
            list.push(full);
        }
    }
    return list;
}

function main() {
    console.log('🔍 校验 0_md_out 下的 Markdown 与 Frontmatter...\n');

    if (!fs.existsSync(MD_OUT_DIR)) {
        console.log('⚠️ 0_md_out 目录不存在。');
        process.exit(0);
    }

    const files = collectMdFiles(MD_OUT_DIR);
    if (files.length === 0) {
        console.log('⚠️ 未找到 .md 文件。');
        process.exit(0);
    }

    let hasError = false;
    for (const f of files) {
        const { filePath, errors } = validateOne(f);
        if (errors.length > 0) {
            hasError = true;
            console.log(`❌ ${filePath}`);
            errors.forEach(e => console.log(`   - ${e}`));
            console.log('');
        } else {
            console.log(`✅ ${filePath}`);
        }
    }

    console.log('\n' + (hasError ? '❌ 存在错误，请修正后再复制/发布。' : '✅ 全部通过，可执行 99translate-blogs.js 复制并翻译。'));
    process.exit(hasError ? 1 : 0);
}

main();
