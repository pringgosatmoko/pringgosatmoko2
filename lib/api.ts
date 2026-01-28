
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
  if (!url || !url.startsWith('http')) return createClient("https://dummy.supabase.co", "key");
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

// --- MIDTRANS INTEGRATION (ULTIMATE AUTOMATION) ---
export const initMidtransPayment = async (email: string, amount: number, plan: string) => {
  try {
    // Panggil Bridge API internal (tanpa mengirim serverId dari client demi keamanan)
    const response = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, amount, plan })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Gateway Bridge Failure');
    }
    
    const orderId = `SAT-MID-${Date.now()}`;
    
    // Log transaksi ke database
    await supabase.from('topup_requests').insert([{
      tid: orderId,
      email: email.toLowerCase(),
      amount: plan === '1B' ? 1000 : plan === '3B' ? 3500 : 15000,
      price: amount,
      status: 'waiting_payment'
    }]);

    return { success: true, snapToken: data.token, orderId };
  } catch (err: any) {
    console.error("Critical Gateway Error:", err);
    return { success: false, error: err.message };
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
  const { data } = await supabase.from('members').select('credits').eq('email', email.toLowerCase()).single();
  return data?.credits || 0;
};

export const deductCredits = async (email: string, amount: number): Promise<boolean> => {
  if (isAdmin(email)) return true;
  const current = await getUserCredits(email);
  if (current < amount) return false;
  const { error } = await supabase.from('members').update({ credits: current - amount }).eq('email', email.toLowerCase());
  return !error;
};

export const updateMemberStatus = async (email: string, status: string, validUntil?: string | null) => {
  const updateData: any = { status };
  if (validUntil !== undefined) updateData.valid_until = validUntil;
  return !(await supabase.from('members').update(updateData).eq('email', email.toLowerCase())).error;
};

export const deleteMember = async (email: string) => {
  return !(await supabase.from('members').delete().eq('email', email.toLowerCase())).error;
};

export const updatePresence = async (email: string) => {
  if (!email) return;
  await supabase.from('members').upsert({ email: email.toLowerCase(), last_seen: new Date().toISOString(), status: 'active' }, { onConflict: 'email' });
};

export const isUserOnline = (lastSeen: string | null | undefined) => {
  if (!lastSeen) return false;
  return (new Date().getTime() - new Date(lastSeen).getTime()) / 1000 < 150; 
};

export const isAdmin = (email: string) => {
  const admins = (getEnv('VITE_ADMIN_EMAILS') || 'pringgosatmoko@gmail.com').toLowerCase().split(',');
  return admins.includes(email.toLowerCase());
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
    const currentCredits = await getUserCredits(email);
    await supabase.from('members').update({ credits: Number(currentCredits) + Number(amount) }).eq('email', email.toLowerCase());
    await supabase.from('topup_requests').update({ status: 'approved' }).eq('id', requestId);
    sendTelegramNotification(`✅ *TOPUP SUCCESS*\nUser: ${email}\n+${amount} CR`);
    return true;
  } catch (e) { return false; }
};

export const manualUpdateCredits = async (email: string, newCredits: number) => {
  return !(await supabase.from('members').update({ credits: newCredits }).eq('email', email.toLowerCase())).error;
};

export const requestTopup = async (email: string, amount: number, price: number, receiptB64: string) => {
  const tid = `SAT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const { error } = await supabase.from('topup_requests').insert([{
    tid, email: email.toLowerCase(), amount, price, receipt_url: receiptB64, status: 'pending'
  }]);
  if (error) throw error;
  sendTelegramNotification(`💰 *TOPUP REQUEST*\nUser: ${email}\nAmount: ${amount} CR\nID: ${tid}`);
  return { success: true, tid };
};
