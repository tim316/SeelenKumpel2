import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.static("public"));

app.get("/session", async (req, res) => {
  // Mint an ephemeral key for the client
  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-realtime-preview-2024-12-17", // or gpt-4o-realtime-preview
      voice: "coral",                // choose your voice
    }),
  });
  const data = await r.json();
  res.json(data);
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
