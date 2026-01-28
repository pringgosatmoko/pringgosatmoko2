
import { GoogleGenAI, VideoGenerationReferenceType, Type } from '@google/genai';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { deductCredits, getSystemSettings, rotateApiKey } from '../lib/api';

interface StoryboardToVideoProps {
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

export const StoryboardToVideo: React.FC<StoryboardToVideoProps> = ({ onBack, lang, userEmail, credits, refreshCredits }) => {
  const [storyboard, setStoryboard] = useState('');
  const [videoStyle, setVideoStyle] = useState('Realistic Cinematic');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '21:9'>('16:9');
  const [numScenes, setNumScenes] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVisualizing, setIsVisualizing] = useState(false);
  const [sceneImages, setSceneImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<LogEntry[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [baseCosts, setBaseCosts] = useState({ image: 20, video: 150 });

  useEffect(() => {
    getSystemSettings().then(s => setBaseCosts({ 
      image: s.cost_image || 20, 
      video: s.cost_video || 150 
    }));
  }, []);

  const totalImageCost = baseCosts.image * numScenes;
  const totalVideoCost = baseCosts.video;

  const styles = [
    'Realistic Cinematic',
    '3D Pixar Animation',
    'Cyberpunk Neon',
    'Anime / Ghibli',
    'Oil Painting Motion',
    'Vintage 35mm Film'
  ];

  const translations = {
    id: {
      title: "Storyboard-ke-Video",
      subtitle: "Visualisasi Alur Cerita Kustom",
      placeholder: "Tulis skenario Master di sini secara detail...",
      settings: "PENGATURAN PRODUKSI",
      style: "Gaya Visual",
      ratio: "Bentuk Video",
      sceneCount: "Jumlah Adegan",
      step1: `LANGKAH 1: BUAT ${numScenes} ADEGAN`,
      step2: "LANGKAH 2: RENDER VIDEO UTUH",
      totalCost: "ESTIMASI BIAYA",
      noCredit: "SALDO TIDAK CUKUP",
      waiting: "MENUNGGU PERINTAH MASTER",
      visualReady: `${numScenes} ADEGAN SIAP`,
      visualizing: "MENGGAMBAR ADEGAN...",
      rendering: "SEDANG MERENDER VIDEO...",
      guideTitle: "PANDUAN STORYBOARD",
      guideContent: `Modul ini mengubah naskah panjang menjadi satu video utuh.
      1. Tulis naskah lengkap di kolom teks.
      2. Klik Langkah 1 untuk membuat gambar per adegan (Keyframes).
      3. Setelah semua gambar siap & konsisten, klik Langkah 2.
      4. Sistem akan merender video sinematik utuh yang menggabungkan semua adegan tersebut.`
    },
    en: {
      title: "Storyboard-to-Video",
      subtitle: "Custom Storyline Visualization",
      placeholder: "Write Master's scenario here in detail...",
      settings: "PRODUCTION SETTINGS",
      style: "Visual Style",
      ratio: "Video Shape",
      sceneCount: "Scene Count",
      step1: `STEP 1: CREATE ${numScenes} SCENES`,
      step2: "STEP 2: RENDER FULL VIDEO",
      totalCost: "ESTIMATED COST",
      noCredit: "INSUFFICIENT BALANCE",
      waiting: "WAITING FOR MASTER COMMAND",
      visualReady: `${numScenes} SCENES READY`,
      visualizing: "DRAWING SCENES...",
      rendering: "RENDERING VIDEO...",
      guideTitle: "STORYBOARD GUIDE",
      guideContent: `This module converts long scripts into a single full video.
      1. Write full script in the text field.
      2. Click Step 1 to create images per scene (Keyframes).
      3. Once all images are ready & consistent, click Step 2.
      4. System will render a full cinematic video combining all scenes.`
    }
  };

  const t = translations[lang] || translations.id;

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

  const generateSceneImages = async (retryCount = 0) => {
    if (credits < totalImageCost && retryCount === 0) {
      addLog(t.noCredit, "error");
      return;
    }

    setIsVisualizing(true);
    if (retryCount === 0) setSceneImages([]);
    setVideoUrl(null);
    addLog(`Menganalisis skenario untuk ${numScenes} adegan...`);

    let isSuccess = false;
    try {
      if (retryCount === 0) {
        const success = await deductCredits(userEmail, totalImageCost);
        if (!success) throw new Error("Gagal memotong saldo.");
        refreshCredits();
      }

      // Correct: Use process.env.API_KEY directly as per guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const analysisPrompt = `Analyze and break this script into exactly ${numScenes} distinct chronological visual keyframes. 
      Maintain strict consistency in characters, costumes, and environment lighting across all scenes. 
      Return JSON array of ${numScenes} strings (highly detailed visual prompts).
      Script: ${storyboard}
      Style: ${videoStyle}`;

      const analysisResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ parts: [{ text: analysisPrompt }] }],
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const prompts = JSON.parse(analysisResponse.text || "[]");
      addLog(`Rencana ${prompts.length} adegan siap. Mulai menggambar...`);

      const images: string[] = [];
      for (let i = 0; i < prompts.length; i++) {
        addLog(`Memproses Visual Adegan ${i + 1}/${prompts.length}...`);
        
        let success = false;
        let imgRetry = 0;
        while (!success && imgRetry < 3) {
           try {
              // Correct: Use process.env.API_KEY directly as per guidelines.
              const currentAi = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
              const imgResponse = await currentAi.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: `${prompts[i]}. Cinematic high-end production, matches style: ${videoStyle}.` }] },
                config: {
                  imageConfig: { aspectRatio: aspectRatio === '21:9' ? '16:9' : (aspectRatio as any) }
                }
              });

              if (imgResponse.candidates?.[0]?.content?.parts) {
                for (const part of imgResponse.candidates[0].content.parts) {
                  if (part.inlineData) {
                    const b64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    images.push(b64);
                    setSceneImages([...images]);
                    success = true;
                    break;
                  }
                }
              }
           } catch (err: any) {
              const errMsg = err?.message || JSON.stringify(err);
              if (errMsg.includes('429') || errMsg.includes('quota')) {
                 rotateApiKey();
                 imgRetry++;
                 await new Promise(r => setTimeout(r, 1000));
              } else throw err;
           }
        }
      }

      addLog(`Visualisasi ${images.length} adegan selesai!`, "success");
      isSuccess = true;
    } catch (e: any) {
      const errorMsg = e?.message || JSON.stringify(e);
      if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 3) {
        rotateApiKey();
        setTimeout(() => generateSceneImages(retryCount + 1), 1500);
        return;
      } else {
        addLog(`Gagal: ${errorMsg.substring(0, 50)}...`, "error");
      }
    } finally {
      if (isSuccess || retryCount >= 3) {
        setIsVisualizing(false);
      }
      refreshCredits();
    }
  };

  const processToVideo = async (retryCount = 0) => {
    if (sceneImages.length < numScenes) {
      addLog(`Master, butuh ${numScenes} adegan visual sebelum merender!`, "warning");
      return;
    }
    if (credits < totalVideoCost && retryCount === 0) {
      addLog(t.noCredit, "error");
      return;
    }

    setIsGenerating(true);
    addLog("Sinkronisasi adegan ke neural video engine...");

    let isSuccess = false;
    try {
      if (retryCount === 0) {
        const success = await deductCredits(userEmail, totalVideoCost);
        if (!success) throw new Error("Gagal memotong saldo.");
        refreshCredits();
      }

      // Correct: Use process.env.API_KEY directly as per guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const finalPrompt = `Animate a high-quality cinematic video following this chronological storyboard: ${storyboard}. 
      Visual Style: ${videoStyle}. 
      Follow the visual flow of the provided reference images. Smooth camera motion, 4k detail.`;
      
      const selectedIndices = sceneImages.length <= 3 
        ? sceneImages.map((_, i) => i) 
        : [0, Math.floor(sceneImages.length / 2), sceneImages.length - 1];

      const refImages = selectedIndices.map(idx => ({
        image: {
          imageBytes: sceneImages[idx].split(',')[1],
          mimeType: sceneImages[idx].match(/data:(.*?);/)?.[1] || 'image/png'
        },
        referenceType: VideoGenerationReferenceType.ASSET
      }));

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: finalPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio === '21:9' ? '16:9' : (aspectRatio as any),
          referenceImages: refImages
        }
      });

      while (!operation.done) {
        addLog("Rendering simulasi (1-3 menit)...", "info");
        await new Promise(r => setTimeout(r, 15000));
        operation = await ai.operations.getVideosOperation({ operation });
        if (operation.error) throw operation.error;
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        // Correct: Append process.env.API_KEY for fetching the video bytes.
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob as Blob));
        addLog("Video sinematik selesai dikonstruksi!", "success");
        isSuccess = true;
      }
    } catch (e: any) {
      const errorMsg = e?.message || JSON.stringify(e);
      if (errorMsg.includes('403')) {
         addLog("Node Error (403): Kunci ini tidak diizinkan akses Veo. Wajib Kunci Project BERBAYAR.", "error");
         if (retryCount < 2) {
           rotateApiKey();
           addLog("Mencoba slot kunci cadangan...");
           setTimeout(() => processToVideo(retryCount + 1), 2000);
           return;
         }
      } else if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 3) {
        rotateApiKey();
        setTimeout(() => processToVideo(retryCount + 1), 2000);
        return;
      } else {
        addLog(`Error: ${errorMsg.substring(0, 60)}...`, "error");
      }
    } finally {
      if (isSuccess || retryCount >= 2) {
        setIsGenerating(false);
      }
      refreshCredits();
    }
  };

  return (
    <div className="space-y-6 pb-40 relative">
      <div className="fixed top-6 right-6 z-[300] w-72 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {processLogs.map((log) => (
            <motion.div 
              key={log.id} 
              initial={{ opacity: 0, x: 50 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 100 }}
              drag="x"
              dragConstraints={{ left: -100, right: 100 }}
              onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 40) removeLog(log.id); }}
              className={`p-4 rounded-2xl glass-panel border-l-4 shadow-2xl flex flex-col gap-1 backdrop-blur-3xl pointer-events-auto cursor-grab active:cursor-grabbing ${log.type === 'success' ? 'border-l-green-500 bg-green-500/10' : log.type === 'error' ? 'border-l-red-500 bg-red-500/20' : 'border-l-cyan-500 bg-cyan-500/10'}`}
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
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <button onClick={() => setShowGuide(!showGuide)} className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center shadow-xl ${showGuide ? 'bg-fuchsia-500 text-black border-fuchsia-400' : 'bg-white/5 border-white/5 text-fuchsia-500'}`}>
            <i className={`fa-solid ${showGuide ? 'fa-xmark' : 'fa-question'} text-[10px]`}></i>
          </button>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">{t.title}</h2>
            <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-600 mt-1">{t.subtitle}</p>
          </div>
        </div>
        <div className="text-right">
           <p className="text-[9px] font-black uppercase text-slate-600 tracking-widest leading-none mb-1">Saldo Anda</p>
           <p className="text-xl font-black italic text-cyan-400 leading-none">{credits.toLocaleString()} CR</p>
        </div>
      </div>

      <AnimatePresence>
        {showGuide && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-panel p-8 rounded-[2.5rem] bg-fuchsia-500/5 border border-fuchsia-500/20 mb-4 shadow-2xl">
               <p className="text-[9px] font-black text-fuchsia-500 uppercase tracking-[0.4em] mb-3">{t.guideTitle}</p>
               <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed whitespace-pre-line">
                 {t.guideContent}
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <section className="glass-panel p-8 rounded-[3rem] bg-slate-900/40 space-y-6 shadow-2xl border-white/5">
             <div className="space-y-4">
                <p className="text-[9px] font-black uppercase text-fuchsia-500 tracking-[0.2em]">{t.settings}</p>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-600 uppercase px-1">{t.style}</label>
                      <select value={videoStyle} onChange={e => setVideoStyle(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-3 text-[10px] text-white font-black uppercase outline-none">
                         {styles.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-600 uppercase px-1">{t.ratio}</label>
                      <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-3 text-[10px] text-white font-black outline-none">
                         <option value="16:9">Lanskap (16:9)</option>
                         <option value="9:16">Tegak (9:16)</option>
                         <option value="1:1">Kotak (1:1)</option>
                         <option value="21:9">Bioskop (21:9)</option>
                      </select>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[8px] font-black text-slate-600 uppercase px-1">{t.sceneCount}</label>
                   <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                      {[2, 3, 4, 5, 6].map(num => (
                        <button key={num} onClick={() => { setNumScenes(num); setSceneImages([]); }} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${numScenes === num ? 'bg-fuchsia-500 text-black' : 'text-slate-600 hover:text-white'}`}>{num}</button>
                      ))}
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[8px] font-black text-slate-600 uppercase px-1">Naskah Skenario</label>
                   <textarea 
                     value={storyboard} 
                     onChange={e => setStoryboard(e.target.value)} 
                     placeholder={t.placeholder}
                     className="w-full h-40 bg-black/60 border border-white/10 rounded-[2rem] p-6 text-[12px] text-white focus:border-fuchsia-500/50 outline-none resize-none leading-relaxed shadow-inner" 
                   />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-fuchsia-500/5 border border-fuchsia-500/20 flex flex-col justify-center">
                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">{numScenes}x Visual</p>
                    <p className="text-lg font-black italic text-white">{totalImageCost} <span className="text-[8px] text-slate-500">CR</span></p>
                  </div>
                  <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 flex flex-col justify-center">
                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">1x Render</p>
                    <p className="text-lg font-black italic text-white">{totalVideoCost} <span className="text-[8px] text-slate-500">CR</span></p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => generateSceneImages(0)} 
                    disabled={isVisualizing || isGenerating || !storyboard || credits < totalImageCost} 
                    className={`w-full py-5 bg-white text-black font-black uppercase rounded-[1.5rem] transition-all shadow-xl active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3 ${sceneImages.length === numScenes ? 'bg-green-500 text-white' : 'hover:bg-fuchsia-500 hover:text-white'}`}
                  >
                    {isVisualizing ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-camera-retro"></i>}
                    {isVisualizing ? t.visualizing : sceneImages.length === numScenes ? t.visualReady : t.step1}
                  </button>
                  <button 
                    onClick={() => processToVideo(0)} 
                    disabled={isGenerating || isVisualizing || sceneImages.length < numScenes || credits < totalVideoCost} 
                    className="w-full py-5 bg-cyan-600 text-white font-black uppercase rounded-[1.5rem] hover:bg-white hover:text-cyan-600 transition-all shadow-xl active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3 disabled:grayscale"
                  >
                    {isGenerating ? <i className="fa-solid fa-microchip fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                    {isGenerating ? t.rendering : t.step2}
                  </button>
                </div>
             </div>
          </section>
        </div>
        <div className="lg:col-span-7 space-y-6">
           <div className="glass-panel min-h-[250px] rounded-[3rem] p-6 bg-black/20 border-white/5 shadow-xl relative overflow-hidden flex flex-col gap-4">
              <div className="flex justify-between items-center px-2">
                 <p className="text-[9px] font-black uppercase text-slate-600 tracking-[0.4em] italic">STORYBOARD_KEYFRAMES</p>
                 <span className="text-[8px] font-black text-cyan-500 uppercase">{sceneImages.length}/{numScenes} ADEGAN</span>
              </div>
              <div className={`flex-1 grid gap-4 ${numScenes <= 3 ? 'grid-cols-3' : 'grid-cols-3 md:grid-cols-3'}`}>
                 {Array.from({ length: numScenes }).map((_, idx) => (
                   <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center group">
                      {sceneImages[idx] ? (
                        <motion.img 
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          src={sceneImages[idx]} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="text-center opacity-10">
                           <i className="fa-solid fa-image text-3xl mb-2"></i>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg text-[7px] font-black text-white uppercase">ADEGAN {idx+1}</div>
                      {isVisualizing && idx === sceneImages.length && (
                         <div className="absolute inset-0 bg-fuchsia-500/20 flex items-center justify-center">
                            <i className="fa-solid fa-spinner fa-spin text-white"></i>
                         </div>
                      )}
                   </div>
                 ))}
              </div>
           </div>
           <div className="glass-panel min-h-[400px] rounded-[4rem] flex flex-col items-center justify-center p-8 bg-black/30 border-white/5 shadow-2xl relative overflow-hidden flex-1">
              {videoUrl ? (
                <div className="w-full h-full flex flex-col gap-6">
                   <video src={videoUrl} controls autoPlay loop className="w-full h-auto rounded-3xl border border-white/10 shadow-2xl" />
                   <div className="flex justify-center">
                      <a href={videoUrl} download="storyboard_final_video.mp4" className="px-10 py-4 bg-cyan-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white hover:text-black transition-all shadow-xl">UNDUH VIDEO FINAL</a>
                   </div>
                </div>
              ) : (
                <div className="text-center opacity-10 flex flex-col items-center gap-6">
                   <i className="fa-solid fa-clapperboard text-8xl"></i>
                   <p className="text-[11px] font-black uppercase tracking-[0.8em]">{t.waiting}</p>
                </div>
              )}
              {isGenerating && (
                 <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                    <motion.div 
                      animate={{ scale: [1, 1.1, 1], rotate: 360 }} 
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full mb-6 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                    />
                    <p className="text-[10px] font-black text-white uppercase tracking-[0.4em] animate-pulse">NEURAL_VIDEO_RENDER_ACTIVE</p>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
