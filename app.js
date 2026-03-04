// Speed Reading Video Maker (RSVP)
// - One-word-at-a-time playback with adjustable WPM
// - Canvas rendering for video export via MediaRecorder

const els = {
  fileInput: document.getElementById("fileInput"),
  textInput: document.getElementById("textInput"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  prepareBtn: document.getElementById("prepareBtn"),

  wordDisplay: document.getElementById("wordDisplay"),
  progressText: document.getElementById("progressText"),

  backBtn: document.getElementById("backBtn"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  nextBtn: document.getElementById("nextBtn"),

  wpmSlider: document.getElementById("wpmSlider"),
  wpmLabel: document.getElementById("wpmLabel"),
  slowerBtn: document.getElementById("slowerBtn"),
  fasterBtn: document.getElementById("fasterBtn"),

  seekBar: document.getElementById("seekBar"),
  timeNow: document.getElementById("timeNow"),
  timeTotal: document.getElementById("timeTotal"),

  wordCount: document.getElementById("wordCount"),
  estWpm: document.getElementById("estWpm"),
  estDuration: document.getElementById("estDuration"),

  orpToggle: document.getElementById("orpToggle"),
  resolutionSelect: document.getElementById("resolutionSelect"),
  fpsSelect: document.getElementById("fpsSelect"),
  recordBtn: document.getElementById("recordBtn"),
  stopRecordBtn: document.getElementById("stopRecordBtn"),
  recordStatus: document.getElementById("recordStatus"),
  downloadLink: document.getElementById("downloadLink"),

  videoCanvas: document.getElementById("videoCanvas"),
};

let words = [];
let index = 0;

let playing = false;
let timerId = null;
let nextTickAt = 0;

let wpm = clamp(parseInt(els.wpmSlider.value, 10) || 300, 60, 900);

let recorder = null;
let recordedChunks = [];
let recording = false;

const canvas = els.videoCanvas;
const ctx = canvas.getContext("2d");

init();

function init() {
  refreshWpmUI();
  updateStats();

  els.fileInput.addEventListener("change", onFileSelected);
  els.loadSampleBtn.addEventListener("click", loadSample);
  els.clearBtn.addEventListener("click", clearAll);
  els.prepareBtn.addEventListener("click", prepareWords);

  els.playPauseBtn.addEventListener("click", togglePlayPause);
  els.backBtn.addEventListener("click", () => step(-1));
  els.nextBtn.addEventListener("click", () => step(+1));

  els.wpmSlider.addEventListener("input", (e) => {
    wpm = clamp(parseInt(e.target.value, 10) || 300, 60, 900);
    refreshWpmUI();
    updateStats();
  });

  els.slowerBtn.addEventListener("click", () => bumpWpm(-10));
  els.fasterBtn.addEventListener("click", () => bumpWpm(+10));

  els.seekBar.addEventListener("input", (e) => {
    const v = parseInt(e.target.value, 10) || 0;
    index = clamp(v, 0, Math.max(0, words.length - 1));
    renderCurrentWord();
    updateProgressUI();
  });

  els.recordBtn.addEventListener("click", startRecording);
  els.stopRecordBtn.addEventListener("click", stopRecording);

  document.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) {
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
    }
    if (e.code === "ArrowLeft") step(-1);
    if (e.code === "ArrowRight") step(+1);
  });

  // Initial canvas draw
  resizeCanvasFromSelect();
  renderCurrentWord();
  updateProgressUI();
}

function onFileSelected() {
  const file = els.fileInput.files && els.fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    els.textInput.value = String(reader.result || "");
    updateStats();
  };
  reader.readAsText(file);
}

function loadSample() {
  els.textInput.value =
`This is a sample passage.
Paste or upload your own book text, then click “Prepare words”.
Press spacebar to play/pause, and export to a video when ready.`;
  updateStats();
}

function clearAll() {
  stopPlayback();
  if (recording) stopRecording();

  els.textInput.value = "";
  words = [];
  index = 0;

  els.downloadLink.style.display = "none";
  els.downloadLink.href = "#";

  renderCurrentWord();
  updateProgressUI();
  updateStats();
}

function prepareWords() {
  stopPlayback();
  if (recording) stopRecording();

  const text = (els.textInput.value || "").trim();
  words = tokenize(text);
  index = 0;

  els.seekBar.max = Math.max(0, words.length - 1);
  els.seekBar.value = "0";

  renderCurrentWord();
  updateProgressUI();
  updateStats();
}

