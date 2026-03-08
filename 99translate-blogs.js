/**
 * DeepSeek 通用博客翻译脚本 (批量多文件版)
 *
 * 流程：
 * 1. 扫描 0_md_out/ 下各子文件夹内的 .md，根据子文件夹名与 frontmatter 的 lang，将 md 复制到 GitHub 同名项目的博客指定语种目录（源文件保留，便于核对）。
 * 2. 将复制后的 md 翻译到该项目的其他语种（本土化表达、术语保留、不破坏 Markdown、保留链接）。
 *
 * 配置：在项目根目录的 .env 中设置 DEEPSEEK_API_KEY（.env 已加入 .gitignore，不会同步到 GitHub）；可选 TASKS_OVERRIDE 见下方。
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);

/** 从项目根目录加载 .env 到 process.env（不依赖 dotenv 包） */
function loadEnv() {
    const envPath = path.join(ROOT_DIR, '.env');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
            val = val.slice(1, -1);
        process.env[key] = val;
    }
}
loadEnv();

// ================= ⚙️ 用户配置 =================

/** DeepSeek API Key（从 .env 的 DEEPSEEK_API_KEY 读取，勿提交到仓库） */
const API_KEY = process.env.DEEPSEEK_API_KEY || '';

/** 存放待导出 md 的目录（子文件夹名 = 项目名） */
const MD_OUT_DIR = path.join(ROOT_DIR, '0_md_out');

/** 博客项目根目录（与 blogwrite 同级的 Github 目录） */
const GITHUB_ROOT = path.join(ROOT_DIR, '..');

/** 各项目内博客内容相对路径 */
const BLOG_CONTENT_SUBPATH = 'src/content/blog';

/**
 * 若设为非空数组，则跳过「从 0_md_out 扫描并复制」，仅按 TASKS 执行翻译。
 * 每项: { project: '项目名', path: 'src/content/blog/en/xxx.md' }
 */
const TASKS_OVERRIDE = [];

// ====================================================================

const BATCH_SIZE = 5;
const RETRY_MAX = 3;
const REQUEST_TIMEOUT = 180000;

const ALL_LANGS = {
    'en': 'English (英语)',
    'zh-cn': 'Simplified Chinese (简体中文)',
    'zh-tw': 'Traditional Chinese (繁体中文)',
    'es': 'Spanish (西班牙语)',
    'ar': 'Arabic (阿拉伯语)',
    'pt': 'Portuguese (葡萄牙语)',
    'id': 'Indonesian (印尼语)',
    'ms': 'Malay (马来语)',
    'fr': 'French (法语)',
    'ru': 'Russian (俄语)',
    'hi': 'Hindi (印地语)',
    'ja': 'Japanese (日语)',
    'de': 'German (德语)',
    'ko': 'Korean (韩语)',
    'tr': 'Turkish (土耳其语)',
    'vi': 'Vietnamese (越南语)',
    'th': 'Thai (泰语)',
    'it': 'Italian (意大利语)',
    'fa': 'Persian (波斯语)',
    'nl': 'Dutch (荷兰语)',
    'pl': 'Polish (波兰语)',
    'sv': 'Swedish (瑞典语)',
    'uk': 'Ukrainian (乌克兰语)',
    'ro': 'Romanian (罗马尼亚语)'
};

