import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArticleData } from '../App';
import { Eye, FileText, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  data: ArticleData | null;
  loading: boolean;
  onRegenerateImage?: (index: number) => void;
  regeneratingIndices?: number[];
}

export function Preview({ data, loading, onRegenerateImage, regeneratingIndices = [] }: Props) {
  const [activeTab, setActiveTab] = useState<'preview' | 'markdown'>('preview');

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 min-h-[400px]">
        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p>AI 正在奋笔疾书...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 min-h-[400px]">
        <FileText size={48} className="mb-4 opacity-20" />
        <p>在左侧输入主题，点击生成开始</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
        <button
          onClick={() => setActiveTab('preview')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'preview' 
              ? "bg-blue-50 text-blue-700" 
              : "text-gray-600 hover:bg-gray-50"
          )}
        >
          <Eye size={16} />
          预览模式
        </button>
        <button
          onClick={() => setActiveTab('markdown')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'markdown' 
              ? "bg-blue-50 text-blue-700" 
              : "text-gray-600 hover:bg-gray-50"
          )}
        >
          <FileText size={16} />
          源码模式
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {activeTab === 'preview' ? (
          <div className="prose prose-blue max-w-none">
            <h1>{data.title}</h1>
            <ReactMarkdown
               components={{
                 img: ({node, ...props}) => {
                   // We don't render images from markdown content directly if they are placeholders
                   // or we can try to match them with generated images
                   return <img {...props} className="rounded-lg shadow-md my-4 max-w-full" />;
                 }
               }}
            >
              {data.content}
            </ReactMarkdown>
            
            {data.images.length > 0 && (
              <div className="mt-8 border-t border-gray-100 pt-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ImageIcon size={20} />
                  生成配图 ({data.images.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.images.map((img, i) => (
                    <div key={i} className="group relative rounded-lg overflow-hidden border border-gray-200">
                      <img src={img.url} alt={img.prompt} className="w-full h-48 object-cover" />
                      
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                        <p className="text-white text-xs text-center mb-2 break-all">{img.filename}</p>
                        
                        {onRegenerateImage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRegenerateImage(i);
                            }}
                            disabled={regeneratingIndices.includes(i)}
                            className="bg-white/20 hover:bg-white/30 text-white border border-white/50 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 backdrop-blur-sm transition-all"
                          >
                            <RefreshCw size={12} className={cn(regeneratingIndices.includes(i) && "animate-spin")} />
                            {regeneratingIndices.includes(i) ? '生成中...' : '重新生成'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <pre className="bg-gray-50 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap text-gray-700 border border-gray-200">
            {`# ${data.title}\n\n${data.content}`}
          </pre>
        )}
      </div>
    </div>
  );
}
