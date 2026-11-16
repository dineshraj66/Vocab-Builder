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
  getDoc,
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
  return new Function(`return (${match[0]});`)();
}

let auth;
let db;
const provider = new GoogleAuthProvider();

// ==========================================
// 2. STARTER DATA (ADULT NEWSPAPER + KID STORY VOCAB)
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

// Progressive 7-Year-Old Story Book Vocabulary (Easy -> Medium -> Chapter Book)
const KID_WORD_BANK = [
  // Tier 1: Easy Story Starters (Level 0)
  { word: "brave", synonym: "courageous", antonym: "scared", clue: "Not afraid to face danger.", sentence: "The [brave] puppy barked to protect his friend." },
  { word: "gigantic", synonym: "huge", antonym: "tiny", clue: "Super big like a mountain.", sentence: "A [gigantic] dinosaur stomped through the jungle." },
  { word: "giggle", synonym: "laugh", antonym: "cry", clue: "A happy, silly little laugh.", sentence: "The funny monkey made all the children [giggle]." },
  { word: "swift", synonym: "fast", antonym: "slow", clue: "Moving very quickly.", sentence: "The [swift] cheetah zoomed across the grassy plain." },
  { word: "cheerful", synonym: "happy", antonym: "gloomy", clue: "Full of smiles and joy.", sentence: "Maya sang a [cheerful] song on her way to school." },
  { word: "whisper", synonym: "murmur", antonym: "shout", clue: "Speak very softly using your breath.", sentence: "We had to [whisper] inside the quiet library." },
  { word: "ancient", synonym: "old", antonym: "modern", clue: "From a very long time ago.", sentence: "They found an [ancient] treasure map inside the cave." },
  { word: "clever", synonym: "smart", antonym: "silly", clue: "Quick at learning and solving puzzles.", sentence: "The [clever] fox figured out how to open the latch." },
  { word: "gentle", synonym: "kind", antonym: "rough", clue: "Soft, calm, and careful.", sentence: "Be [gentle] when you pet the baby rabbit." },
  { word: "bright", synonym: "shiny", antonym: "dark", clue: "Giving off lots of light.", sentence: "A [bright] shooting star streaked across the night sky." },
  { word: "chilly", synonym: "cold", antonym: "warm", clue: "A little bit cold.", sentence: "Put on your cozy sweater because it is [chilly] outside." },
  { word: "tidy", synonym: "neat", antonym: "messy", clue: "Clean and in the right place.", sentence: "Aarav kept his bookshelf neat and [tidy]." },

  // Tier 2: Growing Reader Words (Level 1)
  { word: "curious", synonym: "inquisitive", antonym: "bored", clue: "Eager to learn and ask questions.", sentence: "The [curious] kitten peeked inside the cardboard box." },
  { word: "vanish", synonym: "disappear", antonym: "appear", clue: "To go out of sight suddenly.", sentence: "The magician made the coin [vanish] into thin air." },
  { word: "generous", synonym: "giving", antonym: "selfish", clue: "Happy to share with others.", sentence: "She was [generous] and shared her mangoes with everyone." },
  { word: "fragile", synonym: "breakable", antonym: "sturdy", clue: "Easily broken if dropped.", sentence: "Carry the [fragile] glass bowl with both hands." },
  { word: "enormous", synonym: "colossal", antonym: "miniature", clue: "Extremely large in size.", sentence: "An [enormous] blue whale swam beside the boat." },
  { word: "timid", synonym: "shy", antonym: "bold", clue: "Easily frightened or bashful.", sentence: "The [timid] deer hid behind the tall bushes." },
  { word: "discover", synonym: "find", antonym: "lose", clue: "To find something for the first time.", sentence: "Explorers [discover] hidden islands across the ocean." },
  { word: "fierce", synonym: "wild", antonym: "tame", clue: "Strong, powerful, and intense.", sentence: "A [fierce] storm rattled the wooden shutters." },
  { word: "plenty", synonym: "abundant", antonym: "scarce", clue: "More than enough.", sentence: "There is [plenty] of water in the well for the whole farm." },
  { word: "grumpy", synonym: "cranky", antonym: "pleasant", clue: "In a bad, grouchy mood.", sentence: "Bear was [grumpy] when he woke up from his nap." },
  { word: "gleam", synonym: "sparkle", antonym: "dull", clue: "To shine softly and brightly.", sentence: "The polished bicycle began to [gleam] in the sunlight." },
  { word: "sturdy", synonym: "strong", antonym: "weak", clue: "Built well and hard to break.", sentence: "They built a [sturdy] treehouse on the old banyan tree." },

  // Tier 3: Chapter Book Explorer Words (Level 2)
  { word: "peculiar", synonym: "strange", antonym: "ordinary", clue: "Unusual or a little weird.", sentence: "The wizard wore a [peculiar] hat shaped like a teapot." },
  { word: "cautious", synonym: "careful", antonym: "reckless", clue: "Paying close attention to stay safe.", sentence: "Be [cautious] when crossing the slippery stepping stones." },
  { word: "triumph", synonym: "victory", antonym: "defeat", clue: "A great win or success.", sentence: "The team cheered in [triumph] after winning the match." },
  { word: "drowsy", synonym: "sleepy", antonym: "alert", clue: "Feeling ready to fall asleep.", sentence: "Reading a bedtime story made him feel [drowsy]." },
  { word: "famished", synonym: "starving", antonym: "full", clue: "Extremely hungry.", sentence: "After swimming all afternoon, the kids were [famished]." },
  { word: "astonish", synonym: "amaze", antonym: "bore", clue: "To surprise someone greatly.", sentence: "The acrobats will [astonish] the crowd with their flips." },
  { word: "reluctant", synonym: "hesitant", antonym: "eager", clue: "Not wanting to do something right away.", sentence: "He was [reluctant] to jump into the cold swimming pool." },
  { word: "vivid", synonym: "colorful", antonym: "faded", clue: "Very bright, clear, and detailed.", sentence: "She painted a [vivid] picture of a rainbow over the hills." },
  { word: "conceal", synonym: "hide", antonym: "reveal", clue: "To keep something out of sight.", sentence: "Thick clouds can [conceal] the top of the mountain." },
  { word: "frantic", synonym: "panicked", antonym: "calm", clue: "Hurried and worried in a rush.", sentence: "The squirrel made a [frantic] dash to gather its acorns." },
  { word: "brilliant", synonym: "genius", antonym: "foolish", clue: "Super smart or shining brightly.", sentence: "Rohan came up with a [brilliant] idea for the science fair." },
  { word: "scarce", synonym: "rare", antonym: "plentiful", clue: "Very hard to find; not much around.", sentence: "Water becomes [scarce] in the desert during summer." },

  // Tier 4: Master Storyteller Words (Level 3+)
  { word: "magnificent", synonym: "splendid", antonym: "plain", clue: "Grand, impressive, and wonderful.", sentence: "The peacock spread its [magnificent] tail feathers." },
  { word: "perilous", synonym: "dangerous", antonym: "safe", clue: "Full of risk or danger.", sentence: "Crossing the rope bridge over the canyon was [perilous]." },
  { word: "dwell", synonym: "live", antonym: "leave", clue: "To live in a place as your home.", sentence: "Many colorful fish [dwell] inside the coral reef." },
  { word: "abolish", synonym: "end", antonym: "create", clue: "To officially stop or get rid of.", sentence: "The kind king decided to [abolish] the unfair rule." },
  { word: "humble", synonym: "modest", antonym: "proud", clue: "Not bragging about how good you are.", sentence: "Even after winning the trophy, she remained [humble]." },
  { word: "mimic", synonym: "imitate", antonym: "ignore", clue: "To copy how someone talks or moves.", sentence: "Parrots can [mimic] almost any sound they hear." },
  { word: "navigate", synonym: "steer", antonym: "wander", clue: "To find your way across land or sea.", sentence: "Sailors use stars and a compass to [navigate] at night." },
  { word: "abundant", synonym: "overflowing", antonym: "lacking", clue: "Existing in large amounts.", sentence: "The orchard had an [abundant] harvest of sweet chikus." },
  { word: "tranquil", synonym: "peaceful", antonym: "noisy", clue: "Quiet, calm, and relaxing.", sentence: "Early morning by the farm pond is always [tranquil]." },
  { word: "persistent", synonym: "determined", antonym: "quitting", clue: "Never giving up even when it is hard.", sentence: "With [persistent] practice, he learned to read thick books." }
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
const DAILY_WORD_TARGET = 10;

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

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

function setGoalProgress(textId, barId, count, target) {
  const textEl = document.getElementById(textId);
  const barEl = document.getElementById(barId);
  if (!textEl || !barEl) return;

  textEl.textContent = `${count} / ${target}`;
  const pct = Math.min(100, Math.round((count / target) * 100));
  barEl.style.width = `${pct}%`;

  if (count >= target) {
    textEl.classList.add("done");
  } else {
    textEl.classList.remove("done");
  }
}

function updateStats() {
  const now = new Date();
  const today = getLocalISO(now);
  const year = now.getFullYear();
  const month = now.getMonth();

  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(year, month, now.getDate() + diffToMonday);
  const sunday = new Date(year, month, now.getDate() + diffToMonday + 6);
  const weekStartISO = getLocalISO(monday);
  const weekEndISO = getLocalISO(sunday);

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const yearPrefix = `${year}-`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeapYear ? 366 : 365;

  let dailyCount = 0;
  let weeklyCount = 0;
  let monthlyCount = 0;
  let yearlyCount = 0;

  allCards.forEach((c) => {
    const d = c.dateAdded || "";
    if (d === today) dailyCount++;
    if (d >= weekStartISO && d <= weekEndISO) weeklyCount++;
    if (d.startsWith(monthPrefix)) monthlyCount++;
    if (d.startsWith(yearPrefix)) yearlyCount++;
  });

  setGoalProgress("goal-daily-text", "goal-daily-bar", dailyCount, DAILY_WORD_TARGET);
  setGoalProgress("goal-weekly-text", "goal-weekly-bar", weeklyCount, DAILY_WORD_TARGET * 7);
  setGoalProgress("goal-monthly-text", "goal-monthly-bar", monthlyCount, DAILY_WORD_TARGET * daysInMonth);
  setGoalProgress("goal-yearly-text", "goal-yearly-bar", yearlyCount, DAILY_WORD_TARGET * daysInYear);

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

document.getElementById("jump-arcade-btn").addEventListener("click", () => {
  document.querySelector('.tab-btn[data-tab="arcade-tab"]').click();
});

// ==========================================
// 7. ADULT ARCADE GAMES
// ==========================================
let lastArcadeMode = "quiz";
let quizDeck = [];
let quizIdx = 0;
let quizScore = 0;
let quizCombo = 1;
let quizCorrectCount = 0;
let quizTimerInterval = null;
let quizTimeLeft = 15;

let matchStartTime = 0;
let matchPenaltySec = 0;
let matchTimerInterval = null;
let selectedWordId = null;
let selectedMeaningId = null;
let matchedPairs = 0;

function getArcadePool() {
  const weakOnly = document.getElementById("weak-words-toggle").checked;
  if (weakOnly) {
    const weak = allCards.filter((c) => (c.box || 1) <= 2);
    if (weak.length >= 6) return weak;
  }
  return allCards;
}

function updateArcadeRecordsUI() {
  const bestQuiz = localStorage.getItem("vocab_quiz_best") || "0";
  const bestMatch = localStorage.getItem("vocab_match_best");
  document.getElementById("quiz-best-score").textContent = bestQuiz;
  document.getElementById("match-best-time").textContent = bestMatch ? `${bestMatch}s` : "--";
}

function hideAllArcadeViews() {
  clearInterval(quizTimerInterval);
  clearInterval(matchTimerInterval);
  document.getElementById("arcade-menu").classList.add("hidden");
  document.getElementById("quiz-arena").classList.add("hidden");
  document.getElementById("match-arena").classList.add("hidden");
  document.getElementById("arcade-result").classList.add("hidden");
}

document.querySelectorAll(".exit-arcade-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    hideAllArcadeViews();
    updateArcadeRecordsUI();
    document.getElementById("arcade-menu").classList.remove("hidden");
  });
});

