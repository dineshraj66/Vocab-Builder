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
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ==========================================
// 1. PASTE YOUR FIREBASE CONFIG HERE
// ==========================================
const firebaseConfig = {
 apiKey: "AIzaSyDf8N77GLM53518B3hBJh3sUAI8_UHfla0",
  authDomain: "flashcards-b7b51.firebaseapp.com",
  databaseURL: "https://flashcards-b7b51-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "flashcards-b7b51",
  storageBucket: "flashcards-b7b51.firebasestorage.app",
  messagingSenderId: "202751219372",
  appId: "1:202751219372:web:b6c8a793afc9b71c6df109",
  measurementId: "G-W62823E94D"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
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

const BOX_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 15, 5: 30 };

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
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
// 4. AUTHENTICATION FLOW
// ==========================================
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
    await loadCards();
  } else {
    currentUser = null;
    document.getElementById("auth-screen").classList.remove("hidden");
    document.getElementById("app-container").classList.add("hidden");
  }
});

// ==========================================
// 5. FIRESTORE DATA OPERATIONS
// ==========================================
function userCardsRef() {
  return collection(db, "users", currentUser.uid, "vocab_cards");
}

async function loadCards() {
  const snapshot = await getDocs(userCardsRef());
  allCards = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  updateStats();
  buildStudyQueue(false);
  renderWordBank();
}

function updateStats() {
  const today = getTodayISO();
  const dueCount = allCards.filter((c) => (c.nextReview || today) <= today).length;
  const masteredCount = allCards.filter((c) => (c.box || 1) >= 4).length;
  const uniqueDays = new Set(allCards.map((c) => c.dateAdded)).size;

  document.getElementById("stat-due").textContent = dueCount;
  document.getElementById("stat-total").textContent = allCards.length;
  document.getElementById("stat-mastered").textContent = masteredCount;
  document.getElementById("stat-days").textContent = uniqueDays;
}

// ==========================================
// 6. SPACED REPETITION ENGINE
// ==========================================
function buildStudyQueue(practiceAll = false) {
  const today = getTodayISO();
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

  // Dynamic interval previews
  const goodBox = Math.min(5, box + 1);
  const easyBox = Math.min(5, box + 2);
  document.getElementById("good-interval-label").textContent = `${BOX_INTERVALS[goodBox]} days (Box ${goodBox})`;
  document.getElementById("easy-interval-label").textContent = `${BOX_INTERVALS[easyBox]} days (Box ${easyBox})`;

  // Reset visibility
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

    const nextReview = addDaysISO(daysToAdd);
    const cardDocRef = doc(db, "users", currentUser.uid, "vocab_cards", card.id);

    await updateDoc(cardDocRef, {
      box: newBox,
      nextReview: nextReview,
      reviewCount: (card.reviewCount || 0) + 1,
      lastReviewed: getTodayISO()
    });

    // Update local state
    card.box = newBox;
    card.nextReview = nextReview;

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
    const today = getTodayISO();

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

    await batch.commit();
    importStatus.textContent = `Saved ${items.length} words successfully!`;
    jsonInput.value = "";
    await loadCards();
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
  dlAnchor.setAttribute("download", `vocab-backup-${getTodayISO()}.json`);
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
      }
    });
  });
}

document.getElementById("search-input").addEventListener("input", renderWordBank);
document.getElementById("box-filter").addEventListener("change", renderWordBank);