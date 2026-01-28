
// Vercel Serverless Function - Standard Node.js Runtime
export default async function handler(req, res) {
  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, amount, plan } = req.body;
    
    // Ambil Server ID dari Environment Variable
    const serverId = process.env.VITE_MIDTRANS_SERVER_ID;
    
    if (!serverId) {
      return res.status(500).json({ error: 'SERVER_ID_MISSING' });
    }

    // Gunakan btoa untuk auth header
    const authHeader = `Basic ${btoa(serverId + ":")}`;
    const orderId = `SAT-MID-${Date.now()}`;

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
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
