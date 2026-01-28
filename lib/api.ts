
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- INITIAL ENVIRONMENT SYNC ---
const win = window as any;
win.process = win.process || {};
win.process.env = win.process.env || {};

const getEnv = (key: string) => {
  const metaEnv = (import.meta as any).env || {};
  return win.process?.env?.[key] || metaEnv[key] || "";
};

if (!win.process.env.API_KEY) {
  win.process.env.API_KEY = getEnv('VITE_GEMINI_API_1');
}

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;
  const url = getEnv('VITE_DATABASE_URL');
  const key = getEnv('VITE_SUPABASE_ANON');
  if (!url || !String(url).startsWith('http')) return createClient("https://dummy.supabase.co", "key");
  supabaseInstance = createClient(url, key);
  return supabaseInstance;
};

export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop: keyof SupabaseClient) => {
    const client = getSupabase();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// --- MIDTRANS INTEGRATION (ULTRA STABLE) ---
export const initMidtransPayment = async (email: string, amount: number, plan: string) => {
  try {
    console.log("Satmoko Hub: Menghubungi Gateway Pembayaran...");
    
    const response = await fetch('/api/pay', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: String(email || "").toLowerCase(), amount, plan })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.details || data.error || `Error ${response.status}`;
      throw new Error(String(errorMsg));
    }

    const orderId = `SAT-MID-${Date.now()}`;
    
    await supabase.from('topup_requests').insert([{
      tid: orderId,
      email: String(email || "").toLowerCase(),
      amount: plan === '1B' ? 1000 : plan === '3B' ? 3500 : 15000,
      price: amount,
      status: 'waiting_payment'
    }]);

    return { success: true, snapToken: data.token, orderId };
  } catch (err: any) {
    console.error("Critical Payment Error:", err.message);
    const userMsg = String(err?.message || "Unknown Connection Error");
    
    if (userMsg.includes('Failed to fetch')) {
      return { success: false, error: "Koneksi ke API Master Terputus. Pastikan Vercel Function tidak Crash." };
    }
    
    return { success: false, error: userMsg };
  }
};

export const sendTelegramNotification = async (message: string) => {
  const botToken = getEnv('VITE_TELEGRAM_BOT_TOKEN');
  const chatId = getEnv('VITE_TELEGRAM_CHAT_ID');
  if (!botToken || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `🚀 *SATMOKO HUB*\n\n${message}`, parse_mode: 'Markdown' })
    });
  } catch (e) {}
};

export const getUserCredits = async (email: string): Promise<number> => {
  if (!email || typeof email !== 'string') return 0;
  const { data } = await supabase.from('members').select('credits').eq('email', String(email).toLowerCase()).single();
  return data?.credits || 0;
};

export const deductCredits = async (email: string, amount: number): Promise<boolean> => {
  if (!email || typeof email !== 'string') return false;
  if (isAdmin(email)) return true;
  const current = await getUserCredits(email);
  if (current < amount) return false;
  const { error } = await supabase.from('members').update({ credits: current - amount }).eq('email', String(email).toLowerCase());
  return !error;
};

export const updateMemberStatus = async (email: string, status: string, validUntil?: string | null) => {
  if (!email || typeof email !== 'string') return false;
  const updateData: any = { status };
  if (validUntil !== undefined) updateData.valid_until = validUntil;
  return !(await supabase.from('members').update(updateData).eq('email', String(email).toLowerCase())).error;
};

export const deleteMember = async (email: string) => {
  if (!email || typeof email !== 'string') return false;
  return !(await supabase.from('members').delete().eq('email', String(email).toLowerCase())).error;
};

export const updatePresence = async (email: string) => {
  if (!email || typeof email !== 'string') return;
  await supabase.from('members').upsert({ email: String(email).toLowerCase(), last_seen: new Date().toISOString(), status: 'active' }, { onConflict: 'email' });
};

export const isUserOnline = (lastSeen: string | null | undefined) => {
  if (!lastSeen) return false;
  return (new Date().getTime() - new Date(lastSeen).getTime()) / 1000 < 150; 
};

export const isAdmin = (email: any) => {
  if (!email || typeof email !== 'string') return false;
  const adminConfig = getEnv('VITE_ADMIN_EMAILS') || 'pringgosatmoko@gmail.com';
  const admins = String(adminConfig).toLowerCase().split(',');
  return Array.isArray(admins) && admins.includes(String(email).toLowerCase());
};

export const getAdminPassword = () => getEnv('VITE_PASSW');

export const rotateApiKey = () => win.process.env.API_KEY;
export const getActiveApiKey = () => win.process?.env?.API_KEY || getEnv('VITE_GEMINI_API_1');

export const auditApiKeys = () => ({
  slot1: !!getEnv('VITE_GEMINI_API_1'),
  slot2: !!getEnv('VITE_GEMINI_API_2'),
  slot3: !!getEnv('VITE_GEMINI_API_3'),
  currentActive: 'TERPASANG',
  activeSlot: 1
});

export const getSystemSettings = async () => {
  try {
    const { data } = await supabase.from('settings').select('*');
    const settings: Record<string, any> = { cost_image: 25, cost_video: 150, cost_voice: 150, cost_studio: 600 };
    data?.forEach(item => { settings[item.key] = item.value; });
    return settings;
  } catch (e) { return { cost_image: 25, cost_video: 150, cost_voice: 150, cost_studio: 600 }; }
};

export const updateSystemSetting = async (key: string, value: any) => {
  return await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
};

export const approveTopup = async (requestId: string | number, email: string, amount: number) => {
  try {
    if (!email || typeof email !== 'string') return false;
    const currentCredits = await getUserCredits(email);
    await supabase.from('members').update({ credits: Number(currentCredits) + Number(amount) }).eq('email', String(email).toLowerCase());
    await supabase.from('topup_requests').update({ status: 'approved' }).eq('id', requestId);
    sendTelegramNotification(`✅ *TOPUP SUCCESS*\nUser: ${email}\n+${amount} CR`);
    return true;
  } catch (e) { return false; }
};

export const manualUpdateCredits = async (email: string, newCredits: number) => {
  if (!email || typeof email !== 'string') return false;
  return !(await supabase.from('members').update({ credits: newCredits }).eq('email', String(email).toLowerCase())).error;
};

export const requestTopup = async (email: string, amount: number, price: number, receiptB64: string) => {
  if (!email || typeof email !== 'string') throw new Error("Email required");
  const tid = `SAT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const { error } = await supabase.from('topup_requests').insert([{
    tid, email: String(email).toLowerCase(), amount, price, receipt_url: receiptB64, status: 'pending'
  }]);
  if (error) throw error;
  sendTelegramNotification(`💰 *TOPUP REQUEST*\nUser: ${email}\nAmount: ${amount} CR\nID: ${tid}`);
  return { success: true, tid };
};
