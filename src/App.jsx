import { useEffect, useRef, useState } from "react";
import HostShell from "./components/HostShell.jsx";
import QuizmasterPreviewView from "./components/QuizmasterPreviewView.jsx";
import TeamView from "./components/TeamView.jsx";
import { useGitHubQuizLibrary } from "./hooks/useGitHubQuizLibrary.js";
import { useQuizState } from "./hooks/useQuizState.js";

const QUIZMASTER_PREVIEW_PAGES = [
  ["live", "Live Quiz"],
  ["teams", "Teams & Answers"],
  ["results", "Results"],
];

const PREVIEW_LEADERBOARD = [
  { id: "team-2", name: "Universally Challenged", score: 38 },
  { id: "preview-team", name: "The Quizzy Rascals", score: 35 },
  { id: "team-3", name: "Agatha Quiztie", score: 31 },
  { id: "team-4", name: "No Eye Deer", score: 28 },
  { id: "team-5", name: "The Smartinis", score: 27 },
  { id: "team-6", name: "Risky Quizness", score: 25 },
  { id: "team-7", name: "Norfolk 'n' Chance", score: 24 },
  { id: "team-8", name: "The Know It Ales", score: 22 },
  { id: "team-9", name: "Victorious Secret", score: 20 },
  { id: "team-10", name: "Google Wasn't Invited", score: 19 },
  { id: "team-11", name: "Les Quizerables", score: 17 },
  { id: "team-12", name: "Let's Get Quizzical", score: 15 },
  { id: "team-13", name: "The Guessing Game", score: 13 },
  { id: "team-14", name: "Table Trouble", score: 11 },
];

function simulatedTeamAnswer(question, teamId, teamIndex) {
  if (!question) return "";
  if (question.type === "Multiple choice") {
    const options = question.options || [];
    if (!options.length) return "";
    const preferred = [1, 1, 0, 1, 2][teamIndex] ?? 0;
    return options[Math.min(options.length - 1, preferred)] || options[0];
  }

  const answersByQuestion = {
    q1: ["Canberra", "Canberra", "Sydney", "Canberra", "Canberra"],
    q3: ["Vincent van Gogh", "Van Gogh", "Monet", "Vincent van Gogh", "Van Gogh"],
  };
  const choices = answersByQuestion[question.id] || [question.answer, question.answer, "Not sure", question.answer, question.answer];
  return choices[teamIndex] ?? question.answer ?? "";
}

function createPreviewHarnessState(stage) {
  const firstIsMultipleChoice = false;
  const questions = [
    firstIsMultipleChoice
      ? {
          id: "q1",
          number: 1,
          type: "Multiple choice",
          text: "Which planet is known as the Red Planet?",
          answer: "Mars",
          options: ["Venus", "Mars", "Jupiter", "Mercury"],
          revealed: stage === "answer-reveal",
        }
      : {
          id: "q1",
          number: 1,
          type: "Text",
          text: "What is the capital city of Australia?",
          answer: "Canberra",
          options: [],
          revealed: stage === "answer-reveal",
        },
    {
      id: "q2",
      number: 2,
      type: "Multiple choice",
      text: "Which element has the chemical symbol Au?",
      answer: "Gold",
      options: ["Silver", "Gold", "Argon", "Copper"],
      revealed: false,
    },
    {
      id: "q3",
      number: 3,
      type: "Text",
      text: "Who painted The Starry Night?",
      answer: "Vincent van Gogh",
      options: [],
      revealed: false,
    },
    {
      id: "q4",
      number: 4,
      type: "Multiple choice",
      text: "Which ocean is the largest?",
      answer: "Pacific Ocean",
      options: ["Atlantic", "Indian", "Arctic", "Pacific"],
      revealed: false,
    },
  ];

  let teamScreen = "lobby";
  let questionIndex = -1;
  let timerActive = false;
  let timerEndsAt = 0;
  let timerDurationSeconds = 0;
  let nameLocked = true;
  let finalRevealCount = 0;

  return {
    type: "snapshot",
    team: {
      id: "preview-team",
      name: nameLocked ? "The Quizzy Rascals" : "",
      nameLocked,
      table: 7,
      players: 4,
    },
    teams: [
      { id: "preview-team", name: "The Quizzy Rascals", table: 7, players: 4 },
      { id: "team-2", name: "Universally Challenged", table: 2, players: 5 },
      { id: "team-3", name: "Agatha Quiztie", table: 11, players: 3 },
      { id: "team-4", name: "No Eye Deer", table: 5, players: 6 },
      { id: "team-5", name: "The Smartinis", table: 9, players: 4 },
    ],
    teamResponses: {},
    teamResponseHistory: {},
    askedQuestionIds: [],
    answerWave: null,
    hostQuestionIndex: 0,
    quiz: { totalRounds: 5 },
    waitingFacts: [
      "The word quiz may have been popularised in Dublin in the 18th century.",
      "Octopuses have three hearts.",
      "A group of flamingos is called a flamboyance.",
    ],
    roundScores: [],
    leaderboard: PREVIEW_LEADERBOARD,
    teamAnswers: {},
    teamAnswersCount: 0,
    live: {
      teamScreen,
      roundIndex: 0,
      questionIndex,
      timerActive,
      timerEndsAt,
      timerDurationSeconds,
      finalRevealCount,
    },
    nextRound: { number: 2, title: "Music" },
    round: {
      id: "preview-round",
      title: "General Knowledge",
      totalQuestions: 10,
      teamLocked: false,
      forceLocked: teamScreen === "round_locked",
      questions,
    },
  };
}

