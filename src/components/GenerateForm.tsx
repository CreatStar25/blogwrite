import React, { useState } from 'react';
import { Loader2, Settings2 } from 'lucide-react';

export interface GenerateParams {
  topic: string;
  keywords: string;
  language: string;
  wordCount: string;
  imageCount: number;
  imageSize: string;
  apiKey?: string;
  model?: string;
  project?: string;
}

interface Props {
  onGenerate: (params: GenerateParams) => void;
  loading: boolean;
}

export function GenerateForm({ onGenerate, loading }: Props) {
  const [params, setParams] = useState<GenerateParams>({
    topic: '',
    keywords: '',
    language: 'English',
    wordCount: '500字左右',
    imageCount: 1,
    imageSize: '1024x768', // Default 4:3
    apiKey: '',
    model: import.meta.env.VITE_DOUBAO_MODEL || 'ep-20240604123456-abcde', // Default placeholder
    project: 'aixzip'
  });

  const projects = [
    { id: 'aixzip', name: 'aixzip', url: 'https://img.aixzip.com/aitools/' },
    { id: 'banksmt', name: 'banksmt', url: 'https://img.bankstatementconverte.com/banksmt/' },
    { id: 'limaxai', name: 'limaxai', url: 'https://img.limaxai.com/limaxaiblog/' },
  ];

  const aspectRatios = [
    { label: '4:3 (宽幅)', value: '1024x768' },
    { label: '1:1 (正方形)', value: '1024x1024' },
    { label: '16:9 (横屏)', value: '1280x720' },
    { label: '3:4 (竖屏)', value: '768x1024' },
    { label: '9:16 (手机)', value: '720x1280' },
  ];

  const [showAdvanced, setShowAdvanced] = useState(false); // Default hidden as requested

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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          项目选择
        </label>
        <select
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          value={params.project}
          onChange={e => setParams(p => ({ ...p, project: e.target.value }))}
          disabled={loading}
        >
          {projects.map(proj => (
            <option key={proj.id} value={proj.id}>
              {proj.name} ({proj.url})
            </option>
          ))}
        </select>
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
            <option value="500字左右">500字左右</option>
            <option value="1000字左右">1000字左右</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
            图片比例
          </label>
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={params.imageSize}
            onChange={e => setParams(p => ({ ...p, imageSize: e.target.value }))}
            disabled={loading}
          >
            {aspectRatios.map(ratio => (
              <option key={ratio.value} value={ratio.value}>
                {ratio.label}
              </option>
            ))}
          </select>
        </div>
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
