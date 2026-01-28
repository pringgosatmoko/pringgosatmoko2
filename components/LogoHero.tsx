
import React from 'react';
import { motion } from 'framer-motion';

interface LogoHeroProps {
  isLoaded: boolean;
}

export const LogoHero: React.FC<LogoHeroProps> = ({ isLoaded }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={isLoaded ? { opacity: 1 } : {}}
      transition={{ duration: 1 }}
      className="flex flex-col items-center select-none w-full"
    >
      <div className="text-center relative">
        <motion.h1 
          initial={{ letterSpacing: "1em", opacity: 0 }}
          animate={{ letterSpacing: "0.2em", opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-2xl lg:text-3xl font-black text-white uppercase italic leading-none"
        >
          SATMOKO STUDIO <span className="text-cyan-400">CREATIVE</span>
        </motion.h1>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: "40%" }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="h-px bg-cyan-500/40 mx-auto mt-3"
        />
      </div>
    </motion.div>
  );
};
