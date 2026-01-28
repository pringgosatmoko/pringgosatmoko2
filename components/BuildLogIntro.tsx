
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BuildLogIntroProps {
  onComplete: () => void;
}

export const BuildLogIntro: React.FC<BuildLogIntroProps> = ({ onComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const fullLogs = [
    "09:26:08 Running build in Washington, D.C., USA",
    "09:26:08 Build machine configuration: 2 cores, 8 GB",
    "09:26:08 Cloning github.com/pringgosatmoko/Creativestudio",
    "09:26:08 Previous build caches not available.",
    "09:26:08 Cloning completed: 171.000ms",
    "09:26:09 Running \"vercel build\"",
    "09:26:10 Vercel CLI 50.4.5",
    "09:26:10 Installing dependencies...",
    "09:26:26 npm warn deprecated node-domexception@1.0.0",
    "09:26:30 Compiling TypeScript modules...",
    "09:26:35 Optimized bundle generated (342KB)",
    "09:26:38 Initializing Satellite Nodes...",
    "09:26:40 Build Success. Deploying to Satmoko Hub...",
  ];

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < fullLogs.length) {
        setLogs(prev => [...prev, fullLogs[index]]);
        index++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsFinished(true);
          setTimeout(onComplete, 1000);
        }, 1500);
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#010409] z-[999] flex flex-col items-center justify-center p-6 font-mono">
      <AnimatePresence>
        {!isFinished && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
            className="w-full max-w-2xl"
          >
            <div className="mb-8 flex items-center justify-between">
               <div>
                  <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Deployment</h1>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Satmoko Studio Build Engine V5.4</p>
               </div>
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                  <span className="text-[9px] text-cyan-400 font-black">ACTIVE</span>
               </div>
            </div>

            <div className="glass-panel rounded-[1.5rem] bg-[#0d1117] border-white/5 overflow-hidden shadow-2xl">
              <div className="bg-white/5 p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-chevron-down text-[10px] text-slate-500"></i>
                  <span className="text-[11px] font-black text-white uppercase tracking-widest">Build Logs</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">20s</span>
                  <i className="fa-solid fa-circle-check text-green-500 text-xs"></i>
                </div>
              </div>

              <div className="p-6 space-y-2 h-[400px] overflow-y-auto no-scrollbar">
                {logs.map((log, i) => (
                  <motion.p 
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i} 
                    className={`text-[11px] leading-relaxed tracking-wider ${log.includes('Success') ? 'text-green-400 font-black' : log.includes('warn') ? 'text-yellow-500/80' : 'text-slate-400'}`}
                  >
                    {log}
                  </motion.p>
                ))}
                <motion.div 
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-2 h-4 bg-cyan-500 inline-block ml-1"
                />
              </div>
            </div>
            
            <div className="mt-8 flex gap-4 opacity-30">
               <div className="flex-1 h-px bg-white/5"></div>
               <div className="flex-1 h-px bg-white/5"></div>
               <div className="flex-1 h-px bg-white/5"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