document.getElementById("play-again-btn").addEventListener("click", () => {
  if (lastArcadeMode === "quiz") startHeadlineQuiz();
  else startSpeedMatch();
});

function startHeadlineQuiz() {
  const pool = getArcadePool();
  if (pool.length < 4) {
    alert("Add at least 4 words to your Word Bank to play Headline Quiz!");
    return;
  }

  lastArcadeMode = "quiz";
  quizDeck = shuffleArray(pool).slice(0, Math.min(10, pool.length));
  quizIdx = 0;
  quizScore = 0;
  quizCombo = 1;
  quizCorrectCount = 0;

  hideAllArcadeViews();
  document.getElementById("quiz-arena").classList.remove("hidden");
  renderQuizQuestion();
}

function renderQuizQuestion() {
  if (quizIdx >= quizDeck.length) {
    finishHeadlineQuiz();
    return;
  }

  const card = quizDeck[quizIdx];
  document.getElementById("quiz-q-num").textContent = `${quizIdx + 1}`;
  document.getElementById("quiz-combo").textContent = `${quizCombo}x`;
  document.getElementById("quiz-score").textContent = quizScore;
  document.getElementById("quiz-sentence").innerHTML = formatSentence(card.sentence, false);

  const distractors = shuffleArray(
    allCards.filter((c) => c.word.toLowerCase() !== card.word.toLowerCase())
  )
    .slice(0, 3)
    .map((c) => c.word);

  const options = shuffleArray([card.word, ...distractors]);
  const optsEl = document.getElementById("quiz-options");
  optsEl.innerHTML = "";

  options.forEach((optWord) => {
    const btn = document.createElement("button");
    btn.className = "quiz-opt-btn";
    btn.textContent = optWord;
    btn.addEventListener("click", () => handleQuizAnswer(btn, optWord, card));
    optsEl.appendChild(btn);
  });

  clearInterval(quizTimerInterval);
  quizTimeLeft = 15;
  const barEl = document.getElementById("quiz-timer-bar");
  barEl.style.width = "100%";

  quizTimerInterval = setInterval(() => {
    quizTimeLeft -= 0.1;
    const pct = Math.max(0, (quizTimeLeft / 15) * 100);
    barEl.style.width = `${pct}%`;
    if (quizTimeLeft <= 0) {
      clearInterval(quizTimerInterval);
      handleQuizAnswer(null, null, card);
    }
  }, 100);
}

