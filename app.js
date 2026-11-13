import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ==========================================
// 1. LOAD FIREBASE CONFIG FROM firebase.txt
// ==========================================
async function loadFirebaseConfig() {
  const res = await fetch("./firebase.txt");
  if (!res.ok) {
    throw new Error("Could not load firebase.txt. Make sure firebase.txt is uploaded in the same folder.");
  }
  const text = await res.text();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Invalid format in firebase.txt. Could not find { ... } config block.");
  }
  // Safely evaluate JS object literal or JSON from firebase.txt
  return new Function(`return (${match[0]});`)();
}

let auth;
let db;
const provider = new GoogleAuthProvider();

// ==========================================
// 2. STARTER DATA (NOV 12 & NOV 13, 2026)
// ==========================================
const STARTER_PACK = [
  { word: "slog it out", meaning: "To work hard and steadily at something difficult or tiring over a long period.", sentence: "I have to [slog it out] hard at the gym.", source: "Chennai Times", dateAdded: "2026-11-12" },
  { word: "innate", meaning: "Natural; a quality or ability you are born with rather than something you learn.", sentence: "My father's humor was [innate], but he was never loud or someone who said things just for effect.", source: "Chennai Times", dateAdded: "2026-11-12" },
  { word: "roots", meaning: "Supports, cheers for, or hopes someone succeeds.", sentence: "I don't think the industry really [roots] for you.", source: "Chennai Times", dateAdded: "2026-11-12" },
  { word: "in limbo", meaning: "In an uncertain or unfinished state, waiting for a decision or next step.", sentence: "Madonna biopic starring Julia Garner continues to remain [in limbo].", source: "Chennai Times", dateAdded: "2026-11-12" },
  { word: "rattled", meaning: "Made someone or the stock market nervous, worried, or unsettled.", sentence: "Executive scandals that [rattled] share price.", source: "Chennai Times", dateAdded: "2026-11-12" },
  { word: "desi", meaning: "Local, traditional, or distinctly Indian in style or origin.", sentence: "Keeping it cool and [desi].", source: "Chennai Times", dateAdded: "2026-11-12" },
  { word: "shied", meaning: "Avoided doing or confronting something out of nervousness, caution, or reluctance.", sentence: "She never [shied] away from acknowledging it.", source: "Chennai Times", dateAdded: "2026-11-12" },
  { word: "intimate", meaning: "Private, close, and cozy, usually involving a small group of close friends and family.", sentence: "In an [intimate] ceremony at a resort on ECR in Chennai.", source: "Chennai Times", dateAdded: "2026-11-12" },
  { word: "tarnishing", meaning: "Damaging or staining someone's reputation, image, or respect.", sentence: "Refrain from action [tarnishing] TVK.", source: "Chennai Times", dateAdded: "2026-11-12" },
  { word: "stalker", meaning: "Someone who repeatedly follows, watches, or harasses another person.", sentence: "[Stalker] to set girl ablaze, held.", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "ablaze", meaning: "On fire; burning fiercely.", sentence: "Stalker to set girl [ablaze], held.", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "impounded", meaning: "Seized and kept in legal custody by authorities.", sentence: "GCC [impounded] 1823 stray cattle.", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "incumbent", meaning: "The person currently holding an official post or position.", sentence: "[Incumbent] additional project director was transferred.", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "prefab", meaning: "Building sections manufactured in advance for quick assembly on-site.", sentence: "TNUHDB likely to use [prefab] structures to revamp tenements.", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "tenements", meaning: "Multi-family apartment blocks or housing units.", sentence: "TNUHDB likely to use prefab structures to revamp [tenements].", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "reinstate", meaning: "To restore someone back to their former position, right, or home.", sentence: "18 to 20 months to complete the buildings and [reinstate] original allottees.", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "dilapidated", meaning: "In a state of ruin, decay, or severe disrepair.", sentence: "Families have already been evicted from existing [dilapidated] structures after payment of ex-gratia.", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "ex-gratia", meaning: "Money paid out of goodwill or moral duty rather than a legal obligation.", sentence: "Families have already been evicted from existing dilapidated structures after payment of [ex-gratia].", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "crew", meaning: "A group of people working together to operate a vehicle, ship, or aircraft.", sentence: "Bus [crew] overpowers him before he could attack.", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "intercepted", meaning: "Stopped or blocked someone or something on the way to a destination.", sentence: "Student [intercepted] college bus.", source: "Chennai Times City", dateAdded: "2026-11-13" },
  { word: "jurisdiction", meaning: "The official authority or geographical area controlled by a legal or government body.", sentence: "Its [jurisdiction] has remained unchanged.", source: "Chennai Times City", dateAdded: "2026-11-13" }
];

