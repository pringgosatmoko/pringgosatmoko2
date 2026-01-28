
// Satmoko Studio V7.8 - Global Environment Initializer
(function() {
  if (typeof window !== 'undefined') {
    const win = window as any;
    win.process = win.process || {};
    win.process.env = win.process.env || {};
    const metaEnv = (import.meta as any).env || {};
    
    // Prioritas 1: Ambil dari VITE_GEMINI_API_1
    const defaultKey = metaEnv.VITE_GEMINI_API_1 || "";
    win.process.env.API_KEY = defaultKey;
    
    // Salin semua env lain ke process.env
    Object.keys(metaEnv).forEach(key => {
      win.process.env[key] = metaEnv[key];
    });

    // Inisialisasi Midtrans Client
    const midtransScript = document.getElementById('midtrans-script') as HTMLScriptElement;
    if (midtransScript && metaEnv.VITE_MIDTRANS_CLIENT_ID) {
      midtransScript.setAttribute('data-client-key', metaEnv.VITE_MIDTRANS_CLIENT_ID);
    }

    console.log("Satmoko Hub: Global Environment Synced.");
  }
})();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
