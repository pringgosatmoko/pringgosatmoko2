
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, updateMemberStatus, deleteMember, manualUpdateCredits } from '../lib/api';

/**
 * MemberControl Component
 * Administrative interface for managing user accounts, credits, and status.
 */
interface MemberControlProps {
  onBack: () => void;
  lang: 'id' | 'en';
}

export const MemberControl: React.FC<MemberControlProps> = ({ onBack, lang }) => {
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [editingMember, setEditingMember] = useState<any>(null);
  const [newCreditValue, setNewCreditValue] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initial data fetch
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('members').select('*').order('created_at', { ascending: false });
    setMembers(data || []);
    setIsLoading(false);
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

  const handleUpdateStatus = async (email: string, status: string) => {
    setIsProcessing(true);
    const success = await updateMemberStatus(email, status);
    if (success) refreshData();
    setIsProcessing(false);
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Hapus member ${email}?`)) return;
    setIsProcessing(true);
    const success = await deleteMember(email);
    if (success) refreshData();
    setIsProcessing(false);
  };

  const filteredMembers = (members || []).filter(m => {
    const email = String(m?.email || "").toLowerCase();
    const name = String(m?.full_name || "").toLowerCase();
    const search = String(searchTerm || "").toLowerCase();
    
    const matchesSearch = email.includes(search) || name.includes(search);
    const matchesFilter = memberFilter === 'all' || m.status === memberFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto overflow-hidden">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95">
            <i className="fa-solid fa-chevron-left text-xs"></i>
          </button>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Member <span className="text-cyan-500">Control</span></h2>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mt-1">Studio Access Management</p>
          </div>
        </div>
        <button onClick={refreshData} className="w-12 h-12 rounded-2xl bg-white/5 text-slate-400 hover:text-cyan-400 border border-white/10 flex items-center justify-center transition-all">
          <i className={`fa-solid fa-rotate ${isLoading ? 'animate-spin' : ''}`}></i>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <input 
          type="text" 
          placeholder="Cari email atau nama..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 text-xs text-white outline-none focus:border-cyan-500/30 transition-all"
        />
        <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-white/5">
          {(['all', 'active', 'pending'] as const).map(f => (
            <button 
              key={f} 
              onClick={() => setMemberFilter(f)} 
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${memberFilter === f ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar glass-panel rounded-[3rem] bg-slate-950/40 border border-white/5 shadow-inner">
        <table className="w-full text-left border-separate border-spacing-y-2 px-4">
          <thead className="sticky top-0 bg-slate-950/90 z-10">
            <tr className="text-[9px] font-black uppercase text-slate-600 tracking-widest">
              <th className="px-6 py-4">Identity</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Credits</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map(m => (
              <tr key={m.email} className="bg-white/5 hover:bg-white/10 transition-all">
                <td className="px-6 py-5 rounded-l-3xl">
                  <p className="text-xs font-bold text-white uppercase">{m.full_name || 'Guest'}</p>
                  <p className="text-[9px] text-slate-500 font-medium lowercase">{m.email}</p>
                </td>
                <td className="px-6 py-5">
                  <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${m.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-6 py-5 font-black text-cyan-400 text-xs">
                  {m.credits?.toLocaleString()} CR
                </td>
                <td className="px-6 py-5 rounded-r-3xl text-right flex items-center justify-end gap-2">
                  <button onClick={() => { setEditingMember(m); setNewCreditValue(m.credits || 0); }} className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center hover:bg-cyan-500 hover:text-black transition-all">
                    <i className="fa-solid fa-wallet text-[10px]"></i>
                  </button>
                  <button onClick={() => handleUpdateStatus(m.email, m.status === 'active' ? 'pending' : 'active')} className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all">
                    <i className={`fa-solid ${m.status === 'active' ? 'fa-user-slash' : 'fa-user-check'} text-[10px]`}></i>
                  </button>
                  <button onClick={() => handleDelete(m.email)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                    <i className="fa-solid fa-trash text-[10px]"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {editingMember && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel p-10 rounded-[3rem] bg-slate-900 border border-cyan-500/30 max-w-sm w-full space-y-6 shadow-2xl">
              <h3 className="text-sm font-black text-white uppercase italic">Manual Credit Adjustment</h3>
              <p className="text-[10px] text-slate-500 uppercase font-bold">{editingMember.email}</p>
              <input 
                type="number" 
                value={newCreditValue}
                onChange={e => setNewCreditValue(parseInt(e.target.value) || 0)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xl font-black text-cyan-400 outline-none focus:border-cyan-500"
              />
              <div className="flex gap-4">
                <button onClick={() => setEditingMember(null)} className="flex-1 py-4 bg-white/5 text-slate-500 rounded-2xl text-[10px] font-black uppercase hover:text-white transition-all">Batal</button>
                <button onClick={handleManualCredit} disabled={isProcessing} className="flex-1 py-4 bg-cyan-500 text-black rounded-2xl text-[10px] font-black uppercase shadow-xl">Simpan</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
