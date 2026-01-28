// Vercel Serverless Function - Master High-Stability Bridge (Node.js Runtime)
export default async function handler(req, res) {
  // CORS Headers - Set immediately to prevent browser "Failed to fetch" on errors
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
    
    // Deteksi Kunci Master - Mendukung prefix VITE_ maupun tidak
    const serverKey = process.env.VITE_MIDTRANS_SERVER_ID || process.env.MIDTRANS_SERVER_ID;
    
    if (!serverKey) {
      console.error("[MIDTRANS] Server Key missing!");
      return res.status(500).json({ 
        error: 'SERVER_KEY_NOT_FOUND',
        details: 'Pastikan VITE_MIDTRANS_SERVER_ID diatur di Vercel Dashboard.'
      });
    }

    // Auth Header using btoa (Standard in Node.js 16+ and Browsers)
    // Fix: Using btoa instead of Buffer to resolve TypeScript error in serverless environments
    const authHeader = `Basic ${btoa(serverKey + ":")}`;
    const orderId = `SAT-MID-${Date.now()}`;

    console.log(`[PAYMENT_START] Order: ${orderId} for ${email}`);

    // Fetch Midtrans with AbortController to handle potential hang/timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 seconds limit

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
      console.error("[MIDTRANS_REJECTED]", data);
      return res.status(response.status).json({ 
        error: 'GATEWAY_ERROR', 
        details: data.error_messages ? data.error_messages[0] : 'Midtrans rejected the request' 
      });
    }

    console.log(`[PAYMENT_SUCCESS] Token issued for ${orderId}`);
    return res.status(200).json(data);

  } catch (error: any) {
    console.error("[SERVER_ERROR]", error.name === 'AbortError' ? 'Request Timeout' : error.message);
    
    const isTimeout = error.name === 'AbortError';
    return res.status(500).json({ 
      error: isTimeout ? 'GATEWAY_TIMEOUT' : 'INTERNAL_SERVER_ERROR', 
      details: isTimeout ? 'Midtrans Sandbox merespon terlalu lama.' : error.message,
      suggestion: "Cek koneksi internet atau status Midtrans Sandbox."
    });
  }
}