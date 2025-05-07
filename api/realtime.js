// Disable body parsing so we get raw SDP
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const model = "gpt-4o-mini-realtime-preview-2024-12-17";
  const answer = await fetch(
    `https://api.openai.com/v1/realtime?model=${model}`, {
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"],
        "Authorization": req.headers.authorization
      },
      body: req.body
    }
  );
  const sdp = await answer.text();
  res.status(answer.status).send(sdp);
}
