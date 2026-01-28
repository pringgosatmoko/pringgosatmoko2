
import React from 'react';
import { motion } from 'framer-motion';

export const RobotHero: React.FC = () => {
  return (
    <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center select-none pointer-events-none">
      {/* Glow Aura Dasar */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-cyan-500 rounded-full blur-[80px]"
      />

      {/* HUD Orbit Layer 1 (Rotasi Cepat) */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute w-full h-full border border-dashed border-cyan-400/30 rounded-full"
      />
      
      {/* HUD Orbit Layer 2 (Rotasi Berlawanan) */}
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute w-[85%] h-[85%] border-2 border-cyan-500/10 rounded-full border-t-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
      />

      {/* Inti Robot - Ikonik Brain Core */}
      <motion.div 
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-48 h-48 rounded-full bg-slate-900/90 backdrop-blur-3xl border-2 border-white/10 flex flex-col items-center justify-center shadow-[0_0_80px_rgba(34,211,238,0.4)] overflow-hidden"
      >
        {/* Garis Scan Bergerak Vertikal */}
        <motion.div 
          animate={{ top: ["-100%", "200%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-2 bg-cyan-400/40 blur-[4px] z-20"
        />

        {/* Icon Otak AI Tengah */}
        <div className="relative z-10 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">
           <i className="fa-solid fa-brain text-6xl"></i>
        </div>

        {/* Pulse Ring di sekitar Otak */}
        <motion.div 
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute w-20 h-20 border border-cyan-400 rounded-full"
        />

        <div className="mt-4 text-[8px] font-black text-cyan-500 tracking-[0.4em] uppercase opacity-60">
           Neural_Link_v7
        </div>
      </motion.div>

      {/* Partikel Melayang */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          animate={{ 
            y: [0, -60, 0],
            x: [0, (i % 2 === 0 ? 30 : -30), 0],
            opacity: [0, 1, 0]
          }}
          transition={{ 
            duration: 3 + i, 
            repeat: Infinity,
            delay: i * 0.8
          }}
          className="absolute w-1 h-1 bg-cyan-400 rounded-full blur-[1px]"
          style={{ 
            left: `${20 + (i * 20)}%`, 
            top: `${30 + (i * 10)}%` 
          }}
        />
      ))}
    </div>
  );
};
