
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, VideoGenerationReferenceType } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { deductCredits, getSystemSettings, rotateApiKey } from '../lib/api';

interface VideoGeneratorProps {
  mode: 'img2vid' | 'text2vid';
  onBack: () => void;
  lang: 'id' | 'en';
  userEmail: string;
  credits: number;
  refreshCredits: () => void;
}

interface LogEntry {
  id: string;
  msg: string;
  type: 'info' | 'success' | 'warning' | 'error';
  time: string;
}

export const VideoGenerator: React.FC<VideoGeneratorProps> = ({ mode, onBack, lang, userEmail, credits, refreshCredits }) => {
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [bgPrompt, setBgPrompt] = useState(''); 
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<LogEntry[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [costVideo, setCostVideo] = useState(150);
  const [hasUserKey, setHasUserKey] = useState<boolean | null>(null);

  const loadingMessages = [
    "Menghubungkan ke Neural Engine...",
    "Menganalisis Konsistensi Visual...",
    "Sintesis Frame Tahap Awal...",
    "Merender Tekstur & Cahaya...",
    "Memperhalus Gerakan AI...",
    "Finalisasi Paket Data MP4...",
    "Mengunduh Hasil Akhir..."
  ];

  useEffect(() => {
    getSystemSettings().then(s => setCostVideo(s.cost_video || 150));
    checkApiKeyStatus();
  }, []);

  const checkApiKeyStatus = async () => {
    if (!(window as any).aistudio) {
      setHasUserKey(true);
      return;
    }
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      setHasUserKey(hasKey);
    } catch (e) {
      setHasUserKey(true);
    }
  };

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
    }
    setHasUserKey(true);
  };

  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingMessages.length);
      }, 15000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const t = {
    id: {
      guide: "Modul ini menggunakan sistem Veo 3.1. Fitur Video membutuhkan API Key berbayar milik Anda sendiri agar dapat berjalan stabil.",
      title: "PANDUAN VIDEO",
      videoEngine: "Buat Video",
      noCredit: "SALDO TIDAK CUKUP!",
      totalCharge: "TOTAL BIAYA PEMROSESAN",
      keyRequired: "API KEY BERBAYAR DIBUTUHKAN",
      keyDesc: "Model Veo 3.1 memerlukan API Key dari proyek dengan Billing aktif milik Master.",
      selectKey: "HUBUNGKAN API KEY SAYA",
      billingDocs: "Pelajari tentang Penagihan",
      resetKey: "Ganti/Pilih Ulang Key",
      download: "UNDUH VIDEO FINAL",
      ready: "VIDEO SIAP DITAMPILKAN"
    },
    en: {
      guide: "This suite leverages Veo 3.1. Video features require your own paid API Key for stable performance.",
      title: "VIDEO GUIDE",
      videoEngine: "Create Video",
      noCredit: "CREDIT EXHAUSTED!",
      totalCharge: "TOTAL PROCESSING COST",
      keyRequired: "PAID API KEY REQUIRED",
      keyDesc: "Veo 3.1 model requires an API Key from a project with active Billing.",
      selectKey: "SELECT YOUR API KEY",
      billingDocs: "About Gemini Billing",
      resetKey: "Reset/Change API Key",
      download: "DOWNLOAD FINAL VIDEO",
      ready: "VIDEO READY TO VIEW"
    }
  }[lang];

  const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setProcessLogs(prev => {
      const newLogs = [...prev, { id, msg, type, time }];
      return newLogs.length > 5 ? newLogs.slice(1) : newLogs;
    });
  };

  const removeLog = (id: string) => {
    setProcessLogs(prev => prev.filter(log => log.id !== id));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSourceImages(prev => [...prev, reader.result as string].slice(-3));
          addLog("Gambar berhasil diunggah.", "success");
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const generateVideo = async (retryCount = 0) => {
    if (credits < costVideo && retryCount === 0) {
      addLog(t.noCredit, "error");
      return;
    }

    if (!process.env.API_KEY) {
      addLog("Gagal: API Key global tidak terdeteksi. Silakan cek Vercel Master.", "error");
      return;
    }

    setIsGenerating(true);
    if (retryCount === 0) setVideoUrl(null);
    addLog("Memulai pemrosesan video sinematik...");
    
    try {
      if (retryCount === 0) {
        const success = await deductCredits(userEmail, costVideo);
        if (!success) {
          addLog("Saldo Anda tidak mencukupi.", "error");
          setIsGenerating(false);
          return;
        }
        refreshCredits();
      }

      // Initialize with process.env.API_KEY directly
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const isMultiImage = sourceImages.length > 1;
      const modelName = isMultiImage ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';
      const actualRatio = isMultiImage ? '16:9' : aspectRatio;

      const finalPrompt = `${prompt} ${bgPrompt ? `dengan latar ${bgPrompt}` : ''}. Kualitas tinggi, sinematik, gerakan halus.`;

      const referenceImagesPayload = sourceImages.map(img => ({
        image: {
          imageBytes: img.split(',')[1],
          mimeType: img.match(/data:([^;]+);/)?.[1] || 'image/png',
        },
        referenceType: VideoGenerationReferenceType.ASSET,
      }));

      let operation = await ai.models.generateVideos({
        model: modelName,
        prompt: finalPrompt,
        image: sourceImages.length === 1 ? {
          imageBytes: sourceImages[0].split(',')[1],
          mimeType: sourceImages[0].match(/data:([^;]+);/)?.[1] || 'image/png'
        } : undefined,
        config: { 
          numberOfVideos: 1, 
          resolution: '720p', 
          aspectRatio: actualRatio as any,
          referenceImages: isMultiImage ? referenceImagesPayload : undefined
        }
      });

      while (!operation.done) {
        addLog(loadingMessages[loadingStep] || "Sedang memproses...", "info");
        await new Promise(r => setTimeout(r, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
        if (operation.error) throw operation.error;
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        // Appending the global key for download
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob as Blob));
        addLog("Video berhasil dibuat!", "success");
      }
    } catch (e: any) { 
      const errorMsg = e?.message || JSON.stringify(e);
      if ((errorMsg.includes('Requested entity was not found') || errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 2) {
        addLog("Jalur padat, mencoba rotasi kunci...", "warning");
        rotateApiKey();
        setTimeout(() => generateVideo(retryCount + 1), 1500);
      } else {
        addLog(`Gagal: ${errorMsg.substring(0, 80)}`, "error");
      }
    } finally { 
      setIsGenerating(false);
      refreshCredits();
    }
  };

  if (hasUserKey === false) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-10 rounded-[3rem] bg-[#0d1117] border border-cyan-500/30 text-center max-w-md space-y-8 shadow-2xl">
           <div className="w-20 h-20 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto text-3xl shadow-[0_0_40px_rgba(34,211,238,0.2)]">
              <i className="fa-solid fa-key"></i>
           </div>
           <div className="space-y-3">
              <h2 className="text-xl font-bold uppercase text-white tracking-tighter">{t.keyRequired}</h2>
              <p className="text-[10px] font-medium text-slate-500 uppercase px-4 leading-relaxed">{t.keyDesc}</p>
           </div>
           <div className="space-y-4">
              <button onClick={handleSelectKey} className="w-full py-5 bg-white text-black font-bold uppercase text-[10px] rounded-2xl shadow-xl hover:bg-cyan-500 transition-all active:scale-95">
                 {t.selectKey}
              </button>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block text-[9px] font-bold text-slate-600 hover:text-cyan-400 transition-all uppercase tracking-widest">
                 {t.billingDocs} <i className="fa-solid fa-external-link ml-1"></i>
              </a>
           </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-40 relative">
      <div className="fixed top-6 right-6 z-[300] w-72 lg:w-80 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {processLogs.map((log) => (
            <motion.div 
              key={log.id} 
              initial={{ opacity: 0, x: 50 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 300 }}
              drag="x"
              dragConstraints={{ left: -300, right: 300 }}
              onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) removeLog(log.id); }}
              className={`pointer-events-auto cursor-grab active:cursor-grabbing p-4 rounded-2xl glass-panel border-l-4 backdrop-blur-2xl shadow-xl flex flex-col gap-1 ${log.type === 'error' ? 'border-l-red-500 bg-red-500/20' : log.type === 'warning' ? 'border-l-yellow-500 bg-yellow-500/10' : 'border-l-cyan-500 bg-cyan-500/10'}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[7px] font-bold uppercase text-slate-500">{log.time}</span>
                <i className="fa-solid fa-arrows-left-right text-[6px] text-slate-500 opacity-40"></i>
              </div>
              <p className="text-[10px] font-medium text-white leading-tight">{log.msg}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl"><i className="fa-solid fa-arrow-left"></i></button>
          <button onClick={() => setShowGuide(!showGuide)} className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center shadow-xl ${showGuide ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-white/5 border-white/5 text-cyan-400'}`}>
            <i className={`fa-solid ${showGuide ? 'fa-xmark' : 'fa-question'} text-[10px]`}></i>
          </button>
          <h2 className="text-2xl font-bold uppercase">{t.videoEngine} <span className="text-cyan-500">Pintar</span></h2>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={handleSelectKey} className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-bold text-slate-500 hover:text-white transition-all">
              <i className="fa-solid fa-key text-[10px]"></i> {t.resetKey}
           </button>
           <div className="text-right">
              <p className="text-[9px] font-bold uppercase text-slate-600 tracking-widest">Saldo Anda</p>
              <p className="text-xl font-bold text-cyan-400 leading-none">{credits.toLocaleString()} CR</p>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {showGuide && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-panel p-6 rounded-[2.5rem] border-cyan-500/20 bg-cyan-500/5 mb-2 shadow-2xl">
              <p className="text-[9px] font-bold uppercase text-cyan-400 tracking-[0.4em] mb-3">{t.title}</p>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">
                {t.guide}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-5 space-y-6">
          <section className="glass-panel p-8 rounded-[2.5rem] bg-slate-900/40 space-y-6 shadow-2xl border-white/5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 px-2 tracking-widest">Deskripsi Video (Prompt)</label>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full h-24 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-cyan-500/50" placeholder="Contoh: Seekor kucing mengenakan topi sedang berdansa..." />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 px-2 tracking-widest">Latar Tempat (Opsional)</label>
              <input type="text" value={bgPrompt} onChange={e => setBgPrompt(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white outline-none focus:border-cyan-500/50" placeholder="Contoh: di luar angkasa, di tepi pantai..." />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 px-2 tracking-widest">Rasio Aspek</label>
              <div className="flex gap-2">
                <button onClick={() => setAspectRatio('16:9')} className={`flex-1 py-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${aspectRatio === '16:9' ? 'bg-cyan-500 text-black border-cyan-400 shadow-lg' : 'bg-black/20 border-white/5 text-slate-500'}`}>Melebar (16:9)</button>
                <button onClick={() => setAspectRatio('9:16')} className={`flex-1 py-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${aspectRatio === '9:16' ? 'bg-cyan-500 text-black border-cyan-400 shadow-lg' : 'bg-black/20 border-white/5 text-slate-500'}`}>Tegak (9:16)</button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 px-2 tracking-widest">Gambar Referensi (Maks 3)</label>
              <div className="grid grid-cols-3 gap-2">
                {sourceImages.map((img, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-white/10 bg-black relative">
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => setSourceImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full text-[8px] text-white flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                ))}
                {sourceImages.length < 3 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-cyan-500/50 transition-all">
                    <i className="fa-solid fa-plus text-slate-700"></i>
                    <input type="file" multiple onChange={handleImageUpload} className="hidden" accept="image/*" />
                  </label>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-between">
              <div>
                <p className="text-[8px] font-bold text-cyan-500 uppercase tracking-widest">{t.totalCharge}</p>
                <p className="text-lg font-bold text-white leading-none">{costVideo} <span className="text-[10px] text-slate-500">CR</span></p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Sisa Saldo</p>
                <p className={`text-[11px] font-bold ${credits < costVideo ? 'text-red-500' : 'text-slate-400'}`}>
                  {(credits - costVideo).toLocaleString()} CR
                </p>
              </div>
            </div>

            <button 
              onClick={() => generateVideo(0)} 
              disabled={isGenerating || !prompt || credits < costVideo} 
              className="w-full py-5 bg-white text-black font-bold uppercase rounded-2xl hover:bg-cyan-400 transition-all shadow-xl active:scale-95 disabled:opacity-20 relative overflow-hidden"
            >
              {isGenerating ? (
                <div className="flex flex-col items-center gap-1">
                   <span className="text-[10px] animate-pulse">{loadingMessages[loadingStep]}</span>
                   <div className="absolute bottom-0 left-0 h-1 bg-cyan-500 animate-[loading_2s_infinite]" style={{ width: '100%' }}></div>
                </div>
              ) : credits < costVideo ? t.noCredit : `MULAI BUAT VIDEO`}
            </button>
          </section>
        </div>

        <div className="xl:col-span-7 flex flex-col gap-6">
          <div className="glass-panel flex-1 min-h-[450px] lg:min-h-[550px] rounded-[3rem] flex flex-col items-center justify-center p-8 bg-black/20 overflow-hidden shadow-2xl border-white/5 relative">
            {videoUrl ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full flex flex-col items-center">
                 <div className="absolute top-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full backdrop-blur-md">
                    <p className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.3em]">{t.ready}</p>
                 </div>
                 <video 
                    src={videoUrl} 
                    controls 
                    autoPlay 
                    loop 
                    playsInline
                    className="w-full h-full object-contain rounded-2xl shadow-[0_0_50px_rgba(34,211,238,0.2)] border border-cyan-500/20" 
                 />
              </motion.div>
            ) : (
              <div className="text-center opacity-10 flex flex-col items-center gap-6">
                <i className="fa-solid fa-clapperboard text-8xl"></i>
                <p className="text-[10px] font-bold uppercase tracking-[0.8em]">MENUNGGU PERINTAH ANDA</p>
              </div>
            )}
            
            {isGenerating && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-[50]">
                 <motion.div 
                   animate={{ rotate: 360 }} 
                   transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                   className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full mb-6 shadow-[0_0_30px_#22d3ee]"
                 />
                 <p className="text-[10px] font-black text-white uppercase tracking-[0.5em] animate-pulse">PENGOLAHAN NEURAL...</p>
              </div>
            )}
          </div>
          
          <AnimatePresence>
            {videoUrl && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row gap-4 w-full"
              >
                <a 
                  href={videoUrl} 
                  download={`satmoko_video_${Date.now()}.mp4`}
                  className="flex-1 py-5 bg-cyan-600 text-white font-black uppercase rounded-2xl shadow-xl hover:bg-white hover:text-cyan-600 transition-all flex items-center justify-center gap-3 text-xs tracking-widest"
                >
                  <i className="fa-solid fa-download"></i> {t.download}
                </a>
                <button 
                  onClick={() => window.open(videoUrl, '_blank')}
                  className="px-8 py-5 bg-white/5 border border-white/10 text-white font-black uppercase rounded-2xl hover:bg-white/10 transition-all text-xs"
                >
                  <i className="fa-solid fa-expand"></i>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
