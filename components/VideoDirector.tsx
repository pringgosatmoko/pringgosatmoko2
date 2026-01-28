
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
      // Correct: Use process.env.API_KEY directly as per guidelines.
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
      if ((e.message?.includes('429') || e.message?.includes('quota')) && retryCount < 2) {
        rotateApiKey();
        return handleBreakdown(retryCount + 1);
      }
      addLog(`Gagal Analisis: ${e.message}`, "error");
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

      // Correct: Use process.env.API_KEY directly as per guidelines.
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
        // Correct: Append process.env.API_KEY for fetching the video bytes.
        const resp = await fetch(`${uri}&key=${process.env.API_KEY}`);
        const blob = await resp.blob();
        const videoUrl = URL.createObjectURL(new Blob([blob], { type: 'video/mp4' }));
        setSegments(prev => prev.map((s, i) => i === index ? { ...s, videoUrl, isRendering: false } : s));
        addLog(`Segmen #${index + 1} Selesai Terbentuk!`, "success");
        isSuccess = true;
      }
    } catch (e: any) {
      if ((e.message?.includes('429') || e.message?.includes('quota')) && retryCount < 2) {
        rotateApiKey();
        return renderSegment(index, retryCount + 1);
      }
      setSegments(prev => prev.map((s, i) => i === index ? { ...s, isRendering: false } : s));
      addLog(`Gagal Render: ${e.message}`, "error");
    }
  };

  const removeLog = (id: string) => {
    setProcessLogs(prev => prev.filter(log => log.id !== id));
  };

  const translations = {
    id: {
      guideTitle: "PANDUAN VIDEO DIRECTOR",
      guideContent: `Modul ini adalah spesialis pembuat video durasi panjang dengan konsistensi tinggi.
      1. STYLE: Masukkan gaya visual yang diinginkan (misal: Pixar Style). Gaya ini akan dipaksa sama di setiap klip.
      2. SCENARIO: Masukkan naskah cerita panjang Master.
      3. BREAKDOWN: Sistem akan memecah naskah menjadi segmen 8 detik yang saling menyambung.
      4. CONTINUITY: Setiap segmen baru akan mengambil "Frame Terakhir" dari segmen sebelumnya untuk menjaga kesinambungan.
      5. MERGE: Gunakan Terminal Command (FFmpeg) untuk menggabungkan semua file hasil download menjadi satu film utuh.`
    },
    en: {
      guideTitle: "VIDEO DIRECTOR GUIDE",
      guideContent: `This module specializes in creating long-duration videos with high consistency.
      1. STYLE: Enter the desired visual style (e.g., Pixar Style). This style will be enforced on every clip.
      2. SCENARIO: Enter Master's long story script.
      3. BREAKDOWN: The system will automatically split the script into connected 8-second segments.
      4. CONTINUITY: Each new segment uses the "Last Frame" from the previous one to maintain flow.
      5. MERGE: Use Terminal Commands (FFmpeg) to merge all downloaded files into one movie.`
    }
  };

  const t = translations[lang] || translations.id;

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto">
      <div className="fixed top-6 right-6 z-[500] w-72 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {processLogs.map((log) => (
            <motion.div 
              key={log.id} 
              initial={{ opacity: 0, x: 50 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 200 }} 
              drag="x"
              dragConstraints={{ left: -300, right: 300 }}
              onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) removeLog(log.id); }}
              className={`p-4 rounded-2xl glass-panel border-l-4 shadow-2xl flex flex-col gap-1 backdrop-blur-3xl pointer-events-auto cursor-grab active:cursor-grabbing ${log.type === 'success' ? 'border-l-cyan-500 bg-cyan-500/10' : log.type === 'error' ? 'border-l-red-500 bg-red-500/20' : 'border-l-orange-500 bg-orange-500/10'}`}
            >
              <div className="flex justify-between items-center mb-0.5">
                <p className="text-[10px] font-bold text-white leading-tight">{log.msg}</p>
                <i className="fa-solid fa-arrows-left-right text-[7px] text-white/20"></i>
              </div>
              <span className="text-[7px] text-slate-500 uppercase font-black">{log.time}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95"><i className="fa-solid fa-chevron-left"></i></button>
          <button onClick={() => setShowGuide(!showGuide)} className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center shadow-xl ${showGuide ? 'bg-orange-500 text-black border-orange-400 shadow-orange-500/30' : 'bg-white/5 border-white/5 text-orange-400'}`}>
            <i className={`fa-solid ${showGuide ? 'fa-xmark' : 'fa-question'} text-[10px]`}></i>
          </button>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">AI Video <span className="text-orange-500">Director</span></h2>
            <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-600">Continuity & Multi-Segment Specialist</p>
          </div>
        </div>
        <div className="px-6 py-2 bg-black/40 border border-white/5 rounded-2xl shadow-lg border-cyan-500/20">
           <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest leading-none mb-1">Saldo Master</p>
           <p className="text-xl font-black italic text-cyan-400 leading-none">{credits.toLocaleString()} CR</p>
        </div>
      </div>

      <AnimatePresence>
        {showGuide && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-panel p-8 rounded-[2.5rem] bg-orange-500/5 border-2 border-orange-500/30 mb-4 shadow-2xl">
               <p className="text-[9px] font-black text-orange-500 uppercase tracking-[0.4em] mb-3">{t.guideTitle}</p>
               <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed whitespace-pre-line">
                 {t.guideContent}
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <section className="glass-panel p-8 rounded-[3rem] bg-slate-900/40 space-y-6 shadow-2xl border-2 border-orange-500/40">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-orange-500 tracking-[0.2em] px-1">Visual Continuity Style</label>
              <input 
                type="text" 
                value={visualStyle} 
                onChange={e => setVisualStyle(e.target.value)} 
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 text-[11px] text-white outline-none focus:border-orange-500/30 transition-all font-bold"
                placeholder=" Pixar Style, 4K, High Detail..."
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-orange-500 tracking-[0.2em] px-1">Skenario Cerita (Panjang)</label>
              <textarea 
                value={story} 
                onChange={e => setStory(e.target.value)} 
                className="w-full h-80 bg-black/40 border border-white/10 rounded-[2.5rem] p-6 text-sm text-white focus:border-orange-500/30 outline-none resize-none leading-relaxed shadow-inner"
                placeholder="Masukkan cerita Master... Sistem akan memecahnya otomatis menjadi klip 8 detik."
              />
            </div>

            <button 
              onClick={() => handleBreakdown()} 
              disabled={isAnalyzing || !story.trim()} 
              className="w-full py-5 bg-orange-600 text-white font-black uppercase rounded-2xl shadow-xl active:scale-95 disabled:opacity-20 hover:bg-white hover:text-orange-600 transition-all text-xs tracking-widest flex items-center justify-center gap-3"
            >
              {isAnalyzing ? <i className="fa-solid fa-sync fa-spin"></i> : <i className="fa-solid fa-clapperboard"></i>}
              Breakdown Skenario (8s)
            </button>
          </section>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {segments.length > 0 ? (
            <div className="space-y-6">
              {segments.map((seg, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass-panel p-8 rounded-[3rem] bg-[#0d1117]/80 border-2 border-cyan-500/20 flex flex-col md:flex-row gap-8 hover:border-orange-500/40 transition-all shadow-xl"
                >
                  <div className="flex-1 space-y-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                         <span className="w-10 h-10 rounded-full bg-orange-500 text-black flex items-center justify-center font-black italic shadow-lg">#{seg.number}</span>
                         <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Segment [00:{idx*8 < 10 ? '0' : ''}{idx*8} - 00:{(idx+1)*8 < 10 ? '0' : ''}{(idx+1)*8}]</h4>
                       </div>
                       <div className="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black text-slate-500 tracking-widest uppercase">Durasi: {seg.duration}</div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5 shadow-inner">
                        <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest mb-1">Visual Prompt (Continuity)</p>
                        <p className="text-[11px] text-slate-300 font-bold leading-relaxed">{seg.visualDescription}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-cyan-500 uppercase tracking-widest mb-1">Action Details</p>
                        <p className="text-[11px] text-slate-400 italic leading-relaxed">"{seg.action}"</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20">
                        <p className="text-[8px] font-black text-yellow-500 uppercase tracking-widest mb-1">Transition Note</p>
                        <p className="text-[10px] text-slate-500 font-medium">{seg.transitionNote}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                       <p className="text-[7px] font-black text-slate-700 uppercase tracking-widest mb-2 italic">FFmpeg Merge Command:</p>
                       <div className="bg-black/60 p-3 rounded-xl border border-white/5 relative group">
                          <code className="text-[8px] text-cyan-600 font-mono break-all pr-8 block">{seg.terminalCommand}</code>
                          <button onClick={() => navigator.clipboard.writeText(seg.terminalCommand)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-700 hover:text-cyan-500"><i className="fa-solid fa-copy"></i></button>
                       </div>
                    </div>
                  </div>

                  <div className="w-full md:w-80 flex flex-col gap-4">
                    <div className="aspect-video rounded-[2rem] bg-black border border-white/10 overflow-hidden relative shadow-2xl group">
                       {seg.videoUrl ? (
                         <video src={seg.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center opacity-10">
                            <i className="fa-solid fa-film text-5xl"></i>
                         </div>
                       )}
                       {seg.isRendering && (
                         <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-md z-10">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mb-3 shadow-[0_0_15px_rgba(249,115,22,0.4)]"></motion.div>
                            <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest animate-pulse">Neural_Processing</p>
                         </div>
                       )}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                          {seg.videoUrl && <a href={seg.videoUrl} download={`segment_${seg.number}.mp4`} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all"><i className="fa-solid fa-download"></i></a>}
                       </div>
                    </div>
                    <button 
                      onClick={() => renderSegment(idx)} 
                      disabled={seg.isRendering || credits < costVideo} 
                      className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase transition-all shadow-xl active:scale-95 ${seg.videoUrl ? 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-white text-black hover:bg-orange-500 hover:text-white'}`}
                    >
                      {seg.isRendering ? 'Rendering...' : seg.videoUrl ? '✓ Render Ulang' : `Render Segmen (${costVideo} CR)`}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-[600px] glass-panel rounded-[4rem] border border-white/5 flex flex-col items-center justify-center text-center p-12 opacity-20">
               <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center mb-8">
                  <i className="fa-solid fa-clapperboard text-5xl text-slate-700"></i>
               </div>
               <p className="text-xl font-black uppercase tracking-[0.8em] leading-relaxed text-slate-500">Waiting for Script<br/>Breakdown</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
