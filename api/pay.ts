// Vercel Serverless Function - Master High-Stability Bridge (Node.js Runtime)
export default async function handler(req, res) {
  // Tambahkan Header CORS secara manual agar tidak diblokir browser
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, amount, plan } = req.body;
    
    // Deteksi Kunci: Cek VITE_MIDTRANS_SERVER_ID atau MIDTRANS_SERVER_ID
    // Vercel Backend bisa membaca keduanya, tergantung apa yang Master input di Dashboard
    const serverKey = process.env.VITE_MIDTRANS_SERVER_ID || process.env.MIDTRANS_SERVER_ID;
    
    if (!serverKey) {
      console.error("[CRITICAL] Server Key tidak ditemukan di Vercel Env!");
      return res.status(500).json({ 
        error: 'SERVER_KEY_MISSING',
        details: 'Master belum memasukkan VITE_MIDTRANS_SERVER_ID di Environment Variables Vercel.'
      });
    }

    // Fix: Access Buffer via globalThis and cast to any to resolve TypeScript 'Cannot find name Buffer' error in Node.js environment
    const authHeader = `Basic ${(globalThis as any).Buffer.from(serverKey + ":").toString('base64')}`;
    const orderId = `SAT-MID-${Date.now()}`;

    console.log(`[PAYMENT] Processing: ${email}, Amount: ${amount}, OrderID: ${orderId}`);

    const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        customer_details: { email: email.toLowerCase() },
        item_details: [{ id: plan, price: amount, quantity: 1, name: `Satmoko Studio ${plan}` }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Midtrans API Error:", data);
      return res.status(response.status).json({ 
        error: 'MIDTRANS_REJECTED', 
        details: data.error_messages ? data.error_messages[0] : 'Cek Log Midtrans' 
      });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error("Serverless Function Crash:", error.message);
    return res.status(500).json({ 
      error: "INTERNAL_SERVER_ERROR", 
      details: error.message,
      suggestion: "Pastikan Server Key di Vercel sudah benar untuk mode Sandbox."
    });
  }
}