function applyQuizmasterPreviewAction(current, action, values = {}, stage) {
  if (!current) return createPreviewHarnessState(stage);
  if (action === "reset-scenario") return createPreviewHarnessState(stage);

  const liveQuestionIndex = Math.max(0, Number(current.live?.questionIndex ?? 0));
  const hostQuestionIndex = Math.max(0, Number(current.hostQuestionIndex ?? liveQuestionIndex));
  const questions = current.round?.questions || [];
  const currentQuestion = questions[hostQuestionIndex];

  const withLive = (patch) => ({
    ...current,
    live: { ...current.live, ...patch },
  });

  if (action === "previous-question" || action === "next-question") {
    const delta = action === "next-question" ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(Math.max(0, questions.length - 1), hostQuestionIndex + delta));
    return {
      ...current,
      hostQuestionIndex: nextIndex,
    };
  }

  if (action === "send-question") {
    const sentQuestion = questions[hostQuestionIndex];
    const nextTeamAnswers = { ...(current.teamAnswers || {}) };
    if (sentQuestion?.id) delete nextTeamAnswers[sentQuestion.id];
    const askedQuestionIds = sentQuestion?.id
      ? Array.from(new Set([...(current.askedQuestionIds || []), sentQuestion.id]))
      : (current.askedQuestionIds || []);
    return {
      ...current,
      team: { ...current.team, name: current.team.name || "The Quizzy Rascals", nameLocked: true },
      teamAnswers: nextTeamAnswers,
      teamResponses: {},
      askedQuestionIds,
      answerWave: sentQuestion?.id ? { questionId: sentQuestion.id, nonce: Date.now() } : null,
      round: {
        ...current.round,
        forceLocked: false,
        questions: questions.map((question, index) => index === hostQuestionIndex ? { ...question, revealed: false } : question),
      },
      live: {
        ...current.live,
        teamScreen: "question",
        questionIndex: hostQuestionIndex,
        timerActive: false,
        timerEndsAt: 0,
        timerDurationSeconds: 0,
      },
    };
  }

  if (action === "toggle-question-type" && currentQuestion) {
    const makeMultipleChoice = currentQuestion.type !== "Multiple choice";
    const replacement = makeMultipleChoice
      ? {
          ...currentQuestion,
          type: "Multiple choice",
          text: "Which planet is known as the Red Planet?",
          answer: "Mars",
          options: ["Venus", "Mars", "Jupiter", "Mercury"],
          revealed: false,
        }
      : {
          ...currentQuestion,
          type: "Text",
          text: "What is the capital city of Australia?",
          answer: "Canberra",
          options: [],
          revealed: false,
        };
    return {
      ...current,
      round: {
        ...current.round,
        questions: questions.map((question, index) => index === hostQuestionIndex ? replacement : question),
      },
      live: { ...current.live, teamScreen: "question", timerActive: false, timerEndsAt: 0, timerDurationSeconds: 0 },
    };
  }

  if (action === "reveal-answer" && currentQuestion) {
    return {
      ...current,
      round: {
        ...current.round,
        questions: questions.map((question, index) => index === hostQuestionIndex ? { ...question, revealed: true } : question),
      },
      live: { ...current.live, teamScreen: "question" },
    };
  }

  if (action === "mark-preview-answer") {
    const questionId = values.questionId;
    const teamId = values.teamId;
    const status = values.status;
    if (!questionId || !teamId || !["correct", "half", "incorrect"].includes(status)) return current;
    const existing = current.teamResponseHistory?.[questionId]?.[teamId];
    if (!existing) return current;
    const nextResponse = { ...existing, status, markSource: "manual" };
    return {
      ...current,
      teamResponseHistory: {
        ...(current.teamResponseHistory || {}),
        [questionId]: {
          ...(current.teamResponseHistory?.[questionId] || {}),
          [teamId]: nextResponse,
        },
      },
      teamResponses: current.live?.questionIndex >= 0 && current.round?.questions?.[current.live.questionIndex]?.id === questionId
        ? { ...(current.teamResponses || {}), [teamId]: nextResponse }
        : (current.teamResponses || {}),
    };
  }

  if (action === "start-timer") {
    const seconds = Math.max(5, Number(values.seconds) || 45);
    return {
      ...current,
      team: { ...current.team, name: current.team.name || "The Quizzy Rascals", nameLocked: true },
      live: {
        ...current.live,
        teamScreen: "question",
        timerActive: true,
        timerEndsAt: Date.now() + seconds * 1000,
        timerDurationSeconds: seconds,
      },
    };
  }

  if (action === "cancel-timer") {
    return withLive({ timerActive: false, timerEndsAt: 0, timerDurationSeconds: 0 });
  }

  if (action === "show-waiting") {
    return {
      ...current,
      team: { ...current.team, name: current.team.name || "The Quizzy Rascals", nameLocked: true },
      round: { ...current.round, forceLocked: false },
      live: {
        ...current.live,
        teamScreen: "lobby",
        questionIndex: -1,
        timerActive: false,
        timerEndsAt: 0,
        timerDurationSeconds: 0,
      },
    };
  }

  if (action === "lock-round") {
    return {
      ...current,
      round: { ...current.round, forceLocked: true },
      live: {
        ...current.live,
        teamScreen: "round_locked",
        timerActive: false,
        timerEndsAt: 0,
        timerDurationSeconds: 0,
      },
    };
  }

  if (action === "show-leaderboard") {
    return withLive({ teamScreen: "leaderboard", timerActive: false, timerEndsAt: 0, timerDurationSeconds: 0 });
  }

  if (action === "show-final") {
    return withLive({ teamScreen: "final", finalRevealCount: 0, timerActive: false, timerEndsAt: 0, timerDurationSeconds: 0 });
  }

  if (action === "reveal-next-final") {
    return withLive({
      teamScreen: "final",
      finalRevealCount: Math.min(PREVIEW_LEADERBOARD.length, Number(current.live?.finalRevealCount ?? 0) + 1),
      timerActive: false,
      timerEndsAt: 0,
      timerDurationSeconds: 0,
    });
  }

  return current;
}

