
import React from 'react';
import { motion } from 'framer-motion';

export const RobotHero: React.FC = () => {
  return (
    <div className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center">
      {/* Outer Rotating HUD Rings */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 border-[0.5px] border-dashed border-cyan-500/20 rounded-full"
      />
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        className="absolute inset-6 border border-cyan-400/10 rounded-full border-t-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]"
      />
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute inset-12 border border-fuchsia-500/10 rounded-full border-b-fuchsia-500/50 shadow-[0_0_20px_rgba(217,70,239,0.1)]"
      />

      {/* Central Core Container */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="w-48 h-48 rounded-full flex items-center justify-center bg-black/60 backdrop-blur-3xl border border-white/10 shadow-[0_0_100px_rgba(34,211,238,0.25)] relative overflow-hidden group"
      >
        {/* Glow Pulses */}
        <div className="absolute inset-0 bg-cyan-500/5 animate-pulse rounded-full"></div>
        
        {/* Scan Line Effect */}
        <motion.div 
          animate={{ top: ["-100%", "100%", "-100%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-1 bg-cyan-400/40 blur-[2px] z-20"
        />
        
        {/* Glowing Core Icon */}
        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            animate={{ 
              textShadow: [
                "0 0 10px rgba(34,211,238,0.5)",
                "0 0 35px rgba(34,211,238,0.9)",
                "0 0 10px rgba(34,211,238,0.5)"
              ],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center justify-center"
          >
            <i className="fa-solid fa-brain text-cyan-400 text-7xl"></i>
          </motion.div>
          <p className="text-[6px] font-black text-cyan-400/60 uppercase tracking-[0.6em] mt-3 ml-2">CORE_ENABLED</p>
        </div>

        {/* Inner Glitch Particles */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                x: [0, Math.random() * 60 - 30, 0],
                y: [0, Math.random() * 60 - 30, 0],
                opacity: [0, 0.8, 0]
              }}
              transition={{ duration: Math.random() * 3 + 2, repeat: Infinity }}
              className="absolute w-[1.5px] h-[1.5px] bg-white rounded-full"
              style={{ 
                left: `${Math.random() * 100}%`, 
                top: `${Math.random() * 100}%` 
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Decorative Bottom HUD Elements */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-6">
        <motion.div 
          animate={{ opacity: [0.1, 1, 0.1], scaleX: [1, 1.5, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-12 h-1 bg-cyan-500/40 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.6)]"
        />
        <motion.div 
          animate={{ opacity: [0.1, 1, 0.1], scaleX: [1, 1.5, 1] }}
          transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
          className="w-12 h-1 bg-fuchsia-500/40 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.6)]"
        />
      </div>
    </div>
  );
};
