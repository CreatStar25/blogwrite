import { useState } from 'react';
import { GenerateForm, GenerateParams } from './components/GenerateForm';
import { Preview } from './components/Preview';
import { generateArticle, generateImages } from './lib/api';
import { Layout } from './components/Layout';
import { Download } from 'lucide-react';
import { saveAsZip } from './lib/utils';

export interface ArticleData {
  title: string;
  content: string;
  slug?: string;
  images: { url: string; prompt: string; filename: string; blob?: Blob; b64?: string }[];
}

function App() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ArticleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleGenerate = async (params: GenerateParams) => {
    setLoading(true);
    setError(null);
    setData(null);
    setLogs([]);
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

  const handleDownload = async () => {
    if (!data) return;
    await saveAsZip(data);
  };

  return (
    <Layout>
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
              <Preview data={data} loading={loading} />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;
