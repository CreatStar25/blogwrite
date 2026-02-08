import React, { useState } from 'react';
import { Loader2, Download, Image as ImageIcon, Settings2 } from 'lucide-react';
import { generateSingleImage } from '../lib/api';

interface Props {
  apiKey?: string;
  onLog: (msg: string) => void;
}

export function ImageGenerator({ apiKey: initialApiKey, onLog }: Props) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('4:3');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{ url: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [localApiKey, setLocalApiKey] = useState('');
  const [localModel, setLocalModel] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const aspectRatios = [
    { label: '1:1 (正方形)', value: '1:1', size: '1024x1024' },
    { label: '16:9 (横屏)', value: '16:9', size: '1280x720' }, 
    { label: '4:3 (标准)', value: '4:3', size: '1024x768' },
    { label: '3:4 (竖屏)', value: '3:4', size: '768x1024' },
    { label: '9:16 (手机)', value: '9:16', size: '720x1280' },
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    onLog("开始生成图片...");

    try {
      const selectedRatio = aspectRatios.find(r => r.value === aspectRatio);
      const size = selectedRatio ? selectedRatio.size : '1024x1024';

      // Use local key if provided, otherwise prop key, otherwise env key
      const apiKey = localApiKey || initialApiKey || import.meta.env.VITE_DOUBAO_API_KEY || '';

      if (!apiKey) {
        throw new Error("请配置 API Key");
      }

      const image = await generateSingleImage({
        prompt,
        size,
        apiKey,
        model: localModel
      });

      setGeneratedImage(image);
      onLog("图片生成成功！");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "生成失败");
      onLog(`错误: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage.url;
      link.download = generatedImage.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          AI 生图
        </h2>
        
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              提示词 <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
              placeholder="描述你想要生成的图片画面..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              图片比例
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={aspectRatio}
              onChange={e => setAspectRatio(e.target.value)}
              disabled={loading}
            >
              {aspectRatios.map(ratio => (
                <option key={ratio.value} value={ratio.value}>
                  {ratio.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 size={16} />
              {showSettings ? '隐藏设置' : '设置 API Key'}
            </button>
            
            {showSettings && (
               <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 space-y-3">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Model Endpoint ID (必填)
                   </label>
                   <div className="text-xs text-gray-500 mb-1">
                     请在火山引擎控制台创建推理接入点，并复制 <span className="font-mono text-blue-600">ep-</span> 开头的 ID。
                   </div>
                   <input
                     type="text"
                     className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder="ep-20240604xxxxxx-xxxxx"
                     value={localModel}
                     onChange={e => setLocalModel(e.target.value)}
                   />
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     API Key (可选)
                   </label>
                   <input
                     type="password"
                     className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder="sk-..."
                     value={localApiKey}
                     onChange={e => setLocalApiKey(e.target.value)}
                   />
                   <p className="text-xs text-gray-500 mt-1">
                     如果有环境变量配置，可留空。
                   </p>
                 </div>
               </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                正在生成...
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5" />
                开始生成
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {generatedImage && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">生成结果</h3>
          <div className="relative group">
            <img 
              src={generatedImage.url} 
              alt={prompt}
              className="w-full rounded-lg shadow-md"
            />
            <button
              onClick={handleDownload}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
              title="下载图片"
            >
              <Download size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
