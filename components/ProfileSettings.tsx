
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isAdmin } from '../lib/api';

interface ProfileSettingsProps {
  onBack: () => void;
  userEmail: string;
  credits: number;
  validUntil: string | null;
  lang: 'id' | 'en';
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onBack, userEmail, credits, validUntil, lang }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  const isUserAdmin = isAdmin(userEmail);

  useEffect(() => {
    const updateCountdown = () => {
      if (isUserAdmin) {
        setCountdown(lang === 'id' ? 'AKSES UNLIMITED' : 'UNLIMITED ACCESS');
        return;
      }
      if (!validUntil) {
        setCountdown(lang === 'id' ? 'AKUN TIDAK AKTIF' : 'INACTIVE ACCOUNT');
        return;
      }

      const expiry = new Date(validUntil).getTime();
      const now = new Date().getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setCountdown(lang === 'id' ? 'MASA AKTIF HABIS' : 'MEMBERSHIP EXPIRED');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${days}D ${hours}H ${minutes}M ${seconds}S`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [validUntil, lang, isUserAdmin]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', msg: lang === 'id' ? 'Konfirmasi sandi tidak cocok!' : 'Password confirmation does not match!' });
      return;
    }
    
    if (newPassword.length < 6) {
      setStatus({ type: 'error', msg: lang === 'id' ? 'Sandi minimal 6 karakter!' : 'Password must be at least 6 characters!' });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    if (error) {
      setStatus({ type: 'error', msg: error.message });
    } else {
      setStatus({ type: 'success', msg: lang === 'id' ? 'Sandi Master Berhasil Diperbarui!' : 'Master Password Updated Successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    }
    setIsLoading(false);
    setTimeout(() => setStatus(null), 4000);
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail.toLowerCase() === userEmail.toLowerCase()) {
      setStatus({ type: 'error', msg: lang === 'id' ? 'Masukkan email baru yang berbeda!' : 'Enter a different new email!' });
      return;
    }
    
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    
    if (error) {
      setStatus({ type: 'error', msg: error.message });
    } else {
      setStatus({ type: 'success', msg: lang === 'id' ? 'Tautan konfirmasi dikirim ke email baru!' : 'Confirmation link sent to new email!' });
      setNewEmail('');
    }
    setIsLoading(false);
    setTimeout(() => setStatus(null), 4000);
  };

  const t = {
    id: {
      security: "Pengaturan Profil",
      masterPass: "Ubah Kata Sandi",
      emailSync: "Ubah Email Akses",
      update: "SIMPAN PERUBAHAN",
      processing: "MENSINKRONISASI...",
      idBadge: "EMAIL AKTIF SAAT INI",
      balance: "SALDO KREDIT",
      expiry: "STATUS MASA AKTIF",
      adminWarn: "PERINGATAN: Pastikan email baru terdaftar dalam whitelist Admin agar tidak kehilangan akses kontrol.",
      passHint: "Disarankan kombinasi huruf, angka, dan simbol.",
      emailHint: "Anda harus memverifikasi email baru sebelum login berikutnya."
    },
    en: {
      security: "Profile Settings",
      masterPass: "Change Password",
      emailSync: "Change Access Email",
      update: "SAVE CHANGES",
      processing: "SYNCING...",
      idBadge: "CURRENT ACTIVE EMAIL",
      balance: "CREDIT BALANCE",
      expiry: "ACTIVE STATUS",
      adminWarn: "WARNING: Ensure new email is whitelisted in Admin settings to maintain control access.",
      passHint: "Strong combination of characters is recommended.",
      emailHint: "You must verify the new email before your next login."
    }
  }[lang];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      {/* Header Profile Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">{t.security}</h2>
            <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em] mt-1">Satmoko Studio Account Hub</p>
          </div>
        </div>
        <div className="px-6 py-3 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md text-right">
           <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">{t.idBadge}</p>
           <p className="text-xs font-bold text-white lowercase">{userEmail}</p>
        </div>
      </div>

      {/* Credit & Expiry Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div whileHover={{ scale: 1.01 }} className="glass-panel p-8 rounded-[2.5rem] bg-slate-900/40 border-white/5 flex items-center justify-between shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><i className="fa-solid fa-bolt-lightning text-6xl"></i></div>
           <div className="space-y-2">
             <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em]">{t.balance}</p>
             <h3 className="text-4xl font-black italic text-cyan-400 leading-none">
               {credits.toLocaleString()} <span className="text-xs not-italic font-black text-slate-600 ml-1">CR</span>
             </h3>
           </div>
           <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
             <i className="fa-solid fa-wallet text-xl"></i>
           </div>
        </motion.div>

        <motion.div whileHover={{ scale: 1.01 }} className="glass-panel p-8 rounded-[2.5rem] bg-slate-900/40 border-white/5 flex items-center justify-between shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><i className="fa-solid fa-shield-halved text-6xl"></i></div>
           <div className="space-y-2">
             <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em]">{t.expiry}</p>
             <h3 className="text-2xl font-black text-white font-mono leading-none tracking-tight uppercase">
               {countdown}
             </h3>
           </div>
           <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400 border border-fuchsia-500/20">
             <i className="fa-solid fa-hourglass-start text-xl"></i>
           </div>
        </motion.div>
      </div>

      {/* Status Alert Animation */}
      <AnimatePresence mode="wait">
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className={`p-5 rounded-[2rem] border-2 text-[11px] font-black text-center uppercase tracking-widest shadow-2xl ${status.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}
          >
            <i className={`fa-solid ${status.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} mr-2`}></i>
            {status.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Settings Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Password Management Card */}
        <section className="glass-panel rounded-[3rem] bg-[#0d1117]/60 border-white/5 overflow-hidden shadow-2xl flex flex-col">
          <div className="p-8 border-b border-white/5 bg-white/5">
             <h3 className="text-xs font-black uppercase italic tracking-widest text-cyan-400 flex items-center gap-3">
               <i className="fa-solid fa-lock"></i> {t.masterPass}
             </h3>
          </div>
          <div className="p-8 space-y-6 flex-1">
            <p className="text-[10px] text-slate-500 font-bold italic leading-relaxed">{t.passHint}</p>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Sandi Baru</label>
                 <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white focus:outline-none focus:border-cyan-500/30 transition-all" />
              </div>
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Konfirmasi Sandi</label>
                 <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white focus:outline-none focus:border-cyan-500/30 transition-all" />
              </div>
              <button type="submit" disabled={isLoading || !newPassword} className="w-full py-5 bg-white text-black font-black uppercase rounded-2xl hover:bg-cyan-500 transition-all text-[10px] tracking-widest active:scale-95 disabled:opacity-20 shadow-xl mt-6">
                {isLoading ? t.processing : t.update}
              </button>
            </form>
          </div>
        </section>

        {/* Email Management Card */}
        <section className="glass-panel rounded-[3rem] bg-[#0d1117]/60 border-white/5 overflow-hidden shadow-2xl flex flex-col">
          <div className="p-8 border-b border-white/5 bg-white/5">
             <h3 className="text-xs font-black uppercase italic tracking-widest text-fuchsia-400 flex items-center gap-3">
               <i className="fa-solid fa-at"></i> {t.emailSync}
             </h3>
          </div>
          <div className="p-8 space-y-6 flex-1 flex flex-col">
            {isUserAdmin && (
              <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 mb-2">
                <p className="text-[10px] text-red-400 font-black leading-relaxed italic uppercase tracking-wider">{t.adminWarn}</p>
              </div>
            )}
            <p className="text-[10px] text-slate-500 font-bold italic leading-relaxed">{t.emailHint}</p>
            <form onSubmit={handleUpdateEmail} className="space-y-4 mt-auto">
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Alamat Email Baru</label>
                 <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="master@satmoko.studio" className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white focus:outline-none focus:border-fuchsia-500/30 transition-all" />
              </div>
              <button type="submit" disabled={isLoading || !newEmail || newEmail === userEmail} className="w-full py-5 bg-white text-black font-black uppercase rounded-2xl hover:bg-fuchsia-500 transition-all text-[10px] tracking-widest active:scale-95 disabled:opacity-20 shadow-xl mt-6">
                {isLoading ? t.processing : t.update}
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Footer Security Badge */}
      <div className="flex flex-col items-center justify-center pt-10 opacity-20">
         <div className="flex items-center gap-4 mb-3">
            <div className="h-px w-20 bg-slate-500"></div>
            <i className="fa-solid fa-fingerprint text-2xl"></i>
            <div className="h-px w-20 bg-slate-500"></div>
         </div>
         <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.6em]">Encryption Active • Node: SATMOKO_SECURE_VAULT • v7.6.1</p>
      </div>
    </div>
  );
};
