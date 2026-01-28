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

      {/* Inti Robot - Ikonik Brain Core */}
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

        {/* Icon Otak AI Tengah */}
        <div className="