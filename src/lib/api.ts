import axios from 'axios';
import { GenerateParams } from '../components/GenerateForm';
import { ArticleData } from '../App';

// Use local proxy to avoid CORS
const API_BASE = '/api'; 

// const MODEL_NAME = 'doubao-pro-4-250828'; // DEPRECATED: Must use Endpoint ID
const IMG_MODEL_NAME = 'doubao-seedream-4-5-251128'; // Image model name might also need Endpoint ID depending on setup

export async function generateArticle(
  params: GenerateParams, 
  apiKey: string, 
  onLog: (msg: string) => void
): Promise<{ title: string; content: string; slug: string; images_metadata?: any[] }> {
  onLog("正在请求豆包 API 生成文章...");

  // Validate Model ID
  const modelId = params.model?.trim();
  if (!modelId || !modelId.startsWith('ep-')) {
     onLog("警告: 模型 ID 看起来不像 Endpoint ID (应以 ep- 开头)。如果失败，请检查 ID。");
  }
  
  // Map UI language to ISO code for frontmatter
  const langCodeMap: Record<string, string> = {
    English: 'en',
    Chinese: 'zh-cn',
    Japanese: 'ja',
    Korean: 'ko',
  };
  const langCode = langCodeMap[params.language] || 'en';

  const projectUrl = PROJECT_URLS[params.project || 'aixzip'] || 'https://img.aixzip.com/aitools/';

  const systemPrompt = `你是资深Astro博文作者+SEO优化师，精通Astro博客MD文件规范、Cloudflare R2图片存储配置，同时擅长结合竞品SEO策略，撰写高收录、高引流的博文。

请根据以下信息，撰写1篇符合astro要求的博文，并以 JSON 格式输出。

核心信息：
1. 博文标题：${params.topic}
2. 对应SEO关键词：${params.keywords}
3. 文章语种为：${params.language}
4. Cloudflare R2自定义域名前缀：${projectUrl}

撰写及格式要求（严格遵守，缺一不可）：
1. 符合Astro网站博文规范：
    - 开头必须包含Astro标准Frontmatter配置（精准填写，贴合SEO）：
      ---
      title: 【博文标题，核心关键词前置，无堆砌】
      description: 【100-150字，融入1个核心关键词+1个长尾关键词，概括博文核心价值】
      pubDate: 【发布日期，格式：YYYY-MM-DD】
      coverImage: 【第一张配图的完整R2引用地址，格式：自定义域名前缀+图片文件名】
      tags: 【2-5个标签，含1个核心SEO关键词，逗号分隔】
      lang: ${langCode}
      slug_en: 【English kebab-case string only, even if language is not English. NO Pinyin. Example: bank-statement-to-excel】
      ---
    - 正文排版：逻辑清晰（按“痛点引入→核心内容→实操步骤→总结”结构撰写）；层级分明（H2=一级小标题、H3=二级小标题，不使用H1）；重点SEO关键词可加粗，合理使用有序列表、无序列表；

2. 配图要求：
    - 全文包含 ${params.imageCount} 张配图
    - 图片内容要和文章内容相关；首张图片也作为文章的封面图。
    - 配图插入格式：![配图描述](完整R2引用地址)，配图描述需融入1个相关SEO关键词，简洁精准（5-15字）；
    - 图片引用要求：所有配图必须引用完整的Cloudflare R2自定义域名（${projectUrl} + 图片文件名.webp），绝对禁止使用相对路径、本地路径。

3. SEO命名规范：
    - 图片文件名：必须是纯英文 (English only)，kebab-case 格式。禁止使用拼音 (NO Pinyin)。格式：english-keyword-topic.webp（例：astro-seo-cover.webp）；

4. 额外要求：
    - 博文内容贴合目标人群痛点，字数 ${params.wordCount}。
    - 语言贴合目标人群。
    - 结尾可加入简单引导。

RESPONSE FORMAT (JSON ONLY):
{
  "title": "Article Title",
  "slug": "english-kebab-case-slug-only-no-pinyin",
  "content": "Full Markdown content including frontmatter and image links",
  "images_metadata": [
    {
      "filename": "english-filename-only.webp",
      "prompt": "Detailed English prompt for AI image generation (high quality, 4k, etc.). Text in image MUST be English only.",
      "alt": "Short SEO description used in markdown"
    }
  ]
}

Ensure the "content" field contains the complete Markdown article.
Ensure "images_metadata" contains an entry for EVERY image link used in the content.
`;

  try {
    // Note: If using Volcengine Ark, the URL is /chat/completions
    // Headers: Authorization: Bearer <apikey>
    const response = await axios.post(
      `${API_BASE}/chat/completions`,
      {
        model: modelId, // Use the dynamic Endpoint ID
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Write an article about "${params.topic}" in ${params.language}.` }
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 300000 // 5 minutes timeout for long generation
      }
    );

    let contentStr = response.data.choices[0].message.content;
    
    // Attempt to parse JSON
    let parsedData: any = {};
    try {
        // Try to find JSON block if mixed with text
        const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0]);
        } else {
            parsedData = JSON.parse(contentStr);
        }
    } catch (e) {
        onLog("警告: 模型未返回标准的 JSON 格式，尝试手动解析 Markdown...");
        // Fallback: Treat entire content as Markdown
        parsedData = {
            title: params.topic,
            content: contentStr,
            slug: params.topic.toLowerCase().replace(/\s+/g, '-'),
            images_metadata: []
        };
    }

    const { title, content, slug, images_metadata } = parsedData;

    onLog("文章生成成功！");
    return { title, content, slug, images_metadata };

  } catch (error: any) {
    console.error("Article Generation Error:", error);
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
       onLog("错误: 请求超时 (Timeout)。模型生成时间过长，请尝试减少字数或检查网络。已自动延长超时时间设置。");
       throw new Error("请求超时: 超过 5 分钟未收到响应。可能是模型生成内容过长或网络阻塞。");
    }
    if (error.response) {
       console.error("API Response Data:", error.response.data);
       const errorMsg = error.response.data?.error?.message || JSON.stringify(error.response.data);
       
       if (error.response.status === 401) {
         onLog(`错误: 认证失败 (401)。请检查您的 API Key 是否正确。`);
         throw new Error(`认证失败: API Key 无效或格式错误。请检查 .env 文件配置。`);
       } else if (error.response.status === 404) {
         onLog(`错误: 模型接入点不存在 (404)。请检查 VITE_DOUBAO_MODEL 或 VITE_DOUBAO_IMG_MODEL 是否配置正确的 ep- ID。`);
       }
       
       onLog(`API Error: ${error.response.status} - ${errorMsg}`);
    }
    throw new Error(`文章生成失败: ${error.message}`);
  }
}

const PROJECT_URLS: Record<string, string> = {
  aixzip: 'https://img.aixzip.com/aitools/',
  banksmt: 'https://img.bankstatementconverte.com/banksmt/',
  limaxai: 'https://img.limaxai.com/limaxaiblog/',
};

export async function generateImages(
  article: { title: string; content: string; images_metadata?: any[] },
  params: GenerateParams,
  apiKey: string,
  onLog: (msg: string) => void
): Promise<{ images: ArticleData['images'], updatedContent: string }> {
  if (params.imageCount <= 0) return { images: [], updatedContent: article.content };

  onLog("正在分析文章结构以生成配图...");

  let updatedContent = article.content;
  const prompts: { prompt: string; index: number; placeholder: string; filename?: string; isPreGeneratedLink?: boolean }[] = [];
  
  // 1. Check for AI-provided metadata (New Logic)
  if (article.images_metadata && Array.isArray(article.images_metadata) && article.images_metadata.length > 0) {
      onLog(`发现 ${article.images_metadata.length} 个预定义的配图任务...`);
      article.images_metadata.forEach((meta, i) => {
          if (i >= params.imageCount) return;
          prompts.push({
              prompt: meta.prompt || meta.alt || params.topic, // Fallback to alt or topic
              index: i,
              placeholder: "", 
              filename: meta.filename,
              isPreGeneratedLink: true
          });
      });
  } else {
      // 2. Extract prompts from content (Old Logic)
      const regex = /<!--\s*IMG_PROMPT:\s*(.*?)\s*-->/g;
      let match;
      let imgIndex = 0;
      
      while ((match = regex.exec(article.content)) !== null) {
          if (imgIndex >= params.imageCount) break;
          prompts.push({
              prompt: match[1].trim(),
              index: imgIndex,
              placeholder: match[0]
          });
          imgIndex++;
      }

      // 3. Fallback if no prompts found or not enough
      if (prompts.length === 0) {
           onLog("未在文中找到图片占位符，使用默认策略...");
           // Fallback: Generate one main image based on Title
           prompts.push({
               prompt: `${params.topic}, ${params.keywords}, high quality, professional, 4k, SEO-friendly style, English-only text, no non-English characters, prefer text-free visual`,
               index: 0,
               placeholder: "" // No placeholder to replace
           });
           
           // Fallback: Generate subsequent images based on H2 headers if needed
           const headers = article.content.match(/^##\s+(.+)$/gm)?.map(h => h.replace(/^##\s+/, '').trim()) || [];
           headers.slice(0, params.imageCount - 1).forEach((h, i) => {
              if (prompts.length < params.imageCount) {
                  prompts.push({
                      prompt: `${h} related to ${params.topic}, professional illustration, detailed, 4k, English-only text, no non-English characters, prefer text-free visual`,
                      index: prompts.length,
                      placeholder: ""
                  });
              }
           });
      }
  }

  const images: ArticleData['images'] = [];
  const imageModel = import.meta.env.VITE_DOUBAO_IMG_MODEL || IMG_MODEL_NAME;
  
  // Base slug for filenames
  const slugMatch = article.content.match(/slug_en:\s*([A-Za-z0-9-]+)/); // Old frontmatter check
  // Also check for 'slug' in metadata if available? No, usually in content.
  // Or just use title.
  const slugBase = (slugMatch ? slugMatch[1].trim() : (article.title || params.topic))
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();

  // Generate images
  for (let i = 0; i < prompts.length; i++) {
    const item = prompts[i];
    onLog(`正在生成第 ${i+1}/${prompts.length} 张图片...`);
    
    try {
      if (!imageModel.startsWith('ep-') && !imageModel.includes('doubao')) {
          onLog(`警告: 图片模型 ID "${imageModel}" 可能不正确。火山引擎通常需要 ep- 开头的接入点 ID。`);
      }

      const response = await axios.post(
            `${API_BASE}/images/generations`,
            {
                model: imageModel, 
                prompt: item.prompt + ", 4k, high quality, photorealistic or professional illustration, text in image must be English only, no other languages", // Append style and strict language constraint
                n: 1,
                size: params.imageSize || "1024x1024",
                response_format: "b64_json"
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 60000
            }
        );

        const resData = response.data.data[0];
        const b64 = resData.b64_json as string | undefined;
        let url = resData.url as string | undefined;
        let blob: Blob | undefined;
        if (b64) {
          const binary = atob(b64);
          const array = new Uint8Array(binary.length);
          for (let k = 0; k < binary.length; k++) array[k] = binary.charCodeAt(k);
          blob = new Blob([array], { type: "image/webp" });
          url = URL.createObjectURL(blob);
        }
        
        // Determine filename
        let filename = `${slugBase}-${i+1}.webp`;
        if (item.filename) {
            // Clean up filename from metadata just in case
            filename = item.filename.split('/').pop() || filename;
            if (!filename.endsWith('.webp')) filename = filename.replace(/\.\w+$/, '') + '.webp';
        }

        const projectPrefix = params.project ? PROJECT_URLS[params.project] : '';
        const fullImageUrl = projectPrefix ? `${projectPrefix}${filename}` : filename;
        
        // Replace placeholder in content if it exists
        if (item.placeholder) {
            updatedContent = updatedContent.replace(item.placeholder, `![${item.prompt.substring(0, 50)}...](${fullImageUrl})`);
        } else if (!item.isPreGeneratedLink) {
            // Only append if it wasn't already linked in the content by AI
            if (i > 0) { 
                 updatedContent += `\n\n![${item.prompt.substring(0, 50)}...](${fullImageUrl})`;
            }
        }

        images.push({ url: url || "", prompt: item.prompt, filename, blob, b64 });

    } catch (error: any) {
        console.error(`Image ${i+1} generation failed:`, error);
        onLog(`警告: 第 ${i+1} 张图片生成失败 - ${error.message}`);
    }
  }

  return { images, updatedContent };
}

export async function generateSingleImage(params: {
  prompt: string;
  size: string;
  apiKey: string;
  model?: string;
}): Promise<{ url: string; filename: string; blob?: Blob }> {
  const imageModel = params.model?.trim() || import.meta.env.VITE_DOUBAO_IMG_MODEL || IMG_MODEL_NAME;
  
  // Append style and negative prompt instructions to the prompt
  const finalPrompt = `${params.prompt}, high quality, 4k, no watermark, clean image, text in image must be English only, no other languages`;

  const response = await axios.post(
    `${API_BASE}/images/generations`,
    {
      model: imageModel,
      prompt: finalPrompt,
      n: 1,
      size: params.size,
      response_format: "b64_json"
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`
      },
      timeout: 60000
    }
  );

  const resData = response.data.data[0];
  const b64 = resData.b64_json as string | undefined;
  let url = resData.url as string | undefined;
  let blob: Blob | undefined;

  if (b64) {
    const binary = atob(b64);
    const array = new Uint8Array(binary.length);
    for (let k = 0; k < binary.length; k++) array[k] = binary.charCodeAt(k);
    blob = new Blob([array], { type: "image/jpeg" });
    url = URL.createObjectURL(blob);
  }

  const filename = `generated-${Date.now()}.jpg`;
  
  if (!url) throw new Error("No image URL returned");

  return { url, filename, blob };
}
