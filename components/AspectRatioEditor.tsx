
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

// Fix: Correctly define the component as React.FC to avoid the 'void' type error.
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

    if (!process.env.API_KEY) {
      addLog("Gagal: API Key tidak terdeteksi. Silakan cek Vercel Master.", "error");
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

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const imagePart = {
        inlineData: {
          data: sourceImage.split(',')[1],
          mimeType: sourceImage.match(/data:([^;]+);/)?.[1] || 'image/png',
        },
      };

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
      const errorMsg = String(e?.message || (e ? JSON.stringify(e) : ""));
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
    <div className="space-y-6 pb-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95"><i className="fa-solid fa-chevron-left"></i></button>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Smart <span className="text-emerald-500">Reframe</span></h2>
        </div>
        <div className="text-right">
           <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest leading-none mb-1">Saldo Master</p>
           <p className="text-xl font-black italic text-cyan-400 leading-none">{credits.toLocaleString()} CR</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
           <div className="glass-panel p-8 rounded-[3rem] bg-slate-900/40 space-y-6 border-white/5 shadow-2xl">
              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">{t.upload}</label>
                 <div className="aspect-square w-full rounded-2xl border-2 border-dashed border-white/5 flex items-center justify-center overflow-hidden bg-black relative">
                    {sourceImage ? (
                       <img src={sourceImage} className="w-full h-full object-contain" />
                    ) : (
                       <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-slate-700">
                          <i className="fa-solid fa-cloud-arrow-up text-2xl mb-2"></i>
                          <p className="text-[9px] font-black uppercase">Pilih Gambar</p>
                          <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                       </label>
                    )}
                 </div>
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">{t.selectRatio}</label>
                 <div className="grid grid-cols-2 gap-2">
                    {['16:9', '9:16', '1:1', '4:3', '3:4'].map(r => (
                       <button key={r} onClick={() => setAspectRatio(r)} className={`py-3 rounded-xl border text-[9px] font-black uppercase transition-all ${aspectRatio === r ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-white/5 border-white/5 text-slate-500'}`}>{r}</button>
                    ))}
                 </div>
              </div>
              <button onClick={() => processReframe(0)} disabled={isProcessing || !sourceImage} className="w-full py-6 bg-emerald-600 text-white font-black uppercase rounded-[2rem] hover:bg-white hover:text-black transition-all shadow-xl text-[11px] tracking-widest">
                 {isProcessing ? "MENGOLAH VISUAL..." : `${t.process} (-${costPerProcess} CR)`}
              </button>
           </div>
        </div>

        <div className="lg:col-span-7">
           <div className="glass-panel min-h-[500px] rounded-[4rem] bg-black/40 border border-white/5 flex items-center justify-center p-8 shadow-2xl relative overflow-hidden">
              {resultImage ? (
                 <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full flex flex-col items-center gap-6">
                    <img src={resultImage} className="max-w-full max-h-[600px] object-contain rounded-2xl shadow-2xl border border-white/5" />
                    <a href={resultImage} download={`reframe_${Date.now()}.png`} className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 transition-all">UNDUH HASIL</a>
                 </motion.div>
              ) : (
                 <div className="text-center opacity-10 flex flex-col items-center gap-6">
                    <i className="fa-solid fa-expand text-8xl"></i>
                    <p className="text-[11px] font-black uppercase tracking-[0.8em]">{t.placeholder}</p>
                 </div>
              )}
              {isProcessing && (
                 <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                    <i className="fa-solid fa-microchip fa-spin text-emerald-400 text-4xl mb-6"></i>
                    <p className="text-[10px] font-black text-white uppercase tracking-[0.4em] animate-pulse">GENERATIVE_OUTPAINTING_ACTIVE</p>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
