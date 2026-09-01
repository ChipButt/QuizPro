import { createId } from "./src/utils/quiz.js";
import { importQuizDocx } from "./src/utils/docxImport.js";

const STORAGE_KEY = "quizmaster-pro-state-v2";
const ADDON_ID = "quizpro-docx-import-addon";

function buildImportedQuiz(parsed) {
  return {
    id: createId("quiz"),
    title: parsed.title,
    date: "",
    time: "",
    venue: "",
    status: "Draft",
    notes: parsed.warnings.length
      ? `DOCX import notes:\n${parsed.warnings.join("\n")}`
      : "Imported from DOCX.",
    archived: false,
    finalLeaderboard: [],
    rounds: parsed.rounds.map((round, roundIndex) => ({
      id: createId("round"),
      title: round.title,
      type: round.type,
      instructions: "",
      scoringRules: "",
      order: roundIndex + 1,
      questions: round.questions.map((question, questionIndex) => ({
        id: createId("question"),
        number: question.number || questionIndex + 1,
        text: question.text,
        answer: question.answer,
        alternatives: [],
        points: 1,
        type: round.type === "Picture round" ? "Picture" : round.type === "Music round" ? "Music" : "Text",
        category: "",
        difficulty: "Medium",
        image: "",
        audio: "",
        notes: "",
        timeLimit: 60,
        autoMark: true,
      })),
    })),
  };
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveImportedQuiz(quiz) {
  const current = readState() || {
    joinCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    selectedQuizId: "",
    live: {
      status: "Setup",
      screen: "setup",
      registrationOpen: false,
      roundIndex: 0,
      questionIndex: 0,
      locked: false,
      answerRevealed: false,
      elapsedSeconds: 0,
      questionSecondsRemaining: 0,
      audio: { playing: false, progress: 0, volume: 50, maxDuration: 0 },
    },
    media: [],
    quizzes: [],
    teams: [],
    answers: {},
  };

  current.quizzes = [...(current.quizzes || []), quiz];
  current.selectedQuizId = quiz.id;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

function buildUi() {
  const wrapper = document.createElement("div");
  wrapper.id = ADDON_ID;
  wrapper.style.cssText = [
    "margin:0 0 18px",
    "padding:14px 16px",
    "border:1px solid #d9e2eb",
    "border-radius:8px",
    "background:#fff",
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "gap:16px",
    "flex-wrap:wrap",
  ].join(";");

  const copy = document.createElement("div");
  copy.style.cssText = "min-width:240px;flex:1 1 420px";
  copy.innerHTML = `
    <strong style="display:block;margin-bottom:4px;color:#071326">Import an existing Word quiz</strong>
    <span style="color:#607086;font-size:14px">Upload a .docx containing round headings, questions and answers. It will create an editable draft quiz automatically.</span>
    <div data-docx-status style="display:none;margin-top:8px;font-size:13px;font-weight:700;color:#12223a"></div>
  `;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  input.hidden = true;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary-button";
  button.textContent = "Upload .docx";

  const status = copy.querySelector("[data-docx-status]");

  button.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    button.disabled = true;
    button.textContent = "Importing...";
    status.style.display = "block";
    status.textContent = `Reading ${file.name}...`;

    try {
      const parsed = await importQuizDocx(file);
      const quiz = buildImportedQuiz(parsed);
      saveImportedQuiz(quiz);
      status.textContent = `Imported ${parsed.rounds.length} rounds and ${parsed.questionCount} questions. Reloading...`;
      setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      status.textContent = error?.message || "The Word document could not be imported.";
      button.disabled = false;
      button.textContent = "Upload .docx";
      input.value = "";
    }
  });

  wrapper.append(copy, input, button);
  return wrapper;
}

function installAddon() {
  if (document.getElementById(ADDON_ID)) return;

  // If a future compiled build already contains the native importer, do not add a duplicate.
  const nativeButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Upload .docx");
  if (nativeButton) return;

  const page = document.querySelector("main.quizzes-page");
  if (!page) return;

  const titleRow = page.querySelector(".page-title-row");
  if (titleRow) titleRow.insertAdjacentElement("afterend", buildUi());
  else page.prepend(buildUi());
}

const observer = new MutationObserver(installAddon);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", () => setTimeout(installAddon, 0));
installAddon();
