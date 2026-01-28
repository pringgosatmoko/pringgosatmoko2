
// Satmoko Studio V7.8 - Critical Global Environment Polyfill
(function() {
  if (typeof window !== 'undefined') {
    const win = window as any;
    win.process = win.process || {};
    win.process.env = win.process.env || {};
    const metaEnv = (import.meta as any).env || {};
    
    win.process.env.API_KEY = metaEnv.VITE_GEMINI_API_1 || "";
    Object.keys(metaEnv).forEach(key => {
      win.process.env[key] = metaEnv[key];
    });

    // Inisialisasi Midtrans Client menggunakan CLIENT_ID (Bukan KEY)
    const midtransScript = document.getElementById('midtrans-script') as HTMLScriptElement;
    if (midtransScript && metaEnv.VITE_MIDTRANS_CLIENT_ID) {
      midtransScript.setAttribute('data-client-key', metaEnv.VITE_MIDTRANS_CLIENT_ID);
    }

    console.log("Satmoko Hub: Midtrans & Environment Synced.");
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
