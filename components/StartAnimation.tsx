
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LandingHero } from './LandingHero';

interface StartAnimationProps {
  onComplete: () => void;
}

export const StartAnimation: React.FC<StartAnimationProps> = ({ onComplete }) => {
  const [statusText, setStatusText] = useState("INITIALIZING_CORE...");
  const [progress, setProgress] = useState(0);

  const statuses = [
    "BOOTING_SATMOKO_HUB...",
    "SYNCING_NEURAL_WAVES...",
    "DECRYPTING_BIO_KEYS...",
    "ACCESS_AUTHORIZED...",
    "NODE_READY_V7.8"
  ];

  useEffect(() => {
    let sIdx = 0;
    const interval = setInterval(() => {
      if (sIdx < statuses.length) {
        setStatusText(statuses[sIdx]);
        sIdx++;
      }
    }, 800);

    const progInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progInterval);
          setTimeout(onComplete, 800);
          return 100;
        }
        return prev + 1;
      });
    }, 30);

    return () => {
      clearInterval(interval);
      clearInterval(progInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#010409] z-[999] flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.05)_0%,transparent_70%)]"></div>
      
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.2, opacity: 0, filter: "blur(40px)" }}
        className="relative flex flex-col items-center"
      >
        {/* Menggunakan Logo Hero sebagai Animasi Utama */}
        <div className="scale-75 md:scale-100 mb-8">
          <LandingHero />
        </div>

        {/* Progress Display */}
        <div className="w-64 text-center">
          <div className="flex justify-between items-end mb-3">
             <motion.p 
               key={statusText}
               initial={{ opacity: 0, y: 5 }}
               animate={{ opacity: 1, y: 0 }}
               className="text-[10px] font-black uppercase text-cyan-400 tracking-[0.4em] font-mono"
             >
               {statusText}
             </motion.p>
             <p className="text-[10px] font-black text-slate-500 font-mono">{progress}%</p>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.8)]"
            />
          </div>
        </div>
      </motion.div>
      
      <div className="absolute bottom-10 left-10 opacity-10 font-mono text-[8px] text-cyan-400 space-y-1">
        <p>SYSTEM_LOAD: STABLE</p>
        <p>ENCRYPTION: AES-256</p>
      </div>
    </div>
  );
};
