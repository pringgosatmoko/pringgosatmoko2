
import React from 'react';
import { motion } from 'framer-motion';

export const RobotHero: React.FC = () => {
  return (
    <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center select-none pointer-events-none">
      {/* Glow Aura Dasar */}
      <motion.div 
        animate={{ 
          scale: [1, 1.15, 1],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-cyan-500 rounded-full blur-[80px]"
      />

      {/* HUD Orbit Layer 1 (Cepat) */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute w-full h-full border border-dashed border-cyan-400/20 rounded-full"
      />
      
      {/* HUD Orbit Layer 2 (Lambat) */}
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute w-[85%] h-[85%] border border-cyan-500/10 rounded-full border-t-cyan-500/40"
      />

      {/* Inti Robot */}
      <motion.div 
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-44 h-44 rounded-full bg-slate-900/80 backdrop-blur-3xl border border-white/10 flex items-center justify-center shadow-[0_0_60px_rgba(34,211,238,0.3)] overflow-hidden"
      >
        {/* Garis Scan Bergerak */}
        <motion.div 
          animate={{ top: ["-100%", "200%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-1 bg-cyan-400/30 blur-[2px] z-20"
        />

        {/* Icon Otak AI */}
        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            animate={{ 
              filter: ["drop-shadow(0 0 5px #22d3ee)", "drop-shadow(0 0 20px #22d3ee)", "drop-shadow(0 0 5px #22d3ee)"],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-cyan-400 text-7xl"
          >
            <i className="fa-solid fa-brain"></i>
          </motion.div>
          <div className="mt-2 flex flex-col items-center">
             <p className="text-[7px] font-black text-cyan-500 uppercase tracking-[0.4em] ml-2">CORE_ACTIVE</p>
             <div className="w-8 h-0.5 bg-cyan-500 mt-1 rounded-full shadow-[0_0_10px_#22d3ee]"></div>
          </div>
        </div>

        {/* Partikel Melayang */}
        <div className="absolute inset-0 z-0 opacity-20">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                x: [0, Math.random() * 40 - 20, 0],
                y: [0, Math.random() * 40 - 20, 0],
                opacity: [0, 1, 0]
              }}
              transition={{ duration: 2 + Math.random() * 2, repeat: Infinity }}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%` }}
            />
          ))}
        </div>
      </motion.div>

      {/* HUD Info Pinggiran */}
      <div className="absolute -bottom-8 flex flex-col items-center gap-1 opacity-40">
         <div className="flex gap-4">
            <div className="w-8 h-1 bg-cyan-500 rounded-full animate-pulse"></div>
            <div className="w-8 h-1 bg-cyan-500 rounded-full animate-pulse [animation-delay:0.5s]"></div>
         </div>
         <p className="text-[6px] font-black text-white tracking-[0.6em]">SECURE_ENCRYPTION_v7.8</p>
      </div>
    </div>
  );
};
