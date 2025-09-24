// Main interaction logic for the Websim demo
// Mobile-first, simple, uses global `websim` object (provided by the environment)

// Replace early DOM lookups with safe queries and fallbacks
const promptEl = document.getElementById("prompt") || { value: "" };
const ttsBtn = document.getElementById("ttsBtn");
const imageBtn = document.getElementById("imageBtn");
const chatBtn = document.getElementById("chatBtn");
const fileInput = document.getElementById("fileInput");

const audioArea = document.getElementById("audioArea") || document.createElement("div");
const imageArea = document.getElementById("imageArea") || document.createElement("div");
const chatArea = document.getElementById("chatArea") || document.createElement("div");
const uploadArea = document.getElementById("uploadArea") || document.createElement("div");

function setLoading(el, msg = "Working…") {
  el.innerHTML = `<em style="color:#999">${msg}</em>`;
}

function showError(el, err) {
  el.innerHTML = `<span style="color:#b00">${String(err)}</span>`;
}

// Text-to-Speech: generate audio and play
ttsBtn.addEventListener("click", async () => {
  const text = (promptEl.value || "").trim();
  if (!text) return;
  ttsBtn.disabled = true;
  setLoading(audioArea, "Generating speech… (10s expected)");
  try {
    const result = await websim.textToSpeech({
      text,
      voice: "en-male", // simple default
    });
    // result.url is an MP3 URL
    audioArea.innerHTML = "";
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = result.url;
    audioArea.appendChild(audio);
    // autoplay if allowed
    try { await audio.play().catch(()=>{}); } catch(e){}
  } catch (err) {
    showError(audioArea, err);
  } finally {
    ttsBtn.disabled = false;
  }
});

// Image generation demo
imageBtn.addEventListener("click", async () => {
  const prompt = (promptEl.value || "A stylish simple hero illustration of AI").trim();
  imageBtn.disabled = true;
  setLoading(imageArea, "Generating image… (≈10s)");
  try {
    const out = await websim.imageGen({
      prompt,
      aspect_ratio: "3:4",
    });
    imageArea.innerHTML = "";
    const img = document.createElement("img");
    img.className = "generated";
    img.alt = `Generated: ${prompt}`;
    img.src = out.url;
    imageArea.appendChild(img);
  } catch (err) {
    showError(imageArea, err);
  } finally {
    imageBtn.disabled = false;
  }
});

// Chat completion demo (uses last 10 messages pattern internally)
chatBtn.addEventListener("click", async () => {
  const text = (promptEl.value || "").trim();
  chatBtn.disabled = true;
  setLoading(chatArea, "Asking the AI…");
  try {
    const completion = await websim.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a concise demo assistant summarizing capabilities of Websim AI.",
        },
        {
          role: "user",
          content: text || "What can Websim do?",
        },
      ],
    });
    chatArea.innerHTML = "";
    const p = document.createElement("div");
    p.textContent = completion.content;
    chatArea.appendChild(p);

    // Optionally generate TTS for the chat reply (small button)
    const speakBtn = document.createElement("button");
    speakBtn.textContent = "Speak reply";
    speakBtn.style.marginTop = "8px";
    speakBtn.addEventListener("click", async () => {
      setLoading(audioArea, "Generating reply speech…");
      try {
        const tts = await websim.textToSpeech({
          text: completion.content,
          voice: "en-female",
        });
        audioArea.innerHTML = "";
        const a = document.createElement("audio");
        a.controls = true;
        a.src = tts.url;
        audioArea.appendChild(a);
        try { await a.play().catch(()=>{}); } catch(e){}
      } catch (err) { showError(audioArea, err); }
    });
    chatArea.appendChild(speakBtn);
  } catch (err) {
    showError(chatArea, err);
  } finally {
    chatBtn.disabled = false;
  }
});

// File upload demo (returns a hosted URL)
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  setLoading(uploadArea, "Uploading…");
  try {
    const url = await websim.upload(file);
    uploadArea.innerHTML = "";
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = url;
    uploadArea.appendChild(link);

    // If image, preview it
    if (file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = url;
      img.className = "generated";
      img.style.marginTop = "8px";
      uploadArea.appendChild(img);
    }
  } catch (err) {
    showError(uploadArea, err);
  }
});

// replace existing DOM queries and handlers with full-screen speak flow
const speakBtn = document.getElementById("speakBtn");
const visual = document.getElementById("visual");
const status = document.getElementById("status");
const chatOverlay = document.getElementById("chatOverlay");

async function setStatus(txt){ status.textContent = txt; }

async function runFlow(promptText){
  try{
    setStatus("Generating image…");
    const imgRes = await websim.imageGen({ prompt: promptText, aspect_ratio: "3:4" });
    visual.style.backgroundImage = `url(${imgRes.url})`;

    setStatus("Asking AI for narration…");
    const completion = await websim.chat.completions.create({
      messages: [
        { role: "system", content: "You are a concise demo narrator describing Websim AI capabilities in an engaging voice." },
        { role: "user", content: promptText }
      ]
    });

    chatOverlay.textContent = completion.content;
    setStatus("Generating speech… (10s)");
    const tts = await websim.textToSpeech({ text: completion.content, voice: "en-male" });

    // play audio
    const audio = new Audio(tts.url);
    audio.play().catch(()=>{});
    setStatus("Playing clip — tap to speak again");
  }catch(err){
    setStatus("Error: " + String(err));
  }
}

// Speech recognition (mobile-first, fallback to text prompt)
function startRecognition(){
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    const text = prompt("Speech not supported — type your prompt:");
    if (text) runFlow(text);
    return;
  }
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new Rec();
  r.lang = 'en-US';
  r.interimResults = false;
  r.maxAlternatives = 1;
  setStatus("Listening…");
  r.start();
  r.onresult = (ev) => {
    const spoken = ev.results[0][0].transcript;
    setStatus("Heard: " + spoken);
    runFlow(spoken);
  };
  r.onerror = (e) => { setStatus("Recognition error"); };
  r.onend = ()=> { /* do nothing */ };
}

speakBtn.addEventListener("click", () => {
  setStatus("Preparing microphone…");
  startRecognition();
});