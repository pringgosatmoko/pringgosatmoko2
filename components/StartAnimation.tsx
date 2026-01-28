
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RobotHero } from './RobotHero';

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
    }, 25);

    return () => {
      clearInterval(interval);
      clearInterval(progInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#010409] z-[999] flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08)_0%,transparent_70%)]"></div>
      
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.3, opacity: 0, filter: "blur(50px)" }}
        transition={{ duration: 0.8 }}
        className="relative flex flex-col items-center"
      >
        {/* Menggunakan RobotHero sebagai Animasi Booting Utama */}
        <div className="scale-90 md:scale-110 mb-12">
          <RobotHero />
        </div>

        {/* Progress Display */}
        <div className="w-64 text-center">
          <div className="flex justify-between items-end mb-3 px-1">
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
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-cyan-500 shadow-[0_0_20px_rgba(34,211,238,1)]"
            />
          </div>
        </div>
      </motion.div>
      
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 opacity-20 font-mono text-[7px] text-cyan-400 tracking-[0.8em] uppercase">
        Satmoko_Neural_Interface_v7.8_Active
      </div>
    </div>
  );
};
