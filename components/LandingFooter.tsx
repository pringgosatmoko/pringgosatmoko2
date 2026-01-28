
import React from 'react';
import { motion } from 'framer-motion';

interface LandingFooterProps {
  lang: 'id' | 'en';
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ lang }) => {
  const t = {
    id: {
      about: "TENTANG KAMI",
      desc: "Satmoko Studio adalah penyedia layanan kreatif berbasis AI terdepan di Indonesia. Kami menghadirkan solusi otomatisasi produksi video, pengolahan visual, dan sinkronisasi audio tingkat lanjut untuk profesional dan bisnis.",
      contact: "KONTAK MASTER",
      address: "LOKASI HUB",
      hq: "Studio Creative Node 01 - Indonesia",
      social: "IKUTI KAMI",
      privacy: "PRIVASI",
      terms: "KETENTUAN",
      copyright: "© 2025 Copyright by Satmoko. All Rights Reserved."
    },
    en: {
      about: "ABOUT US",
      desc: "Satmoko Studio is Indonesia's leading AI-based creative service provider. We deliver advanced video production automation, visual processing, and high-level audio synchronization solutions for professionals and businesses.",
      contact: "MASTER CONTACT",
      address: "HUB LOCATION",
      hq: "Studio Creative Node 01 - Indonesia",
      social: "FOLLOW US",
      privacy: "PRIVACY",
      terms: "TERMS",
      copyright: "© 2025 Copyright by Satmoko. All Rights Reserved."
    }
  }[lang];

  return (
    <footer className="w-full space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-4">
           <h3 className="text-[10px] font-black text-cyan-500 tracking-[0.4em] uppercase">{t.about}</h3>
           <p className="text-[11px] text-slate-400 font-bold leading-relaxed uppercase tracking-widest">{t.desc}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
             <h3 className="text-[10px] font-black text-cyan-500 tracking-[0.4em] uppercase">{t.contact}</h3>
             <div className="space-y-2">
                <a href="https://wa.me/6285147007574" target="_blank" className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white transition-colors">
                  <i className="fa-brands fa-whatsapp text-cyan-500"></i> +62 851 4700 7574
                </a>
                <a href="mailto:rlirp3fop@mozmail.com" className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white transition-colors">
                  <i className="fa-solid fa-envelope text-cyan-500"></i> rlirp3fop@mozmail.com
                </a>
             </div>
          </div>
          <div className="space-y-4">
             <h3 className="text-[10px] font-black text-cyan-500 tracking-[0.4em] uppercase">{t.address}</h3>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed italic">{t.hq}</p>
          </div>
        </div>
      </div>

      <div className="h-px bg-white/5 w-full"></div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-10">
         <div className="flex flex-col md:flex-row items-center gap-6">
            <p className="text-[9px] font-black text-cyan-500 uppercase tracking-widest">{t.copyright}</p>
            <div className="flex gap-4">
              <a href="#" className="text-[8px] font-black text-slate-700 hover:text-cyan-500 uppercase tracking-widest">{t.privacy}</a>
              <a href="#" className="text-[8px] font-black text-slate-700 hover:text-cyan-500 uppercase tracking-widest">{t.terms}</a>
            </div>
         </div>
         <div className="flex gap-4">
            <a href="#" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-600 hover:text-cyan-400 transition-all border border-white/5"><i className="fa-brands fa-instagram"></i></a>
            <a href="#" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-600 hover:text-cyan-400 transition-all border border-white/5"><i className="fa-brands fa-youtube"></i></a>
            <a href="#" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-600 hover:text-cyan-400 transition-all border border-white/5"><i className="fa-brands fa-tiktok"></i></a>
         </div>
      </div>
    </footer>
  );
};
