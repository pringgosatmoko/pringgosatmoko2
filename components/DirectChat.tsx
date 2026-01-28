
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isUserOnline } from '../lib/api';

/**
 * DirectChat Component
 * Handles direct messaging between users and admins.
 */
interface DirectChatProps {
  userEmail: string;
  isAdmin: boolean;
  adminEmail: string;
  onBack: () => void;
}

export const DirectChat: React.FC<DirectChatProps> = ({ userEmail, isAdmin, adminEmail, onBack }) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync contacts on mount and subscribe to changes
  useEffect(() => {
    fetchContacts();
    const channel = supabase
      .channel('public:members_presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        fetchContacts();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch and subscribe to messages when contact is selected
  useEffect(() => {
    if (selectedContact) {
      fetchMessages();
      const channel = supabase
        .channel(`chat:${selectedContact}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'direct_messages',
          filter: `receiver_email=eq.${userEmail}`
        }, (payload) => {
          if (payload.new.sender_email === selectedContact) {
            setMessages(prev => [...prev, payload.new]);
          }
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setMessages([]);
    }
  }, [selectedContact]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const fetchContacts = async () => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .order('last_seen', { ascending: false });
    
    if (isAdmin) {
      // Admins see all users except themselves
      setContacts(data?.filter(m => m.email.toLowerCase() !== userEmail.toLowerCase()) || []);
    } else {
      // Regular users only see the master admin
      setContacts(data?.filter(m => m.email.toLowerCase() === adminEmail.toLowerCase()) || []);
    }
  };

  const fetchMessages = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_email.eq.${userEmail},receiver_email.eq.${selectedContact}),and(sender_email.eq.${selectedContact},receiver_email.eq.${userEmail})`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setIsLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedContact) return;
    const msg = {
      sender_email: userEmail.toLowerCase(),
      receiver_email: selectedContact.toLowerCase(),
      content: input.trim()
    };
    
    // Optimistic update
    const optimisticMsg = { ...msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');

    const { error } = await supabase.from('direct_messages').insert([msg]);
    if (error) {
      console.error("Message Error:", error);
    }
  };

  const filteredContacts = (contacts || []).filter(c => {
    const email = String(c?.email || "").toLowerCase();
    const name = String(c?.full_name || "").toLowerCase();
    const search = String(searchTerm || "").toLowerCase();
    return email.includes(search) || name.includes(search);
  });

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 max-w-7xl mx-auto overflow-hidden">
      {/* Sidebar Navigation */}
      <div className={`flex-col ${selectedContact ? 'hidden md:flex' : 'flex'} w-full md:w-80 glass-panel rounded-[3rem] bg-slate-900/40 border border-white/5 overflow-hidden`}>
        <div className="p-6 border-b border-white/5 space-y-4">
           <div className="flex items-center gap-4">
              <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-xl active:scale-95">
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <div>
                <h2 className="text-sm font-black uppercase italic text-white leading-none">Direct <span className="text-cyan-400">Node</span></h2>
                <p className="text-[7px] font-bold text-slate-600 uppercase tracking-widest mt-1">Satellite Transmissions</p>
              </div>
           </div>
           <input 
             type="text" 
             placeholder="Cari transmisi..." 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-5 text-[10px] text-white outline-none focus:border-cyan-500/30 transition-all shadow-inner"
           />
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
           {filteredContacts.length > 0 ? (
             filteredContacts.map(c => (
               <button 
                 key={c.email} 
                 onClick={() => setSelectedContact(c.email)}
                 className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all relative group ${selectedContact === c.email ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
               >
                  <div className="relative flex-shrink-0">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black uppercase text-xs border-2 ${selectedContact === c.email ? 'bg-black/10 border-black/20' : 'bg-slate-800 border-white/5'}`}>
                       {c.full_name?.[0] || 'U'}
                     </div>
                     {isUserOnline(c.last_seen) && (
                       <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                     )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                     <p className="text-[10px] font-black uppercase truncate leading-none mb-1">{c.full_name || 'Member Node'}</p>
                     <p className={`text-[8px] truncate font-bold ${selectedContact === c.email ? 'text-black/60' : 'text-slate-600'}`}>{c.email}</p>
                  </div>
               </button>
             ))
           ) : (
             <div className="h-full flex flex-col items-center justify-center opacity-10 gap-3">
                <i className="fa-solid fa-satellite-dish text-3xl"></i>
                <p className="text-[8px] font-black uppercase tracking-widest">No Node Detected</p>
             </div>
           )}
        </div>
      </div>

      {/* Main Communication Interface */}
      <div className={`flex-1 flex flex-col glass-panel rounded-[3rem] bg-black/40 border border-white/5 overflow-hidden shadow-2xl relative ${!selectedContact && 'hidden md:flex items-center justify-center'}`}>
        {selectedContact ? (
          <>
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
               <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedContact(null)} className="md:hidden w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <div>
                    <h3 className="text-xs font-black uppercase text-white tracking-widest leading-none">{selectedContact}</h3>
                    <p className="text-[8px] font-bold text-cyan-500 uppercase tracking-[0.4em] mt-2">SECURE_LINK_V7.2_ENABLED</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                     <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Identity_Verified</p>
                     <p className="text-[9px] font-black text-green-500 uppercase">ENCRYPTED</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                     <i className="fa-solid fa-shield-halved text-xs"></i>
                  </div>
               </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6 custom-scrollbar bg-slate-950/20">
               {messages.map((m, i) => (
                 <div key={i} className={`flex ${m.sender_email === userEmail.toLowerCase() ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] lg:max-w-[70%] space-y-1">
                      <div className={`p-4 lg:p-5 rounded-2xl lg:rounded-3xl text-[11px] lg:text-[13px] font-bold leading-relaxed shadow-2xl relative ${
                        m.sender_email === userEmail.toLowerCase() 
                          ? 'bg-cyan-600 text-white rounded-tr-none border border-cyan-400/30' 
                          : 'bg-[#1c232d] text-slate-200 rounded-tl-none border border-white/5'
                      }`}>
                         {m.content}
                      </div>
                      <p className={`text-[7px] font-black uppercase tracking-widest opacity-30 ${m.sender_email === userEmail.toLowerCase() ? 'text-right mr-2' : 'text-left ml-2'}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                 </div>
               ))}
               {isLoading && messages.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center gap-4 opacity-20">
                    <i className="fa-solid fa-spinner fa-spin text-3xl"></i>
                    <p className="text-[9px] font-black uppercase tracking-widest">Decrypting Stream...</p>
                 </div>
               )}
            </div>

            <div className="p-6 bg-slate-900/60 flex gap-4 border-t border-white/5 backdrop-blur-3xl">
               <input 
                 type="text" 
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSend()}
                 placeholder="Type your transmission, Master..." 
                 className="flex-1 bg-black/60 border border-white/10 rounded-[1.5rem] px-8 py-4 text-xs lg:text-sm text-white outline-none focus:border-cyan-500/40 transition-all shadow-inner placeholder:text-slate-800"
               />
               <button 
                 onClick={handleSend} 
                 disabled={!input.trim()} 
                 className="w-14 h-14 lg:w-16 lg:h-16 rounded-[1.5rem] bg-white text-black flex items-center justify-center hover:bg-cyan-500 transition-all shadow-xl active:scale-90 disabled:opacity-20 flex-shrink-0"
               >
                 <i className="fa-solid fa-paper-plane text-lg"></i>
               </button>
            </div>
          </>
        ) : (
          <div className="text-center opacity-10 flex flex-col items-center justify-center gap-10">
             <div className="relative">
                <i className="fa-solid fa-comments text-[120px]"></i>
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute inset-0 bg-cyan-500 rounded-full blur-[60px] -z-10"
                />
             </div>
             <div>
                <p className="text-xl font-black uppercase tracking-[1em]">IDLE_TRANSMISSION</p>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-4">Select a Node to start communication</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