['http_proxy', 'https_proxy', 'all_proxy'].forEach(k => delete process.env[k]);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** 从 Markdown 内容中解析 frontmatter 的 lang 字段 */
function getLangFromFrontmatter(content) {
    const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return null;
    const langM = m[1].match(/^lang:\s*["']?([\w-]+)["']?/m);
    return langM ? langM[1].trim() : null;
}

/**
 * 验证并修复 MD 的 frontmatter 格式，使其符合 Astro 规范：
 * - 必须以单独一行的 `---` 开始
 * - 必须以单独一行的 `---` 结束，且第二个 `---` 后换行再写正文
 * @returns {{ content: string, fixed: boolean }}
 */
function validateAndFixFrontmatter(content) {
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    let fixed = false;
    let out = content;

    // 1. 确保开头是单独的 ---（无前导空白）
    if (!out.startsWith('---')) {
        const firstLine = out.split(/\r?\n/)[0] || '';
        if (firstLine.match(/^[\w-]+:\s*/)) {
            out = '---' + lineEnding + out;
            fixed = true;
        }
    } else if (out.match(/^[\s]+---/)) {
        out = out.replace(/^[\s]+/, '');
        fixed = true;
    }

    // 2. 定位 closing ---（行首的 ---，即 \n--- 或 \r\n---）
    const openMatch = out.match(/^---\r?\n/);
    if (!openMatch) return { content: out, fixed };
    const openLen = openMatch[0].length;
    const afterOpen = out.slice(openLen);
    const closeMatch = afterOpen.match(/\r?\n---\s*(\r?\n)?/);
    if (!closeMatch) return { content: out, fixed };

    const endOfDelim = closeMatch.index + closeMatch[0].length;
    let body = afterOpen.slice(endOfDelim);
    // 3. 第二个 --- 后必须有换行再接正文
    if (body.length > 0 && body[0] !== '\n' && body[0] !== '\r') {
        body = lineEnding + body;
        out = out.slice(0, openLen) + afterOpen.slice(0, endOfDelim) + body;
        fixed = true;
    }

    return { content: out, fixed };
}

/** 扫描 0_md_out：返回 { projectDir, relativePath, sourceLangCode }[]，并已执行复制（源文件保留） */
function scanAndMoveMdFromExport() {
    const tasks = [];
    if (!fs.existsSync(MD_OUT_DIR)) {
        console.log('⚠️ 0_md_out 目录不存在，跳过扫描与移动。');
        return tasks;
    }

    const subdirs = fs.readdirSync(MD_OUT_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'));

    for (const sub of subdirs) {
        const projectName = sub.name;
        const projectDir = path.join(GITHUB_ROOT, projectName);
        const exportSubDir = path.join(MD_OUT_DIR, projectName);

        if (!fs.existsSync(projectDir)) {
            console.warn(`⚠️ 未找到同名项目 ${projectName}，跳过目录 ${exportSubDir}`);
            continue;
        }

        const blogBase = path.join(projectDir, BLOG_CONTENT_SUBPATH);
        const files = fs.readdirSync(exportSubDir, { withFileTypes: true })
            .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.md'));

        for (const f of files) {
            const srcPath = path.join(exportSubDir, f.name);
            let content;
            try {
                content = fs.readFileSync(srcPath, 'utf-8');
            } catch (e) {
                console.warn(`⚠️ 无法读取 ${srcPath}，跳过。`);
                continue;
            }

            const lang = getLangFromFrontmatter(content);
            if (!lang || !ALL_LANGS[lang]) {
                console.warn(`⚠️ ${f.name} 无有效 frontmatter lang，跳过。`);
                continue;
            }

            const langDir = path.join(blogBase, lang);
            const destPath = path.join(langDir, f.name);

            if (fs.existsSync(destPath)) {
                console.log(`⏭️ 目标已存在，跳过复制: ${projectName}/${BLOG_CONTENT_SUBPATH}/${lang}/${f.name}`);
                continue;
            }

            try {
                if (!fs.existsSync(langDir)) fs.mkdirSync(langDir, { recursive: true });
                fs.copyFileSync(srcPath, destPath);
                console.log(`📦 已复制: ${projectName}/${BLOG_CONTENT_SUBPATH}/${lang}/${f.name}`);
            } catch (e) {
                console.warn(`⚠️ 复制失败 ${srcPath} -> ${destPath}: ${e.message}`);
                continue;
            }

            const relativePath = `${BLOG_CONTENT_SUBPATH}/${lang}/${f.name}`;
            tasks.push({ projectDir, relativePath, sourceLangCode: lang, projectName });
        }
    }

    return tasks;
}

function detectSourceLang(filePath) {
    const codes = Object.keys(ALL_LANGS);
    codes.sort((a, b) => b.length - a.length);
    for (const code of codes) {
        if (filePath.includes(`/${code}/`)) return code;
        if (filePath.startsWith(`${code}/`)) return code;
        if (filePath.includes(`.${code}.`)) return code;
    }
    return null;
}

/** 翻译：本土化、术语保留、不破坏 Markdown、不修改链接 */
function translateContent(rawContent, targetLangName, sourceLangName) {
    return new Promise((resolve, reject) => {
        const systemPrompt = `You are a professional tech blog translator.
Task: Translate the Markdown from ${sourceLangName} to ${targetLangName}.

RULES:
1. **Localization:** Use natural, idiomatic ${targetLangName}—do NOT literal/word-for-word translation.
2. **Terms:** Keep product names, brand names, technical terms (e.g. ARR, API, frontmatter), and proper nouns unchanged unless they have an official localized form.
3. **Markdown:** Do NOT change or break any Markdown syntax: headers (#), lists (- or 1.), bold (**), links ([text](url)), images (![alt](url)), code blocks (\`\`\`), or frontmatter structure (---).
4. **Links & URLs:** Keep every link and URL exactly as in the source. Do NOT translate or modify href/src paths, image URLs, or anchor URLs inside the document.
5. **Frontmatter:** Keep keys in English. Translate only the values for title and description. Set lang to the target language code in your output.
6. **Output:** Return ONLY the full Markdown. Start with ---.`;

        const payload = JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: rawContent }
            ],
            temperature: 0.7,
            stream: false
        });

        const options = {
            hostname: 'api.deepseek.com',
            port: 443,
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Length': Buffer.byteLength(payload)
            },
            rejectUnauthorized: false,
            family: 4,
            timeout: REQUEST_TIMEOUT
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) return reject(new Error(parsed.error.message));
                        let content = parsed.choices[0].message.content.trim();
                        if (content.startsWith('```')) {
                            content = content.replace(/^```(markdown)?\n/i, '').replace(/\n```$/, '');
                        }
                        resolve(content);
                    } catch (e) {
                        reject(new Error('JSON 解析失败'));
                    }
                } else if (res.statusCode === 401) {
                    reject(new Error('HTTP 401 未授权 - 请检查 API Key'));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
        req.write(payload);
        req.end();
    });
}

