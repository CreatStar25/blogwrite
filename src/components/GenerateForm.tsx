import React, { useState } from 'react';
import { Loader2, Settings2 } from 'lucide-react';

export interface GenerateParams {
  topic: string;
  keywords: string;
  language: string;
  wordCount: string;
  imageCount: number;
  apiKey?: string;
  model?: string;
  references?: string;
}

interface Props {
  onGenerate: (params: GenerateParams) => void;
  loading: boolean;
}

export function GenerateForm({ onGenerate, loading }: Props) {
  const [params, setParams] = useState<GenerateParams>({
    topic: '',
    keywords: '',
    language: 'Chinese',
    wordCount: '1000-2000',
    imageCount: 3,
    apiKey: '',
    model: import.meta.env.VITE_DOUBAO_MODEL || 'ep-20240604123456-abcde', // Default placeholder
    references: ''
  });

  const [showAdvanced, setShowAdvanced] = useState(true); // Open by default to show Endpoint ID

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(params);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          文章主题 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          placeholder="例如：React 性能优化指南"
          value={params.topic}
          onChange={e => setParams(p => ({ ...p, topic: e.target.value }))}
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          核心关键词 (逗号分隔)
        </label>
        <input
          type="text"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          placeholder="例如：React, Performance, Hooks"
          value={params.keywords}
          onChange={e => setParams(p => ({ ...p, keywords: e.target.value }))}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            语种
          </label>
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={params.language}
            onChange={e => setParams(p => ({ ...p, language: e.target.value }))}
            disabled={loading}
          >
            <option value="Chinese">中文 (Chinese)</option>
            <option value="English">英文 (English)</option>
            <option value="Japanese">日文 (Japanese)</option>
            <option value="Korean">韩文 (Korean)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            字数范围
          </label>
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={params.wordCount}
            onChange={e => setParams(p => ({ ...p, wordCount: e.target.value }))}
            disabled={loading}
          >
            <option value="500-1000">短篇 (500-1000字)</option>
            <option value="1000-2000">中篇 (1000-2000字)</option>
            <option value="2000+">长篇 (2000字以上)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          配图数量: {params.imageCount}
        </label>
        <input
          type="range"
          min="0"
          max="5"
          step="1"
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          value={params.imageCount}
          onChange={e => setParams(p => ({ ...p, imageCount: parseInt(e.target.value) }))}
          disabled={loading}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0</span>
          <span>5</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          参考链接（每行一个）
        </label>
        <textarea
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          placeholder="https://example.com/article-1\nhttps://example.com/article-2"
          value={params.references}
          onChange={e => setParams(p => ({ ...p, references: e.target.value }))}
          disabled={loading}
        />
        <p className="text-xs text-gray-500 mt-1">
          我会结合这些链接的主题进行写作（若无法读取内容，将以链接主题为参考）。
        </p>
      </div>

      <div className="pt-2">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Settings2 size={16} />
          {showAdvanced ? '隐藏高级设置' : '显示高级设置'}
        </button>
        
        {showAdvanced && (
           <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 space-y-3">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Model Endpoint ID (必填)
               </label>
               <div className="text-xs text-gray-500 mb-1">
                 请在火山引擎控制台创建推理接入点，并复制 <span className="font-mono text-blue-600">ep-</span> 开头的 ID。
                 <br />不要直接使用模型名称 (如 doubao-pro-4...)。
               </div>
               <input
                 type="text"
                 className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                 placeholder="ep-20240604xxxxxx-xxxxx"
                 value={params.model}
                 onChange={e => setParams(p => ({ ...p, model: e.target.value }))}
               />
             </div>

             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 API Key (可选, 覆盖环境变量)
               </label>
               <input
                 type="password"
                 className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                 placeholder="sk-..."
                 value={params.apiKey}
                 onChange={e => setParams(p => ({ ...p, apiKey: e.target.value }))}
               />
             </div>
           </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            正在生成内容...
          </>
        ) : (
          '开始生成'
        )}
      </button>
    </form>
  );
}
