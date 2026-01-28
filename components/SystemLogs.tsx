
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/api';

/**
 * SystemLogs Component
 * Terminal-style viewer for system audit logs and recent activities.
 */
interface SystemLogsProps {
  onBack: () => void;
}

export const SystemLogs: React.FC<SystemLogsProps> = ({ onBack }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Initial fetch and polling
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      // Aggregate data from topup_requests and members to simulate activity logs
      const { data: topups } = await supabase.from('topup_requests').select('*').order('created_at', { ascending: false }).limit(5);
      const { data: members } = await supabase.from('members').select('*').order('created_at', { ascending: false }).limit(5);
      
      const combinedLogs: string[] = [];
      topups?.forEach(t => {
        if (t) combinedLogs.push(`[${new Date(t.created_at).toLocaleTimeString()}] TOPUP_ID: ${t.tid || 'UNKNOWN'} | STATUS: ${String(t.status || '').toUpperCase()} | USER: ${t.email || 'N/A'}`);
      });
      members?.forEach(m => {
        if (m) combinedLogs.push(`[${new Date(m.created_at).toLocaleTimeString()}] NEW_NODE_JOINED | IDENTITY: ${m.email || 'N/A'} | STATUS: ${String(m.status || '').toUpperCase()}`);
      });
      
      const sorted = combinedLogs.sort().reverse();
      setLogs([
        "SYSTEM_BOOT_COMPLETED: NODE_SATMOKO_V7.8_ONLINE",
        "ENCRYPTION_LAYER_ACTIVE: AES-256_RSA-4096",
        "DATABASE_BRIDGE_ESTABLISHED: READY",
        ...sorted
      ]);
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto overflow-hidden">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95">
            <i className="fa-solid fa-chevron-left text-xs"></i>
          </button>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">System <span className="text-cyan-500">Audit</span></h2>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mt-1">Satellite Transmissions & Security Logs</p>
          </div>
        </div>
        <button onClick={fetchLogs} className="w-12 h-12 rounded-2xl bg-white/5 text-slate-400 hover:text-cyan-400 border border-white/10 flex items-center justify-center transition-all">
          <i className={`fa-solid fa-rotate ${isLoading ? 'animate-spin' : ''}`}></i>
        </button>
      </div>

      <div className="flex-1 glass-panel rounded-[3rem] bg-black/60 border border-white/5 shadow-inner overflow-hidden flex flex-col p-8 lg:p-12">
        <div className="flex items-center gap-3 mb-6 opacity-40">
           <div className="w-2 h-2 rounded-full bg-red-500"></div>
           <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
           <div className="w-2 h-2 rounded-full bg-green-500"></div>
           <span className="text-[9px] font-mono ml-4 text-slate-500 uppercase tracking-widest">Satmoko_Terminal_v7.8.1_Secure_Transmission</span>
        </div>

        {isLoading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 opacity-20">
            <i className="fa-solid fa-terminal text-4xl animate-pulse"></i>
            <p className="text-[10px] font-black uppercase tracking-widest">Synchronizing Logs...</p>
          </div>
        ) : (
          <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto custom-scrollbar pr-4 flex flex-col">
            <div className="space-y-2 py-4">
              {(logs || []).map((log, i) => {
                const safeLog = String(log || "");
                const isSuccess = safeLog.includes('AKTIF') || safeLog.includes('TERHUBUNG') || safeLog.includes('READY') || safeLog.includes('APPROVED');
                const isError = safeLog.includes('KOSONG') || safeLog.includes('REJECTED');
                
                return (
                  <p key={i} className={`text-[11px] lg:text-[13px] leading-relaxed tracking-wider ${isSuccess ? 'text-green-400 font-bold' : isError ? 'text-red-500 font-black animate-pulse' : 'text-cyan-400/80 uppercase'}`}>
                    <span className="text-slate-700 mr-2">»</span>
                    {safeLog}
                  </p>
                );
              })}
              <div className="flex items-center gap-2 mt-4">
                 <span className="text-slate-700 mr-2">»</span>
                 <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-2 h-4 bg-cyan-500/60" />
              </div>
              <div ref={terminalEndRef} />
            </div>
          </motion.div>
        )}
      </div>

      <div className="mt-8 flex justify-center gap-8 opacity-20">
         <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> SECURE_NODE_1
         </div>
         <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> SECURE_NODE_2
         </div>
         <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span> BACKUP_NODE_3
         </div>
      </div>
    </div>
  );
};
