
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { deductCredits, getSystemSettings, rotateApiKey } from '../lib/api';

interface LogEntry {
  id: string;
  msg: string;
  type: 'info' | 'success' | 'warning' | 'error';
  time: string;
}

interface AspectRatioEditorProps {
  onBack: () => void;
  lang: 'id' | 'en';
  userEmail: string;
  credits: number;
  refreshCredits: () => void;
}

export const AspectRatioEditor: React.FC<AspectRatioEditorProps> = ({ onBack, lang, userEmail, credits, refreshCredits }) => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<LogEntry[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [costPerProcess, setCostPerProcess] = useState(25);

  useEffect(() => {
    getSystemSettings().then(s => setCostPerProcess(s.cost_image || 25));
  }, []);

  const t = {
    id: {
      guide: `Fitur "Generative Outpainting" untuk memperluas latar belakang gambar tanpa memotong subjek. AI akan mengisi area kosong dengan detail yang menyambung secara logis. Biaya: ${costPerProcess} Kredit.`,
      title: "PANDUAN SMART REFRAME",
      aspectRatioEngine: "Ubah Rasio",
      noCredit: "KREDIT HABIS!",
      totalCharge: "BIAYA PROSES",
      upload: "Upload Gambar Master",
      selectRatio: "Pilih Rasio Baru",
      process: "MULAI UBAH RASIO",
      placeholder: "MENUNGGU_INPUT_MASTER"
    },
    en: {
      guide: `Generative Outpainting feature to extend the background without cropping the subject. AI will fill gaps with logically consistent details. Cost: ${costPerProcess} Credits.`,
      title: "SMART REFRAME GUIDE",
      aspectRatioEngine: "Change Ratio",
      noCredit: "CREDIT EXHAUSTED!",
      totalCharge: "PROCESS COST",
      upload: "Upload Your Image",
      selectRatio: "Select New Ratio",
      process: "START REFRAME",
      placeholder: "WAITING_FOR_INPUT"
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
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImage(reader.result as string);
        setResultImage(null);
        addLog("Gambar master siap diolah.", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const processReframe = async (retryCount = 0) => {
    if (!sourceImage) return;
    if (credits < costPerProcess && retryCount === 0) {
      addLog(t.noCredit, "error");
      return;
    }

    setIsProcessing(true);
    addLog(retryCount > 0 ? `Coba ulang (Slot Kunci ${retryCount + 1})...` : "Melakukan Generative Outpainting...");

    try {
      if (retryCount === 0) {
        const success = await deductCredits(userEmail, costPerProcess);
        if (!success) throw new Error("Gagal potong kredit.");
        refreshCredits();
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      const imagePart = {
        inlineData: {
          data: sourceImage.split(',')[1],
          mimeType: sourceImage.match(/data:([^;]+);/)?.[1] || 'image/png',
        },
      };

      // PROMPT YANG DIPERKUAT: Fokus pada perluasan bagian bawah agar tidak sempit
      const prompt = `Extend the background of this image to fit a ${aspectRatio} aspect ratio. 
      INSTRUCTIONS: 
      1. Use "Generative Fill" to outpaint new areas, ESPECIALLY focus on extending the BOTTOM of the frame significantly. 
      2. Provide more visual room below the subject to prevent a cramped look. 
      3. CONTINUE the existing background patterns, textures, and lighting naturally to the new lower area. 
      4. ABSOLUTELY NO MIRRORING, NO REFLECTIONS, and NO DUPLICATIONS of the main subject at the bottom. 
      5. Maintain realistic ground/floor perspective. High-end professional photography results with spacious composition.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
          imageConfig: { aspectRatio: aspectRatio as any },
          temperature: 0.75,
        },
      });

      if (response?.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setResultImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
            addLog("Outpainting Berhasil!", "success");
            setIsProcessing(false);
            return;
          }
        }
      }
      throw new Error("Gagal menerima output gambar dari AI.");
    } catch (e: any) {
      const errorMsg = e?.message || "";
      if ((errorMsg.includes('429') || errorMsg.includes('500') || errorMsg.includes('Rpc failed')) && retryCount < 3) {
        addLog(`Jalur sibuk, merotasi node...`, "warning");
        rotateApiKey();
        setTimeout(() => processReframe(retryCount + 1), 2000);
      } else {
        addLog(`Gagal: ${errorMsg.substring(0, 50)}...`, "error");
        setIsProcessing(false);
      }
    } finally {
      refreshCredits();
    }
  };

  return (
    <div className="space-y-6 pb-40 relative">
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
                log.type === 'success' ? 'border-l-emerald-500 bg-emerald-500/10' :
                log.type === 'error' ? 'border-l-red-500 bg-red-500/20' : 
                log.type === 'warning' ? 'border-l-yellow-500 bg-yellow-500/10' : 'border-l-white/20 bg-white/5'
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl active:scale-95"><i className="fa-solid fa-chevron-left"></i></button>
          <button onClick={() => setShowGuide(!showGuide)} className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center shadow-xl ${showGuide ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-white/5 border-white/5 text-emerald-400'}`}>
            <i className={`fa-solid ${showGuide ? 'fa-xmark' : 'fa-question'} text-[10px]`}></i>
          </button>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Smart <span className="text-emerald-500">Outpaint</span></h2>
        </div>
        <div className="text-right">
           <p className="text-[9px] font-black uppercase text-slate-600 tracking-widest leading-none mb-1">Saldo Anda</p>
           <p className="text-xl font-black italic text-cyan-400 leading-none">{credits.toLocaleString()} CR</p>
        </div>
      </div>

      <AnimatePresence>
        {showGuide && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-panel p-6 rounded-[2.5rem] border-emerald-500/20 bg-emerald-500/5 mb-2 shadow-2xl">
              <p className="text-[9px] font-black uppercase text-emerald-400 tracking-[0.4em] mb-3">{t.title}</p>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">
                {t.guide}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-5 space-y-6">
          <section className="glass-panel p-8 rounded-[2.5rem] space-y-6 bg-slate-900/40 border-white/5 shadow-2xl">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest">{t.upload}</label>
              <div className="aspect-video rounded-2xl border-2 border-dashed border-white/5 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-all overflow-hidden relative">
                {sourceImage ? (
                  <>
                    <img src={sourceImage} className="w-full h-full object-contain" />
                    <label className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer transition-all">
                       <i className="fa-solid fa-rotate text-white text-xl"></i>
                       <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                    </label>
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                    <i className="fa-solid fa-cloud-arrow-up text-slate-700 text-3xl mb-2"></i>
                    <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Klik Untuk Upload</p>
                    <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest">{t.selectRatio}</label>
               <div className="grid grid-cols-2 gap-2">
                 {[
                   { id: '1:1', label: '1:1 (INSTA)' },
                   { id: '16:9', label: '16:9 (HD)' },
                   { id: '9:16', label: '9:16 (PHONE)' },
                   { id: '4:3', label: '4:3 (STANDARD)' }
                 ].map((r) => (
                   <button 
                     key={r.id} 
                     onClick={() => setAspectRatio(r.id)} 
                     className={`py-4 rounded-xl text-[10px] font-black uppercase transition-all border ${aspectRatio === r.id ? 'bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-black/20 border-white/5 text-slate-500 hover:text-white'}`}
                   >
                     {r.label}
                   </button>
                 ))}
               </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
              <div>
                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">{t.totalCharge}</p>
                <p className="text-lg font-black italic text-white leading-none">{costPerProcess} <span className="text-[10px] text-slate-500">CR</span></p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Sisa Saldo</p>
                <p className={`text-[11px] font-black ${credits < costPerProcess ? 'text-red-500' : 'text-slate-400'}`}>
                  {(credits - costPerProcess).toLocaleString()} CR
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => processReframe()} 
              disabled={isProcessing || !sourceImage || credits < costPerProcess} 
              className="w-full py-6 bg-white text-black font-black uppercase rounded-[1.5rem] hover:bg-emerald-400 transition-all shadow-2xl active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3"
            >
              {isProcessing ? "MENGKONSTRUKSI LATAR..." : credits < costPerProcess ? t.noCredit : t.process}
            </button>
          </section>
        </div>

        <div className="xl:col-span-7">
          <div className="glass-panel min-h-[600px] rounded-[3.5rem] flex flex-col items-center justify-center p-8 bg-black/30 border-white/5 shadow-2xl overflow-hidden relative">
            {resultImage ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative group w-full h-full flex items-center justify-center">
                <img src={resultImage} className="max-w-full max-h-[550px] object-contain rounded-2xl shadow-2xl border border-white/5" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4 backdrop-blur-sm">
                   <a href={resultImage} download={`reframe_satmoko_${Date.now()}.png`} className="w-12 h-12 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:bg-white transition-all shadow-lg shadow-emerald-500/20"><i className="fa-solid fa-download"></i></a>
                   <button onClick={() => window.open(resultImage, '_blank')} className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 backdrop-blur-md border border-white/10"><i className="fa-solid fa-expand"></i></button>
                </div>
              </motion.div>
            ) : (
              <div className="text-center opacity-10 flex flex-col items-center">
                <i className="fa-solid fa-vector-square text-8xl mb-6"></i>
                <p className="text-[11px] font-black uppercase tracking-[0.8em]">{t.placeholder}</p>
              </div>
            )}
            
            {isProcessing && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full mb-6 shadow-[0_0_20px_rgba(16,185,129,0.4)]" />
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] animate-pulse">GENERATIVE_FILL_ACTIVE</p>
                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mt-2">NO_MIRRORING_PROTOCOL_ON</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
