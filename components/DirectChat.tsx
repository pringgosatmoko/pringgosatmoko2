
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isUserOnline, sendTelegramNotification } from '../lib/api';

interface Message {
  id: string | number;
  sender_email: string;
  receiver_email: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface ContactType {
  email: string;
  full_name?: string;
  status: string;
  last_seen?: string | null;
  lastMsg?: string;
  unread: number;
  isOnline: boolean;
  time: string;
  isOfficial?: boolean;
}

interface DirectChatProps {
  userEmail: string;
  isAdmin: boolean;
  adminEmail: string;
  onBack: () => void;
}

export const DirectChat: React.FC<DirectChatProps> = ({ userEmail, isAdmin, adminEmail, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [contacts, setContacts] = useState<ContactType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [isPurging, setIsPurging] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [activeMessageId, setActiveMessageId] = useState<string | number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<any>(null);

  const currentUserEmailNormalized = userEmail.toLowerCase();

  useEffect(() => {
    fetchContactsAndHistory();
    const timer = setInterval(fetchContactsAndHistory, 15000);
    return () => clearInterval(timer);
  }, [userEmail]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser);
      markAsRead(selectedUser);
      if (window.innerWidth < 1024) setMobileView('chat');
    } else {
      setMobileView('list');
    }
  }, [selectedUser]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const fetchContactsAndHistory = async () => {
    if (!userEmail) return;
    try {
      const { data: members, error: memError } = await supabase.from('members').select('*');
      if (memError) throw memError;

      const { data: msgs, error: msgError } = await supabase.from('direct_messages')
        .select('*')
        .or(`sender_email.eq.${userEmail},receiver_email.eq.${userEmail}`)
        .order('created_at', { ascending: false });
      if (msgError) throw msgError;

      const processed = members?.filter(m => m.email.toLowerCase() !== currentUserEmailNormalized).map(m => {
        const memberEmailLower = m.email.toLowerCase();
        const history = msgs?.filter(msg => msg.sender_email.toLowerCase() === memberEmailLower || msg.receiver_email.toLowerCase() === memberEmailLower);
        const last = history?.[0];
        return {
          email: m.email,
          full_name: m.full_name || m.email.split('@')[0],
          status: m.status,
          last_seen: m.last_seen,
          lastMsg: last?.content || 'Belum ada pesan.',
          unread: history?.filter(msg => msg.receiver_email.toLowerCase() === currentUserEmailNormalized && !msg.is_read).length || 0,
          isOnline: isUserOnline(m.last_seen),
          time: last ? new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          isOfficial: m.email.toLowerCase() === adminEmail.toLowerCase()
        };
      }).sort((a, b) => (b.unread - a.unread) || (b.isOnline ? -1 : 1));
      
      setContacts(processed || []);
    } catch (err) {
      console.error("Fetch Contacts Error:", err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const fetchMessages = async (target: string) => {
    try {
      const { data } = await supabase.from('direct_messages')
        .select('*')
        .or(`and(sender_email.eq.${userEmail},receiver_email.eq.${target}),and(sender_email.eq.${target},receiver_email.eq.${userEmail})`)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    } catch (err) {
      console.error("Fetch Messages Error:", err);
    }
  };

  const markAsRead = async (target: string) => {
    await supabase.from('direct_messages')
      .update({ is_read: true })
      .eq('receiver_email', userEmail)
      .eq('sender_email', target);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedUser) return;
    const msg = input; 
    setInput('');
    try {
      await supabase.from('direct_messages').insert([{ 
        sender_email: userEmail, 
        receiver_email: selectedUser, 
        content: msg 
      }]);
      
      sendTelegramNotification(`📩 *PESAN BARU*\nDari: ${userEmail}\nKe: ${selectedUser}\nIsi: ${msg}`);
      fetchMessages(selectedUser);
      fetchContactsAndHistory();
    } catch (err) {
      console.error("Send Message Error:", err);
    }
  };

  const deleteMessage = async (msgId: string | number) => {
    if (!confirm("Hapus pesan ini secara permanen?")) return;
    try {
      await supabase.from('direct_messages').delete().eq('id', msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setActiveMessageId(null);
      fetchContactsAndHistory();
    } catch (err) {
      console.error("Delete Msg Error:", err);
    }
  };

  const handleHoldStart = (msgId: string | number) => {
    longPressTimer.current = setTimeout(() => {
      setActiveMessageId(msgId);
      if (navigator.vibrate) navigator.vibrate(60);
    }, 600);
  };

  const handleHoldEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const purgeChat = async () => {
    if (!selectedUser) return;
    if (!confirm(`Hapus seluruh riwayat percakapan dengan ${selectedUser}?`)) return;
    
    setIsPurging(true);
    try {
      await supabase.from('direct_messages')
        .delete()
        .or(`and(sender_email.eq.${userEmail},receiver_email.eq.${selectedUser}),and(sender_email.eq.${selectedUser},receiver_email.eq.${userEmail})`);
      
      setMessages([]);
      fetchContactsAndHistory();
    } catch (err) {
      console.error("Purge Error:", err);
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 lg:gap-6 max-w-7xl mx-auto overflow-hidden">
      <div className="flex items-center justify-between px-2 flex-shrink-0">
        <div className="flex items-center gap-4 lg:gap-6">
          <button 
            onClick={mobileView === 'chat' ? () => setMobileView('list') : onBack} 
            className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95"
          >
            <i className="fa-solid fa-chevron-left text-xs"></i>
          </button>
          <div>
            <h2 className="text-xl lg:text-4xl font-bold uppercase italic tracking-tighter text-white">
              {mobileView === 'chat' && window.innerWidth < 1024 ? 'Ruang Pesan' : 'Hub Komunikasi'}
            </h2>
            <p className="text-[7px] lg:text-[10px] font-bold uppercase tracking-[0.4em] text-slate-600 mt-1 lg:mt-2">
              {mobileView === 'chat' && window.innerWidth < 1024 ? selectedUser : 'SATMOKO_P2P_NETWORK_STABLE'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden gap-0 lg:gap-8 relative min-h-0 pb-20 lg:pb-0">
        <div className={`
          ${mobileView === 'chat' ? 'hidden' : 'flex'} 
          lg:flex flex-col w-full lg:w-[350px] glass-panel rounded-3xl lg:rounded-[3.5rem] bg-[#0e1621] border-white/5 overflow-hidden shadow-2xl flex-shrink-0 transition-all
        `}>
           <div className="p-4 lg:p-8">
              <input 
                type="text" 
                placeholder="Cari identitas kontak..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 lg:py-4 px-5 lg:px-6 text-[10px] lg:text-xs text-white focus:outline-none focus:border-cyan-500/30 transition-all placeholder:text-slate-800 font-bold shadow-inner" 
              />
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar px-3 lg:px-4 pb-48 lg:pb-20 space-y-1 lg:space-y-2">
              {isLoadingContacts ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 opacity-20">
                   <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
                   <p className="text-[8px] font-black uppercase tracking-widest">Sinkronisasi Kontak...</p>
                </div>
              ) : contacts.filter(c => c.email.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                <button 
                  key={c.email} 
                  onClick={() => setSelectedUser(c.email)} 
                  className={`w-full p-4 lg:p-6 rounded-2xl lg:rounded-[2.5rem] text-left transition-all flex items-center gap-4 lg:gap-5 ${selectedUser === c.email ? 'bg-cyan-500/10 border border-cyan-500/20 shadow-lg' : 'hover:bg-white/5'}`}
                >
                   <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-xs lg:text-sm font-bold border-2 ${c.isOnline ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'border-white/5'} ${selectedUser === c.email ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-500 shadow-inner'}`}>
                        {c.isOfficial ? <i className="fa-solid fa-shield-halved"></i> : c.email.charAt(0).toUpperCase()}
                      </div>
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className={`text-[10px] lg:text-xs font-bold truncate uppercase tracking-tighter ${c.isOfficial ? 'text-cyan-400' : 'text-slate-200'}`}>{c.full_name}</p>
                        <span className="text-[7px] lg:text-[8px] text-slate-600 font-bold">{c.isOnline ? 'ONLINE' : c.time}</span>
                      </div>
                      <p className={`text-[9px] lg:text-[10px] truncate mt-0.5 lg:mt-1 ${c.unread > 0 ? 'text-white font-bold' : 'text-slate-600'}`}>{c.lastMsg}</p>
                   </div>
                   {c.unread > 0 && <span className="w-4 h-4 lg:w-5 lg:h-5 bg-cyan-500 text-black text-[8px] lg:text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">{c.unread}</span>}
                </button>
              ))}
              {!isLoadingContacts && contacts.length === 0 && (
                <p className="text-center text-[9px] font-bold text-slate-700 py-10 uppercase tracking-widest">Tidak ada kontak ditemukan.</p>
              )}
           </div>
        </div>

        <div className={`
          ${mobileView === 'list' ? 'hidden' : 'flex'} 
          lg:flex flex-1 glass-panel rounded-3xl lg:rounded-[4rem] bg-[#17212b] border-white/5 flex flex-col overflow-hidden shadow-2xl relative
        `}>
           {selectedUser ? (
             <>
               <div className="px-6 lg:px-10 py-4 lg:py-6 border-b border-white/5 bg-black/30 flex items-center justify-between">
                  <div className="flex items-center gap-3 lg:gap-4">
                    <button onClick={() => setMobileView('list')} className="lg:hidden text-slate-500 mr-2 active:scale-90 transition-transform"><i className="fa-solid fa-arrow-left"></i></button>
                    <div className={`w-8 h-8 lg:w-12 lg:h-12 rounded-full flex items-center justify-center font-bold border-2 ${isUserOnline(contacts.find(c => c.email === selectedUser)?.last_seen) ? 'border-green-500' : 'border-white/5'} bg-slate-800 text-slate-400 text-xs lg:text-base shadow-inner`}>
                      {selectedUser.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs lg:text-sm font-bold text-white uppercase italic tracking-widest leading-none truncate">{selectedUser}</h4>
                      <p className="text-[7px] lg:text-[9px] font-bold text-green-500 tracking-widest mt-1">ENKRIPSI AES-256 AKTIF</p>
                    </div>
                  </div>
                  <button 
                    onClick={purgeChat} 
                    disabled={isPurging}
                    className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95"
                    title="Bersihkan Semua Pesan"
                  >
                    <i className={`fa-solid ${isPurging ? 'fa-spinner fa-spin' : 'fa-trash-can'} text-xs`}></i>
                  </button>
               </div>
               
               <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 space-y-4 lg:space-y-6 pb-48" onClick={() => setActiveMessageId(null)}>
                  {messages.map(m => {
                    const isSender = m.sender_email.toLowerCase() === currentUserEmailNormalized;
                    const isActive = activeMessageId === m.id;
                    const canDelete = isSender || m.receiver_email.toLowerCase() === currentUserEmailNormalized || isAdmin;

                    return (
                      <div key={m.id} className={`flex group ${isSender ? 'justify-end' : 'justify-start'}`}>
                         <motion.div 
                            onMouseDown={() => handleHoldStart(m.id)}
                            onMouseUp={handleHoldEnd}
                            onMouseLeave={handleHoldEnd}
                            onTouchStart={() => handleHoldStart(m.id)}
                            onTouchEnd={handleHoldEnd}
                            className={`max-w-[85%] lg:max-w-[70%] p-4 lg:p-6 rounded-2xl lg:rounded-[2rem] shadow-xl relative cursor-default select-none transition-all ${isSender ? 'bg-[#2b5278] text-white rounded-tr-none' : 'bg-[#182533] text-slate-200 rounded-tl-none border border-white/5'} ${isActive ? 'ring-2 ring-red-500 scale-[0.98] bg-red-500/10' : ''}`}
                         >
                            <AnimatePresence>
                               {isActive && canDelete && (
                                 <motion.div 
                                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: -55 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="absolute left-1/2 -translate-x-1/2 z-50"
                                 >
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); deleteMessage(m.id); }}
                                      className="bg-red-600 text-white px-5 py-2.5 rounded-full text-[9px] font-black uppercase shadow-[0_10px_25px_rgba(220,38,38,0.5)] flex items-center gap-2 hover:bg-white hover:text-red-600 transition-all border border-red-500 active:scale-90"
                                    >
                                       <i className="fa-solid fa-trash-can"></i> HAPUS PESAN
                                    </button>
                                 </motion.div>
                               )}
                            </AnimatePresence>

                            <p className="text-[11px] lg:text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                            <div className="flex items-center justify-end gap-2 mt-1.5 lg:mt-2 opacity-30">
                               <span className="text-[7px] lg:text-[8px] font-bold">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                               {isSender && <i className={`fa-solid fa-check-double text-[7px] lg:text-[8px] ${m.is_read ? 'text-cyan-400' : ''}`}></i>}
                            </div>
                         </motion.div>
                      </div>
                    );
                  })}
               </div>

               <div className="p-4 lg:p-8 bg-black/40 border-t border-white/5 backdrop-blur-md">
                  <div className="flex items-end gap-3 lg:gap-4 max-w-5xl mx-auto">
                    <textarea 
                      value={input} 
                      onChange={e => setInput(e.target.value)} 
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Tulis transmisi data Master..." 
                      className="flex-1 bg-slate-900/80 border border-white/5 rounded-2xl lg:rounded-3xl p-4 lg:p-6 outline-none text-[11px] lg:text-sm text-white resize-none max-h-24 lg:max-h-32 focus:border-cyan-500/40 transition-all shadow-inner font-medium placeholder:text-slate-700" 
                    />
                    <button 
                      onClick={sendMessage} 
                      disabled={!input.trim()} 
                      className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-cyan-600 text-white flex items-center justify-center hover:bg-white hover:text-cyan-600 shadow-[0_0_20px_rgba(8,145,178,0.3)] active:scale-95 transition-all flex-shrink-0 disabled:opacity-20"
                    >
                      <i className="fa-solid fa-paper-plane text-base lg:text-xl"></i>
                    </button>
                  </div>
               </div>
             </>
           ) : (
             <div className="h-full flex flex-col items-center justify-center opacity-10 p-10 lg:p-20 text-center pb-48">
                <i className="fa-solid fa-shield-halved text-[80px] lg:text-[150px] mb-8 lg:mb-12"></i>
                <h3 className="text-xl lg:text-4xl font-bold uppercase tracking-[0.6em] lg:tracking-[1em]">Gerbang Komunikasi</h3>
                <p className="mt-2 lg:mt-4 text-[8px] lg:text-sm font-bold uppercase tracking-widest">Pilih kontak untuk memulai sinkronisasi data rahasia.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
