
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, Modality, VideoGenerationReferenceType } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { deductCredits, sendTelegramNotification, getSystemSettings, rotateApiKey } from '../lib/api';

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

  const constructProject = async (retryCount = 0) => {
    setIsProcessing(true);
    addLog(retryCount > 0 ? `Mencoba ulang desain cerita... (${retryCount})` : `Merancang alur cerita...`);
    try {
      // Correct: Use process.env.API_KEY directly as per guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
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
      const errorMsg = e?.message || "";
      if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 3) {
        rotateApiKey();
        await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
        return constructProject(retryCount + 1);
      }
      addLog(`Gagal: ${e.message}`, "error"); 
    } finally { setIsProcessing(false); }
  };

  const generateAudio = async (index: number, retryCount = 0) => {
    addLog(`Membuat suara adegan ${index + 1}...`);
    setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, isAudioLoading: true } : s));
    try {
      // Correct: Use process.env.API_KEY directly as per guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
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
      const errorMsg = e?.message || "";
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
      
      // Correct: Use process.env.API_KEY directly as per guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
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
        // Correct: Append process.env.API_KEY for fetching the video bytes.
        const resp = await fetch(`${uri}&key=${process.env.API_KEY}`);
        const blob = await resp.blob();
        const videoUrl = URL.createObjectURL(new Blob([blob], { type: 'video/mp4' }));
        setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, videoUrl, isRendering: false } : s));
        addLog(`Adegan ${index + 1} selesai (-${costPerScene} CR)`, "success");
        isSuccess = true;
      }
    } catch (e: any) { 
      const errorMsg = e?.message || "";
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

  const t = {
    id: {
      title: "Studio Iklan",
      subtitle: "Bikin Iklan Sinematik dengan AI",
      config: "Pengaturan Produksi",
      gender: "Kelamin",
      age: "Umur",
      duration: "Durasi Total",
      style: "Gaya Visual",
      camera: "Sudut Kamera",
      type: "Tipe Proyek",
      ratio: "Bentuk Video",
      ref: "Foto Contoh (Maks 3)",
      prompt: "Ide Cerita / Deskripsi Produk",
      cost: "Estimasi Biaya",
      start: "MULAI BIKIN",
      back: "KEMBALI",
      male: "Pria",
      female: "Wanita",
      adult: "Dewasa",
      child: "Anak",
      ad: "Iklan",
      film: "Film",
      guideTitle: "PANDUAN STUDIO",
      guideContent: `Modul Studio Creator merancang video profesional secara otomatis.
      1. Masukkan konsep/ide di kolom teks.
      2. Lampirkan foto produk/karakter untuk referensi wajah & objek.
      3. Pilih target audience untuk menyesuaikan suara (TTS).
      4. Sistem akan membuat alur adegan (storyboard).
      5. Anda merender visual per adegan sesuai kebutuhan.`
    }
  }['id'];

  return (
    <div className="space-y-6 pb-40 max-w-7xl mx-auto">
      <div className="fixed top-6 right-6 z-[400] w-72 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {processLogs.map((log) => (
            <motion.div 
              key={log.id} 
              initial={{ opacity: 0, x: 50 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, scale: 0.9 }} 
              drag="x"
              dragConstraints={{ left: -100, right: 100 }}
              onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 40) removeLog(log.id); }}
              className={`p-4 rounded-2xl glass-panel border-l-4 shadow-2xl flex flex-col gap-1 backdrop-blur-3xl pointer-events-auto cursor-grab active:cursor-grabbing ${log.type === 'success' ? 'border-l-cyan-500 bg-cyan-500/10' : log.type === 'error' ? 'border-l-red-500 bg-red-500/20' : 'border-l-white/20 bg-white/5'}`}
            >
              <div className="flex justify-between items-center mb-0.5">
                <p className="text-[10px] font-bold text-white leading-tight">{log.msg}</p>
              </div>
              <span className="text-[7px] text-slate-500 uppercase font-black">{log.time}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all"><i className="fa-solid fa-chevron-left"></i></button>
          <button onClick={() => setShowGuide(!showGuide)} className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center shadow-xl ${showGuide ? 'bg-yellow-500 text-black border-yellow-400 shadow-yellow-500/20' : 'bg-white/5 border-white/5 text-yellow-500'}`}>
            <i className={`fa-solid ${showGuide ? 'fa-xmark' : 'fa-question'} text-[10px]`}></i>
          </button>
          <div>
            <h2 className="text-2xl font-black italic uppercase">{t.title} <span className="text-yellow-500">Pro</span></h2>
            <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-600">Produksi Kilat Berkualitas</p>
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
            <div className="glass-panel p-8 rounded-[2.5rem] bg-yellow-500/5 border border-yellow-500/20 mb-4 shadow-2xl">
               <p className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.4em] mb-3">{t.guideTitle}</p>
               <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed whitespace-pre-line">
                 {t.guideContent}
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {step === 'input' ? (
          <motion.div key="input" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <section className="glass-panel p-8 rounded-[3rem] bg-slate-900/40 space-y-6 shadow-2xl border-white/5">
                <p className="text-[9px] font-black uppercase text-yellow-500 tracking-[0.2em]">{t.config}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                     <label className="text-[8px] font-black uppercase text-slate-600 px-1">{t.type}</label>
                     <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        <button onClick={() => setProjectType('Iklan')} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${projectType === 'Iklan' ? 'bg-cyan-500 text-black' : 'text-slate-600'}`}>{t.ad}</button>
                        <button onClick={() => setProjectType('Film')} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${projectType === 'Film' ? 'bg-cyan-500 text-black' : 'text-slate-600'}`}>{t.film}</button>
                     </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-600 px-1">{t.ratio}</label>
                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 px-3 text-[10px] text-white font-black outline-none">
                      <option value="16:9">Lanskap (16:9)</option>
                      <option value="9:16">Tegak (9:16)</option>
                      <option value="1:1">Kotak (1:1)</option>
                      <option value="21:9">Bioskop (21:9)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                     <label className="text-[8px] font-black uppercase text-slate-600 px-1">{t.gender}</label>
                     <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        <button onClick={() => setTargetGender('Pria')} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${targetGender === 'Pria' ? 'bg-white/10 text-white' : 'text-slate-600'}`}>{t.male}</button>
                        <button onClick={() => setTargetGender('Wanita')} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${targetGender === 'Wanita' ? 'bg-white/10 text-white' : 'text-slate-600'}`}>{t.female}</button>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[8px] font-black uppercase text-slate-600 px-1">{t.age}</label>
                     <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        <button onClick={() => setTargetAge('Dewasa')} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${targetAge === 'Dewasa' ? 'bg-white/10 text-white' : 'text-slate-600'}`}>{t.adult}</button>
                        <button onClick={() => setTargetAge('Anak-anak')} className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${targetAge === 'Anak-anak' ? 'bg-white/10 text-white' : 'text-slate-600'}`}>{t.child}</button>
                     </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-slate-600 px-1">{t.camera}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {cameraAngles.map(angle => (
                      <button key={angle} onClick={() => setCameraAngle(angle)} className={`py-3 rounded-xl border text-[9px] font-black uppercase transition-all ${cameraAngle === angle ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-black/40 text-slate-600 border-white/5'}`}>
                        {angle}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-600 px-1">{t.duration}</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[8, 16, 32].map(d => (
                        <button key={d} onClick={() => setDuration(d as any)} className={`py-2 rounded-lg border text-[9px] font-black transition-all ${duration === d ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-black/40 text-slate-600 border-white/5'}`}>{d}D</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-600 px-1">{t.style}</label>
                    <select value={videoStyle} onChange={e => setVideoStyle(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-[10px] text-white font-black uppercase outline-none">
                      {stylePresets.map(s => <option key={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[8px] font-black uppercase text-slate-600 px-1">{t.ref}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {refImages.map((img, i) => (
                      <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black relative group shadow-xl">
                        <img src={img} className="w-full h-full object-cover" />
                        <button onClick={() => setRefImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                           <i className="fa-solid fa-trash text-white text-xs"></i>
                        </button>
                      </div>
                    ))}
                    {refImages.length < 3 && (
                      <label className="aspect-square rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all text-slate-700 hover:text-cyan-500">
                        <i className="fa-solid fa-plus text-lg"></i>
                        <input type="file" multiple onChange={handleRefImage} className="hidden" accept="image/*" />
                      </label>
                    )}
                  </div>
                </div>
              </section>
            </div>
            <div className="lg:col-span-7 space-y-4">
              <section className="glass-panel p-8 rounded-[3rem] bg-slate-900/40 space-y-6 shadow-2xl border-white/5 h-full flex flex-col">
                <div className="flex-1 space-y-3">
                  <label className="text-[10px] font-black uppercase text-yellow-500 tracking-[0.2em] px-1">{t.prompt}</label>
                  <textarea value={title} onChange={e => setTitle(e.target.value)} placeholder="Tuliskan cerita pendek atau jelaskan keunggulan produk Master..." className="w-full h-full min-h-[400px] bg-black/60 border border-white/10 rounded-[2.5rem] p-8 text-sm text-white focus:border-yellow-500/50 outline-none resize-none leading-relaxed shadow-inner" />
                </div>
                <div className="space-y-6">
                  <div className="p-6 rounded-[2.5rem] bg-yellow-500/5 border border-yellow-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">{t.cost} ({ESTIMATED_SCENES} Adegan)</p>
                      <p className="text-2xl font-black italic text-white leading-none">± {estimatedTotalCost} <span className="text-[10px] text-slate-500">CR</span></p>
                    </div>
                  </div>
                  <button onClick={() => constructProject(0)} disabled={isProcessing || !title || credits < estimatedTotalCost} className="w-full py-6 bg-yellow-500 text-black font-black uppercase rounded-[2.5rem] hover:bg-white transition-all shadow-2xl active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4 text-sm tracking-widest">
                    {isProcessing ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>} {t.start}
                  </button>
                </div>
              </section>
            </div>
          </motion.div>
        ) : (
          <motion.div key="story" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {storyboard.map((s, i) => (
              <div key={i} className="glass-panel p-6 rounded-[3rem] bg-black/40 border-white/5 space-y-5 shadow-2xl relative flex flex-col group hover:border-cyan-500/30 transition-all">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <span className="w-9 h-9 rounded-full bg-yellow-500 text-black flex items-center justify-center text-[11px] font-black shadow-lg">#{i+1}</span>
                       <span className="text-[10px] font-black text-white uppercase tracking-widest truncate">{s.scene}</span>
                    </div>
                    <span className="text-[8px] font-black text-slate-600 uppercase">{s.duration}D</span>
                 </div>
                 <div className="bg-black/60 p-5 rounded-[2rem] border border-white/5 flex-1">
                    <p className="text-[11px] text-white font-bold leading-relaxed italic">"{s.audio}"</p>
                    <div className="mt-4 flex gap-2">
                       <button onClick={() => generateAudio(i)} disabled={s.isAudioLoading} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${s.audioUrl ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-slate-500 hover:text-white'}`}>
                          {s.isAudioLoading ? 'PROSES...' : s.audioUrl ? 'SUARA_SIAP' : 'BUAT SUARA'}
                       </button>
                    </div>
                 </div>
                 <div className="aspect-video rounded-[2.5rem] bg-black relative overflow-hidden border border-white/5 shadow-inner">
                    {s.videoUrl ? (
                      <>
                        <video src={s.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        <a 
                          href={s.videoUrl} 
                          download={`satmoko_studio_scene_${i+1}.mp4`}
                          className="absolute bottom-4 right-4 w-10 h-10 bg-cyan-500 text-black rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all z-20"
                        >
                          <i className="fa-solid fa-download"></i>
                        </a>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center opacity-10">
                        <i className="fa-solid fa-clapperboard text-4xl"></i>
                      </div>
                    )}
                    {s.isRendering && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                        <i className="fa-solid fa-microchip fa-spin text-cyan-500 text-2xl mb-3"></i>
                        <p className="text-[9px] font-black text-cyan-500 uppercase tracking-widest animate-pulse">SEDANG_MERENDER</p>
                      </div>
                    )}
                 </div>
                 <button onClick={() => renderVideo(i)} disabled={s.isRendering || credits < costPerScene} className={`w-full py-5 rounded-[1.8rem] text-[10px] font-black uppercase transition-all shadow-xl active:scale-95 ${s.videoUrl ? 'bg-green-900/40 text-green-400 border border-green-500/30' : s.isRendering ? 'bg-slate-800 text-cyan-500 cursor-not-allowed' : 'bg-white text-black hover:bg-cyan-500'}`}>
                    {s.videoUrl ? '✓ RENDER ULANG' : s.isRendering ? 'PROSES' : `RENDER VIDEO (${costPerScene} CR)`}
                 </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
