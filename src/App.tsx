import { useState } from 'react';
import { GenerateForm, GenerateParams } from './components/GenerateForm';
import { ImageGenerator } from './components/ImageGenerator';
import { Preview } from './components/Preview';
import { generateArticle, generateImages, generateSingleImage } from './lib/api';
import { Layout } from './components/Layout';
import { Download, FileText, Image as ImageIcon } from 'lucide-react';
import { saveAsZip } from './lib/utils';

export interface ArticleData {
  title: string;
  content: string;
  slug?: string;
  images: { url: string; prompt: string; filename: string; blob?: Blob; b64?: string }[];
}

function App() {
  const [activeTab, setActiveTab] = useState<'article' | 'image'>('article');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ArticleData | null>(null);
  const [lastParams, setLastParams] = useState<GenerateParams | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [sharedApiKey, setSharedApiKey] = useState<string>('');
  const [regeneratingIndices, setRegeneratingIndices] = useState<number[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleGenerate = async (params: GenerateParams) => {
    setLoading(true);
    setError(null);
    setData(null);
    setLastParams(params);
    setLogs([]);
    
    // Share API key if provided
    if (params.apiKey) {
      setSharedApiKey(params.apiKey);
    }
    
    addLog("开始生成文章...");

    try {
      if (!import.meta.env.VITE_DOUBAO_API_KEY && !params.apiKey) {
        throw new Error("请配置 API Key");
      }
      
      const apiKey = (params.apiKey || import.meta.env.VITE_DOUBAO_API_KEY || "").trim();

      if (!apiKey || apiKey === 'your_api_key_here') {
        throw new Error("请先配置 API Key！\n您可以在 .env 文件中配置 VITE_DOUBAO_API_KEY，或者在高级设置中临时输入。");
      }

      // 1. Generate Article
      const article = await generateArticle(params, apiKey, addLog);
      
      // 2. Generate Images
      addLog(`开始生成 ${params.imageCount} 张配图...`);
      const { images, updatedContent } = await generateImages(article, params, apiKey, addLog);

      setData({
        title: article.title,
        content: updatedContent,
        slug: (article as any).slug,
        images: images
      });
      addLog("所有任务完成！");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "生成失败");
      addLog(`错误: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateImage = async (index: number) => {
    if (!data) return;
    const imageToRegenerate = data.images[index];
    if (!imageToRegenerate) return;

    setRegeneratingIndices(prev => [...prev, index]);
    addLog(`正在重新生成第 ${index + 1} 张图片...`);

    try {
      const apiKey = (sharedApiKey || import.meta.env.VITE_DOUBAO_API_KEY || "").trim();
      if (!apiKey) throw new Error("API Key 未配置");

      const imageSize = lastParams?.imageSize || "1024x768"; // Default to 4:3 if not found
      
      const newImage = await generateSingleImage({
        prompt: imageToRegenerate.prompt,
        size: imageSize,
        apiKey,
        // model: Do not use lastParams.model as it is for text generation. 
        // Let generateSingleImage use the default image model (IMG_MODEL_NAME).
      });

      setData(prev => {
        if (!prev) return null;
        const newImages = [...prev.images];
        newImages[index] = {
          ...newImages[index],
          url: newImage.url,
          filename: newImage.filename,
          blob: newImage.blob,
          // b64 is not returned by generateSingleImage by default in the same structure, but we can adapt if needed.
          // Preview uses url primarily.
        };
        return { ...prev, images: newImages };
      });
      addLog(`第 ${index + 1} 张图片重新生成成功！`);
    } catch (err: any) {
      console.error(err);
      addLog(`错误: 重生失败 - ${err.message}`);
    } finally {
      setRegeneratingIndices(prev => prev.filter(i => i !== index));
    }
  };

  const handleDownload = async () => {
    if (!data) return;
    await saveAsZip(data);
  };

  return (
    <Layout>
      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('article')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'article'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <FileText size={20} />
            文章生成
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'image'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <ImageIcon size={20} />
            AI 生图
          </button>
        </nav>
      </div>

      {activeTab === 'article' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                📝 配置参数
              </h2>
              <GenerateForm onGenerate={handleGenerate} loading={loading} />
            </div>
            
            {/* Logs */}
            {logs.length > 0 && (
              <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-sm max-h-40 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i}>&gt; {log}</div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  👁️ 预览结果
                </h2>
                {data && (
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Download size={16} />
                    打包下载
                  </button>
                )}
              </div>
              
              {error ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                  {error}
                </div>
              ) : (
                <Preview 
                  data={data} 
                  loading={loading} 
                  onRegenerateImage={handleRegenerateImage}
                  regeneratingIndices={regeneratingIndices}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          <ImageGenerator 
            apiKey={sharedApiKey}
            onLog={(msg) => console.log(msg)} 
          />
        </div>
      )}
    </Layout>
  );
}

export default App;
