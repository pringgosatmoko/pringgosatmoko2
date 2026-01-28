
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { deductCredits, getSystemSettings, rotateApiKey } from '../lib/api';

interface LogEntry {
  id: string;
  msg: string;
  type: 'info' | 'success' | 'warning' | 'error';
  time: string;
}

interface SceneResult {
  text: string;
  videoUrl: string | null;
  audioUrl: string | null;
  isRendering: boolean;
  isAudioLoading: boolean;
}

interface VoiceCloningProps {
  onBack: () => void;
  lang: 'id' | 'en';
  userEmail: string;
  credits: number;
  refreshCredits: () => void;
}

export const VoiceCloning: React.FC<VoiceCloningProps> = ({ onBack, lang, userEmail, credits, refreshCredits }) => {
  const [refImage, setRefImage] = useState<string | null>(null);
  const [script, setScript] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [visualPrompt, setVisualPrompt] = useState('');
  const [scenes, setScenes] = useState<SceneResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<LogEntry[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [costs, setCosts] = useState({ voice: 150, video: 150 });

  useEffect(() => {
    getSystemSettings().then(s => setCosts({ voice: s.cost_voice || 150, video: s.cost_video || 150 }));
  }, []);

  const voices = [
    { name: 'Zephyr', desc: 'Wibawa' },
    { name: 'Puck', desc: 'Ceria' },
    { name: 'Kore', desc: 'Lembut' },
    { name: 'Fenrir', desc: 'Berat' }
  ];

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

  const downloadAudio = (url: string, index: number) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `suara_adegan_${index + 1}.wav`;
    a.click();
    addLog(`Suara adegan ${index + 1} diunduh.`, "success");
  };

  const decodeBase64Audio = async (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    
    const wavBlob = await new Promise<Blob>((resolve) => {
      const worker = new Worker(URL.createObjectURL(new Blob([`
        onmessage = function(e) {
          const buffer = e.data;
          const length = buffer.length * 2;
          const view = new DataView(new ArrayBuffer(44 + length));
          const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
          };
          writeString(0, 'RIFF');
          view.setUint32(4, 36 + length, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true); view.setUint16(20, 1, true);
          view.setUint16(22, 1, true); view.setUint32(24, 24000, true);
          view.setUint32(28, 48000, true); view.setUint16(32, 2, true);
          view.setUint16(34, 16, true); writeString(36, 'data');
          view.setUint32(40, length, true);
          for (let i = 0; i < buffer.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, buffer[i])) * 0x7FFF, true);
          postMessage(new Blob([view], { type: 'audio/wav' }));
        }
      `], { type: 'application/javascript' })));
      worker.onmessage = (e) => resolve(e.data);
      worker.postMessage(channelData);
    });
    return URL.createObjectURL(wavBlob);
  };

  const generateVoice = async () => {
    if (credits < costs.voice) return addLog("Kredit Habis!", "error");
    setIsProcessing(true);
    setMergedVideoUrl(null);
    setScenes([]);
    addLog(`Menyiapkan naskah...`);
    try {
      const success = await deductCredits(userEmail, costs.voice);
      if (!success) { setIsProcessing(false); return; }
      refreshCredits();
      
      const splitText = script.split(/[.!?\n]+/).filter(t => t.trim().length > 3);
      setScenes(splitText.map(t => ({ 
        text: t.trim(), 
        videoUrl: null, 
        audioUrl: null, 
        isRendering: false, 
        isAudioLoading: false 
      })));
      
      addLog(`Naskah diproses menjadi ${splitText.length} bagian.`, "success");
    } catch (e: any) { addLog(`Gagal: ${e.message}`, "error"); } finally { setIsProcessing(false); refreshCredits(); }
  };

  const generateSceneAudio = async (index: number, retryCount = 0) => {
    addLog(retryCount > 0 ? `Coba ulang audio adegan ${index + 1}... (${retryCount})` : `Sedang membuat suara adegan ${index + 1}...`);
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, isAudioLoading: true } : s));
    try {
      // Correct: Use process.env.API_KEY directly as per guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: scenes[index].text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } }
        }
      });
      const base64Output = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Output) {
        const audioUrl = await decodeBase64Audio(base64Output);
        setScenes(prev => prev.map((s, i) => i === index ? { ...s, audioUrl, isAudioLoading: false } : s));
        addLog(`Suara adegan ${index + 1} siap.`, "success");
      }
    } catch (e: any) { 
      const errorMsg = e?.message || "";
      if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 3) {
        rotateApiKey();
        const backoff = Math.pow(2, retryCount) * 1000;
        await new Promise(r => setTimeout(r, backoff));
        return generateSceneAudio(index, retryCount + 1);
      }
      setScenes(prev => prev.map((s, i) => i === index ? { ...s, isAudioLoading: false } : s));
      addLog(`Gagal membuat suara.`, "error"); 
    }
  };

  const renderScene = async (index: number, retryCount = 0) => {
    if (credits < costs.video && retryCount === 0) return addLog("Kredit Habis!", "error");
    addLog(retryCount > 0 ? `Coba ulang visual adegan ${index + 1}... (${retryCount})` : `Sedang menggambar visual adegan ${index + 1}...`);
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, isRendering: true } : s));
    try {
      if (retryCount === 0) {
        const success = await deductCredits(userEmail, costs.video);
        if (!success) {
          setScenes(prev => prev.map((s, i) => i === index ? { ...s, isRendering: false } : s));
          return;
        }
        refreshCredits();
      }

      // Correct: Use process.env.API_KEY directly as per guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const scenePrompt = `${visualPrompt}, adegan: ${scenes[index].text}, cinematic style.`;
      const modelName = refImage ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';
      
      let operation = await ai.models.generateVideos({
        model: modelName,
        prompt: scenePrompt,
        image: refImage ? { imageBytes: refImage.split(',')[1], mimeType: 'image/png' } : undefined,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio as any }
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
        const videoBlob = new Blob([blob], { type: 'video/mp4' });
        const videoUrl = URL.createObjectURL(videoBlob);
        setScenes(prev => prev.map((s, i) => i === index ? { ...s, videoUrl, isRendering: false } : s));
        addLog(`Visual selesai (-${costs.video} CR)`, "success");
      }
    } catch (e: any) {
      const errorMsg = e?.message || "";
      if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 3) {
        rotateApiKey();
        const backoff = Math.pow(2, retryCount) * 2000;
        await new Promise(r => setTimeout(r, backoff));
        return renderScene(index, retryCount + 1);
      }
      setScenes(prev => prev.map((s, i) => i === index ? { ...s, isRendering: false } : s));
      addLog(`Gagal membuat visual.`, "error");
    } finally { refreshCredits(); }
  };

  const exportFullVideo = async () => {
    const renderedScenes = scenes.filter(s => !!s.videoUrl && !!s.audioUrl);
    if (renderedScenes.length < 1) return addLog("Harap buat minimal 1 suara dan visual.", "warning");
    setIsMerging(true);
    addLog("Menggabungkan semua bagian video...");
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Gagal memuat sistem video.");
      if (aspectRatio === '16:9') { canvas.width = 1280; canvas.height = 720; }
      else { canvas.width = 720; canvas.height = 1280; }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      const videoStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);
      const recorder = new MediaRecorder(combinedStream, { 
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 5000000 
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const finalBlob = new Blob(chunks, { type: 'video/mp4' });
        setMergedVideoUrl(URL.createObjectURL(finalBlob));
        setIsMerging(false);
        addLog("Video final siap diunduh!", "success");
      };
      recorder.start();
      for (let i = 0; i < renderedScenes.length; i++) {
        const scene = renderedScenes[i];
        addLog(`Memproses bagian ke-${i + 1}...`);
        const video = document.createElement('video');
        video.src = scene.videoUrl!;
        video.muted = true;
        video.playsInline = true;
        const audio = new Audio(scene.audioUrl!);
        const audioSource = audioCtx.createMediaElementSource(audio);
        const gainNode = audioCtx.createGain();
        audioSource.connect(gainNode);
        gainNode.connect(dest);
        await video.play();
        await audio.play();
        const duration = Math.max(video.duration, audio.duration) || 5;
        const transitionTime = 0.4;
        await new Promise<void>((resolve) => {
          const drawFrame = () => {
            const currentTime = video.currentTime || audio.currentTime;
            if ((video.ended && audio.ended) || currentTime >= duration) {
              resolve();
              return;
            }
            if (currentTime > duration - transitionTime) {
              const alpha = (duration - currentTime) / transitionTime;
              ctx.globalAlpha = alpha;
              gainNode.gain.setTargetAtTime(alpha, audioCtx.currentTime, 0.05);
            } else if (currentTime < transitionTime) {
              const alpha = currentTime / transitionTime;
              ctx.globalAlpha = alpha;
              gainNode.gain.setTargetAtTime(alpha, audioCtx.currentTime, 0.05);
            } else {
              ctx.globalAlpha = 1.0;
              gainNode.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.05);
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
          };
          drawFrame();
        });
        video.pause();
        audio.pause();
        audioSource.disconnect();
      }
      recorder.stop();
      audioCtx.close();
    } catch (e: any) {
      addLog(`Gagal: ${e.message}`, "error");
      setIsMerging(false);
    }
  };

  const translations = {
    id: {
      guideTitle: "PANDUAN KLONING",
      guideContent: `Modul ini mensinkronisasi audio TTS dengan visual AI.
      1. Tulis naskah lengkap. Sistem akan membaginya berdasarkan tanda titik (.).
      2. Buat Suara per bagian dengan preset suara yang tersedia.
      3. Render Visual untuk tiap bagian (Gunakan referensi gambar untuk konsistensi).
      4. Export Video Final untuk menggabungkan semuanya menjadi satu file.`
    },
    en: {
      guideTitle: "CLONING GUIDE",
      guideContent: `This module synchronizes TTS audio with AI visuals.
      1. Tulis naskah lengkap. The system will split it based on periods (.).
      2. Create voice for each part with available voice presets.
      3. Render visuals for each part (Use image references for consistency).
      4. Export Final Video to merge everything into one file.`
    }
  };

  const t = translations[lang] || translations.id;

  const someRendered = scenes.some(s => !!s.videoUrl);

  return (
    <div className="space-y-8 pb-40 relative">
      <div className="fixed top-6 right-6 z-[500] w-72 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {processLogs.map((log) => (
            <motion.div 
              key={log.id} 
              initial={{ opacity: 0, x: 50 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 300 }}
              drag="x"
              dragConstraints={{ left: -300, right: 300 }}
              onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 40) removeLog(log.id); }}
              className={`p-4 rounded-2xl glass-panel border-l-4 shadow-2xl flex flex-col gap-1 backdrop-blur-3xl pointer-events-auto cursor-grab active:cursor-grabbing ${log.type === 'success' ? 'border-l-green-500 bg-green-500/10' : log.type === 'error' ? 'border-l-red-500 bg-red-500/20' : 'border-l-white/20 bg-white/5'}`}
            >
              <div className="flex justify-between items-center mb-1">
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
          <button onClick={() => setShowGuide(!showGuide)} className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center shadow-xl ${showGuide ? 'bg-cyan-500 text-black border-cyan-400 shadow-cyan-500/20' : 'bg-white/5 border-white/5 text-cyan-400'}`}>
            <i className={`fa-solid ${showGuide ? 'fa-xmark' : 'fa-question'} text-[10px]`}></i>
          </button>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Kloning <span className="text-cyan-400">Suara</span></h2>
        </div>
        <div className="text-right">
           <p className="text-[9px] font-black uppercase text-slate-600 tracking-widest leading-none mb-1">Saldo Anda</p>
           <p className="text-xl font-black italic text-cyan-400 leading-none">{credits.toLocaleString()} CR</p>
        </div>
      </div>

      <AnimatePresence>
        {showGuide && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-panel p-8 rounded-[2.5rem] bg-cyan-500/5 border border-cyan-500/20 mb-4 shadow-2xl">
               <p className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.4em] mb-3">{t.guideTitle}</p>
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
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Pilih Suara</label>
              <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-3 text-[11px] text-white font-black uppercase outline-none">
                {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.desc})</option>)}
              </select>
            </div>
            <textarea value={script} onChange={e => setScript(e.target.value)} placeholder="Tulis naskah bicara di sini..." className="w-full h-48 bg-black/40 border border-white/10 rounded-[2rem] p-6 text-sm text-white focus:border-cyan-500/50 outline-none resize-none leading-relaxed" />
            <button onClick={generateVoice} disabled={isProcessing || !script || credits < costs.voice} className="w-full py-5 bg-cyan-600 text-white font-black uppercase rounded-2xl shadow-xl active:scale-95 disabled:opacity-20 hover:bg-white hover:text-cyan-600 transition-all">
              {isProcessing ? "MEMPROSES..." : `BUAT RENCANA SUARA (${costs.voice} CR)`}
            </button>
          </section>

          <section className="glass-panel p-8 rounded-[3rem] bg-slate-900/40 space-y-4 shadow-2xl border-white/5">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Gaya Visual</label>
            <div className="grid grid-cols-2 gap-4">
               <div className="aspect-square rounded-[2rem] bg-black/40 border border-white/5 flex items-center justify-center relative overflow-hidden group">
                 {refImage ? (
                   <>
                     <img src={refImage} className="w-full h-full object-cover" />
                     <button onClick={() => setRefImage(null)} className="absolute top-2 right-2 w-7 h-7 bg-black/80 rounded-full text-white text-[10px] flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                   </>
                 ) : (
                   <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5">
                     <i className="fa-solid fa-image text-slate-800 text-2xl"></i>
                     <input type="file" onChange={e => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const reader = new FileReader();
                         reader.onloadend = () => setRefImage(reader.result as string);
                         reader.readAsDataURL(file);
                       }
                     }} className="hidden" accept="image/*" />
                   </label>
                 )}
               </div>
               <div className="flex flex-col gap-2">
                 <label className="text-[8px] font-black uppercase text-slate-700 px-1">Tema Visual</label>
                 <input type="text" value={visualPrompt} onChange={e => setVisualPrompt(e.target.value)} placeholder="Misal: Sinematik..." className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] text-white outline-none focus:border-cyan-500/30 transition-all" />
                 <label className="text-[8px] font-black uppercase text-slate-700 px-1 mt-2">Bentuk Video</label>
                 <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] text-white outline-none font-bold">
                    <option value="16:9">Lanskap (16:9)</option>
                    <option value="9:16">Tegak (9:16)</option>
                 </select>
               </div>
            </div>
          </section>
        </div>

        <div className="lg:col-span-7 space-y-6">
           <div className="glass-panel min-h-[600px] rounded-[4rem] flex flex-col p-8 bg-black/30 border-white/5 shadow-2xl relative flex-1">
              <AnimatePresence>
                {someRendered && (
                  <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex justify-between items-center bg-cyan-500/10 border border-cyan-500/20 p-5 rounded-[2rem] backdrop-blur-md">
                     <div>
                       <p className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">Produksi Master</p>
                       <h4 className="text-white text-[11px] font-black uppercase italic">Gabungkan Suara & Visual</h4>
                     </div>
                     <button onClick={exportFullVideo} disabled={isMerging} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase transition-all shadow-xl active:scale-95 ${isMerging ? 'bg-slate-800 text-slate-500' : 'bg-cyan-500 text-black hover:bg-white'}`}>
                        {isMerging ? 'MENGGABUNGKAN...' : 'EXPORT VIDEO FINAL'}
                     </button>
                  </motion.div>
                )}
              </AnimatePresence>
              {mergedVideoUrl && (
                <div className="mb-8 p-6 rounded-[3rem] bg-slate-900 border border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.1)] overflow-hidden">
                  <p className="text-center text-[9px] font-black text-cyan-400 uppercase tracking-widest mb-4">VIDEO SIAP DIUNDUH</p>
                  <video src={mergedVideoUrl} controls className="w-full rounded-2xl border border-white/5 shadow-2xl" />
                  <a href={mergedVideoUrl} download="video_satmoko_final.mp4" className="block w-full text-center py-4 bg-cyan-500 text-black font-black uppercase text-[10px] mt-4 rounded-xl shadow-xl hover:bg-white transition-all">UNDUH SEKARANG</a>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[650px] pr-2 custom-scrollbar">
                {scenes.map((s, idx) => (
                  <div key={idx} className="bg-black/40 border border-white/5 rounded-3xl p-4 flex flex-col gap-3 group relative overflow-hidden hover:border-cyan-500/20 transition-all">
                     <div className="aspect-video rounded-2xl bg-black relative overflow-hidden flex items-center justify-center shadow-inner">
                        {s.videoUrl ? (
                          <video src={s.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center">
                            {s.isRendering ? <i className="fa-solid fa-spinner fa-spin text-cyan-500 text-xl"></i> : <i className="fa-solid fa-clapperboard text-slate-800 text-xl"></i>}
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded-lg text-[8px] font-black text-white backdrop-blur-md">BAGIAN {idx+1}</div>
                     </div>
                     <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col gap-2 flex-1">
                        <p className="text-[10px] text-slate-400 italic line-clamp-2 px-1 font-medium">"{s.text}"</p>
                        <div className="flex items-center gap-2 mt-auto">
                           <button onClick={() => generateSceneAudio(idx)} disabled={s.isAudioLoading} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${s.audioUrl ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-white/5 text-slate-600 hover:text-white'}`}>
                              {s.isAudioLoading ? 'PROSES...' : s.audioUrl ? 'SUARA_SIAP' : 'BUAT SUARA'}
                           </button>
                           {s.audioUrl && (
                             <button onClick={() => downloadAudio(s.audioUrl!, idx)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
                               <i className="fa-solid fa-download text-[10px]"></i>
                             </button>
                           )}
                        </div>
                     </div>
                     <button onClick={() => renderScene(idx)} disabled={s.isRendering || credits < costs.video} className={`w-full py-4 rounded-xl text-[9px] font-black uppercase transition-all shadow-xl active:scale-95 ${s.videoUrl ? 'bg-green-500/20 text-green-400 border border-green-500/40' : s.isRendering ? 'bg-slate-800 text-cyan-500' : 'bg-white text-black hover:bg-cyan-500'}`}>
                       {s.videoUrl ? '✓ RENDER ULANG' : s.isRendering ? 'PROSES' : `RENDER VISUAL (${costs.video} CR)`}
                     </button>
                  </div>
                ))}
                {scenes.length === 0 && (
                  <div className="col-span-2 h-[400px] flex flex-col items-center justify-center opacity-10">
                     <i className="fa-solid fa-microchip text-6xl mb-4"></i>
                     <p className="text-[10px] font-black uppercase tracking-[0.6em]">Menunggu Naskah Master</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
