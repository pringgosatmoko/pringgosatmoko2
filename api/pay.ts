
// Vercel Serverless Function - Master High-Stability Bridge (Node.js Runtime)
export default async function handler(req, res) {
  // CORS Headers - WAJIB di paling atas agar browser tidak blokir respon error
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Fix: Manual Base64 encoding function to avoid missing Buffer error in some TS environments
  const encodeBase64 = (str: string) => {
    try {
      if (typeof btoa !== 'undefined') return btoa(str);
      // Fallback to Buffer if available in Node
      // @ts-ignore
      if (typeof Buffer !== 'undefined') return Buffer.from(str).toString('base64');
      return "";
    } catch (e) {
      return "";
    }
  };

  try {
    const { email, amount, plan } = req.body;
    const serverKey = process.env.VITE_MIDTRANS_SERVER_ID || process.env.MIDTRANS_SERVER_ID;
    
    if (!serverKey) {
      return res.status(500).json({ error: 'SERVER_KEY_NOT_FOUND' });
    }

    // Fix: Using manual encodeBase64 instead of Buffer directly to resolve "Cannot find name 'Buffer'"
    const authHeader = `Basic ${encodeBase64(serverKey + ":")}`;
    const orderId = `SAT-MID-${Date.now()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000); // Batas 9 detik

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
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: 'MIDTRANS_ERROR', details: data });
    }

    return res.status(200).json(data);

  } catch (error: any) {
    console.error("[PAY_API_CRASH]", error.message);
    return res.status(500).json({ 
      error: 'SERVER_CRASH', 
      details: error.message,
      suggestion: "Cek apakah Server Key Midtrans sudah benar di Env Vercel."
    });
  }
}
