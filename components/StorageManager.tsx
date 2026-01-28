
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/api';

interface StorageManagerProps {
  onBack: () => void;
  lang: 'id' | 'en';
}

export const StorageManager: React.FC<StorageManagerProps> = ({ onBack, lang }) => {
  const [activeTab, setActiveTab] = useState<'members' | 'messages'>('members');
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'members') {
        const { data } = await supabase.from('members').select('*').order('created_at', { ascending: false });
        setMembers(data || []);
      } else {
        const { data } = await supabase.from('direct_messages').select('*').order('created_at', { ascending: false });
        setMessages(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const exportCSV = () => {
    const data = activeTab === 'members' ? members : messages;
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName], (key, value) => value === null ? '' : value)).join(','))
    ];
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ekspor_data_${activeTab}_${Date.now()}.csv`);
    link.click();
  };

  const backupJSON = async () => {
    setIsLoading(true);
    try {
      const { data: mems } = await supabase.from('members').select('*');
      const { data: msgs } = await supabase.from('direct_messages').select('*');
      const backupData = {
        timestamp: new Date().toISOString(),
        tables: {
          members: mems,
          direct_messages: msgs
        }
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `BACKUP_SISTEM_SATMOKO_${Date.now()}.json`);
      link.click();
      setStatus({ type: 'success', msg: 'Data berhasil dicadangkan.' });
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!confirm("⚠️ PERHATIAN: Semua data akan ditimpa dengan data dari file cadangan. Lanjutkan?")) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.tables) throw new Error("File cadangan tidak valid.");
        if (json.tables.members?.length > 0) {
          await supabase.from('members').upsert(json.tables.members);
        }
        if (json.tables.direct_messages?.length > 0) {
          await supabase.from('direct_messages').upsert(json.tables.direct_messages);
        }
        setStatus({ type: 'success', msg: 'Data berhasil dipulihkan.' });
        fetchData();
      } catch (err: any) {
        setStatus({ type: 'error', msg: `Gagal pulihkan: ${err.message}` });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const translations = {
    id: {
      title: "Pusat Data",
      subtitle: "Kelola Laporan & Cadangan Sistem",
      membersTab: "Data Member",
      messagesTab: "Data Chat",
      backup: "Simpan Backup",
      restore: "Upload Backup",
      export: "Ekspor CSV",
      refresh: "Segarkan",
      guideTitle: "PANDUAN DATA CENTER",
      guideContent: `Pusat kendali data administratif Satmoko Studio.
      - EKSPOR CSV: Mengunduh data tabel yang sedang aktif ke format Excel/CSV.
      - BACKUP JSON: Mengunduh seluruh database (Member & Chat) ke satu file aman.
      - RESTORE JSON: Memulihkan database dari file cadangan yang telah dibuat.`
    },
    en: {
      title: "Data Center",
      subtitle: "System Logs & Backup Management",
      membersTab: "Member Data",
      messagesTab: "Chat Data",
      backup: "Save Backup",
      restore: "Upload Backup",
      export: "Export CSV",
      refresh: "Refresh",
      guideTitle: "DATA CENTER GUIDE",
      guideContent: `Administrative data control center for Satmoko Studio.
      - EXPORT CSV: Download current active table data to Excel/CSV format.
      - BACKUP JSON: Download the entire database (Members & Chats) to a secure file.
      - RESTORE JSON: Restore the database from a previously created backup file.`
    }
  };

  const t = translations[lang] || translations.id;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <button onClick={() => setShowGuide(!showGuide)} className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center shadow-xl ${showGuide ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-white/5 border-white/5 text-cyan-400'}`}>
            <i className={`fa-solid ${showGuide ? 'fa-xmark' : 'fa-question'} text-[10px]`}></i>
          </button>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">{t.title}</h2>
            <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-600 mt-1">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
           <button onClick={exportCSV} className="px-5 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase hover:bg-cyan-500 hover:text-black transition-all">
             {t.export}
           </button>
           <button onClick={backupJSON} className="px-5 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase hover:bg-purple-500 hover:text-black transition-all">
             {t.backup}
           </button>
           <label className="px-5 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-black uppercase hover:bg-yellow-500 hover:text-black transition-all cursor-pointer flex items-center">
             {t.restore}
             <input type="file" onChange={handleRestore} className="hidden" accept=".json" />
           </label>
           <button onClick={fetchData} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all flex items-center justify-center">
             <i className={`fa-solid fa-rotate ${isLoading ? 'animate-spin' : ''}`}></i>
           </button>
        </div>
      </div>

      <AnimatePresence>
        {showGuide && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-panel p-8 rounded-[2.5rem] bg-cyan-500/5 border border-cyan-500/20 mb-4 shadow-2xl">
               <p className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.4em] mb-3">{t.guideTitle}</p>
               <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed whitespace-pre-line">
                 {t.guideContent}
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest text-center ${status.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {status.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 glass-panel rounded-[3rem] bg-[#0d1117]/60 border-white/5 flex flex-col overflow-hidden shadow-2xl relative">
        <div className="flex bg-black/40 border-b border-white/5">
          <button onClick={() => setActiveTab('members')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'members' ? 'text-cyan-400 bg-cyan-400/5 border-b-2 border-cyan-400' : 'text-slate-600 hover:text-slate-400'}`}>{t.membersTab}</button>
          <button onClick={() => setActiveTab('messages')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'messages' ? 'text-cyan-400 bg-cyan-400/5 border-b-2 border-cyan-400' : 'text-slate-600 hover:text-slate-400'}`}>{t.messagesTab}</button>
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar p-6">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[9px] font-black uppercase text-slate-600 tracking-widest">
                <th className="px-4 py-2">ID</th>
                {activeTab === 'members' ? (
                  <>
                    <th className="px-4 py-2">EMAIL</th>
                    <th className="px-4 py-2">NAMA</th>
                    <th className="px-4 py-2">KREDIT</th>
                    <th className="px-4 py-2">STATUS</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-2">PENGIRIM</th>
                    <th className="px-4 py-2">PENERIMA</th>
                    <th className="px-4 py-2">ISI PESAN</th>
                  </>
                )}
                <th className="px-4 py-2">WAKTU</th>
              </tr>
            </thead>
            <tbody>
              {activeTab === 'members' ? members.map(m => (
                <tr key={m.id} className="text-[10px] bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <td className="px-4 py-3 rounded-l-xl font-mono text-slate-500">{m.id.toString().slice(-6)}</td>
                  <td className="px-4 py-3 font-bold text-white">{m.email}</td>
                  <td className="px-4 py-3 text-slate-400">{m.full_name || '-'}</td>
                  <td className="px-4 py-3 text-cyan-400 font-black">{m.credits?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md ${m.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3 rounded-r-xl text-[8px] text-slate-600">{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              )) : messages.map(msg => (
                <tr key={msg.id} className="text-[10px] bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <td className="px-4 py-3 rounded-l-xl font-mono text-slate-500">{msg.id.toString().slice(-6)}</td>
                  <td className="px-4 py-3 font-bold text-cyan-400">{msg.sender_email}</td>
                  <td className="px-4 py-3 text-slate-400">{msg.receiver_email}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-white">{msg.content}</td>
                  <td className="px-4 py-3 rounded-r-xl text-[8px] text-slate-600">{new Date(msg.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
