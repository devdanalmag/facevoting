export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify secret key (optional but recommended)
  if (req.headers.authorization !== `Bearer ${process.env.API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const scriptUrl = 'https://script.google.com/.../exec'; // Your Google Script URL

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) throw new Error('Google Script failed');
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to save voter data',
      details: error.message 
    });
  }
}