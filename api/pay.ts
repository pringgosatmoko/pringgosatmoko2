// Vercel Serverless Function - Master Stable Bridge (Node.js Runtime)
export default async function handler(req, res) {
  // Tambahkan Header CORS secara manual untuk keamanan ekstra di mobile
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
    const serverId = process.env.VITE_MIDTRANS_SERVER_ID;
    
    if (!serverId) {
      console.error("CRITICAL: VITE_MIDTRANS_SERVER_ID is missing in Vercel Env.");
      return res.status(500).json({ error: 'SERVER_ID_MISSING' });
    }

    // Fix: Use btoa instead of Buffer to avoid 'Cannot find name Buffer' error in TypeScript
    const authHeader = `Basic ${btoa(serverId + ":")}`;
    const orderId = `SAT-MID-${Date.now()}`;

    console.log(`Processing payment for ${email}, amount: ${amount}, order: ${orderId}`);

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
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Serverless Function Crash:", error.message);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", details: error.message });
  }
}