function handleQuizAnswer(clickedBtn, chosenWord, card) {
  clearInterval(quizTimerInterval);
  const allBtns = document.querySelectorAll(".quiz-opt-btn");
  allBtns.forEach((b) => (b.disabled = true));

  const isCorrect = chosenWord && chosenWord.toLowerCase() === card.word.toLowerCase();

  if (isCorrect) {
    clickedBtn.classList.add("opt-correct");
    const speedBonus = Math.ceil(quizTimeLeft) * 5;
    quizScore += (100 + speedBonus) * quizCombo;
    quizCombo = Math.min(5, quizCombo + 1);
    quizCorrectCount++;
  } else {
    if (clickedBtn) clickedBtn.classList.add("opt-wrong");
    quizCombo = 1;
    allBtns.forEach((b) => {
      if (b.textContent.toLowerCase() === card.word.toLowerCase()) {
        b.classList.add("opt-correct");
      }
    });
  }

  document.getElementById("quiz-sentence").innerHTML = formatSentence(card.sentence, true);
  document.getElementById("quiz-combo").textContent = `${quizCombo}x`;
  document.getElementById("quiz-score").textContent = quizScore;

  setTimeout(() => {
    quizIdx++;
    renderQuizQuestion();
  }, 950);
}

async function finishHeadlineQuiz() {
  hideAllArcadeViews();
  const prevBest = Number(localStorage.getItem("vocab_quiz_best") || 0);
  const isNewRecord = quizScore > prevBest;
  if (isNewRecord) {
    localStorage.setItem("vocab_quiz_best", String(quizScore));
  }

  document.getElementById("result-badge").textContent = isNewRecord ? "NEW HIGH SCORE" : "QUIZ COMPLETE";
  document.getElementById("result-title").textContent = `${quizScore} Points`;
  document.getElementById("result-summary").textContent = `You nailed ${quizCorrectCount} out of ${quizDeck.length} newspaper headlines.`;
  document.getElementById("arcade-result").classList.remove("hidden");

  await markDayCompleted();
}