function tokenize(text) {
  if (!text) return [];

  // Keeps punctuation attached to words reasonably well.
  // For more advanced segmentation (languages), consider Intl.Segmenter.
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim();

  // Split on spaces, but keep em-dashes and punctuation attached.
  // Example tokens: ["Hello,", "world!", "—", "test"]
  const raw = normalized.split(" ");

  // Remove empty tokens
  return raw.map(t => t.trim()).filter(Boolean);
}

function togglePlayPause() {
  if (!words.length) {
    // If user forgot to prepare, do it automatically.
    prepareWords();
  }
  if (!words.length) return;

  playing ? stopPlayback() : startPlayback();
}

function startPlayback() {
  if (playing) return;
  playing = true;
  els.playPauseBtn.textContent = "Pause";

  // Drift-corrected scheduling loop using performance.now()
  nextTickAt = performance.now();
  scheduleNextTick();
}

function scheduleNextTick() {
  if (!playing) return;

  const intervalMs = 60000 / wpm;

  // If we're at the end, stop.
  if (index >= words.length) {
    stopPlayback();
    if (recording) stopRecording();
    return;
  }

  renderCurrentWord();
  updateProgressUI();

  // advance for next tick
  index = Math.min(index + 1, words.length);

  nextTickAt += intervalMs;
  const delay = Math.max(0, nextTickAt - performance.now());

  timerId = window.setTimeout(scheduleNextTick, delay);
}

function stopPlayback() {
  playing = false;
  els.playPauseBtn.textContent = "Play";
  if (timerId) window.clearTimeout(timerId);
  timerId = null;
}

function step(delta) {
  if (!words.length) return;
  index = clamp(index + delta, 0, words.length - 1);
  renderCurrentWord();
  updateProgressUI();
}

function renderCurrentWord() {
  const total = words.length;
  const safeIndex = clamp(index, 0, Math.max(0, total - 1));
  const word = total ? words[safeIndex] : "—";

  // Stage display (HTML)
  els.wordDisplay.innerHTML = formatWordHTML(word, els.orpToggle.checked);
  // Canvas display (for video)
  drawCanvasWord(word);
}

function formatWordHTML(word, orp) {
  if (!orp) return escapeHtml(word);

  // ORP: highlight a central-ish character to aid recognition.
  const i = orpIndex(word);
  if (i < 0) return escapeHtml(word);

  const a = escapeHtml(word.slice(0, i));
  const b = escapeHtml(word.slice(i, i + 1));
  const c = escapeHtml(word.slice(i + 1));
  return `${a}<span style="color: #2dd4bf; text-shadow: 0 0 18px rgba(45,212,191,0.30)">${b}</span>${c}`;
}

function drawCanvasWord(word) {
  // Background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Nice gradient background
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#0c1328");
  g.addColorStop(1, "#070a14");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Frame border glow
  ctx.strokeStyle = "rgba(124,92,255,0.30)";
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  // Word styling
  const fontSize = Math.floor(canvas.height * 0.14); // responsive to resolution
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
  ctx.fillStyle = "#e9eefc";

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;

  if (!els.orpToggle.checked) {
    ctx.fillText(word || "—", canvas.width / 2, canvas.height / 2);
  } else {
    // Draw ORP as two/three parts with different color for the focal char
    const i = orpIndex(word);
    if (i < 0) {
      ctx.fillText(word || "—", canvas.width / 2, canvas.height / 2);
    } else {
      const left = word.slice(0, i);
      const mid = word.slice(i, i + 1);
      const right = word.slice(i + 1);

      // Measure total width by summing parts
      const leftW = ctx.measureText(left).width;
      const midW = ctx.measureText(mid).width;
      const rightW = ctx.measureText(right).width;
      const totalW = leftW + midW + rightW;

      const startX = (canvas.width - totalW) / 2;
      const y = canvas.height / 2;

      // left
      ctx.fillStyle = "#e9eefc";
      ctx.fillText(left, startX + leftW / 2, y);

      // mid highlight
      ctx.fillStyle = "#2dd4bf";
      ctx.fillText(mid, startX + leftW + midW / 2, y);

      // right
      ctx.fillStyle = "#e9eefc";
      ctx.fillText(right, startX + leftW + midW + rightW / 2, y);
    }
  }

  // Subtext progress at bottom
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(233,238,252,0.75)";
  ctx.font = `600 ${Math.floor(canvas.height * 0.035)}px ui-sans-serif, system-ui`;
  const p = `${Math.min(index + 1, words.length)} / ${words.length}  •  ${wpm} WPM`;
  ctx.fillText(p, canvas.width / 2, canvas.height * 0.83);
}

