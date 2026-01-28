
// Vercel Serverless Function - Master High-Stability Bridge (Node.js Runtime)
export default async function handler(req, res) {
  // Fungsi pembantu untuk set headers secara konsisten
  const setCorsHeaders = (response) => {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
  };

  // Selalu set headers di awal
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, amount, plan } = req.body;
    
    // Deteksi Kunci Master
    const serverKey = process.env.VITE_MIDTRANS_SERVER_ID || process.env.MIDTRANS_SERVER_ID;
    
    if (!serverKey) {
      console.error("[CRITICAL] Server Key tidak ditemukan!");
      return res.status(500).json({ 
        error: 'SERVER_KEY_MISSING',
        details: 'Variabel lingkungan VITE_MIDTRANS_SERVER_ID belum diatur di Vercel Dashboard.'
      });
    }

    // Encoding paling aman untuk Node.js
    // Fix: Using (Buffer as any) to resolve TypeScript error when node types are not available
    const authHeader = `Basic ${(Buffer as any).from(serverKey + ":").toString('base64')}`;
    const orderId = `SAT-MID-${Date.now()}`;

    console.log(`[PAYMENT_INIT] ${email} - Order: ${orderId}`);

    const midtransResponse = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
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

    const data = await midtransResponse.json();

    if (!midtransResponse.ok) {
      console.error("[MIDTRANS_ERROR]", data);
      return res.status(midtransResponse.status).json({ 
        error: 'MIDTRANS_API_ERROR', 
        details: data.error_messages ? data.error_messages[0] : 'Gagal memproses ke Midtrans' 
      });
    }

    // Sukses
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("[SERVERLESS_CRASH]", error.message);
    // PASTIKAN headers tetap ada meskipun error
    setCorsHeaders(res);
    return res.status(500).json({ 
      error: "INTERNAL_SERVER_ERROR", 
      details: error.message,
      suggestion: "Cek Log Vercel Master untuk detail lebih lanjut."
    });
  }
}