document.getElementById("start-quiz-btn").addEventListener("click", startHeadlineQuiz);

function startSpeedMatch() {
  const pool = getArcadePool();
  if (pool.length < 6) {
    alert("Add at least 6 words to your Word Bank to play Speed Match!");
    return;
  }

  lastArcadeMode = "match";
  const roundCards = shuffleArray(pool).slice(0, 6);
  selectedWordId = null;
  selectedMeaningId = null;
  matchedPairs = 0;
  matchPenaltySec = 0;

  hideAllArcadeViews();
  document.getElementById("match-count").textContent = "0";
  document.getElementById("match-timer").textContent = "0.0s";
  document.getElementById("match-arena").classList.remove("hidden");

  const wordsCol = document.getElementById("match-words-col");
  const meaningsCol = document.getElementById("match-meanings-col");
  wordsCol.innerHTML = "";
  meaningsCol.innerHTML = "";

  shuffleArray(roundCards).forEach((c) => {
    const tile = document.createElement("button");
    tile.className = "match-tile word-tile";
    tile.dataset.id = c.id;
    tile.textContent = c.word;
    tile.addEventListener("click", () => onSelectWordTile(tile));
    wordsCol.appendChild(tile);
  });

  shuffleArray(roundCards).forEach((c) => {
    const tile = document.createElement("button");
    tile.className = "match-tile";
    tile.dataset.id = c.id;
    tile.textContent = c.meaning;
    tile.addEventListener("click", () => onSelectMeaningTile(tile));
    meaningsCol.appendChild(tile);
  });

  matchStartTime = performance.now();
  matchTimerInterval = setInterval(() => {
    const elapsed = (performance.now() - matchStartTime) / 1000 + matchPenaltySec;
    document.getElementById("match-timer").textContent = `${elapsed.toFixed(1)}s`;
  }, 100);
}

function onSelectWordTile(tile) {
  document.querySelectorAll("#match-words-col .match-tile").forEach((t) => t.classList.remove("selected"));
  tile.classList.add("selected");
  selectedWordId = tile.dataset.id;
  checkSpeedMatchPair();
}

