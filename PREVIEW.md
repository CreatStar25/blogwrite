# 博客 MD 预览与校验

在 blogwrite 里生成的 md 放在 `0_md_out/` 下，可用下面方式快速预览并保证没有错误。

## 1. 校验：保证 md 没有错误

在复制到各项目或翻译前，先做一次校验（frontmatter 必填项、格式）：

```bash
node 99validate-blogs.js
```

- 通过：会输出 `✅ 全部通过`，可继续执行 `99translate-blogs.js`。
- 不通过：会列出每个文件的错误项（如缺少 `title`、`slug`、`lang` 等），修正后再跑一次。

## 2. 本地 HTML 预览（看渲染效果）

把 `0_md_out` 下所有 md 转成 HTML 并生成列表页，在浏览器里看效果（无需安装任何 npm 包）：

```bash
node 99preview-blogs.js
```

会生成 `preview_out/` 目录，用浏览器打开 **`preview_out/index.html`** 即可看到文章列表，点击进入单篇渲染效果。

自动打开默认浏览器：

```bash
node 99preview-blogs.js --open
```

## 3. 编辑器内预览（最快）

在 Cursor / VS Code 里打开任意 `.md` 文件：

- **Mac**：`Cmd + Shift + V`
- **Windows / Linux**：`Ctrl + Shift + V`

即可在侧边看到实时 Markdown 预览。

## 4. 真实线上效果（目标项目）

要看到和正式站点一致的样式与布局，需要：

1. 运行 `99translate-blogs.js`，把 md 复制到对应博客项目（如 sunohk）。
2. 进入该博客项目根目录，启动开发服务器，例如：

   ```bash
   cd ../sunohk && npm run dev
   ```

3. 在浏览器打开控制台里提示的本地地址（如 `http://localhost:4321`），进入博客栏目查看文章。

---

**推荐流程**：先 `99validate-blogs.js` 校验 → 再用 `99preview-blogs.js` 或编辑器预览确认内容 → 最后 `99translate-blogs.js` 复制并翻译。
