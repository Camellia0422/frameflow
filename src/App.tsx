import React, { useState, useRef } from 'react';
import { Upload, Video, Image as ImageIcon, Download, RefreshCw, Layers, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

interface FrameData {
  id: number;
  url: string;
  timestamp: number;
}

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const totalFramesNeeded = 24;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      resetState();
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
    } else if (file) {
      setError("请上传有效的视频文件。");
    }
  };

  const resetState = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setFrames([]);
    setProgress(0);
    setError(null);
  };

  const extractFrames = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    setProgress(0);
    setFrames([]);
    setError(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) {
      setError("无法创建画布上下文。");
      setIsProcessing(false);
      return;
    }

    if (video.readyState < 1) {
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });
    }

    const duration = video.duration;
    const interval = duration / totalFramesNeeded;
    const extractedFrames: FrameData[] = [];

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      for (let i = 0; i < totalFramesNeeded; i++) {
        const time = i * interval + (interval / 2); 
        video.currentTime = time;

        await new Promise((resolve) => {
          video.onseeked = resolve;
        });

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const url = canvas.toDataURL('image/jpeg', 0.85);
        extractedFrames.push({
          id: i,
          url,
          timestamp: time
        });

        setProgress(Math.round(((i + 1) / totalFramesNeeded) * 100));
      }

      setFrames(extractedFrames);
    } catch (err) {
      console.error(err);
      setError("生成过程中出现错误，请重试。");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadGrid = () => {
    if (frames.length === 0) return;

    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = frames[0].url;
    
    img.onload = () => {
      const cols = 4;
      const rows = 6;
      const padding = 12;
      const frameWidth = img.width;
      const frameHeight = img.height;

      exportCanvas.width = (frameWidth * cols) + (padding * (cols + 1));
      exportCanvas.height = (frameHeight * rows) + (padding * (rows + 1));

      ctx.fillStyle = '#0a0a0a'; 
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      let loadedCount = 0;
      frames.forEach((frame, index) => {
        const frameImg = new Image();
        frameImg.src = frame.url;
        frameImg.onload = () => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = padding + col * (frameWidth + padding);
          const y = padding + row * (frameHeight + padding);
          
          ctx.drawImage(frameImg, x, y, frameWidth, frameHeight);
          
          loadedCount++;
          if (loadedCount === totalFramesNeeded) {
            const link = document.createElement('a');
            link.download = `frameflow-网格图-${Date.now()}.jpg`;
            link.href = exportCanvas.toDataURL('image/jpeg', 0.9);
            link.click();
          }
        };
      });
    };
  };

  const downloadZip = async () => {
    if (frames.length === 0) return;
    setIsZipping(true);
    
    const zip = new JSZip();
    const folder = zip.folder("extracted_frames");
    
    frames.forEach((frame, index) => {
      const base64Data = frame.url.split(',')[1];
      folder?.file(`画面_${String(index + 1).padStart(2, '0')}.jpg`, base64Data, { base64: true });
    });

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `frameflow-全部图片-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
      setError("无法创建压缩文件。");
    } finally {
      setIsZipping(false);
    }
  };

  const downloadSingleFrame = (frame: FrameData, idx: number) => {
    const link = document.createElement('a');
    link.href = frame.url;
    link.download = `画面_${String(idx + 1).padStart(2, '0')}.jpg`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 mb-2"
            >
              <div className="p-2 bg-indigo-600 rounded-lg">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <h1 id="app-title" className="text-3xl font-bold tracking-tight text-white">FrameFlow</h1>
            </motion.div>
            <p className="text-neutral-400 max-w-md">
              一键从视频中提取 24 帧画面。支持导出高画质网格大图或批量下载单张原画。
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {videoFile && !isProcessing && (
              <button 
                id="extract-btn"
                onClick={extractFrames}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-full font-medium transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-900/20"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                {frames.length > 0 ? "重新生成" : "生成 24 帧图片"}
              </button>
            )}
            {frames.length > 0 && !isProcessing && (
              <>
                <button 
                  id="download-zip-btn"
                  onClick={downloadZip}
                  disabled={isZipping}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-full font-medium transition-all transform hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isZipping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                  打包下载 (.zip)
                </button>
                <button 
                  id="download-grid-btn"
                  onClick={downloadGrid}
                  className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-2.5 rounded-full font-medium border border-neutral-700 transition-all font-mono text-sm tracking-widest uppercase"
                >
                  <Download className="w-4 h-4" />
                  保存网格图
                </button>
              </>
            )}
          </div>
        </header>

        <main>
          {/* Upload Section */}
          {!videoUrl ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="border-2 border-dashed border-neutral-800 rounded-3xl p-12 flex flex-col items-center justify-center bg-neutral-900/30 min-h-[400px]"
            >
              <div className="w-20 h-20 bg-neutral-800/50 rounded-full flex items-center justify-center mb-6">
                <Video className="w-10 h-10 text-neutral-500" />
              </div>
              <h2 className="text-xl font-medium mb-2">拖拽视频到此处</h2>
              <p className="text-neutral-500 mb-8 text-center max-w-sm">
                支持 MP4, WebM 或 MOV 格式。<br/>适合提取精彩瞬间或制作故事板。
              </p>
              <label className="cursor-pointer bg-white text-black px-8 py-3 rounded-full font-bold transition-all hover:shadow-2xl hover:shadow-white/10 active:scale-95">
                选择文件
                <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
              </label>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Sidebar / Preview */}
              <div className="lg:col-span-4 space-y-6">
                <section className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
                    <span className="text-sm font-mono text-neutral-400 uppercase tracking-widest">源视频预览</span>
                    <button onClick={resetState} className="text-xs text-neutral-500 hover:text-red-400 transition-colors">更换视频</button>
                  </div>
                  <div className="relative aspect-video bg-black flex items-center justify-center">
                    <video 
                      ref={videoRef} 
                      src={videoUrl} 
                      className="max-h-full w-full object-contain pointer-events-none" 
                      muted 
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                        <Video className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate">{videoFile?.name}</p>
                        <p className="text-xs text-neutral-500">
                          {((videoFile?.size ?? 0) / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    
                    {isProcessing ? (
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-indigo-400 animate-pulse uppercase tracking-wider">正在提取画面...</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-indigo-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : frames.length === 0 ? (
                      <button 
                        onClick={extractFrames}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 group transition-all"
                      >
                        开始处理
                        <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 p-3 rounded-xl border border-emerald-400/20">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-medium">已成功提取 24 帧</span>
                      </div>
                    )}

                    {error && (
                      <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">{error}</span>
                      </div>
                    )}
                  </div>
                </section>
                
                <div className="p-6 bg-indigo-900/20 border border-indigo-500/30 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Layers className="w-24 h-24" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">专业导出选项</h3>
                  <p className="text-sm text-neutral-300 relative z-10">
                    您可以下载包含所有画面的高画质网格索引图，或者将每帧单独保存为 JPG 压缩包，也可以单独下载某一张特定的画面。
                  </p>
                </div>
              </div>

              {/* Main Content / Grid Display */}
              <div className="lg:col-span-8">
                {frames.length > 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
                  >
                    <AnimatePresence>
                      {frames.map((frame, idx) => (
                        <motion.div 
                          key={frame.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.015 }}
                          className="group relative aspect-video bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 hover:border-indigo-500/50 transition-all shadow-lg hover:shadow-indigo-500/10"
                        >
                          <img 
                            src={frame.url} 
                            alt={`Frame at ${frame.timestamp.toFixed(1)}s`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <button 
                               onClick={() => downloadSingleFrame(frame, idx)}
                               className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full transition-transform hover:scale-110"
                               title="下载此帧"
                             >
                                <Download className="w-5 h-5 text-white" />
                             </button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent">
                            <span className="text-[10px] font-mono text-neutral-300">
                              {Math.floor(frame.timestamp / 60)}:{(frame.timestamp % 60).toFixed(1).padStart(4, '0')}s
                            </span>
                          </div>
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-400 group-hover:text-indigo-300 transition-colors">
                            #{String(idx + 1).padStart(2, '0')}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <div className="h-full border-2 border-dashed border-neutral-800 rounded-3xl flex flex-col items-center justify-center p-12 text-center bg-neutral-900/10 min-h-[500px]">
                    <ImageIcon className="w-16 h-16 text-neutral-800 mb-6" />
                    <h3 className="text-neutral-400 text-lg font-medium">等待生成</h3>
                    <p className="text-sm text-neutral-600 max-w-sm mt-3">
                      处理视频后，提取的 24 帧画面将显示在此处。您可以预览、打包或生成一张大图。
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <canvas ref={canvasRef} className="hidden" />
        
        <footer className="mt-24 pt-8 border-t border-neutral-900 flex flex-col sm:flex-row justify-between items-center gap-4 text-neutral-600 text-[10px] font-mono uppercase tracking-[0.2em]">
          <span>FrameFlow &bull; 专业视频分析工具</span>
          <div className="flex gap-8">
            <span className="hover:text-neutral-400 cursor-default transition-colors">24 帧序列</span>
            <span className="hover:text-neutral-400 cursor-default transition-colors">支持 Zip & 网格图导出</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
