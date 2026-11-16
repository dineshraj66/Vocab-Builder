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
// 2. STARTER DATA (ADULT + KID STORY VOCAB + MINI-BOOKS)
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

const DEFAULT_KID_WORDS = [
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

const KID_STORYBOOKS = [
  {
    id: "book1",
    requiredMastered: 0,
    icon: "🗺️",
    title: "Chapter 1: The Cave of Glowing Maps",
    summary: "Starter Adventure • Unlocked right away!",
    text: "One [chilly] morning, a [brave] boy named Leo and his [clever] puppy stepped into a quiet forest. Under an [ancient] banyan tree, they spotted a [bright] golden key. Leo had to [whisper] so he would not wake the sleeping owls. When they opened the wooden chest, they let out a happy [giggle]—inside was a map leading to a [gigantic] waterfall!"
  },
  {
    id: "book2",
    requiredMastered: 5,
    icon: "🐋",
    title: "Chapter 2: The Secret Island Voyage",
    summary: "Unlock at 5 Mastered Words",
    text: "The [curious] crew sailed across the blue sea on a [sturdy] wooden boat. Suddenly, an [enormous] whale splashed near the deck and made their lunchboxes seem to [vanish] under a wave! A [generous] fisherman shared [plenty] of sweet bananas, and soon the sun began to [gleam] over a hidden island waiting for them to [discover]."
  },
  {
    id: "book3",
    requiredMastered: 10,
    icon: "🧙‍♂️",
    title: "Chapter 3: The Teapot Wizard",
    summary: "Unlock at 10 Mastered Words",
    text: "Deep in the hills lived a [peculiar] wizard who painted [vivid] rainbows in the sky. He was [cautious] with his magic potions because even a tiny drop could [astonish] the whole village! When a [frantic] squirrel lost its acorns in the fog, the wizard used a [brilliant] spell to [conceal] the nuts safely inside a hollow oak."
  },
  {
    id: "book4",
    requiredMastered: 15,
    icon: "🦚",
    title: "Chapter 4: The Peacock of Tranquil Valley",
    summary: "Unlock at 15 Mastered Words",
    text: "After crossing a [perilous] rope bridge, the explorers reached a [tranquil] valley where rare birds [dwell]. A [magnificent] peacock danced beside an [abundant] orchard of fruit trees. Even though he was the finest bird in the forest, he stayed [humble] and taught young travelers how to [navigate] home by the stars."
  },
  {
    id: "book5",
    requiredMastered: 20,
    icon: "🏆",
    title: "Chapter 5: The Great Treehouse Festival",
    summary: "Unlock at 20 Mastered Words",
    text: "Every child in town felt [cheerful] on festival day. Even a [timid] hedgehog joined the parade after a [gentle] rabbit invited him along. With [persistent] teamwork, they decorated the [tidy] treehouse with lanterns, and the whole forest cheered in [triumph] under the moonlight."
  },
  {
    id: "book6",
    requiredMastered: 25,
    icon: "👑",
    title: "Chapter 6: Master of a Thousand Stories",
    summary: "Unlock at 25 Mastered Words",
    text: "No puzzle was too [fragile] or tricky for a reader who refused to be [reluctant]. Whenever a [fierce] riddle blocked the castle gate, our young hero solved it with a [swift] smile, proving that books hold the greatest magic in the world."
  }
];

const PET_STAGES = [
  { minPts: 0, avatar: "🥚", name: "Mystery Egg", nextText: "Next hatch at 20 pts!" },
  { minPts: 20, avatar: "🐣", name: "Cracking Hatchling", nextText: "Next evolution at 50 pts!" },
  { minPts: 50, avatar: "🐲", name: "Baby Story Dragon", nextText: "Next evolution at 100 pts!" },
  { minPts: 100, avatar: "🐉", name: "Winged Fire Dragon", nextText: "Next evolution at 200 pts!" },
  { minPts: 200, avatar: "🧙‍♂️🐉", name: "Wizard Dragon", nextText: "Next evolution at 350 pts!" },
  { minPts: 350, avatar: "👑🐉✨", name: "Grand Book King", nextText: "Max Evolution Achieved!" }
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
// 4. WEB AUDIO SOUND EFFECTS (KID MODE)
// ==========================================
let audioCtx = null;

function playKidTone(type) {
  if (!kidState.soundOn) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "correct") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now);       // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === "levelup") {
      osc.type = "sine";
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => osc.frequency.setValueAtTime(freq, now + idx * 0.09));
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.linearRampToValueAtTime(165, now + 0.28);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (_) {}
}

function speakKidText(text) {
  if (!text) return;
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-IN";
  utter.rate = 0.88;
  speechSynthesis.speak(utter);
}

// ==========================================
// 5. FIRESTORE DATA & PRACTICE LOGS (ADULT)
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
  setGoalProgress("goal-monthly-text", "goal