
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { requestTopup, supabase } from '../lib/api';

interface TopupCenterProps {
  onBack: () => void;
  userEmail: string;
  credits: number;
  refreshCredits: () => void;
  lang: 'id' | 'en';
}

export const TopupCenter: React.FC<TopupCenterProps> = ({ onBack, userEmail, credits, refreshCredits, lang }) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'history'>('buy');
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [myRequests, setMyRequests] = useState<any[]>([]);

  const packages = [
    { credits: 1000, price: 100000, label: 'Standard Access' },
    { credits: 3500, price: 250000, label: 'Professional Tier' },
    { credits: 8000, price: 500000, label: 'Creative Studio' },
    { credits: 15000, price: 900000, label: 'Unlimited Master' }
  ];

  useEffect(() => {
    if (activeTab === 'history') fetchMyHistory();
  }, [activeTab]);

  const fetchMyHistory = async () => {
    const { data } = await supabase
      .from('topup_requests')
      .select('*')
      .eq('email', userEmail.toLowerCase())
      .order('created_at', { ascending: false });
    if (data) setMyRequests(data);
  };

  // FUNGSI KOMPRESI GAMBAR OTOMATIS (AGAR RINGAN DI DATABASE)
  const compressAndSetImage = (file: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600; // Ukuran cukup untuk verifikasi admin
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Kompres ke format JPEG dengan kualitas 0.7 (sangat ringan)
        const compressedB64 = canvas.toDataURL('image/jpeg', 0.7);
        setReceipt(compressedB64);
      };
    };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressAndSetImage(file);
    }
  };

  const handleSubmitRequest = async () => {
    if (selectedPackage === null || !receipt) return;
    setIsProcessing(true);
    const pkg = packages[selectedPackage];
    
    try {
      const res = await requestTopup(userEmail, pkg.credits, pkg.price, receipt);
      if (res.success) {
        setTransactionId(res.tid);
        setShowSuccess(true);
      }
    } catch (e: any) {
      alert("Gagal mengirim data. Pastikan Master sudah menjalankan kode SQL di Supabase.");
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 flex-shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-white leading-none">Topup <span className="text-cyan-400">Credit</span></h2>
            <p className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.4em] text-slate-600 mt-1">Manual Verification Security</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-black/60 p-1 rounded-2xl border border-white/5">
            <button onClick={() => setActiveTab('buy')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'buy' ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}>PAKET</button>
            <button onClick={() => setActiveTab('history')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'history' ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}>RIWAYAT</button>
          </div>
          <div className="text-right bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
             <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest leading-none mb-1">Saldo Master</p>
             <p className="text-sm font-black italic text-cyan-400 leading-none">{credits.toLocaleString()} CR</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
        <AnimatePresence mode="wait">
          {activeTab === 'buy' ? (
            !showSuccess ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {packages.map((pkg, idx) => (
                      <button key={idx} onClick={() => setSelectedPackage(idx)} className={`glass-panel p-6 rounded-[2rem] border-2 text-left transition-all ${selectedPackage === idx ? 'border-cyan-500 bg-cyan-500/5' : 'border-white/5 bg-slate-900/40'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedPackage === idx ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'bg-white/5 text-slate-600'}`}><i className="fa-solid fa-coins"></i></div>
                          <div className="text-right">
                            <p className="text-[12px] font-black text-white italic">{pkg.credits.toLocaleString()} CR</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Rp {pkg.price.toLocaleString()}</p>
                          </div>
                        </div>
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{pkg.label}</p>
                      </button>
                    ))}
                  </div>

                  {selectedPackage !== null && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-8 rounded-[2rem] bg-slate-900/40 border border-white/5 space-y-6">
                       <h3 className="text-[10px] font-black uppercase text-cyan-500 tracking-widest">Langkah 2: Upload Bukti Transfer</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                          <div className="space-y-4">
                             <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Transfer Ke:</p>
                                <p className="text-xs font-black text-white tracking-widest">BANK MANDIRI</p>
                                <p className="text-lg font-black text-cyan-400">123-000-999-888</p>
                                <p className="text-[9px] font-bold text-slate-600">A/N SATMOKO STUDIO</p>
                             </div>
                          </div>
                          <div className="relative aspect-video rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden group bg-black/20">
                            {receipt ? (
                              <img src={receipt} className="w-full h-full object-contain" />
                            ) : (
                              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                                 <i className="fa-solid fa-camera text-slate-800 text-2xl mb-2"></i>
                                 <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Klik Upload Bukti</p>
                                 <input type="file" onChange={handleFile} className="hidden" accept="image/*" />
                              </label>
                            )}
                            {receipt && <button onClick={() => setReceipt(null)} className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]"><i className="fa-solid fa-xmark"></i></button>}
                          </div>
                       </div>
                    </motion.div>
                  )}
                </div>

                <div className="lg:col-span-4">
                  <div className="glass-panel p-8 rounded-[2.5rem] bg-[#0d1117] border border-white/5 shadow-2xl space-y-6 lg:sticky lg:top-0">
                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Ringkasan Pesanan</p>
                    {selectedPackage !== null ? (
                       <div className="space-y-4">
                          <div className="flex justify-between text-[11px] font-bold">
                             <span className="text-slate-500">PAKET:</span>
                             <span className="text-white uppercase">{packages[selectedPackage].label}</span>
                          </div>
                          <div className="flex justify-between text-[11px] font-bold">
                             <span className="text-slate-500">NOMINAL:</span>
                             <span className="text-cyan-400">Rp {packages[selectedPackage].price.toLocaleString()}</span>
                          </div>
                          <div className="pt-4 border-t border-white/5 flex justify-between">
                             <span className="text-xs font-black text-white">TOTAL</span>
                             <span className="text-xl font-black italic text-cyan-400">Rp {packages[selectedPackage].price.toLocaleString()}</span>
                          </div>
                       </div>
                    ) : (
                       <div className="py-10 text-center opacity-20"><i className="fa-solid fa-cart-plus text-3xl"></i></div>
                    )}
                    <button onClick={handleSubmitRequest} disabled={selectedPackage === null || !receipt || isProcessing} className="w-full py-5 rounded-2xl bg-white text-black font-black uppercase text-[10px] tracking-widest hover:bg-cyan-500 transition-all shadow-xl active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3">
                      {isProcessing ? <><i className="fa-solid fa-spinner fa-spin"></i> MEMPROSES...</> : "KONFIRMASI PEMBAYARAN"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto py-10">
                 <div className="glass-panel p-10 rounded-[3rem] bg-[#0d1117] border border-cyan-500/30 text-center space-y-8">
                    <div className="w-20 h-20 rounded-full bg-cyan-500 text-black flex items-center justify-center mx-auto text-3xl shadow-[0_0_30px_#22d3ee]"><i className="fa-solid fa-hourglass-half"></i></div>
                    <div className="space-y-2">
                       <h3 className="text-xl font-black italic uppercase text-white tracking-tighter">PERMINTAAN TERKIRIM</h3>
                       <p className="text-[10px] font-bold text-slate-500 uppercase px-4 leading-relaxed">Mohon tunggu maksimal 15-30 menit selagi admin memvalidasi pembayaran Master.</p>
                    </div>
                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                       <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-1">ID Transaksi</p>
                       <code className="text-[11px] font-black text-cyan-500">{transactionId}</code>
                    </div>
                    <button onClick={() => { setShowSuccess(false); setActiveTab('history'); }} className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase text-[9px] tracking-widest hover:bg-white hover:text-black transition-all">LIHAT RIWAYAT</button>
                 </div>
              </motion.div>
            )
          ) : (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
               {myRequests.map((req) => (
                 <div key={req.id} className="glass-panel p-6 rounded-3xl bg-black/40 border border-white/5 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${req.status === 'approved' ? 'bg-green-500/10 text-green-500' : req.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                          <i className={`fa-solid ${req.status === 'approved' ? 'fa-check' : req.status === 'rejected' ? 'fa-xmark' : 'fa-clock'}`}></i>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">{req.amount.toLocaleString()} CR</p>
                          <p className="text-[8px] font-bold text-slate-600 uppercase mt-0.5">{req.tid}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${req.status === 'approved' ? 'bg-green-500 text-black' : req.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'}`}>
                          {req.status}
                       </span>
                       <p className="text-[7px] text-slate-700 mt-2 font-black">{new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                 </div>
               ))}
               {myRequests.length === 0 && <div className="py-20 text-center opacity-10 flex flex-col items-center gap-4"><i className="fa-solid fa-receipt text-6xl"></i><p className="text-xs font-black uppercase tracking-[0.4em]">Belum Ada Transaksi</p></div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