function applyQuizTakerPreviewAction(current, message) {
  if (!current || !message) return current;
  if (message.type === "set-team-name") {
    return {
      ...current,
      team: { ...current.team, name: message.name, nameLocked: true },
    };
  }
  if (message.type === "save-answer") {
    const teamAnswers = {
      ...current.teamAnswers,
      [message.questionId]: { text: message.text },
    };
    const rawCurrentQuestionIndex = Number(current.live?.questionIndex ?? -1);
    const currentQuestionId = rawCurrentQuestionIndex >= 0
      ? current.round?.questions?.[rawCurrentQuestionIndex]?.id
      : undefined;
    const question = current.round?.questions?.find((item) => item.id === message.questionId);
    const response = {
      teamId: "preview-team",
      answer: message.text,
      status: String(message.text || "").trim().toLowerCase() === String(question?.answer || "").trim().toLowerCase() ? "correct" : "incorrect",
      markSource: "auto",
      receivedAt: Date.now(),
    };
    const teamResponses = currentQuestionId === message.questionId
      ? {
          ...(current.teamResponses || {}),
          "preview-team": response,
        }
      : (current.teamResponses || {});
    const teamResponseHistory = {
      ...(current.teamResponseHistory || {}),
      [message.questionId]: {
        ...(current.teamResponseHistory?.[message.questionId] || {}),
        "preview-team": response,
      },
    };
    return {
      ...current,
      teamAnswers,
      teamResponses,
      teamResponseHistory,
      teamAnswersCount: Object.keys(teamAnswers).length,
    };
  }
  return current;
}

