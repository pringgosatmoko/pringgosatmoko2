
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSystemSettings, updateSystemSetting } from '../lib/api';

interface PriceManagerProps {
  onBack: () => void;
  lang: 'id' | 'en';
}

export const PriceManager: React.FC<PriceManagerProps> = ({ onBack, lang }) => {
  const [prices, setPrices] = useState<Record<string, number>>({
    cost_image: 20,
    cost_video: 150,
    cost_voice: 150,
    cost_studio: 600
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    setIsLoading(true);
    const data = await getSystemSettings();
    setPrices(data);
    setIsLoading(false);
  };

  const handleUpdate = async (key: string, value: number) => {
    setIsLoading(true);
    const { error } = await updateSystemSetting(key, value);
    setIsLoading(false);
    if (!error) {
      setPrices(prev => ({ ...prev, [key]: value }));
      setStatus({ type: 'success', msg: lang === 'id' ? 'HARGA DIPERBARUI!' : 'PRICE UPDATED!' });
      setTimeout(() => setStatus(null), 2000);
    } else {
      setStatus({ type: 'error', msg: `GAGAL: ${error.message}` });
    }
  };

  const translations = {
    id: {
      title: "Atur Harga",
      subtitle: "Manajemen Biaya Kredit Fitur",
      image: "Bikin Gambar",
      video: "Bikin Video",
      voice: "Kloning Suara",
      studio: "Studio Iklan",
      save: "SIMPAN",
      token: "PER PROSES",
      feature: "NAMA FITUR",
      cost: "BIAYA (KREDIT)",
      guideTitle: "EKONOMI SISTEM",
      guideContent: `Menu ini mengatur berapa jumlah kredit yang dipotong setiap kali user menggunakan fitur AI.
      - Perubahan harga bersifat instan ke seluruh sistem.
      - Pastikan harga seimbang antara kualitas output AI dan biaya operasional Master.`
    },
    en: {
      title: "Manage Pricing",
      subtitle: "Feature Credit Cost Management",
      image: "Generate Image",
      video: "Generate Video",
      voice: "Voice Cloning",
      studio: "Ad Studio",
      save: "SAVE",
      token: "PER PROCESS",
      feature: "FEATURE NAME",
      cost: "COST (CREDIT)",
      guideTitle: "SYSTEM ECONOMY",
      guideContent: `This menu sets how many credits are deducted each time a user uses an AI feature.
      - Price changes are instantaneous across the system.
      - Ensure prices balance AI output quality and Master's operational costs.`
    }
  };
  
  const t = translations[lang] || translations.id;

  const priceItems = [
    { itemKey: 'cost_image', icon: 'fa-image', title: t.image, variant: 'cyan' },
    { itemKey: 'cost_video', icon: 'fa-video', title: t.video, variant: 'purple' },
    { itemKey: 'cost_voice', icon: 'fa-microphone-lines', title: t.voice, variant: 'cyan' },
    { itemKey: 'cost_studio', icon: 'fa-film', title: t.studio, variant: 'yellow' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6 max-w-2xl mx-auto overflow-hidden">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <button onClick={() => setShowGuide(!showGuide)} className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center shadow-xl ${showGuide ? 'bg-yellow-500 text-black border-yellow-400 shadow-yellow-500/20' : 'bg-white/5 border-white/5 text-yellow-500'}`}>
            <i className={`fa-solid ${showGuide ? 'fa-xmark' : 'fa-question'} text-[10px]`}></i>
          </button>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white leading-none">{t.title}</h2>
            <p className="text-[7px] font-black uppercase tracking-[0.4em] text-slate-600 mt-1">{t.subtitle}</p>
          </div>
        </div>
        <button onClick={fetchPrices} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all flex items-center justify-center active:scale-95">
             <i className={`fa-solid fa-rotate ${isLoading ? 'animate-spin' : ''}`}></i>
        </button>
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

      <AnimatePresence>
        {status && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`p-4 mx-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest text-center shadow-2xl ${status.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/20 border-red-500/40 text-red-400'}`}>
            {status.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 glass-panel rounded-[2.5rem] bg-[#0d1117]/60 border-white/5 overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center px-8 py-4 border-b border-white/5 bg-black/40 text-[9px] font-black uppercase tracking-widest text-slate-500">
           <div className="flex-1">{t.feature}</div>
           <div className="w-32 text-center">{t.cost}</div>
           <div className="w-20"></div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
           {priceItems.map((item) => (
             <PriceTableRow 
               key={item.itemKey} 
               icon={item.icon}
               title={item.title}
               variant={item.variant}
               value={prices[item.itemKey]} 
               onSync={(v) => handleUpdate(item.itemKey, v)} 
               lang={lang} 
               isLoading={isLoading} 
             />
           ))}
        </div>
      </div>
    </div>
  );
};

interface RowProps {
  icon: string;
  title: string;
  value: number;
  onSync: (v: number) => void;
  variant: string;
  lang: string;
  isLoading: boolean;
}

const PriceTableRow: React.FC<RowProps> = ({ icon, title, value, onSync, variant, isLoading }) => {
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);
  const accentColor = variant === 'cyan' ? 'text-cyan-400' : variant === 'purple' ? 'text-fuchsia-400' : 'text-yellow-400';
  const accentBg = variant === 'cyan' ? 'bg-cyan-500/10' : variant === 'purple' ? 'bg-fuchsia-500/10' : 'bg-yellow-500/10';
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center px-4 py-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
      <div className="flex-1 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 ${accentBg} ${accentColor} shadow-inner group-hover:scale-110 transition-transform`}>
          <i className={`fa-solid ${icon} text-sm`}></i>
        </div>
        <div className="min-w-0">
          <h4 className="text-[10px] font-black uppercase text-white truncate tracking-tight">{title}</h4>
        </div>
      </div>
      <div className="w-32 px-4">
        <input type="number" value={val} onChange={(e) => setVal(parseInt(e.target.value) || 0)} className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-center text-sm font-black italic text-cyan-400 focus:outline-none focus:border-cyan-500/50 transition-all" />
      </div>
      <div className="w-20 text-right">
        <button onClick={() => onSync(val)} disabled={isLoading} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-lg active:scale-95 disabled:opacity-30 ${variant === 'cyan' ? 'bg-cyan-500 text-black hover:bg-white' : variant === 'purple' ? 'bg-fuchsia-500 text-black hover:bg-white' : 'bg-yellow-500 text-black hover:bg-white'}`}>OK</button>
      </div>
    </motion.div>
  );
};
