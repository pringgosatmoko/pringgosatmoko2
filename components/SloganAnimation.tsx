
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const SloganAnimation: React.FC = () => {
  const slogan = "ORA NGAPAK ORA KEPENAK";
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < slogan.length) {
        setDisplayText(slogan.substring(0, i + 1));
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, 100);

    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => {
      clearInterval(typingInterval);
      clearInterval(cursorInterval);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-1"
      >
        <span className="text-[14px] font-black text-cyan-400 uppercase tracking-[0.6em] italic drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
          {displayText}
        </span>
        <span className={`w-2 h-4 bg-cyan-500 ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity`}></span>
      </motion.div>
      
      {/* Glitch Overlay Effect */}
      <motion.div 
        animate={{ 
          x: [0, -2, 2, -1, 0],
          opacity: [0.1, 0.4, 0.1, 0.5, 0.1]
        }}
        transition={{ duration: 0.2, repeat: Infinity, repeatType: "mirror" }}
        className="absolute inset-0 text-[14px] font-black text-fuchsia-500 uppercase tracking-[0.6em] italic opacity-0 pointer-events-none select-none blur-[1px]"
      >
        {displayText}
      </motion.div>
    </div>
  );
};