function onSelectMeaningTile(tile) {
  document.querySelectorAll("#match-meanings-col .match-tile").forEach((t) => t.classList.remove("selected"));
  tile.classList.add("selected");
  selectedMeaningId = tile.dataset.id;
  checkSpeedMatchPair();
}

async function checkSpeedMatchPair() {
  if (!selectedWordId || !selectedMeaningId) return;

  const wTile = document.querySelector(`#match-words-col .match-tile[data-id="${selectedWordId}"]`);
  const mTile = document.querySelector(`#match-meanings-col .match-tile[data-id="${selectedMeaningId}"]`);

  if (selectedWordId === selectedMeaningId) {
    wTile.classList.remove("selected");
    mTile.classList.remove("selected");
    wTile.classList.add("matched");
    mTile.classList.add("matched");
    matchedPairs++;
    document.getElementById("match-count").textContent = String(matchedPairs);

    selectedWordId = null;
    selectedMeaningId = null;

    if (matchedPairs === 6) {
      clearInterval(matchTimerInterval);
      const finalSec = Number(((performance.now() - matchStartTime) / 1000 + matchPenaltySec).toFixed(1));
      const prevBest = Number(localStorage.getItem("vocab_match_best") || 9999);
      const isRecord = finalSec < prevBest;
      if (isRecord) {
        localStorage.setItem("vocab_match_best", finalSec.toFixed(1));
      }

      setTimeout(async () => {
        hideAllArcadeViews();
        document.getElementById("result-badge").textContent = isRecord ? "NEW SPEED RECORD" : "GRID CLEARED";
        document.getElementById("result-title").textContent = `${finalSec.toFixed(1)} Seconds`;
        document.getElementById("result-summary").textContent =
          matchPenaltySec > 0
            ? `Cleared all 6 pairs (includes +${matchPenaltySec}s mismatch penalty).`
            : "Flawless run with zero mismatches!";
        document.getElementById("arcade-result").classList.remove("hidden");
        await markDayCompleted();
      }, 350);
    }
  } else {
    matchPenaltySec += 2;
    wTile.classList.add("mismatch");
    mTile.classList.add("mismatch");
    selectedWordId = null;
    selectedMeaningId = null;
    setTimeout(() => {
      wTile.classList.remove("selected", "mismatch");
      mTile.classList.remove("selected", "mismatch");
    }, 320);
  }
}

document.getElementById("start-match-btn").addEventListener("click", startSpeedMatch);

// ==========================================
// 8. KID MODE ENGINE (7-YEAR-OLD STORY EXPLORER)
// ==========================================
let kidState = {
  points: 0,
  masteredWords: [], // array of word strings
  streaks: {},       // { [word]: 0..5 }
  unlockedCount: 8   // starts with 8 easy words; adds 1 new word each time one is mastered
};

let kidCurrentGame = 1;
let kidCurrentItem = null;
let kidSpeakText = "";
let kidSpellSlots = [];
let kidSpellMissingIndices = [];

function kidDocRef() {
  return doc(db, "users", currentUser.uid, "kid_progress", "profile");
}

async function loadKidState() {
  const localRaw = localStorage.getItem("kid_mode_state_v1");
  if (localRaw) {
    try {
      kidState = { ...kidState, ...JSON.parse(localRaw) };
    } catch (_) {}
  }

  if (currentUser && db) {
    try {
      const snap = await getDoc(kidDocRef());
      if (snap.exists()) {
        kidState = { ...kidState, ...snap.data() };
      } else {
        await saveKidState();
      }
    } catch (err) {
      console.warn("Using local Kid Mode state:", err);
    }
  }
  renderKidHeaderAndHub();
}

