
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';
import { rotateApiKey } from '../lib/api';

interface ChatAssistantProps {
  onBack: () => void;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const welcome = "Halo Bro! Gue SATMOKO AI CORE. Siap bantu operasional studio lo dengan cepat. Ada project apa kita hari ini?";
    setMessages([{ role: 'assistant', text: welcome }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (retryCount = 0) => {
    const userMsg = input.trim();
    if (!userMsg && retryCount === 0) return;
    if (isTyping && retryCount === 0) return;
    
    // Gunakan process.env.API_KEY secara langsung sesuai pedoman
    if (!process.env.API_KEY) {
       setMessages(prev => [...prev, { role: 'assistant', text: "Waduh Bro, API Key Master belum terdeteksi secara global. Cek Vercel Master." }]);
       return;
    }

    if (retryCount === 0) {
      setInput('');
      setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    }
    
    setIsTyping(true);

    try {
      // Correct initialization according to rule: Must use new GoogleGenAI({ apiKey: process.env.API_KEY })
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const systemInstruction = `Anda adalah "SATMOKO AI CORE" - Intelijen Utama Satmoko Studio Creative.

ATURAN IDENTITAS & PRIVASI (WAJIB):
1. Panggil pengguna dengan sebutan "Bro". Gunakan gaya bahasa kekinian, santai tapi tetap profesional dan cerdas.
2. Jika ditanya siapa pemilik/founder Satmoko Studio, JAWAB: "Pemilik Satmoko Studio adalah Bro P*S. Informasi detail dirahasiakan demi privasi."
3. DILARANG KERAS menyebutkan nama "Satmoko Hari Mukti" atau identitas asli lainnya.
4. JANGAN PERNAH membocorkan email admin, password, API Key, atau data rahasia sistem.

PENGETAHUAN SELURUH PRODUK:
- Video Generator: Pake mesin Veo 3.1 & VideoFX. Bisa Prompt-to-Video atau Image-to-Video.
- Visual Artist: Render gambar Pro (1K, 2K, 4K) dengan referensi foto.
- Voice Cloning: Kloning suara manusia (Zephyr, Puck, Kore, Fenrir) yang sinkron sama visual.
- Studio Creator: Bikin storyboard iklan/film otomatis.
- Aspect Ratio: Outpainting (perluas latar gambar tanpa potong subjek).

GAYA KOMUNIKASI:
- Jawab secara SIMPEL, SINGKAT, dan JELAS (Langsung ke poinnya).
- Jangan jelasin panjang lebar KECUALI Bro (user) minta: "jelaskan secara detail", "gimana cara kerjanya secara rinci", atau "kasih langkah-langkah detail".
- Jika ditanya hal umum di luar studio, jawab singkat dan arahkan kembali ke fitur kreatif kita.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: retryCount === 0 ? userMsg : messages[messages.length - 1].text,
        config: { 
          systemInstruction: systemInstruction,
          temperature: 0.75,
        },
      });

      const reply = response.text || "Sorry Bro, koneksi lagi agak lag. Bisa ulangi pertanyaannya?";
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (e: any) {
      console.error("Chat Error:", e);
      const errorMsg = String(e?.message || (e ? JSON.stringify(e) : ""));
      if ((errorMsg.includes('429') || errorMsg.includes('quota')) && retryCount < 2) {
        rotateApiKey(); 
        setTimeout(() => handleSend(retryCount + 1), 1000); 
      } else {
        const errorText = errorMsg.includes('API key not found') 
          ? "API Key Master hilang di tengah jalan. Cek pengaturan Vercel Master."
          : "Jalur transmisi lagi padat nih Bro. Gue coba alihkan ke node cadangan ya...";
        setMessages(prev => [...prev, { role: 'assistant', text: errorText }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const downloadHistory = () => {
    const content = messages.map(m => `[${m.role.toUpperCase()}]\n${m.text}\n\n`).join('---\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satmoko_chat_bro_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full gap-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between px-2 flex-shrink-0">
        <div className="flex items-center gap-4 lg:gap-6">
          <button onClick={onBack} className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl active:scale-95">
            <i className="fa-solid fa-chevron-left text-xs"></i>
          </button>
          <div>
            <h2 className="text-xl lg:text-4xl font-bold uppercase italic tracking-tighter leading-none">Smart <span className="text-cyan-400">Logic</span></h2>
            <p className="text-[8px] lg:text-[10px] font-bold uppercase tracking-[0.4em] text-slate-600 mt-1 lg:mt-2">SATMOKO_SECURE_VAULT_BRO_v1</p>
          </div>
        </div>
        <button onClick={downloadHistory} className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-cyan-400 flex items-center justify-center transition-all shadow-xl" title="Simpan Log Chat">
          <i className="fa-solid fa-download text-xs"></i>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 glass-panel rounded-3xl lg:rounded-[3.5rem] p-6 lg:p-10 space-y-6 lg:space-y-8 overflow-y-auto custom-scrollbar bg-slate-950/40 border-white/5 shadow-inner">
        {messages.map((m, i) => (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] lg:max-w-[75%] p-5 lg:p-8 rounded-2xl lg:rounded-[2.5rem] shadow-2xl relative ${m.role === 'user' ? 'bg-cyan-600 text-white font-bold rounded-tr-none border border-cyan-400/30' : 'bg-[#1c232d] text-slate-200 border border-white/5 rounded-tl-none'}`}>
              <p className="text-xs lg:text-base leading-relaxed whitespace-pre-wrap">{m.text}</p>
              <div className="absolute top-0 -translate-y-full mb-2 flex items-center gap-2 opacity-30 mt-[-10px]">
                 <p className="text-[7px] font-bold uppercase tracking-widest">{m.role === 'user' ? 'BRO_TRANSMISSION' : 'SATMOKO_CORE_REPLY'}</p>
              </div>
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-3 ml-6 opacity-40">
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        )}
        <div className="h-20 w-full flex-shrink-0"></div>
      </div>

      <div className="flex-shrink-0 flex gap-3 lg:gap-4 p-3 lg:p-4 bg-slate-900/60 rounded-3xl lg:rounded-[3rem] border border-white/10 shadow-2xl focus-within:border-cyan-500/50 transition-all max-w-5xl mx-auto w-full mb-4">
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleSend(0)} 
          placeholder="Tanya apa aja ke AI Core, Bro..." 
          className="flex-1 bg-transparent px-4 lg:px-8 py-2 lg:py-4 focus:outline-none text-xs lg:text-base text-white placeholder:text-slate-700 font-medium" 
        />
        <button onClick={() => handleSend(0)} disabled={isTyping || !input.trim()} className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-white text-black hover:bg-cyan-400 transition-all flex items-center justify-center disabled:opacity-20 shadow-lg active:scale-90 flex-shrink-0">
          <i className="fa-solid fa-paper-plane text-sm lg:text-lg"></i>
        </button>
      </div>
    </div>
  );
};
