console.log("app.js loaded");

// Standard therapy instructions
const therapyInstructions = `
Du bist SeelenKumpel,du redest mit deutschem Akzent, ein einfühlsamer, vertrauensvoller KI-Therapeut. Du führst das Gespräch auf ruhige, respektvolle und aufmerksam-zuhörende Weise. Antworte stets empathisch, validiere Gefühle und stelle offene Fragen, um deinem Gegenüber zu helfen, Gedanken und Emotionen zu erkunden. Halte stets einen unterstützenden und nicht-wertenden Ton.

Assistant (TheraVoice) – erste Äußerung:
„Hallo! Wie kann ich dir heute helfen?“

Weitere Verhaltensregeln:

Aktives Zuhören: Fasse gelegentlich zusammen, was dein Gegenüber sagt („Wenn ich dich richtig verstehe, …“).

Validierung: Erkenne Emotionen an („Das klingt herausfordernd, das kann sehr belastend sein.“).

Offene Fragen: Fördere Reflexion („Was denkst du, könnte dir in dieser Situation helfen?“）。

Ressourcenorientierung: Lenke den Blick auf Stärken („Welche deiner Fähigkeiten haben dir schon früher geholfen?“）。

Grenzen wahren: Gib keine medizinischen Diagnosen oder rechtlichen Ratschläge, sondern ermutige bei Bedarf, professionelle Hilfe zu suchen。

Abschluss: Fasse am Ende einer Sitzung kurz zusammen und frage, ob noch etwas offen ist („Gibt es noch etwas, worüber du sprechen möchtest?“）。
`;

// Gen-Z mode instructions
const genZInstructions = `
Du bist SeelenKumpel, ein empathischer KI-Therapeut mit deutschem Akzent und dezentem Gen-Z-Vibe. Du redest in kurzen, lockeren Sätzen, streust sparsam englische Slang-Wörter ein (z. B. “no cap”, “slay”, “vibes”), bleibst aber stets respektvoll, ruhig und aufmerksam-zuhörend.

Assistant (TheraVoice) – erste Äußerung:
“Hey, was geht? Wie kann ich dich heute supporten?”

Guidelines:

Empathie & Validierung: “Ich fühl das gerade voll bei dir.”

Offene Fragen: “Was geht da gerade in dir ab?”

Stärken betonen: “Du hast schon so viel gerockt, echt slay.”

Sanfte Vorschläge: “Vielleicht hilft’s, mal … auszuprobieren.”

Nicht-wertend & unterstützend: Immer wohlwollend und aufmerksam bleiben.

Call-to-Action: “Alles klar bei dir? Noch was aufm Herzen?”
`;

const startBtn   = document.querySelector("#start");
const endBtn     = document.querySelector("#end");
const clearBtn   = document.querySelector("#clear");
const genzChk    = document.querySelector("#genz");
const micSel     = document.querySelector("#micSelect");
const speakBtn   = document.querySelector("#speak");
const transcript = document.querySelector("#transcript");

let pc, dc;
let localStream; // Tracks the current mic stream

// Request permission and populate mic list
async function init() {
  console.log("Requesting mic permission...");
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Mic permission granted");
  } catch (err) {
    console.error("Mic permission denied:", err);
  }
  await listMics();
}

// Enumerate and display audioinput devices
async function listMics() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === "audioinput");
    micSel.innerHTML = "";
    audioInputs.forEach(d => {
      const label = d.label || `Mic ${micSel.length + 1}`;
      micSel.add(new Option(label, d.deviceId));
    });
  } catch (err) {
    console.error("Error listing mics:", err);
  }
}

init();

// Start realtime session
startBtn.onclick = async () => {
  // Prevent toggling mid-session
  genzChk.disabled = true;
  startBtn.disabled = true;
  endBtn.disabled = false;

  // Choose instructions based on Gen-Z checkbox
  const instructions = genzChk.checked ? genZInstructions : therapyInstructions;

  // 1) Mint ephemeral key
  let EPHEMERAL_KEY;
  try {
    const res = await fetch("/api/session");
    EPHEMERAL_KEY = (await res.json()).client_secret.value;
  } catch (err) {
    console.error("Error fetching session key:", err);
    alert("Failed to start session. Check console.");
    return;
  }

  // 2) Create RTCPeerConnection
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  pc.onicecandidate = e => console.log("ICE candidate:", e);
  pc.oniceconnectionstatechange = () =>
    console.log("ICE state:", pc.iceConnectionState);
  pc.ontrack = e => {
    const audio = new Audio();
    audio.srcObject = e.streams[0];
    audio.play().catch(err => console.error("Play error:", err));
  };

  // 3) Data channel
  dc = pc.createDataChannel("oai-events");
  dc.onopen = () => {
    // Send selected instructions
    dc.send(
      JSON.stringify({
        type: "session.update",
        session: { instructions }
      })
    );
  };
  dc.onmessage = e => handleEvent(JSON.parse(e.data));
  dc.onerror = err => console.error("DC error:", err);
  dc.onclose = () => console.log("DC closed");

  // 4) Add mic track & enable mid-session swapping
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: micSel.value }
    });
    localStream.getAudioTracks().forEach(track => pc.addTrack(track, localStream));

    micSel.onchange = async () => {
      if (!pc || pc.iceConnectionState === "closed") return;
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: micSel.value }
        });
        const newTrack = newStream.getAudioTracks()[0];
        const sender = pc.getSenders().find(s => s.track?.kind === "audio");
        if (sender) {
          await sender.replaceTrack(newTrack);
          localStream.getTracks().forEach(t => t.stop());
          localStream = newStream;
        }
      } catch (err) {
        console.error("Error switching mic:", err);
        alert("Could not switch microphone. Check permissions.");
      }
    };
  } catch (err) {
    console.error("Error accessing mic:", err);
    alert("Cannot access mic. Check permissions.");
    return;
  }

  // 5) WebRTC handshake via serverless proxy
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const answerRes = await fetch("/api/realtime", {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        Authorization: `Bearer ${EPHEMERAL_KEY}`
      },
      body: offer.sdp
    });
    const answerSdp = await answerRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  } catch (err) {
    console.error("Handshake error:", err);
    alert("Handshake failed. See console.");
  }
};

// End session
endBtn.onclick = () => {
  dc?.close();
  pc?.close();
  startBtn.disabled = false;
  endBtn.disabled = true;
  genzChk.disabled = false;
};

// Push-to-talk
speakBtn.addEventListener("mousedown", () => {
  transcript.innerText += "\n▶ [listening...]";
  dc?.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
});
speakBtn.addEventListener("mouseup", () => {
  dc?.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  dc?.send(JSON.stringify({ type: "response.create" }));
});

// Clear transcript
clearBtn.onclick = () => (transcript.innerText = "");

// Handle incoming events
function handleEvent(event) {
  switch (event.type) {
    case "response.text.delta":
      transcript.innerText += event.delta;
      break;
    case "response.done":
      transcript.innerText += "\n";
      break;
    case "error":
      alert(`Error: ${event.error.message}`);
      break;
  }
}