async function saveKidState() {
  localStorage.setItem("kid_mode_state_v1", JSON.stringify(kidState));
  if (currentUser && db) {
    try {
      await setDoc(kidDocRef(), {
        ...kidState,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn("Could not sync Kid Mode to Firestore:", err);
    }
  }
}

function getKidLevel() {
  // Starts at Level 0; reaching 100 points unlocks Level 1, 200 -> Level 2, etc.
  return Math.floor(kidState.points / 100);
}

function getKidActivePool() {
  const limit = Math.min(KID_WORD_BANK.length, Math.max(8, kidState.unlockedCount));
  const unlockedSlice = KID_WORD_BANK.slice(0, limit);
  const unmastered = unlockedSlice.filter((w) => !kidState.masteredWords.includes(w.word));
  // If he mastered everything unlocked so far, keep practicing the full unlocked slice
  return unmastered.length > 0 ? unmastered : unlockedSlice;
}

function renderKidHeaderAndHub() {
  const level = getKidLevel();
  const pointsIntoLevel = kidState.points % 100;

  document.getElementById("kid-level-label").textContent = `Level ${level}`;
  document.getElementById("kid-level-bar-fill").style.width = `${pointsIntoLevel}%`;
  document.getElementById("kid-points").textContent = kidState.points;
  document.getElementById("kid-mastered").textContent = kidState.masteredWords.length;

  const limit = Math.min(KID_WORD_BANK.length, Math.max(8, kidState.unlockedCount));
  const unlockedSlice = KID_WORD_BANK.slice(0, limit);
  document.getElementById("kid-active-count").textContent = unlockedSlice.length;

  const gridEl = document.getElementById("kid-active-words-grid");
  gridEl.innerHTML = unlockedSlice
    .map((item) => {
      const isMastered = kidState.masteredWords.includes(item.word);
      const streak = isMastered ? 5 : (kidState.streaks[item.word] || 0);
      const stars = "★".repeat(streak) + "☆".repeat(5 - streak);
      return `
        <div class="kid-word-chip${isMastered ? " is-mastered" : ""}">
          <span>${item.word}</span>
          <span class="kid-chip-stars">${stars}</span>
        </div>
      `;
    })
    .join("");
}

function updateStageStars(word) {
  const isMastered = kidState.masteredWords.includes(word);
  const streak = isMastered ? 5 : (kidState.streaks[word] || 0);
  document.getElementById("kid-word-stars").textContent = "★".repeat(streak) + "☆".repeat(5 - streak);
}

// Confetti Popper Animation
function launchPoppers(burstCount = 70) {
  const canvas = document.getElementById("kid-confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444"];
  const pieces = Array.from({ length: burstCount }, () => ({
    x: canvas.width * (0.2 + Math.random() * 0.6),
    y: canvas.height * 0.45,
    vx: (Math.random() - 0.5) * 14,
    vy: -6 - Math.random() * 10,
    size: 7 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 0.25
  }));

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.rot += p.vRot;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    frame++;
    if (frame < 75) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

async function recordKidAnswer(word, isCorrect, correctDisplayText) {
  const feedbackEl = document.getElementById("kid-feedback-banner");
  const emojiEl = document.getElementById("kid-feedback-emoji");
  const titleEl = document.getElementById("kid-feedback-title");
  const msgEl = document.getElementById("kid-feedback-msg");

  feedbackEl.classList.remove("hidden", "happy", "sad");

  if (isCorrect) {
    launchPoppers(75);
    feedbackEl.classList.add("happy");
    emojiEl.textContent = "🎉";

    const alreadyMastered = kidState.masteredWords.includes(word);
    if (alreadyMastered) {
      titleEl.textContent = "Super Job! 🎉";
      msgEl.textContent = `You already mastered "${word}"! Keep going!`;
    } else {
      const nextStreak = (kidState.streaks[word] || 0) + 1;
      kidState.streaks[word] = nextStreak;

      if (nextStreak >= 5) {
        const prevLevel = getKidLevel();
        kidState.masteredWords.push(word);
        kidState.points += 2;
        if (kidState.unlockedCount < KID_WORD_BANK.length) {
          kidState.unlockedCount += 1;
        }
        const newLevel = getKidLevel();

        if (newLevel > prevLevel) {
          launchPoppers(140);
          emojiEl.textContent = "🎊";
          titleEl.textContent = `LEVEL ${newLevel} UNLOCKED! 👑`;
          msgEl.textContent = `You mastered "${word}" (+2 pts) and reached Level ${newLevel}! A new word was added!`;
        } else {
          titleEl.textContent = `WORD MASTERED! +2 Points 🏆`;
          msgEl.textContent = `5 in a row for "${word}"! A brand-new story word was just unlocked!`;
        }
      } else {
        titleEl.textContent = `Popper Time! (${nextStreak}/5 Stars) 🎉`;
        msgEl.textContent = `${5 - nextStreak} more in a row to master "${word}"!`;
      }
    }
  } else {
    feedbackEl.classList.add("sad");
    emojiEl.textContent = "😢";
    if (!kidState.masteredWords.includes(word)) {
      kidState.streaks[word] = 0;
    }
    titleEl.textContent = "Oops! Try Next Time 😢";
    msgEl.textContent = `The right answer was "${correctDisplayText}". Streak reset to 0/5 — you've got this!`;
  }

  updateStageStars(word);
  renderKidHeaderAndHub();
  await saveKidState();
}

function nextKidRound() {
  document.getElementById("kid-feedback-banner").classList.add("hidden");
  const pool = getKidActivePool();
  const item = pool[Math.floor(Math.random() * pool.length)];
  kidCurrentItem = item;
  updateStageStars(item.word);

  const mcEl = document.getElementById("kid-mc-options");
  const spellEl = document.getElementById("kid-spell-area");
  mcEl.innerHTML = "";

  if (kidCurrentGame === 1) {
    // GAME 1: Synonym or Antonym
    document.getElementById("kid-game-title-pill").textContent = "Game 1 • Twins & Opposites";
    mcEl.classList.remove("hidden");
    spellEl.classList.add("hidden");

    const askSynonym = Math.random() < 0.5;
    const correctAns = askSynonym ? item.synonym : item.antonym;
    document.getElementById("kid-prompt-badge").textContent = askSynonym
      ? "SYNONYM (SAME MEANING)"
      : "ANTONYM (OPPOSITE MEANING)";
    document.getElementById("kid-question-text").textContent = item.word.toUpperCase();
    document.getElementById("kid-clue-text").textContent = `Clue: ${item.clue}`;
    kidSpeakText = item.word;

    const allOtherChoices = KID_WORD_BANK.filter((w) => w.word !== item.word).map((w) =>
      askSynonym ? w.synonym : w.antonym
    );
    const distractors = shuffleArray([...new Set(allOtherChoices)]).slice(0, 3);
    const options = shuffleArray([correctAns, ...distractors]);

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "kid-opt-btn";
      btn.textContent = opt;
      btn.addEventListener("click", async () => {
        document.querySelectorAll(".kid-opt-btn").forEach((b) => (b.disabled = true));
        const ok = opt.toLowerCase() === correctAns.toLowerCase();
        btn.classList.add(ok ? "kid-correct" : "kid-wrong");
        if (!ok) {
          document.querySelectorAll(".kid-opt-btn").forEach((b) => {
            if (b.textContent.toLowerCase() === correctAns.toLowerCase()) b.classList.add("kid-correct");
          });
        }
        await recordKidAnswer(item.word, ok, correctAns);
        setTimeout(nextKidRound, 1750);
      });
      mcEl.appendChild(btn);
    });
  } else if (kidCurrentGame === 2) {
    // GAME 2: Story Sentence Fill
    document.getElementById("kid-game-title-pill").textContent = "Game 2 • Story Sentence";
    mcEl.classList.remove("hidden");
    spellEl.classList.add("hidden");

    document.getElementById("kid-prompt-badge").textContent = "FINISH THE STORY SENTENCE";
    document.getElementById("kid-question-text").innerHTML = formatSentence(item.sentence, false);
    document.getElementById("kid-clue-text").textContent = `Hint: ${item.clue}`;
    kidSpeakText = item.sentence.replace(/\[|\]/g, "");

    const distractors = shuffleArray(KID_WORD_BANK.filter((w) => w.word !== item.word))
      .slice(0, 3)
      .map((w) => w.word);
    const options = shuffleArray([item.word, ...distractors]);

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "kid-opt-btn";
      btn.textContent = opt;
      btn.addEventListener("click", async () => {
        document.querySelectorAll(".kid-opt-btn").forEach((b) => (b.disabled = true));
        const ok = opt.toLowerCase() === item.word.toLowerCase();
        btn.classList.add(ok ? "kid-correct" : "kid-wrong");
        if (!ok) {
          document.querySelectorAll(".kid-opt-btn").forEach((b) => {
            if (b.textContent.toLowerCase() === item.word.toLowerCase()) b.classList.add("kid-correct");
          });
        }
        document.getElementById("kid-question-text").innerHTML = formatSentence(item.sentence, true);
        await recordKidAnswer(item.word, ok, item.word);
        setTimeout(nextKidRound, 1750);
      });
      mcEl.appendChild(btn);
    });
  } else {
    // GAME 3: Missing Letters Spell-It
    document.getElementById("kid-game-title-pill").textContent = "Game 3 • Missing Letters";
    mcEl.classList.add("hidden");
    spellEl.classList.remove("hidden");

    document.getElementById("kid-prompt-badge").textContent = "TAP THE MISSING LETTERS";
    document.getElementById("kid-question-text").textContent = item.clue;
    document.getElementById("kid-clue-text").textContent = `Same as "${item.synonym}" • Opposite of "${item.antonym}"`;
    kidSpeakText = item.word;

    const chars = item.word.toUpperCase().split("");
    const numMissing = chars.length <= 5 ? 2 : 3;
    const candidateIndices = chars.map((_, idx) => idx);
    kidSpellMissingIndices = shuffleArray(candidateIndices).slice(0, numMissing).sort((a, b) => a - b);
    kidSpellSlots = chars.map((ch, idx) => (kidSpellMissingIndices.includes(idx) ? "" : ch));

    const missingLetters = kidSpellMissingIndices.map((idx) => chars[idx]);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const extraLetters = shuffleArray(alphabet.filter((l) => !missingLetters.includes(l))).slice(0, 4);
    const tileBank = shuffleArray([...missingLetters, ...extraLetters]);

    renderKidSpellBoard(tileBank);
  }
}

