// One-time additive importer for the approved TPC Nov 2026 pub quiz.
// Existing quizzes, rounds, media and all other library fields are preserved.
import { readFileSync, writeFileSync } from "node:fs";

const sourcePath = "data/imports/tpc-nov-2026.json";
const libraryPath = "data/quiz-library.json";
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const library = JSON.parse(readFileSync(libraryPath, "utf8"));
const slug = "tpc-nov-2026";
const quizId = `quiz-${slug}`;

if (source.slug !== slug || source.title !== "TPC Nov 2026") {
  throw new Error("Unexpected quiz source; refusing to modify library.");
}
if (!Array.isArray(source.rounds) || source.rounds.length !== 7 ||
    source.rounds.some((round) =>
      !Array.isArray(round.questions) || round.questions.length !== 10 ||
      round.questions.some((pair) => !Array.isArray(pair) || pair.length !== 2 ||
        !String(pair[0]).trim() || !String(pair[1]).trim()))) {
  throw new Error("TPC Nov 2026 must contain exactly seven complete 10-question rounds.");
}
if (!Array.isArray(library.quizzes) || !Array.isArray(library.roundLibrary) || !Array.isArray(library.media)) {
  throw new Error("Unexpected shared QuizPro library schema; refusing import.");
}

const existingById = library.quizzes.find((quiz) => quiz.id === quizId);
const existingByTitle = library.quizzes.find((quiz) =>
  String(quiz.title || "").trim().toLowerCase() === source.title.toLowerCase());
if (existingByTitle && existingByTitle.id !== quizId) {
  throw new Error("A different quiz already has the title TPC Nov 2026. Import stopped to avoid duplicates.");
}
const today = new Date().toISOString();
function questionFrom(pair, roundNumber, number, prefix) {
  const n = String(roundNumber).padStart(2, "0");
  const q = String(number).padStart(2, "0");
  return {
    id: `question-${slug}-${prefix}-${n}-${q}`,
    number,
    text: pair[0],
    answer: pair[1],
    alternatives: [],
    points: 1,
    type: "Text",
    options: [],
    category: "",
    difficulty: "Medium",
    image: "",
    imageName: "",
    audio: "",
    audioName: "",
    answerImage: "",
    answerImageName: "",
    answerAudio: "",
    answerAudioName: "",
    notes: "",
    timeLimit: 60,
    autoMark: true,
  };
}
function roundFrom(sourceRound, index, libraryVersion) {
  const number = index + 1;
  const n = String(number).padStart(2, "0");
  const libraryId = `saved-round-${slug}-${n}`;
  const base = {
    id: libraryVersion ? libraryId : `round-${slug}-${n}`,
    title: sourceRound.title,
    type: "Standard question round",
    answerMode: "text",
    choiceCount: 4,
    instructions: "",
    scoringRules: "",
    category: sourceRound.category,
    order: number,
    questions: sourceRound.questions.map((pair, q) =>
      questionFrom(pair, number, q + 1, libraryVersion ? "library" : "quiz")),
  };
  return libraryVersion
    ? { ...base, createdAt: today, updatedAt: today }
    : { ...base, librarySourceId: libraryId };
}

let addedRounds = 0;
for (const [index, round] of source.rounds.entries()) {
  const libraryRound = roundFrom(round, index, true);
  const existing = library.roundLibrary.find((saved) => saved.id === libraryRound.id);
  if (!existing) {
    library.roundLibrary.push(libraryRound);
    addedRounds += 1;
  }
}
let addedQuiz = 0;
if (!existingById) {
  library.quizzes.push({
    id: quizId,
    title: source.title,
    date: "",
    time: "",
    venue: "",
    status: "Draft",
    notes: "",
    archived: false,
    rounds: source.rounds.map((round, index) => roundFrom(round, index, false)),
    finalLeaderboard: [],
  });
  addedQuiz = 1;
}
if (addedQuiz || addedRounds) {
  library.updatedAt = today;
  writeFileSync(libraryPath, JSON.stringify(library, null, 2) + "\n", "utf8");
}
console.log(JSON.stringify({
  title: source.title, addedQuiz, addedRounds,
  totalQuizzes: library.quizzes.length,
  totalReusableRounds: library.roundLibrary.length,
  quizRounds: source.rounds.length,
  questions: source.rounds.reduce((n, r) => n + r.questions.length, 0),
}));
