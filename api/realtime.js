// /api/realtime.js
// Disable body parsing so we can proxy raw SDP
export const config = {
    api: {
      bodyParser: false
    }
  };
  
  export default async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).end('Method Not Allowed');
    }
  
    const model = 'gpt-4o-mini-realtime-preview-2024-12-17';
  
    try {
      const answer = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
          method: 'POST',
          headers: {
            'Content-Type':  req.headers['content-type'],
            'Authorization': req.headers['authorization']
          },
          body: req.body
        }
      );
  
      const sdp = await answer.text();
      res.status(answer.status).send(sdp);
    } catch (err) {
      console.error('Error proxying realtime SDP:', err);
      res.status(500).send('Internal Server Error');
    }
  }
  