async function processSingleFile(fullSourcePath, fullTargetPath, langCode, targetLangName, sourceLangName) {
    if (fs.existsSync(fullTargetPath)) {
        console.log(`⏭️ [${langCode}] 已存在，跳过翻译`);
        return;
    }
    const targetDir = path.dirname(fullTargetPath);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const rawContent = fs.readFileSync(fullSourcePath, 'utf-8');

    let attempt = 1;
    while (attempt <= RETRY_MAX) {
        try {
            console.log(`🚀 [${langCode}] 正在翻译...`);
            const translated = await translateContent(rawContent, targetLangName, sourceLangName);

            if (!translated.startsWith('---') && rawContent.startsWith('---')) throw new Error('丢失 Frontmatter');

            let finalContent = translated.replace(
                /^lang:\s*["']?[\w-]+["']?/m,
                `lang: "${langCode}"`
            );
            // 翻译后的 md 删除 slug 行（仅改写入内容，源文件不改）
            finalContent = finalContent.replace(/^\s*slug:\s*[^\n]+\n/gm, '');

            // 验证并修复 frontmatter 格式（Astro：--- 单独成行、闭合后换行再写正文）
            const { content: validatedContent, fixed } = validateAndFixFrontmatter(finalContent);
            finalContent = validatedContent;
            if (fixed) console.log(`🔧 [${langCode}] 已修复 frontmatter 格式`);

            fs.writeFileSync(fullTargetPath, finalContent, 'utf-8');
            console.log(`✅ [${langCode}] 保存成功`);
            return;
        } catch (e) {
            console.error(`⚠️ [${langCode}] 失败: ${e.message}`);
            if (e.message.includes('401')) {
                console.error('🛑 鉴权失败，程序终止。');
                process.exit(1);
            }
            if (attempt < RETRY_MAX) {
                await sleep(2000);
                attempt++;
            } else {
                console.error(`❌ [${langCode}] 放弃`);
                return;
            }
        }
    }
}

async function processTaskItem(task, index, total) {
    const { projectDir, relativePath, sourceLangCode, projectName } = task;
    const fullSourcePath = path.join(projectDir, relativePath);

    console.log(`\n========================================`);
    console.log(`📂 任务 (${index + 1}/${total}): ${projectName}`);
    console.log(`📄 ${relativePath}`);

    if (!fs.existsSync(projectDir)) {
        console.error(`❌ 项目目录不存在: ${projectDir}`);
        return;
    }
    if (!fs.existsSync(fullSourcePath)) {
        console.error(`❌ 源文件不存在: ${fullSourcePath}`);
        return;
    }

    const detectedCode = detectSourceLang(relativePath) || sourceLangCode;
    const sourceLangName = ALL_LANGS[detectedCode];
    if (!sourceLangName) {
        console.error(`❌ 未识别的源语言: ${detectedCode}`);
        return;
    }
    console.log(`🔍 源语言: ${sourceLangName} (${detectedCode})`);

    const targetQueue = [];
    for (const [code, name] of Object.entries(ALL_LANGS)) {
        if (code === detectedCode) continue;
        let newRelativePath;
        if (relativePath.includes(`/${detectedCode}/`)) {
            newRelativePath = relativePath.replace(`/${detectedCode}/`, `/${code}/`);
        } else if (relativePath.startsWith(`${detectedCode}/`)) {
            newRelativePath = relativePath.replace(`${detectedCode}/`, `${code}/`);
        } else {
            newRelativePath = relativePath.replace(new RegExp(`\\.${detectedCode.replace(/-/g, '\\-')}\\.`), `.${code}.`);
        }
        targetQueue.push({ code, name, fullPath: path.join(projectDir, newRelativePath) });
    }

    console.log(`⚡ 目标: ${targetQueue.length} 种语言`);
    console.log(`========================================`);

    for (let i = 0; i < targetQueue.length; i += BATCH_SIZE) {
        const batch = targetQueue.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(item =>
            processSingleFile(fullSourcePath, item.fullPath, item.code, item.name, sourceLangName)
        ));
        if (i + BATCH_SIZE < targetQueue.length) await sleep(1000);
    }
    console.log(`🎉 ${relativePath} 处理完毕！`);
}

