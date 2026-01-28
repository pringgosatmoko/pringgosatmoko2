
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Modality, VideoGenerationReferenceType } from '@google/genai';
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

// Fix: Correctly define the component as React.FC to avoid the 'void' type error.
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
    } catch (e: any) { addLog(`Gagal: ${String(e?.message || "")}`, "error"); } finally { setIsProcessing(false); refreshCredits(); }
  };

  const generateSceneAudio = async (index: number, retryCount = 0) => {
    addLog(retryCount > 0 ? `Coba ulang audio adegan ${index + 1}... (${retryCount})` : `Sedang membuat suara adegan ${index + 1}...`);
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, isAudioLoading: true } : s));
    try {
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
      const errorMsg = String(e?.message || (e ? JSON.stringify(e) : ""));
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
        const resp = await fetch(`${uri}&key=${process.env.API_KEY}`);
        const blob = await resp.blob();
        const videoBlob = new Blob([blob], { type: 'video/mp4' });
        const videoUrl = URL.createObjectURL(videoBlob);
        setScenes(prev => prev.map((s, i) => i === index ? { ...s, videoUrl, isRendering: false } : s));
        addLog(`Visual selesai (-${costs.video} CR)`, "success");
      }
    } catch (e: any) {
      const errorMsg = String(e?.message || (e ? JSON.stringify(e) : ""));
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

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefImage(reader.result as string);
        addLog("Referensi wajah dikunci.", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 pb-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl"><i className="fa-solid fa-chevron-left"></i></button>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Voice <span className="text-cyan-500">Cloning</span></h2>
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
                 <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Pilih Karakter Suara</label>
                 <div className="grid grid-cols-2 gap-2">
                    {voices.map(v => (
                       <button key={v.name} onClick={() => setSelectedVoice(v.name)} className={`py-3 rounded-xl border text-[9px] font-black uppercase transition-all ${selectedVoice === v.name ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-white/5 border-white/5 text-slate-500'}`}>
                          {v.name} <span className="opacity-50 italic">({v.desc})</span>
                       </button>
                    ))}
                 </div>
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Upload Referensi Wajah</label>
                 <div className="aspect-square w-32 rounded-2xl border-2 border-dashed border-white/5 flex items-center justify-center overflow-hidden bg-black relative">
                    {refImage ? (
                       <img src={refImage} className="w-full h-full object-cover" />
                    ) : (
                       <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-slate-700">
                          <i className="fa-solid fa-user-plus"></i>
                          <input type="file" onChange={handleImage} className="hidden" accept="image/*" />
                       </label>
                    )}
                 </div>
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Visual Style (Prompt)</label>
                 <input type="text" value={visualPrompt} onChange={e => setVisualPrompt(e.target.value)} placeholder="Misal: Studio podcast mewah, sinematik..." className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white font-bold outline-none" />
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Naskah Bicara</label>
                 <textarea value={script} onChange={e => setScript(e.target.value)} placeholder="Tulis naskah di sini..." className="w-full h-40 bg-black/40 border border-white/10 rounded-[2rem] p-6 text-sm text-white outline-none resize-none" />
              </div>
              <button onClick={generateVoice} disabled={isProcessing || !script} className="w-full py-6 bg-cyan-600 text-white font-black uppercase rounded-[2rem] hover:bg-white hover:text-black transition-all shadow-xl text-[11px] tracking-widest">
                 {isProcessing ? "MENGOLAH NASKAH..." : `MULAI PROSES CLONING (-${costs.voice} CR)`}
              </button>
           </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
           {scenes.map((s, idx) => (
              <div key={idx} className="glass-panel p-6 rounded-[2.5rem] bg-black/40 border border-white/5 flex gap-6 items-center group shadow-xl">
                 <div className="w-32 aspect-video bg-slate-800 rounded-xl overflow-hidden flex-shrink-0 relative">
                    {s.videoUrl ? <video src={s.videoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-600"><i className="fa-solid fa-film"></i></div>}
                    {s.isRendering && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><i className="fa-solid fa-spinner fa-spin text-cyan-400"></i></div>}
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white font-bold truncate mb-3">{s.text}</p>
                    <div className="flex gap-2">
                       <button onClick={() => generateSceneAudio(idx)} disabled={s.isAudioLoading || !!s.audioUrl} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${s.audioUrl ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                          {s.isAudioLoading ? "..." : s.audioUrl ? "AUDIO OK" : "GEN AUDIO"}
                       </button>
                       <button onClick={() => renderScene(idx)} disabled={s.isRendering || !!s.videoUrl || !s.audioUrl} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${s.videoUrl ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'}`}>
                          {s.isRendering ? "..." : s.videoUrl ? "VIDEO OK" : "GEN VIDEO"}
                       </button>
                    </div>
                 </div>
              </div>
           ))}
        </div>
      </div>
    </div>
  );
};
