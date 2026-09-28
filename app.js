import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  serverTimestamp,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

/*
  ==========================================================
  1. ISI KONFIGURASI FIREBASE KAMU DI BAGIAN INI
  ==========================================================
  Firebase Console > Project settings > Your apps > Web app
*/
const firebaseConfig = {
  apiKey: "AIzaSyAOXMwu4v-dh505yvoDPfiIgk7pK0FaoqZI",
  authDomain: "vaytimer-e68e0.firebaseapp.com",
  databaseURL: "https://vaytimer-e68e0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vaytimer-e68e0",
  storageBucket: "vaytimer-e68e0.firebasestorage.app",
  messagingSenderId: "794716698218",
  appId: "1:794716698218:web:1ebf389ac5a292d40fc13"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ---------- Room ---------- */
const params = new URLSearchParams(location.search);
let roomId = params.get("room");

if (!roomId || !/^[A-Z0-9]{4,12}$/i.test(roomId)) {
  roomId = randomRoom();
  history.replaceState(null, "", `?room=${roomId}`);
}

roomId = roomId.toUpperCase();

const roomRef = ref(db, `rooms/${roomId}`);
const connectedRef = ref(db, ".info/connected");

/* ---------- State ---------- */
let selectedDuration = 120;
let roomState = {
  duration: 120,
  status: "idle",
  startedAt: null,
  pausedAt: null,
  remaining: 120
};

let serverOffset = 0;
let timerInterval = null;
let finishedOnce = false;

/* ---------- DOM ---------- */
const timeDisplay = document.getElementById("timeDisplay");
const selectedLabel = document.getElementById("selectedLabel");
const timerRing = document.getElementById("timerRing");
const startBtn = document.getElementById("startBtn");
const startText = document.getElementById("startText");
const startIcon = document.getElementById("startIcon");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const syncMessage = document.getElementById("syncMessage");
const roomCode = document.getElementById("roomCode");
const roomCodeBottom = document.getElementById("roomCodeBottom");
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");
const statusLight = document.getElementById("statusLight");
const statusValue = document.getElementById("statusValue");
const statusDescription = document.getElementById("statusDescription");
const toast = document.getElementById("toast");

roomCode.textContent = roomId;
roomCodeBottom.textContent = roomId;

/* ---------- Helpers ---------- */
function randomRoom() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function nowServerMs() {
  return Date.now() + serverOffset;
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function durationName(seconds) {
  return ({
    60: "1 Menit",
    90: "1,5 Menit",
    120: "2 Menit",
    180: "3 Menit"
  })[seconds] || `${seconds} Detik`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 1700);
}

function updateProgress(remaining, total) {
  const progress = Math.max(0, Math.min(1, remaining / total));
  timerRing.style.setProperty("--progress", `${progress * 360}deg`);
}

function getRemaining() {
  if (roomState.status === "running" && roomState.startedAt) {
    const elapsed = (nowServerMs() - roomState.startedAt) / 1000;
    return Math.max(0, roomState.duration - elapsed);
  }

  if (roomState.status === "paused" && roomState.pausedAt != null) {
    return Math.max(0, Number(roomState.pausedAt));
  }

  return Math.max(0, Number(roomState.remaining ?? roomState.duration));
}

function render() {
  const remaining = getRemaining();
  const duration = Number(roomState.duration || selectedDuration);

  selectedDuration = duration;
  timeDisplay.textContent = formatTime(remaining);
  selectedLabel.textContent = durationName(duration);
  updateProgress(remaining, duration);

  document.querySelectorAll(".duration-btn").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.duration) === duration);
    const check = btn.querySelector("i");
    if (check) check.remove();
    if (Number(btn.dataset.duration) === duration) {
      const i = document.createElement("i");
      i.textContent = "✓";
      btn.appendChild(i);
    }
  });

  if (roomState.status === "running") {
    startText.textContent = "Sedang Berjalan";
    startIcon.textContent = "●";
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    syncMessage.innerHTML = "<span>●</span> Timer sedang berjalan";
  } else if (roomState.status === "paused") {
    startText.textContent = "Lanjut";
    startIcon.textContent = "▶";
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    syncMessage.innerHTML = "<span>●</span> Timer dijeda";
  } else if (roomState.status === "finished") {
    startText.textContent = "Mulai Lagi";
    startIcon.textContent = "↻";
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    syncMessage.innerHTML = "<span>●</span> Waktu selesai";
  } else {
    startText.textContent = "Mulai";
    startIcon.textContent = "▶";
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    syncMessage.innerHTML = "<span>●</span> Menunggu timer dimulai...";
  }

  if (roomState.status === "finished" && !finishedOnce) {
    finishedOnce = true;
    document.body.classList.add("finished");
    setTimeout(() => document.body.classList.remove("finished"), 2600);
  }

  if (roomState.status !== "finished") {
    finishedOnce = false;
  }
}

