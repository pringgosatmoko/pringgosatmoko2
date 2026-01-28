
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RobotHero } from './components/RobotHero';
import { LogoHero } from './components/LogoHero';
import { SloganAnimation } from './components/SloganAnimation';
import { LoginForm } from './components/LoginForm';
import { ChatAssistant } from './components/ChatAssistant';
import { VideoGenerator } from './components/VideoGenerator';
import { StudioCreator } from './components/StudioCreator';
import { ImageGenerator } from './components/ImageGenerator';
import { MemberControl } from './components/MemberControl';
import { DirectChat } from './components/DirectChat';
import { ProfileSettings } from './components/ProfileSettings';
import { SystemLogs } from './components/SystemLogs';
import { TopupCenter } from './components/TopupCenter';
import { AspectRatioEditor } from './components/AspectRatioEditor';
import { VoiceCloning } from './components/VoiceCloning';
import { VideoDirector } from './components/VideoDirector';
import { StoryboardToVideo } from './components/StoryboardToVideo';
import { ProductSlider } from './components/ProductSlider';
import { LandingFooter } from './components/LandingFooter';
import { StartAnimation } from './components/StartAnimation';
import { BuildLogIntro } from './components/BuildLogIntro';
import { isAdmin, updatePresence, getUserCredits, supabase } from './lib/api';

/**
 * Global App Entry Point
 * Manages authentication, module routing, and global state for Satmoko Studio v7.8
 */
