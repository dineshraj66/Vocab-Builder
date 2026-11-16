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

  // Monday-to-Sunday bounds for the current week
  const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(year, month, now.getDate() + diffToMonday);
  const sunday = new Date(year, month, now.getDate() + diffToMonday + 6);
  const weekStartISO = getLocalISO(monday);
  const weekEndISO = getLocalISO(sunday);

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const yearPrefix = `${year}-`;

  // Dynamic targets based on 10 words/day
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeapYear ? 366 : 365;

  const dailyTarget = DAILY_WORD_TARGET;
  const weeklyTarget = DAILY_WORD_TARGET * 7;
  const monthlyTarget = DAILY_WORD_TARGET * daysInMonth;
  const yearlyTarget = DAILY_WORD_TARGET * daysInYear;

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

  setGoalProgress("goal-daily-text", "goal-daily-bar", dailyCount, dailyTarget);
  setGoalProgress("goal-weekly-text", "goal-weekly-bar", weeklyCount, weeklyTarget);
  setGoalProgress("goal-monthly-text", "goal-monthly-bar", monthlyCount, monthlyTarget);
  setGoalProgress("goal-yearly-text", "goal-yearly-bar", yearlyCount, yearlyTarget);

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
// 7. ARCADE GAMES (HEADLINE QUIZ & SPEED MATCH)
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

// --- GAME 1: HEADLINE FILL-IN-THE-BLANK ---
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

// --- GAME 2: SPEED MATCH (6x2 GRID) ---
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
// 8. IMPORT MODAL & BACKUP
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
// 9. WORD BANK & NAVIGATION TABS
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
// 10. BOOTSTRAP APP & SERVICE WORKER
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