function updateProgressUI() {
  els.progressText.textContent = `${Math.min(index + 1, words.length)} / ${words.length}`;
  els.seekBar.value = String(clamp(index, 0, Math.max(0, words.length - 1)));

  const totalSeconds = words.length ? (words.length / wpm) * 60 : 0;
  const nowSeconds = words.length ? (clamp(index, 0, words.length) / wpm) * 60 : 0;

  els.timeNow.textContent = fmtTime(nowSeconds);
  els.timeTotal.textContent = fmtTime(totalSeconds);
}

function updateStats() {
  const prepared = words.length;
  const text = (els.textInput.value || "").trim();

  // If not prepared, estimate word count quickly from raw text
  const quickCount = text ? text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length : 0;
  const count = prepared ? prepared : quickCount;

  els.wordCount.textContent = String(count);
  els.estWpm.textContent = String(wpm);

  const seconds = count ? (count / wpm) * 60 : 0;
  els.estDuration.textContent = fmtTime(seconds);
}

function refreshWpmUI() {
  els.wpmLabel.textContent = String(wpm);
  els.wpmSlider.value = String(wpm);
}

function bumpWpm(delta) {
  wpm = clamp(wpm + delta, 60, 900);
  refreshWpmUI();
  updateStats();
  // Playback loop picks up new interval on next tick automatically.
}

function resizeCanvasFromSelect() {
  const v = els.resolutionSelect.value;
  const [w, h] = v.split("x").map(n => parseInt(n, 10));
  if (!w || !h) return;
  canvas.width = w;
  canvas.height = h;
}

els.resolutionSelect.addEventListener("change", () => {
  resizeCanvasFromSelect();
  renderCurrentWord();
});

els.orpToggle.addEventListener("change", () => {
  renderCurrentWord();
});

function startRecording() {
  if (recording) return;

  if (!words.length) prepareWords();
  if (!words.length) return;

  // Reset download link
  els.downloadLink.style.display = "none";
  els.downloadLink.href = "#";

  resizeCanvasFromSelect();
  renderCurrentWord();

  const fps = clamp(parseInt(els.fpsSelect.value, 10) || 30, 1, 60);
  const stream = canvas.captureStream(fps);

  recordedChunks = [];

  // Choose a mime type the browser supports.
  const preferred = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  let mimeType = "";
  for (const t of preferred) {
    if (MediaRecorder.isTypeSupported(t)) {
      mimeType = t;
      break;
    }
  }

  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (err) {
    alert("MediaRecorder failed to start. Try Chrome/Edge. Error: " + err);
    return;
  }

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);

    els.downloadLink.href = url;
    els.downloadLink.download = `speed-reading_${wpm}wpm.webm`;
    els.downloadLink.style.display = "inline-block";

    els.recordStatus.textContent = "Recording stopped. Video is ready to download.";
  };

  recorder.start(1000); // collect in 1s chunks
  recording = true;

  els.recordBtn.disabled = true;
  els.stopRecordBtn.disabled = false;
  els.recordStatus.textContent = "Recording… (real-time). Keep this tab active.";

  // Start playback if not playing
  if (!playing) {
    // Make sure we start from the current index, not forced to 0.
    startPlayback();
  }
}

function stopRecording() {
  if (!recording) return;

  recording = false;
  els.recordBtn.disabled = false;
  els.stopRecordBtn.disabled = true;

  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }

  els.recordStatus.textContent = "Stopping recording…";
}

// Utility: ORP index heuristic (works decently for English)
// Common RSVP heuristics shift the focus slightly left of center for longer words.
function orpIndex(word) {
  if (!word) return -1;

  // Strip leading/trailing punctuation for ORP calc (but keep original for drawing)
  const core = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!core) return -1;

  const len = core.length;
  let i;
  if (len <= 1) i = 0;
  else if (len <= 5) i = 1;
  else if (len <= 9) i = 2;
  else if (len <= 13) i = 3;
  else i = 4;

  // Map back into original word by finding where core starts
  const start = word.indexOf(core);
  return start + clamp(i, 0, len - 1);
}

function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Keep stats updated when typing
els.textInput.addEventListener("input", () => {
  // Only estimate; don't re-tokenize prepared words automatically
  if (!words.length) updateStats();
});