function renderKidSpellBoard(tileBank) {
  const slotsEl = document.getElementById("kid-letter-slots");
  slotsEl.innerHTML = kidSpellSlots
    .map((ch, idx) => {
      const isMissingSlot = kidSpellMissingIndices.includes(idx);
      return `<div class="kid-slot ${isMissingSlot ? "blank" : "fixed"}">${ch || "_"}</div>`;
    })
    .join("");

  const choicesEl = document.getElementById("kid-letter-choices");
  choicesEl.innerHTML = "";
  tileBank.forEach((letter) => {
    const btn = document.createElement("button");
    btn.className = "kid-letter-tile";
    btn.textContent = letter;
    btn.addEventListener("click", async () => {
      const nextEmptyIdx = kidSpellMissingIndices.find((idx) => kidSpellSlots[idx] === "");
      if (nextEmptyIdx === undefined) return;

      kidSpellSlots[nextEmptyIdx] = letter;
      btn.disabled = true;

      // Re-render slots
      slotsEl.innerHTML = kidSpellSlots
        .map((ch, idx) => {
          const isMissingSlot = kidSpellMissingIndices.includes(idx);
          return `<div class="kid-slot ${isMissingSlot ? "blank" : "fixed"}">${ch || "_"}</div>`;
        })
        .join("");

      // Check if all missing slots are filled
      const allFilled = kidSpellMissingIndices.every((idx) => kidSpellSlots[idx] !== "");
      if (allFilled) {
        document.querySelectorAll(".kid-letter-tile").forEach((t) => (t.disabled = true));
        const builtWord = kidSpellSlots.join("");
        const ok = builtWord === kidCurrentItem.word.toUpperCase();
        await recordKidAnswer(kidCurrentItem.word, ok, kidCurrentItem.word.toUpperCase());
        setTimeout(nextKidRound, 1850);
      }
    });
    choicesEl.appendChild(btn);
  });
}

