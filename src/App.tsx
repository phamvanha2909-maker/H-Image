/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Maximize2, 
  Layout, 
  Type,
  AlertCircle,
  Loader2,
  ChevronRight,
  History,
  Trash2,
  Upload,
  X,
  User
} from "lucide-react";

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

interface HistoryItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [referenceImage, setReferenceImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [useStandardQuality, setUseStandardQuality] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for API key on mount
  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('ha_image_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('ha_image_history', JSON.stringify(history));
  }, [history]);

  const generateImage = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Create a fresh instance to ensure it uses the latest selected key
      const ai = new GoogleGenAI({ apiKey: useStandardQuality ? process.env.GEMINI_API_KEY : (process.env.API_KEY || process.env.GEMINI_API_KEY) });
      
      const parts: any[] = [];
      
      if (referenceImage) {
        parts.push({
          inlineData: {
            data: referenceImage.data,
            mimeType: referenceImage.mimeType,
          },
        });
      }
      
      parts.push({
        text: prompt,
      });

      // Call API twice in parallel to get 2 distinct images
      const model = useStandardQuality ? 'gemini-2.5-flash-image' : 'gemini-3.1-flash-image-preview';
      const imageConfig = useStandardQuality ? { aspectRatio: aspectRatio } : { aspectRatio: aspectRatio, imageSize: "2K" as const };

      const promises = [
        ai.models.generateContent({
          model: model,
          contents: { parts: parts },
          config: { imageConfig: imageConfig },
        }),
        ai.models.generateContent({
          model: model,
          contents: { parts: parts },
          config: { imageConfig: imageConfig },
        })
      ];

      const results = await Promise.all(promises);
      const newImages: string[] = [];

      results.forEach((response) => {
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            newImages.push(`data:image/png;base64,${part.inlineData.data}`);
            break;
          }
        }
      });

      if (newImages.length > 0) {
        setGeneratedImages(newImages);
        
        const newHistoryItems: HistoryItem[] = newImages.map((url, idx) => ({
          id: `${Date.now()}-${idx}`,
          url: url,
          prompt: prompt,
          timestamp: Date.now()
        }));
        
        setHistory(prev => [...newHistoryItems, ...prev].slice(0, 50));
      } else {
        throw new Error("Không thể tạo ảnh. Vui lòng thử lại với mô tả khác.");
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      const errorMessage = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      
      if (errorMessage.includes("Requested entity was not found") || 
          errorMessage.includes("PERMISSION_DENIED") || 
          errorMessage.includes("403")) {
        if (!useStandardQuality) {
          setError("API Key của bạn không có quyền sử dụng tính năng 2K. Bạn có thể chọn API Key khác hoặc chuyển sang chất lượng thường.");
        } else {
          setError("Đã xảy ra lỗi phân quyền. Vui lòng kiểm tra lại API Key.");
        }
      } else {
        setError(errorMessage || "Đã xảy ra lỗi không mong muốn trong quá trình tạo ảnh.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `ha-image-${Date.now()}.png`;
    link.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setReferenceImage({
          data: base64String,
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#1A1A1A] font-sans selection:bg-[#E0E0E0]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#EEEEEE] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center">
            <ImageIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Hà Image</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-100">
            <Sparkles className="w-3 h-3" />
            {useStandardQuality ? "Chất lượng thường" : "Chất lượng 2K"}
          </div>
          <span className="text-xs font-medium uppercase tracking-widest text-[#888888]">
            {useStandardQuality ? "Gemini 2.5 Flash" : "Gemini 3.1 Flash"}
          </span>
        </div>
      </header>

      {!hasApiKey && !useStandardQuality ? (
        <div className="flex-1 flex items-center justify-center p-8 bg-[#F9F9F9]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white p-10 rounded-[32px] shadow-xl border border-[#EEEEEE] text-center space-y-8"
          >
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-blue-600" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-[#1A1A1A]">Kích hoạt chất lượng 2K</h2>
              <p className="text-sm text-[#888888] leading-relaxed">
                Để sử dụng mô hình Gemini 3.1 Flash với chất lượng 2K, bạn cần chọn API Key từ dự án Google Cloud có trả phí.
              </p>
              <p className="text-[10px] text-[#AAAAAA]">
                Xem thêm tại <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">tài liệu thanh toán</a>.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleSelectKey}
                className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-semibold hover:bg-[#333333] transition-all active:scale-[0.98] shadow-lg shadow-black/10"
              >
                Chọn API Key
              </button>
              <button
                onClick={() => setUseStandardQuality(true)}
                className="w-full py-3 text-[#888888] text-xs font-medium hover:text-[#1A1A1A] transition-colors"
              >
                Sử dụng chất lượng thường (Miễn phí)
              </button>
            </div>
          </motion.div>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[400px_1fr] min-h-[calc(100vh-65px)]">
        {/* Sidebar Controls */}
        <aside className="border-r border-[#EEEEEE] bg-white p-8 flex flex-col gap-8 overflow-y-auto">
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[#888888]">
              <User className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Ảnh tham chiếu (Nhân vật/Phong cách)</span>
            </div>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`relative group cursor-pointer border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center p-4 min-h-[120px] ${
                referenceImage ? "border-[#1A1A1A] bg-[#F9F9F9]" : "border-[#EEEEEE] hover:border-[#CCCCCC] bg-[#F5F5F5]"
              }`}
            >
              {referenceImage ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img 
                    src={`data:${referenceImage.mimeType};base64,${referenceImage.data}`} 
                    alt="Reference" 
                    className="max-h-24 rounded-lg object-contain shadow-sm"
                  />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setReferenceImage(null);
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-[#1A1A1A] text-white rounded-full shadow-lg hover:bg-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-[#888888] mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] font-medium text-[#888888] text-center">Tải lên ảnh để giữ nét nhân vật hoặc phong cách</p>
                </>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[#888888]">
              <Type className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Mô tả ảnh</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Mô tả những gì bạn muốn thấy..."
              className="w-full h-40 p-4 bg-[#F5F5F5] border-none rounded-2xl resize-none focus:ring-2 focus:ring-[#1A1A1A] transition-all text-sm leading-relaxed outline-none"
            />
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[#888888]">
              <Layout className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Tỷ lệ khung hình</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["1:1", "16:9", "9:16", "4:3", "3:4"] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                    aspectRatio === ratio
                      ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                      : "bg-white text-[#1A1A1A] border-[#EEEEEE] hover:border-[#CCCCCC]"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </section>

          <button
            onClick={generateImage}
            disabled={isGenerating || !prompt.trim()}
            className="mt-auto w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#333333] transition-all active:scale-[0.98]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Tạo ảnh ngay
              </>
            )}
          </button>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-3 text-red-600"
            >
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-xs leading-relaxed">{error}</p>
              </div>
              {error.includes("2K") && (
                <div className="flex gap-2">
                  <button 
                    onClick={handleSelectKey}
                    className="text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Đổi API Key
                  </button>
                  <button 
                    onClick={() => {
                      setUseStandardQuality(true);
                      setError(null);
                    }}
                    className="text-[10px] font-bold uppercase tracking-wider bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Dùng chất lượng thường
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </aside>

        {/* Preview Area */}
        <section className="p-8 lg:p-12 flex flex-col gap-8 bg-[#F9F9F9] overflow-y-auto">
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <AnimatePresence mode="wait">
              {generatedImages.length > 0 ? (
                <motion.div
                  key={generatedImages.join(',')}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl"
                >
                  {generatedImages.map((img, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="relative group aspect-square bg-white rounded-3xl shadow-xl overflow-hidden border border-[#EEEEEE]"
                    >
                      <img
                        src={img}
                        alt={`Generated ${idx}`}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => downloadImage(img)}
                          className="p-3 bg-white/90 backdrop-blur shadow-lg rounded-full hover:bg-white transition-all text-[#1A1A1A]"
                          title="Tải xuống"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-6 text-[#888888] text-center max-w-md"
                >
                  <div className="w-24 h-24 rounded-full bg-white border border-[#EEEEEE] flex items-center justify-center shadow-sm">
                    {isGenerating ? (
                      <Loader2 className="w-10 h-10 animate-spin text-[#1A1A1A]" />
                    ) : (
                      <ImageIcon className="w-10 h-10 opacity-20" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium text-[#1A1A1A]">Sẵn sàng sáng tạo?</h3>
                    <p className="text-sm leading-relaxed">
                      Nhập mô tả ở bên trái và chọn các cài đặt. Tác phẩm của bạn sẽ xuất hiện tại đây.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="space-y-6 pt-8 border-t border-[#EEEEEE]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#888888]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#888888]">Lịch sử ảnh đã tạo</h4>
                </div>
                <button 
                  onClick={() => {
                    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử?")) {
                      setHistory([]);
                    }
                  }}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-[#888888] hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Xóa lịch sử
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {history.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-white border border-[#EEEEEE] shadow-sm hover:shadow-md transition-all cursor-pointer"
                    onClick={() => {
                      setGeneratedImages([item.url]);
                      setPrompt(item.prompt);
                    }}
                  >
                    <img 
                      src={item.url} 
                      alt={item.prompt} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      referrerPolicy="no-referrer" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                      <p className="text-[10px] text-white line-clamp-2 font-medium leading-tight">
                        {item.prompt}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-[#EEEEEE] px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[#888888]">
        <p className="text-xs">© 2026 Hà Image. Được cung cấp bởi Google Gemini.</p>
        <div className="flex items-center gap-6 text-xs font-medium">
          <a href="#" className="hover:text-[#1A1A1A] transition-colors">Bảo mật</a>
          <a href="#" className="hover:text-[#1A1A1A] transition-colors">Điều khoản</a>
          <a href="#" className="hover:text-[#1A1A1A] transition-colors">Hỗ trợ</a>
        </div>
      </footer>
    </div>
  );
}

