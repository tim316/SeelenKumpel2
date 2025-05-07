// /api/realtime.js
import getRawBody from "raw-body";

export const config = {
  api: {
    bodyParser: false,   // ← allow us to read the raw SDP
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  // 1) grab the raw SDP offer from the client
  let offerSdp;
  try {
    offerSdp = (await getRawBody(req)).toString("utf-8");
  } catch (err) {
    console.error("Could not read raw body:", err);
    return res.status(500).send("Error reading request");
  }

  // 2) forward it to OpenAI’s realtime endpoint
  const model = "gpt-4o-mini-realtime-preview-2024-12-17";
  let openaiRes, answerText;
  try {
    openaiRes = await fetch(
      `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
      {
        method: "POST",
        headers: {
          "Authorization": req.headers.authorization, // should be "Bearer <ephemeral_key>"
          "Content-Type": "application/sdp",
        },
        body: offerSdp,
      }
    );
    answerText = await openaiRes.text();
  } catch (err) {
    console.error("Network error proxying to OpenAI:", err);
    return res.status(502).send("Bad Gateway");
  }

  // 3) if OpenAI returned an error (400, 401, etc.), forward that JSON/text
  if (!openaiRes.ok) {
    console.error("OpenAI realtime error:", openaiRes.status, answerText);
    return res.status(openaiRes.status).send(answerText);
  }

  // 4) success! return the raw SDP back to the browser
  res.setHeader("Content-Type", "application/sdp");
  res.status(200).send(answerText);
}