async function main() {
    if (!API_KEY || API_KEY.trim() === '') {
        console.error('🛑 请在项目根目录 .env 中配置 DEEPSEEK_API_KEY（可参考 .env.example）');
        process.exit(1);
    }

    let tasks = [];

    if (TASKS_OVERRIDE.length > 0) {
        console.log('📌 使用 TASKS_OVERRIDE，跳过 0_md_out 扫描与复制。\n');
        tasks = TASKS_OVERRIDE.map(t => {
            const code = detectSourceLang(t.path);
            if (!code || !ALL_LANGS[code]) return null;
            return {
                projectDir: path.join(GITHUB_ROOT, t.project),
                relativePath: t.path,
                sourceLangCode: code,
                projectName: t.project
            };
        }).filter(Boolean);
    } else {
        console.log('📂 扫描 0_md_out 并复制 md 到各项目...\n');
        tasks = scanAndMoveMdFromExport();
    }

    if (tasks.length === 0) {
        console.log('⚠️ 无待处理任务。');
        return;
    }

    console.log(`\n🚀 开始翻译，共 ${tasks.length} 个文件。`);

    for (let i = 0; i < tasks.length; i++) {
        await processTaskItem(tasks[i], i, tasks.length);
    }

    console.log('\n✅ 全部完成。');
}

main();
