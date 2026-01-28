
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductSliderProps {
  lang: 'id' | 'en';
}

export const ProductSlider: React.FC<ProductSliderProps> = ({ lang }) => {
  const [index, setIndex] = useState(0);

  const slides = [
    {
      id: 0,
      title: lang === 'id' ? "APA ITU SATMOKO STUDIO?" : "WHAT IS SATMOKO STUDIO?",
      desc: lang === 'id' 
        ? "Platform AI Creative Division tercanggih untuk produksi video sinematik, kloning suara manusia, dan pembuatan iklan otomatis berbasis Neural Engine." 
        : "The most advanced AI Creative Division platform for cinematic video production, human voice cloning, and Neural Engine-based automated ad creation.",
      icon: "fa-atom"
    },
    {
      id: 1,
      title: lang === 'id' ? "KEUNGGULAN SISTEM" : "SYSTEM CAPABILITIES",
      desc: lang === 'id'
        ? "Akses mesin Veo 3.1, visual resolusi 8K, sinkronisasi audio-visual presisi tinggi, dan efisiensi waktu produksi hingga 90%."
        : "Access to Veo 3.1 engine, 8K resolution visuals, high-precision audio-visual synchronization, and up to 90% production efficiency.",
      icon: "fa-microchip"
    },
    {
      id: 2,
      title: lang === 'id' ? "HARGA BERLANGGANAN" : "SUBSCRIPTION PRICING",
      isPrice: true,
      pricing: [
        { label: lang === 'id' ? '1 BULAN' : '1 MONTH', price: 'Rp 100.000', credits: '1.000 CR' },
        { label: lang === 'id' ? '3 BULAN' : '3 MONTHS', price: 'Rp 250.000', credits: '3.500 CR' },
        { label: lang === 'id' ? '1 TAHUN' : '1 YEAR', price: 'Rp 900.000', credits: '15.000 CR' }
      ],
      icon: "fa-tags"
    }
  ];

  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x < -50 && index < slides.length - 1) {
      setIndex(index + 1);
    } else if (info.offset.x > 50 && index > 0) {
      setIndex(index - 1);
    }
  };

  return (
    <div className="w-full mb-8 relative px-2">
      <div className="flex justify-center items-center gap-1.5 mb-4">
        <i className="fa-solid fa-hand-pointer text-[8px] text-cyan-500 animate-bounce"></i>
        <p className="text-[7px] font-black uppercase text-slate-500 tracking-[0.3em]">
          {lang === 'id' ? "GESER UNTUK INFORMASI PRODUK" : "SWIPE FOR PRODUCT INFO"}
        </p>
      </div>

      <div className="relative overflow-hidden h-[180px] w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0 glass-panel p-6 rounded-[2rem] bg-black/40 border border-white/5 flex flex-col items-center text-center shadow-xl cursor-grab active:cursor-grabbing"
          >
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
               <i className={`fa-solid ${slides[index].icon} text-cyan-400 text-sm`}></i>
            </div>
            <h3 className="text-[10px] font-black uppercase text-white tracking-widest mb-2 italic">
              {slides[index].title}
            </h3>
            
            {slides[index].isPrice ? (
              <div className="grid grid-cols-3 gap-2 w-full mt-1">
                {slides[index].pricing?.map((p, i) => (
                  <div key={i} className="flex flex-col items-center p-2 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[6px] font-black text-slate-500 mb-1">{p.label}</p>
                    <p className="text-[9px] font-black text-cyan-400 leading-none">{p.price}</p>
                    <p className="text-[6px] text-slate-600 mt-1">{p.credits}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                {slides[index].desc}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {slides.map((_, i) => (
          <div
            key={i}
            onClick={() => setIndex(i)}
            className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${i === index ? 'w-6 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.6)]' : 'w-1.5 bg-slate-800'}`}
          />
        ))}
      </div>
    </div>
  );
};