document.getElementById("kid-clear-letters-btn").addEventListener("click", () => {
  if (!kidCurrentItem) return;
  const chars = kidCurrentItem.word.toUpperCase().split("");
  kidSpellSlots = chars.map((ch, idx) => (kidSpellMissingIndices.includes(idx) ? "" : ch));
  const tiles = Array.from(document.querySelectorAll(".kid-letter-tile")).map((t) => t.textContent);
  renderKidSpellBoard(tiles);
});

document.getElementById("kid-speak-btn").addEventListener("click", () => {
  if (!kidSpeakText) return;
  const utter = new SpeechSynthesisUtterance(kidSpeakText);
  utter.lang = "en-IN";
  utter.rate = 0.9;
  speechSynthesis.speak(utter);
});

// Kid Mode Navigation
document.getElementById("enter-kid-mode-btn").addEventListener("click", async () => {
  document.body.classList.add("kid-theme");
  document.getElementById("app-container").classList.add("hidden");
  document.getElementById("kid-container").classList.remove("hidden");
  document.getElementById("kid-hub").classList.remove("hidden");
  document.getElementById("kid-stage").classList.add("hidden");
  await loadKidState();
});

document.getElementById("exit-kid-mode-btn").addEventListener("click", () => {
  document.body.classList.remove("kid-theme");
  document.getElementById("kid-container").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");
});

document.getElementById("kid-back-hub-btn").addEventListener("click", () => {
  document.getElementById("kid-stage").classList.add("hidden");
  document.getElementById("kid-hub").classList.remove("hidden");
  renderKidHeaderAndHub();
});

document.getElementById("kid-start-g1").addEventListener("click", () => {
  kidCurrentGame = 1;
  document.getElementById("kid-hub").classList.add("hidden");
  document.getElementById("kid-stage").classList.remove("hidden");
  nextKidRound();
});

document.getElementById("kid-start-g2").addEventListener("click", () => {
  kidCurrentGame = 2;
  document.getElementById("kid-hub").classList.add("hidden");
  document.getElementById("kid-stage").classList.remove("hidden");
  nextKidRound();
});

document.getElementById("kid-start-g3").addEventListener("click", () => {
  kidCurrentGame = 3;
  document.getElementById("kid-hub").classList.add("hidden");
  document.getElementById("kid-stage").classList.remove("hidden");
  nextKidRound();
});

// ==========================================
// 9. IMPORT MODAL & BACKUP
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
// 10. WORD BANK & NAVIGATION TABS
// ==========================================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.remove("hidden");

    if (btn.dataset.tab === "arcade-tab") {
      hideAllArcadeViews();
      updateArcadeRecordsUI();
      document.getElementById("arcade-menu").classList.remove("hidden");
    }
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
// 11. BOOTSTRAP APP & SERVICE WORKER
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
        updateArcadeRecordsUI();
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