const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [isDeploying, setIsDeploying] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [validUntil, setValidUntil] = useState<string | null>(null);

  // Sync credits when logged in
  const refreshCredits = async () => {
    if (userEmail) {
      const c = await getUserCredits(userEmail);
      setCredits(c);
    }
  };

  useEffect(() => {
    if (isLoggedIn && userEmail) {
      refreshCredits();
      const interval = setInterval(refreshCredits, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, userEmail]);

  // Track presence for online status
  useEffect(() => {
    if (isLoggedIn && userEmail) {
      updatePresence(userEmail);
      const interval = setInterval(() => updatePresence(userEmail), 60000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, userEmail]);

  // Fix for error: handleLoginSuccess not found
  const handleLoginSuccess = (email: string, expiry: string | null = null) => {
    setUserEmail(email);
    setIsLoggedIn(true);
    setValidUntil(expiry);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserEmail('');
    setActiveModule(null);
  };

  // Deployment and Booting sequences
  if (isDeploying) return <BuildLogIntro onComplete={() => setIsDeploying(false)} />;
  if (isBooting) return <StartAnimation onComplete={() => setIsBooting(false)} />;

  return (
    <div className="min-h-screen bg-[#010409] text-white selection:bg-cyan-500/30 selection:text-cyan-200">
      <AnimatePresence mode="wait">
        {!isLoggedIn ? (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* HERO & LOGIN SECTION */}
            <section id="hero" className="min-h-screen flex flex-col items-center justify-center px-6 py-28 relative overflow-hidden">
               {/* Background Effects */}
               <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none"></div>
               
               <div className="relative z-10 flex flex-col items-center w-full max-w-lg">
                  {/* 1. Animasi Robot Master di Paling Atas */}
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0, y: -30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="mb-6"
                  >
                    <RobotHero />
                  </motion.div>
                  
                  {/* 2. Logo dan Slogan di Tengah */}
                  <div className="text-center space-y-4 mb-10">
                    <LogoHero isLoaded={true} />
                    <SloganAnimation />
                  </div>
                  
                  {/* 3. Login Form di Paling Bawah */}
                  <motion.div 
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className="w-full"
                  >
                    <LoginForm onSuccess={handleLoginSuccess} lang={lang} forcedMode={authMode} />
                  </motion.div>

                  <div className="mt-12 w-full">
                    <ProductSlider lang={lang} />
                  </div>

                  <div className="mt-12 group flex flex-col items-center gap-4 opacity-20 hover:opacity-50 transition-opacity">
                    <span className="text-[8px] font-bold uppercase text-slate-600 tracking-[0.5em]">SCROLL_DOWN_FOR_INTEL</span>
                    <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center animate-bounce text-cyan-400"><i className="fa-solid fa-chevron-down text-[8px]"></i></div>
                  </div>
               </div>
            </section>
            
            <section className="max-w-7xl mx-auto px-6 py-20">
              <LandingFooter lang={lang} />
            </section>
          </motion.div>
        ) : (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
            {/* Dashboard Navigation Router */}
            {activeModule === null ? (
              <div className="max-w-7xl mx-auto space-y-12">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter">SATMOKO <span className="text-cyan-500">DASHBOARD</span></h1>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mt-2">Active Node: {userEmail}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right px-4 py-2 bg-white/5 border border-white/5 rounded-2xl">
                      <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest leading-none mb-1">Available Credits</p>
                      <p className="text-xl font-black text-cyan-400 leading-none">{credits.toLocaleString()} CR</p>
                    </div>
                    <button onClick={handleLogout} className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-xl active:scale-95">
                      <i className="fa-solid fa-power-off"></i>
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {[
                    { id: 'chat', label: 'Smart Logic', icon: 'fa-brain', color: 'cyan' },
                    { id: 'image', label: 'Visual Artist', icon: 'fa-palette', color: 'fuchsia' },
                    { id: 'video', label: 'Video Gen', icon: 'fa-video', color: 'cyan' },
                    { id: 'studio', label: 'Studio Creator', icon: 'fa-film', color: 'yellow' },
                    { id: 'voice', label: 'Voice Clone', icon: 'fa-microphone-lines', color: 'cyan' },
                    { id: 'director', label: 'Video Director', icon: 'fa-clapperboard', color: 'orange' },
                    { id: 'storyboard', label: 'Storyboard', icon: 'fa-scroll', color: 'fuchsia' },
                    { id: 'outpaint', label: 'AspectRatio', icon: 'fa-expand', color: 'emerald' },
                    { id: 'chat_direct', label: 'Direct Chat', icon: 'fa-comments', color: 'white' },
                    { id: 'topup', label: 'Topup Center', icon: 'fa-wallet', color: 'cyan' },
                    { id: 'profile', label: 'Settings', icon: 'fa-user-gear', color: 'white' },
                    ...(isAdmin(userEmail) ? [
                      { id: 'admin_members', label: 'Members Control', icon: 'fa-users-gear', color: 'cyan' },
                      { id: 'admin_logs', label: 'System Audit', icon: 'fa-terminal', color: 'cyan' }
                    ] : [])
                  ].map(m => (
                    <button 
                      key={m.id} 
                      onClick={() => setActiveModule(m.id)} 
                      className="glass-panel p-8 rounded-[2.5rem] bg-slate-900/40 border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col items-center gap-6 text-center shadow-2xl group"
                    >
                      <div className={`w-16 h-16 rounded-3xl bg-${m.color}-500/10 flex items-center justify-center text-${m.color}-400 border border-${m.color}-500/20 group-hover:scale-110 transition-transform`}>
                        <i className={`fa-solid ${m.icon} text-2xl`}></i>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-7xl mx-auto">
                {activeModule === 'chat' && <ChatAssistant onBack={() => setActiveModule(null)} />}
                {activeModule === 'video' && <VideoGenerator mode="text2vid" onBack={() => setActiveModule(null)} lang={lang} userEmail={userEmail} credits={credits} refreshCredits={refreshCredits} />}
                {activeModule === 'studio' && <StudioCreator onBack={() => setActiveModule(null)} lang={lang} userEmail={userEmail} credits={credits} refreshCredits={refreshCredits} />}
                {activeModule === 'image' && <ImageGenerator onBack={() => setActiveModule(null)} lang={lang} userEmail={userEmail} credits={credits} refreshCredits={refreshCredits} />}
                {activeModule === 'admin_members' && <MemberControl onBack={() => setActiveModule(null)} lang={lang} />}
                {activeModule === 'chat_direct' && <DirectChat userEmail={userEmail} isAdmin={isAdmin(userEmail)} adminEmail="pringgosatmoko@gmail.com" onBack={() => setActiveModule(null)} />}
                {activeModule === 'profile' && <ProfileSettings onBack={() => setActiveModule(null)} userEmail={userEmail} credits={credits} validUntil={validUntil} lang={lang} />}
                {activeModule === 'admin_logs' && <SystemLogs onBack={() => setActiveModule(null)} />}
                {activeModule === 'topup' && <TopupCenter onBack={() => setActiveModule(null)} userEmail={userEmail} credits={credits} refreshCredits={refreshCredits} lang={lang} />}
                {activeModule === 'outpaint' && <AspectRatioEditor onBack={() => setActiveModule(null)} lang={lang} userEmail={userEmail} credits={credits} refreshCredits={refreshCredits} />}
                {activeModule === 'voice' && <VoiceCloning onBack={() => setActiveModule(null)} lang={lang} userEmail={userEmail} credits={credits} refreshCredits={refreshCredits} />}
                {activeModule === 'director' && <VideoDirector onBack={() => setActiveModule(null)} lang={lang} userEmail={userEmail} credits={credits} refreshCredits={refreshCredits} />}
                {activeModule === 'storyboard' && <StoryboardToVideo onBack={() => setActiveModule(null)} lang={lang} userEmail={userEmail} credits={credits} refreshCredits={refreshCredits} />}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
