import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { deductCredits, getSystemSettings, rotateApiKey, getActiveApiKey } from '../lib/api';

interface LogEntry {
  id: string;
  msg: string;
  type: 'info' | 'success' | 'warning' | 'error';
  time: string;
}

interface ImageGeneratorProps {
  onBack: () => void;
  lang: 'id' | 'en';
  userEmail: string;
  credits: number;
  refreshCredits: () => void;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onBack, lang, userEmail, credits, refreshCredits }) => {
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Nyata (Foto)');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [numToGenerate, setNumToGenerate] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [processLogs, setProcessLogs] = useState<LogEntry[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [costPerImage, setCostPerImage] = useState(25);
  const [hasUserKey, setHasUserKey] = useState<boolean | null>(null);

  useEffect(() => {
    getSystemSettings().then(s => setCostPerImage(s.cost_image || 25));
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

  const totalCost = numToGenerate * costPerImage * (imageSize === '4K' ? 3 : imageSize === '2K' ? 2 : 1);

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
          addLog("Gambar referensi ditambahkan.", "success");
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const generateSingleVariant = async (parts: any[]): Promise<string | null> => {
    try {
      // Fix: Always use process.env.API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Fix: Select model based on quality requirement as per guidelines
      const modelName = (imageSize === '2K' || imageSize === '4K') ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      const config: any = { 
        imageConfig: { 
          aspectRatio: aspectRatio as any
        }, 
        temperature: 0.9 
      };

      // imageSize is only supported on gemini-3-pro-image-preview
      if (modelName === 'gemini-3-pro-image-preview') {
        config.imageConfig.imageSize = imageSize as any;
      }

      const response = await ai.models.generateContent({ 
        model: modelName, 
        contents: { parts },
        config: config
      });

      if (response?.candidates?.[0]?.content?.parts) {
        // Fix: Iterate through all parts to find the image part
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (e: any) {
      throw e;
    }
  };

  const generateImage = async () => {
    if (!prompt.trim() || credits < totalCost) return;
    setIsGenerating(true);
    setResultImages([]);
    addLog("Memulai sintesis neural Pro...", "info");

    try {
      const success = await deductCredits(userEmail, totalCost);
      if (!success) { setIsGenerating(false); return; }
      refreshCredits();

      const baseParts: any[] = sourceImages.map(img => ({ 
        inlineData: { 
          data: img.split(',')[1], 
          mimeType: img.match(/data:([^;]+);/)?.[1] || 'image/png' 
        } 
      }));

      const styledPrompt = `Generate a high-quality ${imageSize} image. Subject: ${prompt}. Visual Style: ${style}. 
      CRITICAL COMPOSITION RULE: Provide ample vertical space and background extension at the bottom of the frame. 
      Ensure the subject is not cramped or cut off at the bottom. Use a full-frame or wide-angle perspective to maintain 
      a spacious and balanced composition. Professional photography standards, cinematic lighting, ultra detailed.`;
      
      baseParts.push({ text: styledPrompt });

      const tasks = Array.from({ length: numToGenerate }).map(() => generateSingleVariant([...baseParts]));
      const results = await Promise.all(tasks);
      const validResults = results.filter((r): r is string => r !== null);
      
      if (validResults.length > 0) {
        setResultImages(validResults);
        addLog(`Berhasil merender ${validResults.length} karya masterpiece!`, "success");
      } else {
        addLog("AI tidak mengembalikan gambar. Mencoba slot kunci lain...", "warning");
        rotateApiKey();
      }
    } catch (e: any) { 
      const errorMsg = e?.message || JSON.stringify(e);
      if (errorMsg.includes('Requested entity was not found') || errorMsg.includes('429') || errorMsg.includes('API key')) {
        addLog("Node sibuk atau kunci bermasalah, merotasi kunci...", "warning");
        rotateApiKey();
        addLog("Master, silakan tekan Generate sekali lagi.", "info");
      } else {
        addLog(`Gagal: ${errorMsg.substring(0, 80)}`, "error"); 
      }
    } finally { 
      setIsGenerating(false); 
      refreshCredits(); 
    }
  };

  const t = {
    id: {
      guideTitle: "PANDUAN VISUAL ARTIST PRO",
      guideContent: `Halo Bro! Berikut instruksi penggunaan modul Visual Artist:
      1. PROMPT: Tulis apa yang pengen lo liat. Makin detail makin keren hasilnya.
      2. REFERENSI (WAJIB UNTUK WAJAH): Upload foto lo atau subjek tertentu (maks 3 foto) biar AI tau siapa yang harus digambar.
      3. RESOLUSI 4K: Pilih 4K untuk hasil tajam maksimal. Inget Bro, biaya 4K 3x lipat dari 1K.
      4. VARIASI: Lo bisa pilih '4 VAR' biar AI ngerender 4 opsi gambar sekaligus.
      5. GAYA: Pilih gaya visual seperti 'Disney Pixar' atau 'Nyata' sesuai kebutuhan project lo.`
    },
    en: {
      guideTitle: "VISUAL ARTIST PRO GUIDE",
      guideContent: `Hey Bro! Here's how to use the Visual Artist module:
      1. PROMPT: Describe what you want to see. More detail = better results.
      2. REFERENCE (CRITICAL): Upload photos (max 3) so AI knows the face or object to replicate.
      3. 4K RESOLUTION: Select 4K for maximum sharpness. Note: 4K costs 3x more than 1K.
      4. VARIATION: Select '4 VAR' to render 4 different options at once.
      5. STYLE: Choose styles like 'Disney Pixar' or 'Realistic' for your project.`
    }
  }[lang];

  if (hasUserKey === false) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-10 rounded-[3rem] bg-[#0d1117] border border-fuchsia-500/30 text-center max-w-md space-y-8 shadow-2xl">
           <div className="w-20 h-20 rounded-full bg-fuchsia-500/10 text-fuchsia-400 flex items-center justify-center mx-auto text-3xl shadow-[0_0_40px_rgba(217,70,239,0.2)]">
              <i className="fa-solid fa-key"></i>
           </div>
           <div className="space-y-3">
              <h2 className="text-xl font-bold uppercase text-white tracking-tighter">PILIH API KEY PRO</h2>
              <p className="text-[10px] font-medium text-slate-500 uppercase px-4 leading-relaxed">Fitur Visual Artist Pro (4K) memerlukan API Key dari proyek dengan Billing aktif milik Bro.</p>
           </div>
           <div className="space-y-4">
              <button onClick={handleSelectKey} className="w-full py-5 bg-white text-black font-bold uppercase text-[10px] rounded-2xl shadow-xl hover:bg-fuchsia-500 transition-all active:scale-95">
                 HUBUNGKAN API KEY SAYA
              </button>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block text-[9px] font-bold text-slate-600 hover:text-fuchsia-400 transition-all uppercase tracking-widest">
                 INFO PENAGIHAN <i className="fa-solid fa-external-link ml-1"></i>
              </a>
           </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 relative pb-40">
      <div className="fixed top-6 right-6 z-[400] w-72 lg:w-80 flex flex-col gap-3 pointer-events-none">
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
              className={`pointer-events-auto cursor-grab active:cursor-grabbing p-4 rounded-2xl glass-panel border-l-4 backdrop-blur-3xl shadow-2xl flex flex-col gap-1 ${
                log.type === 'success' ? 'border-l-fuchsia-500 bg-fuchsia-500/10' :
                log.type === 'error' ? 'border-l-red-500 bg-red-500/20' : 'border-l-white/20 bg-white/5'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[7px] font-black uppercase text-slate-500">{log.time}</span>
                <i className="fa-solid fa-arrows-left-right text-[6px] text-slate-500 opacity-40"></i>
              </div>
              <p className="text-[10px] font-bold text-white leading-tight">{log.msg}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between flex-shrink-0 px-2">
        <div className="flex items-center gap-4 lg:gap-6">
          <button onClick={onBack} className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl active:scale-95"><i className="fa-solid fa-chevron-left"></i></button>
          
          <button 
            onClick={() => setShowGuide(!showGuide)} 
            className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl border transition-all flex items-center justify-center shadow-xl ${showGuide ? 'bg-fuchsia-500 text-black border-fuchsia-400 animate-pulse' : 'bg-white/5 border-white/5 text-fuchsia-400 hover:bg-fuchsia-500/10'}`}
            title="Klik untuk panduan, Bro!"
          >
            <i className={`fa-solid ${showGuide ? 'fa-xmark' : 'fa-question'} text-[12px]`}></i>
          </button>

          <div>
            <h2 className="text-xl lg:text-4xl font-black italic uppercase tracking-tighter leading-none">Visual <span className="text-fuchsia-500">Artist</span></h2>
            <p className="text-[7px] lg:text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 mt-1 lg:mt-2">PRO MASTER ENGINE • BRO_ENABLED_NODE</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={handleSelectKey} className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-bold text-slate-500 hover:text-white transition-all">
              <i className="fa-solid fa-key text-[10px]"></i> GANTI KEY
           </button>
           <div className="text-right px-4 lg:px-6 py-2 lg:py-3 bg-white/5 border border-white/5 rounded-2xl lg:rounded-3xl">
              <p className="text-[7px] lg:text-[8px] font-black uppercase text-slate-600 tracking-widest leading-none mb-1">SALDO ANDA</p>
              <p className="text-sm lg:text-2xl font-black italic text-cyan-400 leading-none">{credits.toLocaleString()} CR</p>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {showGuide && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-panel p-8 rounded-[2.5rem] bg-fuchsia-500/5 border border-fuchsia-500/20 mb-4 shadow-2xl">
               <p className="text-[10px] font-black text-fuchsia-500 uppercase tracking-[0.4em] mb-3 flex items-center gap-2">
                 <i className="fa-solid fa-circle-info"></i> {t.guideTitle}
               </p>
               <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed whitespace-pre-line">
                 {t.guideContent}
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0">
        <div className="lg:w-[450px] flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 flex-shrink-0">
          <section className="glass-panel p-8 rounded-[3rem] space-y-6 bg-slate-900/40 border-white/5 shadow-2xl">
            
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-fuchsia-500 tracking-[0.2em] px-2">Gambar Referensi (Maks 3)</label>
              <div className="grid grid-cols-3 gap-3">
                {sourceImages.map((img, i) => (
                  <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black relative group shadow-xl">
                    <img src={img} className="w-full h-full object-cover" />
                    <button onClick={() => setSourceImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                       <i className="fa-solid fa-trash text-white text-xs"></i>
                    </button>
                  </div>
                ))}
                {sourceImages.length < 3 && (
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all text-slate-700 hover:text-fuchsia-500">
                    <i className="fa-solid fa-plus text-lg"></i>
                    <input type="file" multiple onChange={handleImageUpload} className="hidden" accept="image/*" />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest">Gaya & Rasio</label>
              <div className="grid grid-cols-1 gap-4">
                <select value={style} onChange={e => setStyle(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-4 text-xs text-white font-black uppercase outline-none focus:border-fuchsia-500/50">
                  <option>Nyata (Foto)</option><option>Animasi 3D</option><option>Kartun / Anime</option><option>Seni Lukis</option><option>Futuristik</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  {['1:1', '16:9', '9:16', '4:3'].map(r => (
                    <button key={r} onClick={() => setAspectRatio(r as any)} className={`py-3 rounded-xl text-[9px] font-black border transition-all ${aspectRatio === r ? 'bg-fuchsia-500 text-black border-fuchsia-400 shadow-lg' : 'bg-black/20 border-white/5 text-slate-600'}`}>{r} RATIO</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest">Resolusi Output (High Definition)</label>
               <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                 {['1K', '2K', '4K'].map((size) => (
                   <button key={size} onClick={() => setImageSize(size as any)} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${imageSize === size ? 'bg-fuchsia-500 text-black shadow-lg' : 'text-slate-500'}`}>{size}</button>
                 ))}
               </div>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest">Jumlah Variasi</label>
               <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                 {[1, 2, 4].map((num) => (
                   <button key={num} onClick={() => setNumToGenerate(num)} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${numToGenerate === num ? 'bg-fuchsia-500 text-black shadow-lg' : 'text-slate-500'}`}>{num} VAR</button>
                 ))}
               </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest">Perintah Visual (Prompt)</label>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full h-32 bg-black/40 border border-white/10 rounded-[2.5rem] p-6 text-sm text-white focus:border-fuchsia-500/50 outline-none resize-none leading-relaxed shadow-inner" placeholder="Jelaskan mahakarya yang pengen lo buat, Bro..." />
            </div>

            <div className="p-6 rounded-[2.5rem] bg-fuchsia-500/5 border border-fuchsia-500/10 flex items-center justify-between">
              <div>
                <p className="text-[8px] font-black text-fuchsia-500 uppercase tracking-widest">BIAYA PRODUKSI</p>
                <p className="text-2xl font-black italic text-white leading-none">{totalCost} <span className="text-[10px] text-slate-500">CR</span></p>
              </div>
            </div>
            
            <button 
              onClick={generateImage} 
              disabled={isGenerating || !prompt.trim() || credits < totalCost} 
              className="w-full py-6 bg-white text-black font-black uppercase rounded-[2rem] hover:bg-fuchsia-400 transition-all shadow-2xl active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3 text-[11px] tracking-widest"
            >
              {isGenerating ? "SINTESIS NEURAL AKTIF..." : `MULAI CIPTAKAN MAHAKARYA`}
            </button>
          </section>
        </div>

        <div className="flex-1 min-w-0">
          <div className="glass-panel h-full rounded-[2rem] lg:rounded-[4rem] flex flex-col items-center justify-center p-4 lg:p-12 bg-black/30 border-white/5 shadow-2xl overflow-hidden relative">
            {resultImages.length > 0 ? (
              <div className={`grid gap-4 lg:gap-8 w-full h-full max-h-[900px] ${resultImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {resultImages.map((img, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative group rounded-3xl lg:rounded-[3.5rem] overflow-hidden border-2 border-white/5 bg-black shadow-2xl h-full">
                    <img src={img} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-6 backdrop-blur-md">
                       <a href={img} download={`satmoko_art_${idx}.png`} className="w-16 h-16 rounded-full bg-fuchsia-500 text-black flex items-center justify-center hover:bg-white transition-all text-xl"><i className="fa-solid fa-download"></i></a>
                       <button onClick={() => window.open(img, '_blank')} className="w-16 h-16 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 backdrop-blur-md border border-white/10 text-xl"><i className="fa-solid fa-expand"></i></button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center opacity-10 flex flex-col items-center">
                <i className="fa-solid fa-wand-magic-sparkles text-[100px] lg:text-[120px] mb-8 lg:mb-10"></i>
                <p className="text-base lg:text-xl font-black uppercase tracking-[1.2em]">SIAP UNTUK VISUALISASI</p>
              </div>
            )}
            
            {isGenerating && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl z-30 flex flex-col items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-20 lg:w-24 h-20 lg:h-24 border-8 border-fuchsia-500 border-t-transparent rounded-full mb-8 shadow-[0_0_40px_rgba(217,70,239,0.5)]" />
                <p className="text-lg lg:text-xl font-black text-fuchsia-400 uppercase tracking-[0.5em] animate-pulse">MEMPROSES GAMBAR {imageSize}...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};