// ==========================================
// 3. STATE & HELPERS
// ==========================================
let currentUser = null;
let allCards = [];
let studyQueue = [];
let currentIndex = 0;
let completedDates = new Set();
let viewDate = new Date();

const BOX_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 15, 5: 30 };

function getLocalISO(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getLocalISO(d);
}

function slugify(dateStr, word) {
  return `${dateStr}_${word.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function formatSentence(sentence, reveal = false) {
  const regex = /\[(.*?)\]/g;
  if (reveal) {
    return sentence.replace(regex, `<span class="cloze-revealed">$1</span>`);
  }
  return sentence.replace(regex, `<span class="cloze-blank">________</span>`);
}

// ==========================================
// 4. FIRESTORE DATA & PRACTICE LOGS
// ==========================================
function userCardsRef() {
  return collection(db, "users", currentUser.uid, "vocab_cards");
}

function practiceLogsRef() {
  return collection(db, "users", currentUser.uid, "practice_logs");
}

async function loadCards() {
  const snapshot = await getDocs(userCardsRef());
  allCards = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  buildStudyQueue(false);
  renderWordBank();
}

async function loadPracticeLogs() {
  completedDates.clear();
  const snapshot = await getDocs(practiceLogsRef());
  snapshot.docs.forEach((d) => completedDates.add(d.id));
}

async function markDayCompleted(dateStr = getLocalISO()) {
  completedDates.add(dateStr);
  const logDocRef = doc(db, "users", currentUser.uid, "practice_logs", dateStr);
  await setDoc(
    logDocRef,
    {
      date: dateStr,
      reviews: increment(1),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  updateStats();
}

function calculateStreaks() {
  const sorted = Array.from(completedDates).sort();
  if (sorted.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let running = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const curr = new Date(sorted[i] + "T00:00:00");
    const diffDays = Math.round((curr - prev) / 86400000);
    if (diffDays === 1) {
      running++;
      if (running > best) best = running;
    } else if (diffDays > 1) {
      running = 1;
    }
  }

  let current = 0;
  const checkDate = new Date();
  const todayStr = getLocalISO(checkDate);
  if (!completedDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (completedDates.has(getLocalISO(checkDate))) {
    current++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return { current, best };
}

function updateStats() {
  const today = getLocalISO();
  const dueCount = allCards.filter((c) => (c.nextReview || today) <= today).length;
  const masteredCount = allCards.filter((c) => (c.box || 1) >= 4).length;
  const streaks = calculateStreaks();

  document.getElementById("stat-due").textContent = dueCount;
  document.getElementById("stat-total").textContent = allCards.length;
  document.getElementById("stat-mastered").textContent = masteredCount;
  document.getElementById("stat-streak").textContent = `${streaks.current}d`;
  document.getElementById("header-streak").textContent = streaks.current;
}

// ==========================================
// 5. CALENDAR MODAL RENDERER
// ==========================================
const calendarModal = document.getElementById("calendar-modal");

function renderCalendar() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayStr = getLocalISO();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  document.getElementById("calendar-month-label").textContent = `${monthNames[month]} ${year}`;

  const streaks = calculateStreaks();
  document.getElementById("cal-current-streak").textContent = `${streaks.current} days`;
  document.getElementById("cal-best-streak").textContent = `${streaks.best} days`;
  document.getElementById("cal-total-days").textContent = `${completedDates.size} days`;

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const gridEl = document.getElementById("calendar-grid");
  gridEl.innerHTML = "";

  for (let i = 0; i < firstDayOfMonth; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "cal-day empty";
    gridEl.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isDone = completedDates.has(dateStr);
    const isToday = dateStr === todayStr;

    const cell = document.createElement("div");
    cell.className = `cal-day${isDone ? " completed" : ""}${isToday ? " today" : ""}`;
    cell.innerHTML = `
      <span>${day}</span>
      <span class="cal-tick">${isDone ? "✓" : ""}</span>
    `;
    gridEl.appendChild(cell);
  }
}

document.getElementById("open-calendar-btn").addEventListener("click", () => {
  viewDate = new Date();
  renderCalendar();
  calendarModal.classList.remove("hidden");
});

document.getElementById("close-calendar-btn").addEventListener("click", () => {
  calendarModal.classList.add("hidden");
});

document.getElementById("prev-month-btn").addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("next-month-btn").addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() + 1);
  renderCalendar();
});

// ==========================================
// 6. SPACED REPETITION ENGINE
// ==========================================
function buildStudyQueue(practiceAll = false) {
  const today = getLocalISO();
  const filtered = practiceAll
    ? [...allCards]
    : allCards.filter((c) => (c.nextReview || today) <= today);

  studyQueue = filtered.sort((a, b) => (a.box || 1) - (b.box || 1));
  currentIndex = 0;
  renderCurrentCard();
}

function renderCurrentCard() {
  const emptyEl = document.getElementById("empty-queue");
  const wrapperEl = document.getElementById("flashcard-wrapper");

  if (studyQueue.length === 0 || currentIndex >= studyQueue.length) {
    emptyEl.classList.remove("hidden");
    wrapperEl.classList.add("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  wrapperEl.classList.remove("hidden");

  const card = studyQueue[currentIndex];
  const box = card.box || 1;

  document.getElementById("card-source").textContent = `${card.source || "Newspaper"} • ${card.dateAdded}`;
  document.getElementById("card-box").textContent = `Box ${box}`;
  document.getElementById("card-progress").textContent = `${currentIndex + 1} / ${studyQueue.length}`;

  document.getElementById("card-sentence").innerHTML = formatSentence(card.sentence, false);
  document.getElementById("card-hint-text").textContent = card.meaning;
  document.getElementById("card-word").textContent = card.word;
  document.getElementById("card-meaning").textContent = card.meaning;

  const goodBox = Math.min(5, box + 1);
  const easyBox = Math.min(5, box + 2);
  document.getElementById("good-interval-label").textContent = `${BOX_INTERVALS[goodBox]} days (Box ${goodBox})`;
  document.getElementById("easy-interval-label").textContent = `${BOX_INTERVALS[easyBox]} days (Box ${easyBox})`;

  document.getElementById("hint-section").classList.add("hidden");
  document.getElementById("answer-section").classList.add("hidden");
  document.getElementById("pre-reveal-controls").classList.remove("hidden");
  document.getElementById("rating-controls").classList.add("hidden");
}

document.getElementById("show-hint-btn").addEventListener("click", () => {
  document.getElementById("hint-section").classList.remove("hidden");
});

document.getElementById("reveal-btn").addEventListener("click", () => {
  const card = studyQueue[currentIndex];
  document.getElementById("card-sentence").innerHTML = formatSentence(card.sentence, true);
  document.getElementById("answer-section").classList.remove("hidden");
  document.getElementById("pre-reveal-controls").classList.add("hidden");
  document.getElementById("rating-controls").classList.remove("hidden");
});

document.getElementById("speak-btn").addEventListener("click", () => {
  const card = studyQueue[currentIndex];
  const utterance = new SpeechSynthesisUtterance(card.word);
  utterance.lang = "en-IN";
  speechSynthesis.speak(utterance);
});

document.querySelectorAll(".btn-rate").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const rate = btn.dataset.rate;
    const card = studyQueue[currentIndex];
    const currentBox = card.box || 1;

    let newBox = currentBox;
    let daysToAdd = 1;

    if (rate === "again") {
      newBox = 1;
      daysToAdd = 1;
    } else if (rate === "hard") {
      newBox = currentBox;
      daysToAdd = 2;
    } else if (rate === "good") {
      newBox = Math.min(5, currentBox + 1);
      daysToAdd = BOX_INTERVALS[newBox];
    } else if (rate === "easy") {
      newBox = Math.min(5, currentBox + 2);
      daysToAdd = BOX_INTERVALS[newBox];
    }

    const todayStr = getLocalISO();
    const nextReview = addDaysISO(daysToAdd);
    const cardDocRef = doc(db, "users", currentUser.uid, "vocab_cards", card.id);

    await updateDoc(cardDocRef, {
      box: newBox,
      nextReview: nextReview,
      reviewCount: (card.reviewCount || 0) + 1,
      lastReviewed: todayStr
    });

    card.box = newBox;
    card.nextReview = nextReview;

    await markDayCompleted(todayStr);

    currentIndex++;
    updateStats();
    renderCurrentCard();
  });
});

document.getElementById("practice-all-btn").addEventListener("click", () => {
  buildStudyQueue(true);
});

// ==========================================
// 7. IMPORT MODAL & BACKUP
// ==========================================
const modal = document.getElementById("import-modal");
const jsonInput = document.getElementById("json-input");
const importStatus = document.getElementById("import-status");

document.getElementById("open-import-btn").addEventListener("click", () => {
  importStatus.textContent = "";
  modal.classList.remove("hidden");
});

document.getElementById("close-import-btn").addEventListener("click", () => {
  modal.classList.add("hidden");
});

document.getElementById("load-starter-btn").addEventListener("click", () => {
  jsonInput.value = JSON.stringify(STARTER_PACK, null, 2);
});

document.getElementById("save-json-btn").addEventListener("click", async () => {
  try {
    const items = JSON.parse(jsonInput.value.trim());
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Please paste a valid JSON array of word objects.");
    }

    const batch = writeBatch(db);
    const today = getLocalISO();

    items.forEach((item) => {
      if (!item.word || !item.sentence || !item.meaning) return;
      const dateAdded = item.dateAdded || today;
      const id = slugify(dateAdded, item.word);
      const ref = doc(db, "users", currentUser.uid, "vocab_cards", id);

      batch.set(
        ref,
        {
          word: item.word.trim(),
          meaning: item.meaning.trim(),
          sentence: item.sentence.trim(),
          source: item.source || "Newspaper",
          dateAdded,
          box: 1,
          nextReview: today,
          reviewCount: 0,
          createdAt: serverTimestamp()
        },
        { merge: true }
      );
    });

    const logRef = doc(db, "users", currentUser.uid, "practice_logs", today);
    batch.set(logRef, { date: today, updatedAt: serverTimestamp() }, { merge: true });
    completedDates.add(today);

    await batch.commit();
    importStatus.style.color = "#10b981";
    importStatus.textContent = `Saved ${items.length} words successfully!`;
    jsonInput.value = "";
    await loadCards();
    updateStats();
    setTimeout(() => modal.classList.add("hidden"), 900);
  } catch (err) {
    importStatus.style.color = "#ef4444";
    importStatus.textContent = `Error: ${err.message}`;
  }
});

document.getElementById("export-backup-btn").addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allCards, null, 2));
  const dlAnchor = document.createElement("a");
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `vocab-backup-${getLocalISO()}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
});