function startLocalLoop() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    render();

    if (roomState.status === "running" && getRemaining() <= 0) {
      clearInterval(timerInterval);
      finishTimer();
    }
  }, 100);
}

/* ---------- Firebase ---------- */
onValue(ref(db, ".info/serverTimeOffset"), snapshot => {
  serverOffset = Number(snapshot.val() || 0);
});

onValue(connectedRef, async snapshot => {
  const connected = snapshot.val() === true;

  connectionDot.className = "connection-dot " + (connected ? "online" : "offline");
  statusLight.className = "status-light " + (connected ? "online" : "offline");

  connectionText.textContent = connected ? "Terhubung" : "Offline";
  statusValue.textContent = connected ? "Terhubung" : "Offline";
  statusValue.style.color = connected ? "#1ca56b" : "#d65c5c";
  statusDescription.textContent = connected
    ? "Timer tersinkron di perangkat yang terhubung."
    : "Koneksi terputus. Coba cek internet.";

  if (connected) {
    await onDisconnect(ref(db, `rooms/${roomId}/presence`)).remove();
    set(ref(db, `rooms/${roomId}/presence/${getClientId()}`), {
      connected: true,
      lastSeen: serverTimestamp()
    });
  }
});

onValue(roomRef, snapshot => {
  const data = snapshot.val();

  if (!data) {
    const initial = {
      duration: selectedDuration,
      status: "idle",
      startedAt: null,
      pausedAt: null,
      remaining: selectedDuration,
      updatedAt: serverTimestamp()
    };
    set(roomRef, initial);
    roomState = { ...roomState, ...initial };
  } else {
    roomState = {
      duration: Number(data.duration ?? 120),
      status: data.status ?? "idle",
      startedAt: data.startedAt ?? null,
      pausedAt: data.pausedAt ?? null,
      remaining: Number(data.remaining ?? data.duration ?? 120)
    };
  }

  render();
  startLocalLoop();
});

/* ---------- Controls ---------- */
document.querySelectorAll(".duration-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    if (roomState.status === "running") {
      showToast("Jeda dulu sebelum mengganti durasi.");
      return;
    }

    const duration = Number(btn.dataset.duration);

    await update(roomRef, {
      duration,
      remaining: duration,
      status: "idle",
      startedAt: null,
      pausedAt: null,
      updatedAt: serverTimestamp()
    });
  });
});

startBtn.addEventListener("click", async () => {
  const duration = Number(roomState.duration || selectedDuration);
  const remaining = getRemaining();

  if (roomState.status === "paused") {
    // Reconstruct start time so both devices continue from the same remaining time.
    const startedAt = nowServerMs() - ((remaining === duration ? 0 : (duration - remaining)) * 1000);
    await update(roomRef, {
      status: "running",
      startedAt,
      pausedAt: null,
      remaining: duration,
      updatedAt: serverTimestamp()
    });
    return;
  }

  await update(roomRef, {
    duration,
    status: "running",
    startedAt: serverTimestamp(),
    pausedAt: null,
    remaining: null,
    updatedAt: serverTimestamp()
  });
});

pauseBtn.addEventListener("click", async () => {
  if (roomState.status !== "running") return;

  const remaining = getRemaining();

  await update(roomRef, {
    status: "paused",
    startedAt: null,
    pausedAt: Number(remaining.toFixed(2)),
    remaining: Number(remaining.toFixed(2)),
    updatedAt: serverTimestamp()
  });
});

resetBtn.addEventListener("click", async () => {
  const duration = Number(roomState.duration || selectedDuration);

  await update(roomRef, {
    status: "idle",
    startedAt: null,
    pausedAt: null,
    remaining: duration,
    updatedAt: serverTimestamp()
  });
});

async function finishTimer() {
  if (roomState.status !== "running") return;

  await update(roomRef, {
    status: "finished",
    startedAt: null,
    pausedAt: 0,
    remaining: 0,
    updatedAt: serverTimestamp()
  });
}

/* ---------- Copy ---------- */
async function copyText(text, message = "Tersalin!") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast("Gagal menyalin. Coba lagi.");
  }
}

document.getElementById("copyRoomBtn").addEventListener("click", () => {
  copyText(location.href, "Link room tersalin!");
});

document.getElementById("copyLinkBtn").addEventListener("click", () => {
  copyText(location.href, "Link room tersalin!");
});

document.getElementById("copyCodeBtn").addEventListener("click", () => {
  copyText(roomId, "Kode room tersalin!");
});

/* ---------- Simple client ID ---------- */
function getClientId() {
  let id = localStorage.getItem("latihanBarengClientId");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem("latihanBarengClientId", id);
  }
  return id;
}

getClientId();
render();