function getRoute() {
  const hash = window.location.hash || "#/host";
  if (hash.startsWith("#/host-preview/")) {
    const stage = decodeURIComponent(hash.split("/")[2] || "live");
    return { kind: "host-preview", stage };
  }
  if (hash.startsWith("#/preview/")) {
    const stage = decodeURIComponent(hash.split("/")[2] || "team-name");
    return { kind: "preview", stage: stage === "locked" ? "between-rounds" : stage };
  }
  if (hash === "#/preview" || hash === "#/preview/") return { kind: "preview", stage: "live" };
  if (hash.startsWith("#/join/")) {
    const parts = hash.replace(/^#\//, "").split("/");
    return {
      kind: "join",
      sessionCode: decodeURIComponent(parts[1] ?? "").trim().toUpperCase(),
      teamToken: decodeURIComponent(parts[2] ?? "").trim(),
    };
  }
  if (hash === "#/join" || hash === "#/join/") {
    return { kind: "join", sessionCode: "", teamToken: "" };
  }
  return { kind: "host" };
}

function HostApp() {
  const { state, updateState, resetState, storageError } = useQuizState();
  const sharedLibrary = useGitHubQuizLibrary(state, updateState);
  return <HostShell state={state} updateState={updateState} resetState={resetState} sharedLibrary={sharedLibrary} storageError={storageError} />;
}

function TeamPreview({ stage }) {
  const PHONE_WIDTH = 390;
  const PHONE_HEIGHT = 844;
  const FRAME_BORDER = 8;
  const FRAME_WIDTH = PHONE_WIDTH + FRAME_BORDER * 2;
  const FRAME_HEIGHT = PHONE_HEIGHT + FRAME_BORDER * 2;
  const PHONE_GAP = 24;

  const hostIframeRef = useRef(null);
  const teamIframeRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [simState, setSimState] = useState(() => createPreviewHarnessState(stage));
  const [bulbSize, setBulbSize] = useState(360);
  const [factBoxWidth, setFactBoxWidth] = useState(158);
  const [factBoxX, setFactBoxX] = useState(50);
  const [factBoxY, setFactBoxY] = useState(39);
  const [editorEnabled, setEditorEnabled] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [layoutExport, setLayoutExport] = useState("");

  const sendPreviewStyle = () => {
    teamIframeRef.current?.contentWindow?.postMessage({
      type: "quiz-preview-style",
      bulbSize,
      factBoxWidth,
      factBoxX,
      factBoxY,
    }, window.location.origin);
  };

  const sendEditor = (action, values = {}) => {
    hostIframeRef.current?.contentWindow?.postMessage({
      type: "quiz-layout-editor",
      action,
      ...values,
    }, window.location.origin);
  };

  const sendSimulation = (state = simState) => {
    hostIframeRef.current?.contentWindow?.postMessage({
      type: "quizmaster-preview-state",
      state,
    }, window.location.origin);
    teamIframeRef.current?.contentWindow?.postMessage({
      type: "quiz-preview-snapshot",
      snapshot: state,
    }, window.location.origin);
  };

  const updateSelectedField = (field, rawValue) => {
    if (!selectedElement || selectedElement.locked) return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    const next = { ...selectedElement, [field]: value };
    setSelectedElement(next);
    sendEditor("update-selected", { values: { [field]: value } });
  };

  useEffect(() => {
    setSelectedElement(null);
    setLayoutExport("");
  }, [stage]);

  useEffect(() => {
    const updateScale = () => {
      const sidebarWidth = window.innerWidth >= 760 ? 220 : 0;
      const horizontalChrome = window.innerWidth >= 760 ? 28 + 56 : 28;
      const verticalChrome = window.innerWidth >= 760 ? 56 : 160;
      const availableWidth = Math.max(260, window.innerWidth - sidebarWidth - horizontalChrome);
      const availableHeight = Math.max(420, window.innerHeight - verticalChrome);
      const pairWidth = FRAME_WIDTH * 2 + PHONE_GAP;
      setPreviewScale(Math.min(1, availableWidth / pairWidth, availableHeight / FRAME_HEIGHT));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [FRAME_HEIGHT, FRAME_WIDTH]);

  useEffect(() => {
    sendPreviewStyle();
  }, [bulbSize, factBoxWidth, factBoxX, factBoxY, stage]);

  useEffect(() => {
    sendSimulation(simState);
  }, [simState]);

  useEffect(() => {
    if (!simState.answerWave?.questionId) return undefined;
    const wave = simState.answerWave;
    const timers = [650, 1450, 2350, 3450].map((delay, index) => window.setTimeout(() => {
      setSimState((current) => {
        if (current.answerWave?.nonce !== wave.nonce || current.answerWave?.questionId !== wave.questionId) return current;
        const question = current.round?.questions?.find((item) => item.id === wave.questionId);
        const team = current.teams?.[index + 1];
        if (!question || !team || current.teamResponseHistory?.[question.id]?.[team.id]) return current;
        const answer = simulatedTeamAnswer(question, team.id, index + 1);
        const response = {
          teamId: team.id,
          answer,
          status: String(answer || "").trim().toLowerCase() === String(question.answer || "").trim().toLowerCase() ? "correct" : "incorrect",
          markSource: "auto",
          receivedAt: Date.now(),
        };
        return {
          ...current,
          teamResponses: {
            ...(current.teamResponses || {}),
            [team.id]: response,
          },
          teamResponseHistory: {
            ...(current.teamResponseHistory || {}),
            [question.id]: {
              ...(current.teamResponseHistory?.[question.id] || {}),
              [team.id]: response,
            },
          },
        };
      });
    }, delay));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [simState.answerWave]);

  useEffect(() => {
    if (!simState.live?.timerActive || !simState.live?.timerEndsAt) return undefined;
    const delay = Math.max(0, Number(simState.live.timerEndsAt) - Date.now()) + 80;
    const timer = window.setTimeout(() => {
      setSimState((current) => {
        if (!current.live?.timerActive) return current;
        if (Number(current.live.timerEndsAt || 0) > Date.now()) return current;
        return {
          ...current,
          round: { ...current.round, forceLocked: true },
          live: {
            ...current.live,
            teamScreen: "round_locked",
            timerActive: false,
            timerEndsAt: 0,
            timerDurationSeconds: 0,
          },
        };
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [simState.live?.timerActive, simState.live?.timerEndsAt]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data || {};

      if (message.type === "quizmaster-preview-action") {
        setSimState((current) => applyQuizmasterPreviewAction(current, message.action, message, stage));
        return;
      }

      if (message.type === "quiz-taker-preview-action") {
        setSimState((current) => applyQuizTakerPreviewAction(current, message.message));
        return;
      }

      if (message.type === "quizmaster-preview-ready") {
        sendSimulation();
        sendEditor("set-enabled", { enabled: editorEnabled });
        return;
      }

      if (message.type === "quiz-taker-preview-ready") {
        sendSimulation();
        sendPreviewStyle();
        return;
      }

      if (message.type === "quiz-layout-selection") {
        setSelectedElement({
          path: message.path,
          label: message.label,
          x: Number(message.x || 0),
          y: Number(message.y || 0),
          width: Number(message.width || 0),
          height: Number(message.height || 0),
          fontSize: Number(message.fontSize || 16),
          zIndex: Number(message.zIndex || 0),
          locked: Boolean(message.locked),
        });
        return;
      }

      if (message.type === "quiz-layout-selection-cleared") {
        setSelectedElement(null);
        return;
      }

      if (message.type === "quiz-layout-export") {
        setLayoutExport(JSON.stringify({
          version: message.version || 1,
          stage: message.stage,
          viewport: message.viewport,
          modified: message.modified || {},
          elements: message.elements || [],
        }, null, 2));
        return;
      }

      if (message.type === "quiz-preview-ready" && message.target === "quizmaster") {
        sendSimulation();
        sendEditor("set-enabled", { enabled: editorEnabled });
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editorEnabled, bulbSize, factBoxWidth, factBoxX, factBoxY, stage, simState]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#111827",
      display: "grid",
      gridTemplateColumns: window.innerWidth >= 760 ? "220px minmax(0, 1fr)" : "1fr",
      gap: 28,
      alignItems: "start",
      justifyContent: "center",
      padding: "28px",
      boxSizing: "border-box",
      overflow: "auto"
    }}>
      <aside style={{
        position: window.innerWidth >= 760 ? "sticky" : "static",
        top: 28,
        width: window.innerWidth >= 760 ? 220 : "100%",
        padding: 14,
        borderRadius: 14,
        background: "#0b1220",
        boxShadow: "0 8px 30px rgba(0,0,0,.35)",
        boxSizing: "border-box"
      }}>
        <div style={{ color: "#fff", font: "800 14px system-ui", margin: "2px 4px 4px" }}>Dual UI testing</div>
        <div style={{ color: "#94a3b8", font: "600 9px/1.35 system-ui", margin: "0 4px 12px" }}>
          Edit the Quizmaster phone. The Quiz Taker phone reacts to its controls.
        </div>

        <div style={{ color: "#fff", font: "800 11px system-ui", margin: "8px 4px 7px" }}>Quizmaster pages</div>
        <div style={{ display: "grid", gap: 6, gridTemplateColumns: window.innerWidth >= 760 ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
          {QUIZMASTER_PREVIEW_PAGES.map(([id, label]) => (
            <a key={id} href={`#/preview/${id}`} style={{
              color: id === stage ? "#111" : "#fff",
              background: id === stage ? "#f3c94b" : "#26324a",
              textDecoration: "none", padding: "9px 10px", borderRadius: 8,
              font: "600 12px system-ui"
            }}>{label}</a>
          ))}
          <a href="#/host" style={{
            color: "#fff", background: "#7b2d36", textDecoration: "none",
            padding: "9px 10px", borderRadius: 8, font: "600 12px system-ui",
            marginTop: window.innerWidth >= 760 ? 6 : 0
          }}>Exit preview</a>
        </div>

        <div style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid #26324a",
          display: "grid",
          gap: 10
        }}>
          <div style={{ color: "#fff", font: "800 12px system-ui" }}>Quizmaster layout editor</div>

          <button
            type="button"
            onClick={() => {
              const next = !editorEnabled;
              setEditorEnabled(next);
              setSelectedElement(null);
              sendEditor("set-enabled", { enabled: next });
            }}
            style={{
              border: 0,
              borderRadius: 8,
              padding: "9px 10px",
              background: editorEnabled ? "#0891b2" : "#26324a",
              color: "#fff",
              font: "800 11px system-ui",
              cursor: "pointer"
            }}
          >
            {editorEnabled ? "Editing ON" : "Enable editing"}
          </button>

          <div style={{ color: "#9ca3af", font: "500 10px/1.35 system-ui" }}>
            {editorEnabled
              ? "Click anything on the Quizmaster phone. Drag to move; use handles to resize."
              : "The Quiz Taker phone remains functional but is not editable in this view."}
          </div>

          {editorEnabled && selectedElement ? (
            <div style={{
              display: "grid",
              gap: 9,
              padding: 10,
              borderRadius: 9,
              background: "#111827",
              border: selectedElement.locked ? "1px solid #f59e0b" : "1px solid #334155"
            }}>
              <div style={{
                color: selectedElement.locked ? "#fbbf24" : "#67e8f9",
                font: "700 10px/1.3 system-ui",
                wordBreak: "break-word"
              }}>
                {selectedElement.label}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {[
                  ["x", "X"],
                  ["y", "Y"],
                  ["width", "Width"],
                  ["height", "Height"],
                  ["fontSize", "Text size"],
                  ["zIndex", "Layer"],
                ].map(([field, label]) => (
                  <label key={field} style={{
                    display: "grid",
                    gap: 3,
                    gridColumn: ["fontSize", "zIndex"].includes(field) ? "1 / -1" : undefined,
                    color: "#9ca3af",
                    font: "600 9px system-ui"
                  }}>
                    <span>{label}</span>
                    <input
                      type="number"
                      step={field === "fontSize" ? "0.5" : "1"}
                      value={selectedElement[field]}
                      disabled={selectedElement.locked}
                      onChange={(event) => updateSelectedField(field, event.target.value)}
                      style={{
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        background: selectedElement.locked ? "#1f2937" : "#0f172a",
                        color: "#fff",
                        padding: "6px 7px",
                        font: "600 10px system-ui"
                      }}
                    />
                  </label>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button type="button" disabled={selectedElement.locked} onClick={() => sendEditor("layer-backward")} style={{ border: 0, borderRadius: 7, padding: "8px 7px", background: "#334155", color: "#fff", font: "800 9px system-ui" }}>← Back layer</button>
                <button type="button" disabled={selectedElement.locked} onClick={() => sendEditor("layer-forward")} style={{ border: 0, borderRadius: 7, padding: "8px 7px", background: "#0c4a6e", color: "#fff", font: "800 9px system-ui" }}>Forward layer →</button>
              </div>

              <button type="button" disabled={selectedElement.locked} onClick={() => sendEditor("center-selected")} style={{ border: 0, borderRadius: 7, padding: "8px 9px", background: "#1d4ed8", color: "#fff", font: "800 10px system-ui" }}>Center align</button>
              <button type="button" onClick={() => sendEditor(selectedElement.locked ? "unlock-selected" : "lock-selected")} style={{ border: 0, borderRadius: 7, padding: "8px 9px", background: selectedElement.locked ? "#92400e" : "#0f766e", color: "#fff", font: "800 10px system-ui" }}>{selectedElement.locked ? "Unlock element" : "Lock element"}</button>
              <button type="button" disabled={selectedElement.locked} onClick={() => sendEditor("reset-selected")} style={{ border: 0, borderRadius: 7, padding: "7px 9px", background: "#26324a", color: "#fff", font: "700 10px system-ui" }}>Reset selected</button>
            </div>
          ) : null}

          {editorEnabled && !selectedElement ? (
            <div style={{ color: "#94a3b8", font: "600 10px/1.35 system-ui" }}>
              Click an element on the Quizmaster phone to select it.
            </div>
          ) : null}

          {editorEnabled ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button type="button" onClick={() => sendEditor("lock-all")} style={{ border: 0, borderRadius: 7, padding: "7px", background: "#78350f", color: "#fff", font: "700 9px system-ui" }}>Lock all</button>
              <button type="button" onClick={() => sendEditor("unlock-all")} style={{ border: 0, borderRadius: 7, padding: "7px", background: "#26324a", color: "#fff", font: "700 9px system-ui" }}>Unlock all</button>
              <button type="button" onClick={() => { if (window.confirm("Reset every Quizmaster layout edit on this preview page?")) sendEditor("reset-page"); }} style={{ gridColumn: "1 / -1", border: 0, borderRadius: 7, padding: "7px", background: "#7f1d1d", color: "#fff", font: "700 9px system-ui" }}>Reset Quizmaster page</button>
              <button type="button" onClick={() => sendEditor("export")} style={{ gridColumn: "1 / -1", border: 0, borderRadius: 7, padding: "7px", background: "#312e81", color: "#fff", font: "700 9px system-ui" }}>Generate Quizmaster JSON</button>
            </div>
          ) : null}

          {layoutExport ? (
            <div style={{ display: "grid", gap: 7 }}>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(layoutExport); } catch { /* manual copy remains */ } }} style={{ border: 0, borderRadius: 7, padding: "8px 9px", background: "#0f766e", color: "#fff", font: "800 10px system-ui" }}>Copy Quizmaster JSON</button>
              <textarea readOnly value={layoutExport} style={{ width: "100%", minHeight: 150, boxSizing: "border-box", resize: "vertical", border: "1px solid #334155", borderRadius: 7, background: "#020617", color: "#cbd5e1", padding: 7, font: "500 8px/1.3 monospace" }} />
            </div>
          ) : null}
        </div>


      </aside>

      <div style={{ minWidth: 0, display: "grid", justifyItems: "center", alignItems: "start" }}>
        <div style={{
          width: (FRAME_WIDTH * 2 + PHONE_GAP) * previewScale,
          height: FRAME_HEIGHT * previewScale,
          position: "relative"
        }}>
          <div style={{
            width: FRAME_WIDTH * 2 + PHONE_GAP,
            height: FRAME_HEIGHT,
            position: "absolute",
            inset: 0,
            transform: `scale(${previewScale})`,
            transformOrigin: "top left",
            display: "grid",
            gridTemplateColumns: `${FRAME_WIDTH}px ${FRAME_WIDTH}px`,
            gap: PHONE_GAP
          }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "#f3c94b", font: "900 11px system-ui", letterSpacing: ".08em", textAlign: "center" }}>QUIZMASTER · EDITABLE</div>
              <div style={{
                width: FRAME_WIDTH,
                height: FRAME_HEIGHT - 20,
                borderRadius: 28,
                background: "#05070b",
                boxShadow: "0 14px 50px rgba(0,0,0,.5)",
                padding: FRAME_BORDER,
                boxSizing: "border-box",
                overflow: "hidden"
              }}>
                <iframe
                  ref={hostIframeRef}
                  key={`host-${stage}`}
                  title={`Quizmaster preview: ${stage}`}
                  src={`#/host-preview/${encodeURIComponent(stage)}`}
                  onLoad={() => {
                    sendSimulation();
                    sendEditor("set-enabled", { enabled: editorEnabled });
                  }}
                  style={{
                    display: "block",
                    width: PHONE_WIDTH,
                    height: PHONE_HEIGHT,
                    border: 0,
                    borderRadius: 20,
                    background: "#061b38"
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "#67e8f9", font: "900 11px system-ui", letterSpacing: ".08em", textAlign: "center" }}>QUIZ TAKER · LIVE RESPONSE</div>
              <div style={{
                width: FRAME_WIDTH,
                height: FRAME_HEIGHT - 20,
                borderRadius: 28,
                background: "#05070b",
                boxShadow: "0 14px 50px rgba(0,0,0,.5)",
                padding: FRAME_BORDER,
                boxSizing: "border-box",
                overflow: "hidden"
              }}>
                <iframe
                  ref={teamIframeRef}
                  key="team-linked-preview"
                  title="Quiz-taker live response preview"
                  src="#/join/__PREVIEW__/linked"
                  onLoad={() => {
                    sendSimulation();
                    sendPreviewStyle();
                  }}
                  style={{
                    display: "block",
                    width: PHONE_WIDTH,
                    height: PHONE_HEIGHT,
                    border: 0,
                    borderRadius: 20,
                    background: "#fff"
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, color: "#9ca3af", font: "600 11px system-ui", letterSpacing: ".02em" }}>
          Two linked 390 × 844 phone viewports · Quizmaster actions update the Quiz Taker preview
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route.kind === "preview") return <TeamPreview stage={route.stage} />;
  if (route.kind === "host-preview") return <QuizmasterPreviewView stage={route.stage} />;
  if (route.kind === "join") return <TeamView sessionCode={route.sessionCode} teamToken={route.teamToken} />;
  return <HostApp />;
}
