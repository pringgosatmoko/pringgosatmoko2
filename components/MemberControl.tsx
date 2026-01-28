
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isUserOnline, approveTopup, manualUpdateCredits, updateMemberStatus, deleteMember } from '../lib/api';

interface Member {
  id: string | number;
  email: string;
  full_name?: string;
  status: 'active' | 'inactive' | 'pending';
  valid_until?: string | null;
  created_at: string;
  last_seen?: string | null;
  credits: number;
}

interface TopupRequest {
  id: number;
  tid: string;
  email: string;
  amount: number;
  price: number;
  receipt_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface MemberControlProps {
  onBack: () => void;
  lang: 'id' | 'en';
}

export const MemberControl: React.FC<MemberControlProps> = ({ onBack, lang }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'topup' | 'performance'>('members');
  const [memberFilter, setMemberFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newCreditValue, setNewCreditValue] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    refreshData();
    const timer = setInterval(refreshData, 20000);
    return () => clearInterval(timer);
  }, []);

  const refreshData = async () => {
    try {
      const { data: mems } = await supabase.from('members').select('*');
      const { data: reqs } = await supabase.from('topup_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
      
      if (mems) setMembers([...mems].sort((a, b) => new Date(b.last_seen || 0).getTime() - new Date(a.last_seen || 0).getTime()));
      if (reqs) setRequests(reqs);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveMember = async (email: string) => {
    if (!confirm(`Aktifkan akses untuk ${email}?`)) return;
    setIsProcessing(true);
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    const success = await updateMemberStatus(email, 'active', expiry.toISOString());
    if (success) refreshData();
    setIsProcessing(false);
  };

  const handleToggleStatus = async (email: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    if (!confirm(`Ubah status ${email} menjadi ${newStatus}?`)) return;
    setIsProcessing(true);
    const success = await updateMemberStatus(email, newStatus);
    if (success) refreshData();
    setIsProcessing(false);
  };

  const handleDeleteMember = async (email: string) => {
    if (!confirm(`Hapus permanen ${email}? Data tidak bisa kembali.`)) return;
    setIsProcessing(true);
    const success = await deleteMember(email);
    if (success) refreshData();
    setIsProcessing(false);
  };

  const handleApproveTopup = async (req: TopupRequest) => {
    if (!confirm(`Setujui ${req.amount} CR untuk ${req.email}?`)) return;
    setIsProcessing(true);
    const success = await approveTopup(req.id, req.email, req.amount);
    if (success) refreshData();
    setIsProcessing(false);
  };

  const handleManualCredit = async () => {
    if (!editingMember) return;
    setIsProcessing(true);
    const success = await manualUpdateCredits(editingMember.email, newCreditValue);
    if (success) {
      setEditingMember(null);
      refreshData();
    }
    setIsProcessing(false);
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (m.full_name && m.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = memberFilter === 'all' || m.status === memberFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto overflow-hidden">
      {/* MINIMALIST HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 px-2 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white leading-none">Admin <span className="text-cyan-500 font-black">Control</span></h2>
            <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-slate-600 mt-1">Satmoko Studio v7.8 Security</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
            <button onClick={() => setActiveTab('members')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'members' ? 'bg-cyan-500 text-black' : 'text-slate-600'}`}>DATA</button>
            <button onClick={() => setActiveTab('topup')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all relative ${activeTab === 'topup' ? 'bg-red-500 text-white' : 'text-slate-600'}`}>
              REQ {requests.length > 0 && <span className="ml-1 text-[8px] bg-white text-red-500 px-1 rounded-sm animate-pulse">{requests.length}</span>}
            </button>
            <button onClick={() => setActiveTab('performance')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'performance' ? 'bg-yellow-500 text-black' : 'text-slate-600'}`}>ENGINE</button>
          </div>
          <button onClick={() => { setIsLoading(true); refreshData(); }} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-500 flex items-center justify-center transition-all hover:text-cyan-500">
            <i className={`fa-solid fa-rotate ${isLoading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {activeTab === 'members' && (
        <div className="flex flex-col md:flex-row gap-3 mb-6 px-2 flex-shrink-0">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 text-xs"></i>
            <input 
              type="text" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              placeholder="Cari email atau nama member..." 
              className="w-full bg-black/30 border border-white/5 rounded-xl py-3 pl-10 pr-6 text-[11px] text-white outline-none focus:border-cyan-500/30 transition-all font-medium" 
            />
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1 overflow-x-auto no-scrollbar">
            {['all', 'active', 'pending', 'inactive'].map(f => (
              <button 
                key={f} 
                onClick={() => setMemberFilter(f as any)} 
                className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all whitespace-nowrap ${memberFilter === f ? 'bg-white/10 text-white' : 'text-slate-600'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SCROLLABLE DATA AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-24">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-20">
            <i className="fa-solid fa-database fa-spin text-3xl"></i>
            <p className="text-[10px] font-black uppercase tracking-[0.5em]">Syncing Master Data...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'members' ? (
              <motion.div key="mem" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                 {filteredMembers.map(m => (
                   <motion.div 
                     layout
                     key={m.id} 
                     className={`glass-panel p-5 rounded-3xl bg-[#0d1117] border flex flex-col gap-4 relative transition-all group ${m.status === 'pending' ? 'border-yellow-500/20' : m.status === 'inactive' ? 'border-red-500/20 opacity-60 grayscale' : 'border-white/5 hover:border-cyan-500/30'}`}
                   >
                      <div className="flex items-start justify-between">
                         <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black border text-xs ${isUserOnline(m.last_seen) ? 'border-green-500 text-green-500 bg-green-500/5' : 'border-white/5 text-slate-700 bg-black/40'}`}>
                               {m.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                               <p className="text-[11px] font-black text-white truncate uppercase tracking-tight">{m.full_name || 'MASTER_USER'}</p>
                               <p className="text-[9px] text-slate-600 truncate lowercase font-medium">{m.email}</p>
                            </div>
                         </div>
                         <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${m.status === 'active' ? 'text-green-500' : m.status === 'pending' ? 'text-yellow-500 font-black animate-pulse' : 'text-red-500'}`}>
                           {m.status}
                         </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-black/20 p-3 rounded-2xl border border-white/5">
                         <div>
                            <p className="text-[7px] font-black text-slate-700 uppercase tracking-widest mb-0.5">BALANCE</p>
                            <p className="text-xs font-black text-cyan-400 italic">{(m.credits || 0).toLocaleString()} <span className="text-[7px] not-italic opacity-40">CR</span></p>
                         </div>
                         <div className="text-right">
                            <p className="text-[7px] font-black text-slate-700 uppercase tracking-widest mb-0.5">EXPIRE</p>
                            <p className="text-[9px] font-bold text-slate-400">{m.valid_until ? new Date(m.valid_until).toLocaleDateString() : 'PERMANENT'}</p>
                         </div>
                      </div>

                      <div className="flex flex-col gap-2 mt-1">
                         <div className="flex gap-2">
                            <button onClick={() => { setEditingMember(m); setNewCreditValue(m.credits || 0); }} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-[8px] font-black uppercase text-slate-500 hover:text-white hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-1.5">
                              <i className="fa-solid fa-coins text-[7px]"></i> SALDO
                            </button>
                            {m.status === 'pending' ? (
                              <button onClick={() => handleApproveMember(m.email)} className="flex-1 py-2 rounded-xl bg-green-600 text-white text-[8px] font-black uppercase flex items-center justify-center gap-1.5 shadow-lg active:scale-95">
                                <i className="fa-solid fa-check text-[7px]"></i> APPROVE
                              </button>
                            ) : (
                              <button onClick={() => handleToggleStatus(m.email, m.status)} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${m.status === 'active' ? 'bg-yellow-600/10 text-yellow-500 border border-yellow-500/20' : 'bg-green-600/10 text-green-500 border border-green-500/20'}`}>
                                <i className={`fa-solid ${m.status === 'active' ? 'fa-ban' : 'fa-play'} text-[7px]`}></i> {m.status === 'active' ? 'SUSPEND' : 'ACTIVATE'}
                              </button>
                            )}
                         </div>
                         <button onClick={() => handleDeleteMember(m.email)} className="w-full py-2 rounded-xl bg-red-900/10 border border-red-900/20 text-[8px] font-black uppercase text-red-700 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white">
                           HAPUS PERMANEN
                         </button>
                      </div>
                   </motion.div>
                 ))}
              </motion.div>
            ) : activeTab === 'performance' ? (
              <motion.div key="perf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-panel p-6 rounded-3xl bg-slate-900/40 border-white/5 space-y-4">
                       <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">NEURAL ENGINE LOAD</p>
                       <div className="flex items-end justify-between">
                          <h4 className="text-4xl font-black italic text-white">12%</h4>
                          <span className="text-[8px] font-bold text-green-500 uppercase">Status: Optimal</span>
                       </div>
                       <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: '12%' }} className="h-full bg-cyan-500 shadow-[0_0_10px_#22d3ee]"></motion.div>
                       </div>
                    </div>
                    <div className="glass-panel p-6 rounded-3xl bg-slate-900/40 border-white/5 space-y-4">
                       <p className="text-[10px] font-black text-fuchsia-500 uppercase tracking-widest">API LATENCY</p>
                       <div className="flex items-end justify-between">
                          <h4 className="text-4xl font-black italic text-white">42ms</h4>
                          <span className="text-[8px] font-bold text-green-500 uppercase">Region: Global</span>
                       </div>
                       <div className="flex gap-1">
                          {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className={`h-2 flex-1 rounded-sm ${i < 4 ? 'bg-fuchsia-500' : 'bg-white/10'}`}></div>)}
                       </div>
                    </div>
                    <div className="glass-panel p-6 rounded-3xl bg-slate-900/40 border-white/5 space-y-4">
                       <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Uptime System</p>
                       <div className="flex items-end justify-between">
                          <h4 className="text-4xl font-black italic text-white">99.9%</h4>
                          <span className="text-[8px] font-bold text-yellow-500 uppercase">Secure Deploy</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                          <p className="text-[9px] font-black text-slate-500 uppercase">All nodes operational</p>
                       </div>
                    </div>
                 </div>
                 <div className="glass-panel p-10 rounded-[3rem] bg-black/40 border border-white/5 flex flex-col items-center text-center space-y-6">
                    <i className="fa-solid fa-microchip text-6xl text-cyan-500 opacity-20"></i>
                    <h3 className="text-xl font-black uppercase text-white tracking-tighter">Diagnostic Engine AI</h3>
                    <p className="text-xs text-slate-500 max-w-lg leading-relaxed font-medium uppercase tracking-widest">Sistem berjalan secara otomatis dengan penyeimbangan beban (Load Balancing) di seluruh cluster Satmoko Hub. Tidak diperlukan intervensi manual untuk pemulihan kegagalan.</p>
                 </div>
              </motion.div>
            ) : (
              <motion.div key="topup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {requests.map(req => (
                   <div key={req.id} className="glass-panel p-6 rounded-[2.5rem] bg-[#0d1117] border border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                         <p className="text-[8px] font-black text-cyan-500 tracking-widest uppercase">{req.tid}</p>
                         <span className="text-[8px] font-black text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">PENDING</span>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                         <p className="text-[7px] font-black text-slate-700 uppercase tracking-widest mb-1">USER & NOMINAL</p>
                         <div className="flex justify-between items-center">
                            <p className="text-[10px] font-bold text-white truncate max-w-[120px]">{req.email}</p>
                            <p className="text-sm font-black italic text-cyan-400">{req.amount.toLocaleString()} CR</p>
                         </div>
                      </div>
                      <div className="aspect-video rounded-2xl border border-white/5 bg-black/40 overflow-hidden relative group">
                         {req.receipt_url ? (
                           <img src={req.receipt_url} className="w-full h-full object-cover" />
                         ) : <div className="w-full h-full flex flex-col items-center justify-center text-slate-800 gap-2"><i className="fa-solid fa-image text-2xl"></i></div>}
                         <button onClick={() => window.open(req.receipt_url, '_blank')} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white text-[9px] font-black uppercase">Lihat Bukti</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => handleApproveTopup(req)} disabled={isProcessing} className="py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">APPROVE</button>
                         <button onClick={() => supabase.from('topup_requests').update({ status: 'rejected' }).eq('id', req.id).then(refreshData)} disabled={isProcessing} className="py-3 bg-red-600/10 text-red-500 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all">REJECT</button>
                      </div>
                   </div>
                 ))}
                 {requests.length === 0 && <div className="col-span-full h-64 flex flex-col items-center justify-center opacity-10"><i className="fa-solid fa-check-double text-5xl mb-4"></i><p className="text-[10px] font-black uppercase tracking-[0.4em]">Semua Topup Telah Diproses</p></div>}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* MINIMALIST EDIT MODAL */}
      <AnimatePresence>
        {editingMember && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-panel p-8 rounded-[3rem] bg-[#0d1117] border border-white/10 max-w-sm w-full space-y-6 shadow-2xl">
                <div className="text-center">
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Koreksi Saldo Manual</p>
                   <h3 className="text-xs font-black text-cyan-400 truncate uppercase">{editingMember.email}</h3>
                </div>
                <div className="space-y-2">
                   <input 
                     type="number" 
                     value={newCreditValue} 
                     onChange={e => setNewCreditValue(parseInt(e.target.value) || 0)} 
                     className="w-full bg-black/60 border border-white/10 rounded-2xl py-5 px-6 text-2xl font-black italic text-white text-center focus:outline-none focus:border-cyan-500/50 transition-all shadow-inner" 
                   />
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => setEditingMember(null)} className="py-4 bg-white/5 text-slate-500 rounded-2xl text-[9px] font-black uppercase hover:text-white">BATAL</button>
                   <button onClick={handleManualCredit} disabled={isProcessing} className="py-4 bg-cyan-600 text-white rounded-2xl text-[9px] font-black uppercase shadow-xl hover:shadow-cyan-900/40 active:scale-95 transition-all">SINKRONISASI</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
