
// Vercel Serverless Function - Master High-Stability Bridge (Node.js Runtime)
export default async function handler(req: any, res: any) {
  // CORS Headers - Set immediately to avoid "Failed to fetch" on browser
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

  try {
    const { email, amount, plan } = req.body;
    const serverKey = process.env.VITE_MIDTRANS_SERVER_ID || process.env.MIDTRANS_SERVER_ID;
    
    if (!serverKey) {
      console.error("[MIDTRANS_ERROR] SERVER_KEY missing");
      return res.status(500).json({ error: 'SERVER_KEY_NOT_FOUND' });
    }

    // Menggunakan btoa() untuk encoding Basic Auth - Aman untuk Node.js modern di Vercel
    const authHeader = 'Basic ' + btoa(serverKey + ':');
    const orderId = `SAT-MID-${Date.now()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); 

    const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        customer_details: { email: String(email || "").toLowerCase() },
        item_details: [{ id: String(plan || "1B"), price: amount, quantity: 1, name: `Satmoko Studio ${plan}` }]
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
    const errorMsg = String(error.message || "");
    const isTimeout = error.name === 'AbortError' || errorMsg.includes('timeout');
    
    return res.status(500).json({ 
      error: isTimeout ? 'GATEWAY_TIMEOUT' : 'SERVER_CRASH', 
      details: isTimeout ? 'Gateway timed out' : errorMsg
    });
  }
}
