
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type, Modality, VideoGenerationReferenceType } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { deductCredits, getSystemSettings, rotateApiKey } from '../lib/api';

interface StoryboardItem {
  scene: string;
  label?: string;
  visual: string;
  audio: string;
  duration: number;
  speaker: string;
  voicePreset: string;
  transition: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
  endFrame?: string | null;
  isRendering?: boolean;
  isAudioLoading?: boolean;
}

interface LogEntry {
  id: string;
  msg: string;
  type: 'info' | 'success' | 'warning' | 'error';
  time: string;
}

interface StudioCreatorProps {
  onBack: () => void;
  lang: 'id' | 'en';
  userEmail: string;
  credits: number;
  refreshCredits: () => void;
}

// Fix: Correctly define the component as React.FC to avoid the 'void' type error.
export const StudioCreator: React.FC<StudioCreatorProps> = ({ onBack, lang, userEmail, credits, refreshCredits }) => {
  const [title, setTitle] = useState('');
  const [projectType, setProjectType] = useState<'Iklan' | 'Film'>('Iklan');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '21:9'>('9:16');
  const [videoStyle, setVideoStyle] = useState('Disney Pixar');
  const [cameraAngle, setCameraAngle] = useState('Cinematic Wide');
  const [targetAge, setTargetAge] = useState<'Dewasa' | 'Anak-anak'>('Dewasa');
  const [targetGender, setTargetGender] = useState<'Pria' | 'Wanita'>('Wanita');
  const [refImages, setRefImages] = useState<string[]>([]);
  const [duration, setDuration] = useState<8 | 16 | 32>(16);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'input' | 'story'>('input');
  const [storyboard, setStoryboard] = useState<StoryboardItem[]>([]);
  const [charBio, setCharBio] = useState(''); 
  const [processLogs, setProcessLogs] = useState<LogEntry[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [costPerScene, setCostPerScene] = useState(150);

  useEffect(() => {
    getSystemSettings().then(s => setCostPerScene(Math.floor((s.cost_studio || 600) / 4)));
  }, []);

  const ESTIMATED_SCENES = duration === 8 ? 2 : duration === 16 ? 4 : 6;
  const estimatedTotalCost = ESTIMATED_SCENES * costPerScene;

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

  const stylePresets = [
    { name: 'Disney Pixar', prompt: 'Disney Pixar 3D animation style, cinematic lighting, vibrant' },
    { name: 'Realistic', prompt: 'Cinematic photorealism, high detail, 8k, natural movement' },
    { name: 'Anime', prompt: 'Modern high-quality anime, vibrant colors, clean lines' },
    { name: 'Cyberpunk', prompt: 'Neon cyberpunk aesthetic, moody lighting, rainy streets' },
    { name: 'Noir', prompt: 'Classic Black and White Noir, high contrast, dramatic shadows' }
  ];

  const cameraAngles = [
    'Cinematic Wide', 'Low Angle (Hero)', 'Close-up Detail', 'Bird\'s Eye View', 'Tracking Shot', 'Handheld'
  ];

  const getVoicePreset = () => {
    if (targetAge === 'Anak-anak') return 'Puck';
    return targetGender === 'Pria' ? 'Zephyr' : 'Kore';
  };

  const handleRefImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setRefImages(prev => [...prev, reader.result as string].slice(0, 3));
          addLog("Gambar referensi ditambahkan.", "success");
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Correct: Use process.env.API_KEY directly and access .text property from GenerateContentResponse
  const constructProject = async (retryCount = 0) => {
    setIsProcessing(true);
    addLog(retryCount > 0 ? `Mencoba ulang desain cerita... (${retryCount})` : `Merancang alur cerita...`);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const imageParts = refImages.map(img => ({
        inlineData: { data: img.split(',')[1], mimeType: img.match(/data:([^;]+);/)?.[1] || 'image/png' }
      }));
      
      const analysisResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ parts: [{ text: `Analisis detail subjek dalam gambar untuk video. Subjek adalah ${targetAge} ${targetGender}.` }, ...imageParts] }]
      });
      
      const masterBio = analysisResponse.text || '';
      setCharBio(masterBio);
      
      const selectedStyle = stylePresets.find(s => s.name === videoStyle);
      const voicePreset = getVoicePreset();

      let systemPrompt = `Role: Direktur Kreatif. Proyek: "${title}".
      TIPE: ${projectType}. Target: ${targetAge} ${targetGender}.
      KAMERA: ${cameraAngle}. TOTAL DURASI: ${duration} detik. JUMLAH ADEGAN: ${ESTIMATED_SCENES}.
      STYLE: ${selectedStyle?.prompt}. VOICE_ENGINE: ${voicePreset}.
      Buat JSON ARRAY berisi ${ESTIMATED_SCENES} adegan. 
      Wajib ada: scene (judul), visual (prompt video detail), audio (naskah bicara), duration (angka), speaker (${targetGender}), voicePreset (${voicePreset}), transition (efek).`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', 
        contents: systemPrompt,
        config: { 
          responseMimeType: "application/json", 
          responseSchema: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: { 
                scene: { type: Type.STRING }, 
                visual: { type: Type.STRING }, 
                audio: { type: Type.STRING }, 
                duration: { type: Type.NUMBER },
                speaker: { type: Type.STRING }, 
                voicePreset: { type: Type.STRING },
                transition: { type: Type.STRING } 
              }
            } 
          } 
        }
      });
      
      const data = JSON.parse(response.text || '[]');
      setStoryboard(data.map((item: any) => ({ 
        ...item, 
        videoUrl: null, 
        audioUrl: null, 
        isRendering: false, 
        isAudioLoading: false
      })));
      setStep('story');
      addLog("Alur cerita siap!", "success");
    } catch (e: any) { 
      const errorMsg = String(e?.message || (e ? JSON.stringify(e) : ""));
      if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 3) {
        rotateApiKey();
        await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
        return constructProject(retryCount + 1);
      }
      addLog(`Gagal: ${errorMsg}`, "error"); 
    } finally { setIsProcessing(false); }
  };

  const generateAudio = async (index: number, retryCount = 0) => {
    addLog(`Membuat suara adegan ${index + 1}...`);
    setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, isAudioLoading: true } : s));
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts", 
        contents: [{ parts: [{ text: storyboard[index].audio }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: storyboard[index].voicePreset } } }
        }
      });
      const base64Audio = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
         // Manual audio decoding as per guidelines
         const binaryString = atob(base64Audio);
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
        const audioUrl = URL.createObjectURL(wavBlob);
        setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, audioUrl, isAudioLoading: false } : s));
        addLog(`Suara adegan ${index + 1} selesai.`, "success");
      }
    } catch (e: any) { 
      const errorMsg = String(e?.message || (e ? JSON.stringify(e) : ""));
      if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 3) {
        rotateApiKey();
        await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 500));
        return generateAudio(index, retryCount + 1);
      }
      addLog("Gagal membuat suara.", "error"); 
      setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, isAudioLoading: false } : s));
    }
  };

  const renderVideo = async (index: number, retryCount = 0) => {
    if (credits < costPerScene && retryCount === 0) return addLog("Kredit Habis!", "error");
    addLog(`Sedang merender visual adegan ${index + 1}...`);
    setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, isRendering: true } : s));
    
    let isSuccess = false;
    try {
      if (retryCount === 0) {
        const success = await deductCredits(userEmail, costPerScene);
        if (!success) {
          setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, isRendering: false } : s));
          return;
        }
        refreshCredits();
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const selectedStyle = stylePresets.find(s => s.name === videoStyle);
      let actualRatio = aspectRatio === '21:9' ? '16:9' : aspectRatio;
      const finalPrompt = `${storyboard[index].visual}. Gaya: ${selectedStyle?.prompt}. Subjek: ${charBio}. Cinematic lighting, 8k.`;
      
      const referenceImagesPayload = refImages.map(img => ({
        image: {
          imageBytes: img.split(',')[1],
          mimeType: img.match(/data:([^;]+);/)?.[1] || 'image/png',
        },
        referenceType: VideoGenerationReferenceType.ASSET,
      }));

      const modelName = refImages.length > 1 ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';

      let operation = await ai.models.generateVideos({
        model: modelName, 
        prompt: finalPrompt,
        config: { 
          numberOfVideos: 1, 
          resolution: '720p', 
          aspectRatio: actualRatio as any,
          referenceImages: refImages.length > 1 ? referenceImagesPayload : undefined
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
        setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, videoUrl, isRendering: false } : s));
        addLog(`Adegan ${index + 1} selesai (-${costPerScene} CR)`, "success");
        isSuccess = true;
      }
    } catch (e: any) { 
      const errorMsg = String(e?.message || (e ? JSON.stringify(e) : ""));
      if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 3) {
        rotateApiKey();
        await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
        return renderVideo(index, retryCount + 1);
      }
      setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, isRendering: false } : s));
      addLog("Gagal merender video.", "error"); 
    } finally { 
      if (isSuccess || retryCount >= 2) {
        setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, isRendering: false } : s));
      }
      refreshCredits(); 
    }
  };

  return (
    <div className="space-y-6 pb-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl">
            <i className="fa-solid fa-chevron-left text-xs"></i>
          </button>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Studio <span className="text-yellow-500">Creator</span></h2>
        </div>
        <div className="text-right">
           <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest leading-none mb-1">Saldo Master</p>
           <p className="text-xl font-black italic text-cyan-400 leading-none">{credits.toLocaleString()} CR</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'input' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
               <div className="glass-panel p-8 rounded-[3rem] bg-slate-900/40 space-y-6 border-white/5 shadow-2xl">
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Detail Produksi</label>
                     <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Judul Iklan/Film..." className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white font-bold outline-none" />
                     <div className="grid grid-cols-2 gap-4">
                        <select value={projectType} onChange={e => setProjectType(e.target.value as any)} className="bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white font-black uppercase outline-none">
                           <option>Iklan</option><option>Film</option>
                        </select>
                        <select value={videoStyle} onChange={e => setVideoStyle(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white font-black uppercase outline-none">
                           {stylePresets.map(s => <option key={s.name}>{s.name}</option>)}
                        </select>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Karakter & Target</label>
                     <div className="grid grid-cols-2 gap-4">
                        <select value={targetAge} onChange={e => setTargetAge(e.target.value as any)} className="bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white font-black uppercase outline-none">
                           <option>Dewasa</option><option>Anak-anak</option>
                        </select>
                        <select value={targetGender} onChange={e => setTargetGender(e.target.value as any)} className="bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white font-black uppercase outline-none">
                           <option>Wanita</option><option>Pria</option>
                        </select>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">Referensi Visual (Wajib 1-3)</label>
                     <div className="grid grid-cols-3 gap-3">
                        {refImages.map((img, i) => (
                           <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black relative group shadow-xl">
                              <img src={img} className="w-full h-full object-cover" />
                              <button onClick={() => setRefImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"><i className="fa-solid fa-trash text-white"></i></button>
                           </div>
                        ))}
                        {refImages.length < 3 && (
                           <label className="aspect-square rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all text-slate-700">
                              <i className="fa-solid fa-plus text-lg"></i>
                              <input type="file" multiple onChange={handleRefImage} className="hidden" accept="image/*" />
                           </label>
                        )}
                     </div>
                  </div>
                  <button onClick={() => constructProject(0)} disabled={isProcessing || !title || refImages.length === 0} className="w-full py-6 bg-yellow-500 text-black font-black uppercase rounded-[2rem] hover:bg-white transition-all shadow-xl active:scale-95 disabled:opacity-20 text-[11px] tracking-widest">
                     {isProcessing ? "MENGKONSTRUKSI CERITA..." : `BANGUN STORYBOARD (-${estimatedTotalCost} CR)`}
                  </button>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {storyboard.map((item, idx) => (
                   <div key={idx} className="glass-panel rounded-[2.5rem] bg-slate-900/40 border-white/5 overflow-hidden flex flex-col shadow-2xl">
                      <div className="aspect-video bg-black/60 relative overflow-hidden">
                         {item.videoUrl ? (
                            <video src={item.videoUrl} className="w-full h-full object-cover" controls />
                         ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 gap-4">
                               <i className="fa-solid fa-film text-4xl"></i>
                               <p className="text-[9px] font-black uppercase tracking-widest">Adegan {idx + 1}</p>
                            </div>
                         )}
                         {item.isRendering && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                               <i className="fa-solid fa-spinner fa-spin text-cyan-400 text-2xl mb-4"></i>
                               <p className="text-[8px] font-black text-white uppercase tracking-[0.4em] animate-pulse">RENDERING...</p>
                            </div>
                         )}
                      </div>
                      <div className="p-6 space-y-4 flex-1">
                         <div>
                            <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1">{item.scene}</p>
                            <p className="text-[9px] text-slate-400 leading-relaxed line-clamp-2">{item.visual}</p>
                         </div>
                         <div className="flex gap-2">
                            <button onClick={() => generateAudio(idx)} disabled={item.isAudioLoading || !!item.audioUrl} className={`flex-1 py-3 rounded-xl border text-[8px] font-black uppercase transition-all ${item.audioUrl ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                               {item.isAudioLoading ? "LOAD..." : item.audioUrl ? "VOICE OK" : "GEN AUDIO"}
                            </button>
                            <button onClick={() => renderVideo(idx)} disabled={item.isRendering || !!item.videoUrl || !item.audioUrl} className={`flex-1 py-3 rounded-xl border text-[8px] font-black uppercase transition-all ${item.videoUrl ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-yellow-500 text-black border-yellow-400 hover:bg-white'}`}>
                               {item.isRendering ? "RENDER..." : item.videoUrl ? "VIDEO OK" : "GEN VIDEO"}
                            </button>
                         </div>
                         {item.audioUrl && <audio src={item.audioUrl} controls className="w-full h-8 opacity-40 hover:opacity-100 transition-opacity" />}
                      </div>
                   </div>
                ))}
             </div>
             <button onClick={() => setStep('input')} className="px-8 py-4 rounded-2xl bg-white/5 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">BUAT PROYEK BARU</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
