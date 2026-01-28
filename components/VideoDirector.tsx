
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from '@google/genai';
import { deductCredits, getSystemSettings, rotateApiKey } from '../lib/api';

interface VideoSegment {
  number: number;
  duration: string;
  visualDescription: string;
  action: string;
  transitionNote: string;
  terminalCommand: string;
  videoUrl?: string | null;
  isRendering?: boolean;
}

interface VideoDirectorProps {
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

// Fix: Correctly define the component as React.FC to avoid the 'void' type error.
export const VideoDirector: React.FC<VideoDirectorProps> = ({ onBack, lang, userEmail, credits, refreshCredits }) => {
  const [story, setStory] = useState('');
  const [visualStyle, setVisualStyle] = useState('3D Animation, Pixar Style, High Detail, 4K');
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processLogs, setProcessLogs] = useState<LogEntry[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [costVideo, setCostVideo] = useState(150);

  useEffect(() => {
    getSystemSettings().then(s => setCostVideo(s.cost_video || 150));
  }, []);

  const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setProcessLogs(prev => {
      const newLogs = [...prev, { id, msg, type, time }];
      return newLogs.length > 5 ? newLogs.slice(1) : newLogs;
    });
  };

  const handleBreakdown = async (retryCount = 0) => {
    if (!story.trim()) return;
    setIsAnalyzing(true);
    addLog("Sutradara AI sedang membedah naskah...", "info");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const systemInstruction = `Role: AI Video Director & Continuity Specialist. 
Task: Breakdown a story into 8-second segments for Veo/VideoFX AI generation.

Rules:
1. Visual style MUST ALWAYS be: ${visualStyle}.
2. CHARACTER CONSISTENCY: Describe main characters with identical details in every prompt.
3. CONTINUITY: Every segment (except the first) must mention "Frame Awal" based on the "Frame Akhir" of the previous segment.
4. Output format for each segment must include: number, duration (8s), visualDescription, action, transitionNote, and terminalCommand (FFmpeg).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Breakdown this story according to your Role and Rules: \n\n${story}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.INTEGER },
                duration: { type: Type.STRING },
                visualDescription: { type: Type.STRING },
                action: { type: Type.STRING },
                transitionNote: { type: Type.STRING },
                terminalCommand: { type: Type.STRING }
              },
              required: ["number", "duration", "visualDescription", "action", "transitionNote", "terminalCommand"]
            }
          }
        }
      });

      const data = JSON.parse(response.text || '[]');
      setSegments(data.map((seg: any) => ({ ...seg, videoUrl: null, isRendering: false })));
      addLog(`Berhasil memecah cerita menjadi ${data.length} segmen 8 detik.`, "success");
    } catch (e: any) {
      const errorMsg = String(e?.message || (e ? JSON.stringify(e) : ""));
      if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 2) {
        rotateApiKey();
        return handleBreakdown(retryCount + 1);
      }
      addLog(`Gagal Analisis: ${errorMsg}`, "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderSegment = async (index: number, retryCount = 0) => {
    if (credits < costVideo && retryCount === 0) return addLog("Kredit Tidak Cukup!", "error");
    
    setSegments(prev => prev.map((s, i) => i === index ? { ...s, isRendering: true } : s));
    addLog(`Merender Segmen #${index + 1} (8 Detik)...`, "info");

    let isSuccess = false;
    try {
      if (retryCount === 0) {
        const success = await deductCredits(userEmail, costVideo);
        if (!success) throw new Error("Gagal potong kredit.");
        refreshCredits();
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const seg = segments[index];

      const continuityContext = index > 0 
        ? `STARTING FRAME: This scene must start exactly where the previous one ended: ${segments[index-1].transitionNote}. ` 
        : "";
      
      const fullPrompt = `${continuityContext}${seg.visualDescription}. Style: ${visualStyle}. Action: ${seg.action}`;

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: fullPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(r => setTimeout(r, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
        if (operation.error) throw operation.error;
      }

      const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (uri) {
        const resp = await fetch(`${uri}&key=${process.env.API_KEY}`);
        const blob = await resp.blob();
        const videoUrl = URL.createObjectURL(new Blob([blob], { type: 'video/mp4' }));
        setSegments(prev => prev.map((s, i) => i === index ? { ...s, videoUrl, isRendering: false } : s));
        addLog(`Segmen #${index + 1} Selesai Terbentuk!`, "success");
        isSuccess = true;
      }
    } catch (e: any) {
      const errorMsg = String(e?.message || (e ? JSON.stringify(e) : ""));
      if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 2) {
        rotateApiKey();
        return renderSegment(index, retryCount + 1);
      }
      setSegments(prev => prev.map((s, i) => i === index ? { ...s, isRendering: false } : s));
      addLog(`Gagal Render: ${errorMsg}`, "error");
    }
  };

  return (
    <div className="space-y-6 pb-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95"><i className="fa-solid fa-chevron-left"></i></button>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Video <span className="text-orange-500">Director</span></h2>
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
                 <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Gaya Visual Global</label>
                 <input type="text" value={visualStyle} onChange={e => setVisualStyle(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white font-bold outline-none" />
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Tulis Cerita Utuh</label>
                 <textarea value={story} onChange={e => setStory(e.target.value)} placeholder="Tulis cerita di sini..." className="w-full h-60 bg-black/40 border border-white/10 rounded-[2.5rem] p-6 text-sm text-white outline-none resize-none" />
              </div>
              <button onClick={() => handleBreakdown(0)} disabled={isAnalyzing || !story} className="w-full py-6 bg-orange-600 text-white font-black uppercase rounded-[2rem] hover:bg-white hover:text-black transition-all shadow-xl text-[11px] tracking-widest">
                 {isAnalyzing ? "MENGANALISIS ALUR..." : `PECAH JADI SEGMEN VIDEO`}
              </button>
           </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
           <div className="space-y-4">
              {segments.map((s, idx) => (
                 <div key={idx} className="glass-panel p-6 rounded-[2.5rem] bg-black/40 border border-white/5 flex gap-6 items-center shadow-xl">
                    <div className="w-40 aspect-video bg-slate-800 rounded-2xl overflow-hidden flex-shrink-0 relative">
                       {s.videoUrl ? <video src={s.videoUrl} className="w-full h-full object-cover" controls /> : <div className="w-full h-full flex items-center justify-center text-slate-700"><i className="fa-solid fa-clapperboard"></i></div>}
                       {s.isRendering && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><i className="fa-solid fa-spinner fa-spin text-orange-400"></i></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2">SEGMEN #{s.number} ({s.duration})</p>
                       <p className="text-[9px] text-slate-500 line-clamp-2 mb-4">{s.action}</p>
                       <button onClick={() => renderSegment(idx)} disabled={s.isRendering || !!s.videoUrl} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${s.videoUrl ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-orange-500 text-black border-orange-400 hover:bg-white'}`}>
                          {s.isRendering ? "RENDERING..." : s.videoUrl ? "SELESAI" : "RENDER SEGMEN"}
                       </button>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};