// ==========================================
// 8. WORD BANK & NAVIGATION TABS
// ==========================================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  });
});

function renderWordBank() {
  const query = document.getElementById("search-input").value.toLowerCase();
  const boxFilter = document.getElementById("box-filter").value;
  const listEl = document.getElementById("word-list");

  const filtered = allCards.filter((c) => {
    const matchesText =
      c.word.toLowerCase().includes(query) ||
      c.sentence.toLowerCase().includes(query) ||
      c.meaning.toLowerCase().includes(query);
    const matchesBox = boxFilter === "all" || String(c.box || 1) === boxFilter;
    return matchesText && matchesBox;
  });

  listEl.innerHTML = filtered
    .map(
      (c) => `
      <div class="word-item">
        <div>
          <h4>${c.word} <span class="badge">Box ${c.box || 1} • Due ${c.nextReview}</span></h4>
          <p class="item-sentence">${c.sentence.replace(/\[(.*?)\]/g, "<strong>$1</strong>")}</p>
          <p class="item-meaning">${c.meaning}</p>
        </div>
        <button class="btn-icon delete-card-btn" data-id="${c.id}" title="Delete">🗑️</button>
      </div>
    `
    )
    .join("");

  document.querySelectorAll(".delete-card-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Delete this word from your database?")) {
        await deleteDoc(doc(db, "users", currentUser.uid, "vocab_cards", btn.dataset.id));
        await loadCards();
        updateStats();
      }
    });
  });
}

document.getElementById("search-input").addEventListener("input", renderWordBank);
document.getElementById("box-filter").addEventListener("change", renderWordBank);

// ==========================================
// 9. BOOTSTRAP APP
// ==========================================
async function init() {
  try {
    const firebaseConfig = await loadFirebaseConfig();
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    document.getElementById("google-signin-btn").addEventListener("click", async () => {
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        document.getElementById("auth-error").textContent = err.message;
      }
    });

    document.getElementById("signout-btn").addEventListener("click", () => signOut(auth));

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        document.getElementById("user-email").textContent = user.email;
        document.getElementById("auth-screen").classList.add("hidden");
        document.getElementById("app-container").classList.remove("hidden");
        await Promise.all([loadCards(), loadPracticeLogs()]);
        updateStats();
      } else {
        currentUser = null;
        document.getElementById("auth-screen").classList.remove("hidden");
        document.getElementById("app-container").classList.add("hidden");
      }
    });
  } catch (err) {
    document.getElementById("auth-error").textContent = err.message;
  }
}

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("SW registration failed:", err);
    });
  });
}