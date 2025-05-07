import OpenAI from "openai";

export default async function handler(req, res) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // returns { value: "sk-..." }
  const key = await openai.realtime.createEphemeralKey();
  res.status(200).json({ client_secret: key });
}
