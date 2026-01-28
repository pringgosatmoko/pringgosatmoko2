
import React from 'react';
import { motion } from 'framer-motion';

export const LandingHero: React.FC = () => {
  return (
    <div className="relative w-full max-w-[280px] md:max-w-[380px] aspect-square flex items-center justify-center mt-4 mb-2 overflow-visible select-none">
      
      {/* Dynamic Background Glows */}
      <div className="absolute inset-0 bg-cyan-500/10 blur-[100px] rounded-full animate-pulse"></div>
      <div className="absolute inset-0 bg-fuchsia-500/5 blur-[120px] rounded-full [animation-delay:2s] animate-pulse"></div>

      {/* Rotating HUD Rings - Layered */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute w-[95%] h-[95%] rounded-full border-[0.5px] border-cyan-400/20 border-dashed"
      />
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute w-[85%] h-[85%] rounded-full border-[1px] border-transparent border-t-fuchsia-500/30 border-b-cyan-400/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]"
      />
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute w-[75%] h-[75%] rounded-full border-[0.5px] border-white/5"
      />

      {/* Central Cybernetic Logo Core */}
      <motion.div 
        animate={{ 
          y: [0, -12, 0],
          rotateY: [-8, 8, -8],
          rotateX: [4, -4, 4]
        }}
        transition={{ 
          duration: 10, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="relative w-[70%] h-[70%] flex items-center justify-center perspective-[2000px]"
      >
        <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
          <defs>
            <linearGradient id="cyber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: '#94a3b8', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#22d3ee', stopOpacity: 1 }} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* S Path - Neural Infrastructure */}
          <g transform="translate(40, 50)">
             <motion.path 
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
                d="M160 60 C80 60, 60 120, 100 160 S160 220, 100 260 S20 200, 20 200" 
                fill="none" 
                stroke="url(#cyber-grad)" 
                strokeWidth="24" 
                strokeLinecap="round"
                filter="url(#glow)"
             />
             <circle cx="160" cy="60" r="6" fill="#22d3ee" className="animate-pulse" />
             <circle cx="20" cy="200" r="6" fill="#f472b6" />
             <path d="M160 60 L190 30" stroke="#22d3ee" strokeWidth="1" opacity="0.4" strokeDasharray="4 2" />
          </g>

          {/* A Path - Optics / Camera Geometry */}
          <g transform="translate(180, 80)">
             <motion.path 
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
                d="M20 220 L90 40 L160 220" 
                fill="none" 
                stroke="url(#cyber-grad)" 
                strokeWidth="24" 
                strokeLinecap="round"
                filter="url(#glow)"
             />
             <line x1="55" x2="125" y1="160" y2="160" stroke="#22d3ee" strokeWidth="4" opacity="0.5" strokeDasharray="10 5" />
             
             {/* Master Lens Core */}
             <g transform="translate(90, 150)">
                <circle r="42" fill="#020617" stroke="#ffffff10" strokeWidth="2" />
                <circle r="32" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.3" />
                <motion.g animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
                   {[0, 60, 120, 180, 240, 300].map((rot) => (
                      <line 
                        key={rot}
                        x1="0" y1="-32" x2="0" y2="-12" 
                        stroke="#22d3ee" 
                        strokeWidth="1.5" 
                        transform={`rotate(${rot})`} 
                        opacity="0.6"
                      />
                   ))}
                </motion.g>
                <circle r="8" fill="#22d3ee">
                   <animate attributeName="opacity" values="0.2;1;0.2" dur="3s" repeatCount="indefinite" />
                </circle>
             </g>
          </g>
        </svg>

        {/* Cinematic Scanline Overlay */}
        <motion.div 
          animate={{ y: [-100, 300] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/5 to-transparent h-10 w-full pointer-events-none"
        />
      </motion.div>

      {/* Floating Particle Orbs */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          animate={{ 
            y: [0, -40, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.1, 0.4, 0.1]
          }}
          transition={{ 
            duration: 4 + Math.random() * 4, 
            repeat: Infinity,
            delay: i * 0.5
          }}
          className="absolute w-1 h-1 bg-cyan-400 rounded-full"
          style={{ 
            left: `${15 + i * 15}%`, 
            top: `${20 + (i % 3) * 20}%` 
          }}
        />
      ))}
      
      {/* HUD Info Badges */}
      <div className="absolute top-0 left-0 text-[6px] font-bold text-slate-700 tracking-[0.3em] uppercase">
        System_Identity: Satmoko_v7.8
      </div>
      <div className="absolute bottom-0 right-0 text-[6px] font-bold text-slate-700 tracking-[0.3em] uppercase">
        Neural_Link: Established
      </div>
    </div>
  );
};
