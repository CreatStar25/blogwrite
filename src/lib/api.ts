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
): Promise<{ title: string; content: string }> {
  onLog("正在请求豆包 API 生成文章...");

  // Validate Model ID
  const modelId = params.model?.trim();
  if (!modelId || !modelId.startsWith('ep-')) {
     onLog("警告: 模型 ID 看起来不像 Endpoint ID (应以 ep- 开头)。如果失败，请检查 ID。");
  }
  
  // Map UI language to ISO code for frontmatter
  const langCodeMap: Record<string, string> = {
    English: 'en',
    Chinese: 'zh',
    Japanese: 'ja',
    Korean: 'ko',
  };
  const langCode = langCodeMap[params.language] || 'en';
  const references = (params.references || '')
    .split(/\n|,|;/)
    .map(s => s.trim())
    .filter(Boolean);

  const systemPrompt = `You are a senior SEO copywriter.
IMPORTANT: You MUST write the entire article content in ${params.language}. Only the "slug_en" in frontmatter must be in English.

Create a high-quality article about "${params.topic}" tailored for an Astro site.

Requirements:
1) Language: The article title, description, headings, and body text MUST be in ${params.language}.
2) Human tone, remove AI flavor, include concrete examples and practical tips.
3) Substance first: solve real user problems, be specific and actionable.
4) Clear structure: title, subtitle, intro, 3-5 sections, conclusion.
5) Keyword placement: naturally integrate "${params.keywords}" with 2%-3% density.
6) Internal links: provide 3-5 related topics at the end in [anchor](url) format using long-tail keywords.
7) Output in Markdown with Astro YAML frontmatter at the top.
---
title: Title in ${params.language} (<=60 chars, includes main keyword)
description: Description in ${params.language} (<=160 chars, includes main keyword)
pubDate: ISO date
lang: ${langCode}
slug_en: English kebab-case filename suggestion (ASCII only, e.g., bank-statement-pdf-to-excel-guide)
cover: slug_en + "-1.jpg"
---
8) Use ## and ### for headings, short sentences, 3-5 line paragraphs.
9) Word count: ${params.wordCount}.
10) Align with the website capability: bank statement PDF to Excel conversion.
11) If references are provided, align content topics accordingly and cite important points with inline markdown links.
12) IMAGES: Naturally insert ${params.imageCount} image placeholders within the content where illustrations would be most helpful.
   - Format: \`<!-- IMG_PROMPT: <detailed English description for AI image generator> -->\`
   - The prompt MUST be in English, descriptive, high-quality, and context-aware.
   - Example: \`<!-- IMG_PROMPT: A professional dashboard showing bank statement conversion process, high resolution, 4k -->\`

References:
${references.map((u, i) => `- [ref${i+1}](${u})`).join('\n')}

REMEMBER: The content MUST be in ${params.language}. Return only the final Markdown.`;

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

    const content = response.data.choices[0].message.content;
    
    // Extract title (simple heuristic: first line or # header)
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^(.+)$/m);
    const title = titleMatch ? titleMatch[1].replace(/\*\*/g, '').trim() : params.topic;
    // Extract slug_en from frontmatter
    const slugMatch = content.match(/slug_en:\s*([A-Za-z0-9-]+)/);
    const slug = slugMatch ? slugMatch[1].trim() : title
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

    onLog("文章生成成功！");
    return { title, content, slug } as any;

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

export async function generateImages(
  article: { title: string; content: string },
  params: GenerateParams,
  apiKey: string,
  onLog: (msg: string) => void
): Promise<{ images: ArticleData['images'], updatedContent: string }> {
  if (params.imageCount <= 0) return { images: [], updatedContent: article.content };

  onLog("正在分析文章结构以生成配图...");

  let updatedContent = article.content;
  const prompts: { prompt: string; index: number; placeholder: string }[] = [];
  
  // 1. Extract prompts from content
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

  // 2. Fallback if no prompts found or not enough
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

  const images: ArticleData['images'] = [];
  const imageModel = import.meta.env.VITE_DOUBAO_IMG_MODEL || IMG_MODEL_NAME;
  
  // Base slug for filenames
  const slugMatch = article.content.match(/slug_en:\s*([A-Za-z0-9-]+)/);
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
                prompt: item.prompt + ", 4k, high quality, photorealistic or professional illustration", // Append style
                n: 1,
                size: "1024x1024",
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
          blob = new Blob([array], { type: "image/jpeg" });
          url = URL.createObjectURL(blob);
        }
        
        const filename = `${slugBase}-${i+1}.jpg`;
        
        // Replace placeholder in content if it exists
        if (item.placeholder) {
            updatedContent = updatedContent.replace(item.placeholder, `![${item.prompt.substring(0, 50)}...](${filename})`);
        } else {
            // Fallback: Append to end or top? 
            // If it's the first image (cover), maybe we don't insert it into body if it's already in frontmatter?
            // But frontmatter says: cover: slug_en + "-1.jpg"
            // So image 1 corresponds to frontmatter cover.
            // Let's just append extra images at the end if no placeholder.
            if (i > 0) { // Don't append cover image duplicate
                 updatedContent += `\n\n![${item.prompt.substring(0, 50)}...](${filename})`;
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
