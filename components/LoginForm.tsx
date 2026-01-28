
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isAdmin, getAdminPassword, sendTelegramNotification, initMidtransPayment } from '../lib/api';

interface LoginFormProps { 
  onSuccess: (email: string, expiry?: string | null) => void;
  lang: 'id' | 'en';
  forcedMode?: 'login' | 'register';
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, lang, forcedMode }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('1B'); 
  const [error, setError] = useState('');
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState('');

  useEffect(() => {
    if (forcedMode === 'register') setIsRegister(true);
    if (forcedMode === 'login') setIsRegister(false);
  }, [forcedMode]);

  const plans = [
    { label: '1B', price: 100000, display: '100k', en: '1M', credits: 1000 },
    { label: '3B', price: 250000, display: '250k', en: '3M', credits: 3500 },
    { label: '1T', price: 900000, display: '900k', en: '1Y', credits: 15000 }
  ];

  const t = {
    id: {
      loginTitle: "MASUK KE AKUN",
      regTitle: "DAFTAR AKUN BARU",
      name: "NAMA LENGKAP",
      email: "ALAMAT EMAIL",
      pass: "KATA SANDI",
      submitLogin: "MASUK SEKARANG",
      submitReg: "DAFTAR & BAYAR",
      noAccount: "BELUM PUNYA AKUN? DAFTAR",
      haveAccount: "SUDAH PUNYA AKUN? MASUK",
      payNow: "BUKA PORTAL MIDTRANS",
      payWaiting: "Menunggu pembayaran Master melalui Midtrans Snap..."
    },
    en: {
      loginTitle: "LOGIN TO ACCOUNT",
      regTitle: "CREATE NEW ACCOUNT",
      name: "FULL NAME",
      email: "EMAIL ADDRESS",
      pass: "PASSWORD",
      submitLogin: "LOGIN NOW",
      submitReg: "REGISTER & PAY",
      noAccount: "NEED AN ACCOUNT? REGISTER",
      haveAccount: "HAVE AN ACCOUNT? LOGIN",
      payNow: "OPEN MIDTRANS PORTAL",
      payWaiting: "Waiting for your payment via Midtrans Snap..."
    }
  }[lang];

  const triggerMidtrans = (snapToken: string) => {
    if (!(window as any).snap) {
      setError("Midtrans library belum termuat. Cek koneksi internet Master.");
      return;
    }

    (window as any).snap.pay(snapToken, {
      onSuccess: function(result: any) {
        sendTelegramNotification(`✅ *PAYMENT SUCCESS*\nEmail: ${email}\nOrder: ${activeOrderId}`);
        window.location.reload();
      },
      onPending: function(result: any) {
        console.log("Waiting...");
      },
      onError: function(result: any) {
        setError("Pembayaran Gagal/Dibatalkan.");
        setIsWaitingPayment(false);
      },
      onClose: function() {
        console.log('User closed popup');
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isRegister) {
        const planData = plans.find(p => p.label === selectedPlan)!;

        const midtransRes = await initMidtransPayment(email, planData.price, selectedPlan);
        
        if (midtransRes.success && midtransRes.snapToken) {
          const { error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
          });
          if (authError) throw authError;

          await supabase.from('members').insert([{ 
            email: email.toLowerCase(), 
            status: 'pending', 
            full_name: `${fullName} (${selectedPlan})`,
            credits: planData.credits 
          }]);

          // SOLUSI ERROR TS2345: Gunakan fallback string kosong '' jika orderId undefined
          const orderId = midtransRes.orderId || "";
          setActiveOrderId(orderId);
          
          setIsWaitingPayment(true);
          sendTelegramNotification(`🆕 *PENDING REGISTER*\nNama: ${fullName}\nEmail: ${email}\nPaket: ${selectedPlan}\nID: ${orderId}`);
          
          triggerMidtrans(midtransRes.snapToken);
        } else {
          throw new Error(midtransRes.error || "Gagal menghubungi server Midtrans.");
        }

      } else {
        if (isAdmin(email) && password === getAdminPassword()) {
          onSuccess(email, null);
          return;
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;

        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('status, valid_until')
          .eq('email', email.toLowerCase())
          .single();

        if (memberError || !memberData || memberData.status !== 'active') {
          await supabase.auth.signOut();
          throw new Error(lang === 'id' ? "AKSES DITOLAK: Akun Master belum aktif atau pembayaran belum divalidasi." : "ACCESS DENIED: Account inactive or payment not validated.");
        }
        onSuccess(email, memberData.valid_until);
      }
    } catch (err: any) {
      setError(err.message || 'Error System');
    } finally {
      setIsLoading(false);
    }
  };

  if (isWaitingPayment) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full glass-panel p-10 rounded-[3rem] bg-black/60 border border-cyan-500/30 text-center space-y-8 shadow-2xl">
         <div className="w-20 h-20 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto text-3xl shadow-[0_0_40px_rgba(34,211,238,0.2)]">
            <i className="fa-solid fa-shield-halved animate-pulse"></i>
         </div>
         <div className="space-y-3">
            <h2 className="text-xl font-bold uppercase text-white tracking-tighter italic">Menunggu Pembayaran</h2>
            <p className="text-[10px] font-medium text-slate-500 uppercase px-4 leading-relaxed">{t.payWaiting}</p>
         </div>
         <div className="p-5 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">TOTAL TAGIHAN</p>
            <p className="text-2xl font-black italic text-white leading-none">Rp {plans.find(p => p.label === selectedPlan)?.price.toLocaleString()}</p>
         </div>
         <div className="space-y-4">
            <button onClick={() => window.location.reload()} className="w-full py-5 bg-white text-black font-bold uppercase text-[10px] rounded-2xl shadow-xl hover:bg-cyan-400 transition-all active:scale-95">
               TUTUP & CEK STATUS AKUN
            </button>
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Order ID: {activeOrderId}</p>
         </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full glass-panel p-8 rounded-[2rem] bg-black/60 border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="mb-6">
          <h2 className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.4em] text-center">
            {isRegister ? t.regTitle : t.loginTitle}
          </h2>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] text-center font-bold uppercase">
              {error}
            </motion.div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-3">
            {isRegister && (
              <>
                <input type="text" required placeholder={t.name} value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-5 text-white text-[11px] font-bold outline-none focus:border-cyan-500/30 transition-all" />
                
                <div className="space-y-2">
                  <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-2">Pilih Paket Langganan</label>
                  <div className="grid grid-cols-3 gap-2">
                    {plans.map(p => (
                      <button 
                        key={p.label}
                        type="button"
                        onClick={() => setSelectedPlan(p.label)}
                        className={`py-2 rounded-xl text-[9px] font-black transition-all border ${selectedPlan === p.label ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-white/5 text-slate-500 border-white/5'}`}
                      >
                        {lang === 'id' ? p.label : p.en}<br/>
                        <span className="opacity-50 font-medium">{p.display}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <input type="email" required placeholder={t.email} value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-5 text-white text-[11px] font-bold outline-none focus:border-cyan-500/30 transition-all" />
            <input type="password" required placeholder={t.pass} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-5 text-white text-[11px] font-bold outline-none focus:border-cyan-500/30 transition-all" />
            
            <button type="submit" disabled={isLoading} className="w-full py-4 mt-2 rounded-xl bg-white text-black font-black uppercase text-[10px] tracking-widest hover:bg-cyan-500 transition-all shadow-xl active:scale-95">
              {isLoading ? "MENGHUBUNGKAN MIDTRANS..." : (isRegister ? t.submitReg : t.submitLogin)}
            </button>
          </form>
        </AnimatePresence>
      </div>

      <button onClick={() => setIsRegister(!isRegister)} className="mt-8 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600 hover:text-cyan-400 transition-colors">
        {isRegister ? t.haveAccount : t.noAccount}
      </button>
    </div>
  );
};
