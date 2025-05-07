// /api/session.js
export default async function handler(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).end('Method Not Allowed');
    }
  
    try {
      const openaiRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-realtime-preview-2024-12-17',
          voice: 'coral'
        }),
      });
  
      const data = await openaiRes.json();
      if (!openaiRes.ok) {
        console.error('Error creating realtime session:', data);
        return res.status(openaiRes.status).json(data);
      }
  
      // Return the entire session object, including client_secret.value
      return res.status(200).json(data);
    } catch (err) {
      console.error('Network error creating realtime session:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
  