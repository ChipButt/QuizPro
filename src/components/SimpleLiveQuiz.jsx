import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Eye,
  EyeOff,
  Lock,
  Menu,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Send,
  Settings2,
  Trash2,
  Trophy,
  Unlock,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { autoScoreAnswer, computeLeaderboard } from "../utils/quiz.js";
import {
  createSessionCode,
  createTeamSlot,
  getLiveQuiz,
  isRoundForceLocked,
} from "../utils/liveSession.js";

function useCountdown(endsAt, active) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active || !endsAt) {
      setSeconds(0);
      return undefined;
    }
    const tick = () => setSeconds(Math.max(0, Math.ceil((Number(endsAt) - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [active, endsAt]);
  return seconds;
}

function joinUrl(sessionCode, token) {
  return `${window.location.origin}${window.location.pathname}#/join/${sessionCode}/${token}`;
}

function quizMeta(quiz) {
  const rounds = quiz.rounds?.length ?? 0;
  const questions = (quiz.rounds ?? []).reduce((total, round) => total + (round.questions?.length ?? 0), 0);
  return `${rounds} round${rounds === 1 ? "" : "s"} · ${questions} question${questions === 1 ? "" : "s"}`;
}

function NetworkBadge({ network }) {
  const online = network?.status === "online";
  return (
    <span className={`simple-network-badge ${online ? "online" : "offline"}`}>
      {online ? <Wifi size={14} /> : <WifiOff size={14} />}
      {online ? `${network.connectedCount} connected` : network?.status || "offline"}
    </span>
  );
}

export default function SimpleLiveQuiz({ state, updateState, network }) {
  const quiz = getLiveQuiz(state);
  const liveRoundIndex = Number(state.live?.roundIndex ?? 0);
  const liveQuestionIndex = Number(state.live?.questionIndex ?? -1);
  const liveRound = quiz?.rounds?.[liveRoundIndex] ?? null;
  const liveQuestion = liveQuestionIndex >= 0 ? liveRound?.questions?.[liveQuestionIndex] ?? null : null;

  const [reviewRoundIndex, setReviewRoundIndex] = useState(liveRoundIndex);
  const [reviewQuestionIndex, setReviewQuestionIndex] = useState(Math.max(0, liveQuestionIndex));
  const [openPanel, setOpenPanel] = useState(null);
  const [liveTab, setLiveTab] = useState("questions");
  const [controlsOpen, setControlsOpen] = useState(false);
  const [screenPreview, setScreenPreview] = useState(null);
  const [waitingRoundIndex, setWaitingRoundIndex] = useState(liveRoundIndex);
  const reviewRound = quiz?.rounds?.[reviewRoundIndex] ?? null;
  const reviewQuestion = reviewRound?.questions?.[reviewQuestionIndex] ?? null;
  const reviewingLiveQuestion = Boolean(
    reviewQuestion &&
    reviewRoundIndex === liveRoundIndex &&
    reviewQuestionIndex === liveQuestionIndex
  );

  const leaderboard = useMemo(() => computeLeaderboard(state), [state]);
  const [table, setTable] = useState("");
  const [players, setPlayers] = useState(4);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [timerChoice, setTimerChoice] = useState(30);
  const timerSeconds = useCountdown(state.live?.timerEndsAt, state.live?.timerActive);
  const hostAudioRef = useRef(null);

  useEffect(() => {
    if (!state.live?.timerActive || timerSeconds > 0) return;
    const roundId = state.live?.timerRoundId || liveRound?.id;
    if (!roundId) return;

    updateState((current) => {
      if (!current.live?.timerActive) return current;
      const endsAt = Number(current.live?.timerEndsAt ?? 0);
      if (endsAt && endsAt > Date.now()) return current;

      return {
        ...current,
        live: {
          ...current.live,
          timerActive: false,
          timerEndsAt: 0,
          timerDurationSeconds: 0,
          timerRoundId: "",
          teamScreen: "round_locked",
          forceLockedRounds: {
            ...(current.live?.forceLockedRounds ?? {}),
            [roundId]: true,
          },
        },
      };
    });
  }, [timerSeconds, state.live?.timerActive, state.live?.timerEndsAt, state.live?.timerRoundId, liveRound?.id, updateState]);

  useEffect(() => {
    if (!quiz) return;
    setReviewRoundIndex((current) => Math.min(current, Math.max(0, quiz.rounds.length - 1)));
  }, [quiz?.id, quiz?.rounds?.length]);

  useEffect(() => {
    if (!quiz?.rounds?.length) return;
    setWaitingRoundIndex((current) => Math.min(Math.max(0, current), quiz.rounds.length - 1));
  }, [quiz?.id, quiz?.rounds?.length]);

  function updateLive(patch) {
    updateState((current) => ({ ...current, live: { ...current.live, ...patch } }));
  }

  function togglePanel(panel) {
    setOpenPanel((current) => current === panel ? null : panel);
  }

  function openTeamsPanel() {
    setScreenPreview(null);
    setControlsOpen(false);
    setOpenPanel("teams");
  }

  function loadQuiz(quizId) {
    if (state.live?.sessionActive && (state.teams.length || Object.keys(state.answers ?? {}).length)) {
      const okay = window.confirm("Start a new live quiz? This clears the current teams and submitted answers, but leaves every saved quiz untouched.");
      if (!okay) return;
    }
    const code = createSessionCode();
    updateState((current) => ({
      ...current,
      selectedQuizId: quizId,
      joinCode: code,
      teams: [],
      answers: {},
      teamRoundLocks: {},
      live: {
        ...current.live,
        quizId,
        sessionCode: code,
        sessionActive: true,
        status: "Setup",
        teamScreen: "lobby",
        roundIndex: 0,
        questionIndex: -1,
        revealMode: "round",
        revealedQuestions: {},
        revealedRounds: {},
        askedQuestionIds: [],
        forceLockedRounds: {},
        timerActive: false,
        timerEndsAt: 0,
        timerRoundId: "",
        finalRevealCount: 0,
        audio: { questionId: "", playNonce: 0 },
      },
    }));
    setReviewRoundIndex(0);
    setReviewQuestionIndex(0);
    setOpenPanel(null);
    setLiveTab("questions");
    setControlsOpen(false);
    setScreenPreview(null);
    setSelectedTeamId(null);
  }

  function stopSession() {
    const okay = window.confirm("Finish this live session and return to the quiz list? Saved quizzes are not affected.");
    if (!okay) return;
    updateState((current) => ({
      ...current,
      live: {
        ...current.live,
        sessionActive: false,
        status: "Setup",
        teamScreen: "lobby",
        questionIndex: -1,
        audio: { questionId: "", playNonce: Number(current.live?.audio?.playNonce ?? 0) },
      },
      teams: [],
      answers: {},
      teamRoundLocks: {},
    }));
  }

  function addTeam() {
    if (!state.live?.sessionActive) return;
    const team = createTeamSlot({ table, players });
    updateState((current) => ({ ...current, teams: [...current.teams, team] }));
    setTable("");
  }

  function updateTeam(teamId, patch) {
    updateState((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === teamId ? { ...team, ...patch } : team),
    }));
  }

  function removeTeam(teamId) {
    updateState((current) => ({
      ...current,
      teams: current.teams.filter((team) => team.id !== teamId),
      teamRoundLocks: Object.fromEntries(
        Object.entries(current.teamRoundLocks ?? {}).map(([roundId, locks]) => [
          roundId,
          Object.fromEntries(Object.entries(locks).filter(([id]) => id !== teamId)),
        ]),
      ),
    }));
    setSelectedTeamId((current) => current === teamId ? null : current);
  }

  function reviewRoundAt(index) {
    if (!quiz?.rounds?.[index]) return;
    setReviewRoundIndex(index);
    setReviewQuestionIndex(0);
  }

  function activateRound(index) {
    if (!quiz?.rounds?.[index]) return;
    updateLive({
      roundIndex: index,
      questionIndex: -1,
      teamScreen: "lobby",
      timerActive: false,
      timerEndsAt: 0,
      timerRoundId: "",
      status: "Live",
      audio: { questionId: "", playNonce: Number(state.live?.audio?.playNonce ?? 0) },
    });
    setReviewRoundIndex(index);
    setReviewQuestionIndex(0);
  }

  function pushReviewedQuestion() {
    if (!reviewRound || !reviewQuestion) return;
    updateState((current) => {
      const askedQuestionIds = Array.from(new Set([
        ...(current.live?.askedQuestionIds ?? []),
        reviewQuestion.id,
      ]));
      return {
        ...current,
        live: {
          ...current.live,
          status: "Live",
          teamScreen: "question",
          roundIndex: reviewRoundIndex,
          questionIndex: reviewQuestionIndex,
          askedQuestionIds,
          timerActive: false,
          timerEndsAt: 0,
          timerRoundId: "",
          audio: { questionId: "", playNonce: Number(current.live?.audio?.playNonce ?? 0) },
        },
      };
    });
  }

  function toggleLiveAnswer() {
    if (!liveQuestion) return;
    updateState((current) => {
      const next = { ...(current.live?.revealedQuestions ?? {}) };
      if (next[liveQuestion.id]) delete next[liveQuestion.id];
      else next[liveQuestion.id] = true;
      return { ...current, live: { ...current.live, revealedQuestions: next } };
    });
  }

  function revealReviewedAnswer() {
    if (!reviewRound || !reviewQuestion) return;
    updateState((current) => {
      const askedQuestionIds = Array.from(new Set([
        ...(current.live?.askedQuestionIds ?? []),
        reviewQuestion.id,
      ]));
      return {
        ...current,
        live: {
          ...current.live,
          status: "Live",
          teamScreen: "question",
          roundIndex: reviewRoundIndex,
          questionIndex: reviewQuestionIndex,
          askedQuestionIds,
          revealedQuestions: {
            ...(current.live?.revealedQuestions ?? {}),
            [reviewQuestion.id]: true,
          },
          timerActive: false,
          timerEndsAt: 0,
          timerDurationSeconds: 0,
          timerRoundId: "",
        },
      };
    });
  }

  function runAnswerFlow(reviewQuestionAsked, reviewQuestionRevealed) {
    if (!reviewQuestion || !reviewRound) return;
    if (reviewQuestionRevealed) {
      setReviewQuestionIndex((index) => Math.min(reviewRound.questions.length - 1, index + 1));
      return;
    }
    if (reviewQuestionAsked) {
      revealReviewedAnswer();
      return;
    }
    pushReviewedQuestion();
  }

  function toggleLiveRoundAnswers() {
    if (!liveRound) return;
    updateState((current) => {
      const next = { ...(current.live?.revealedRounds ?? {}) };
      const wasRevealed = Boolean(next[liveRound.id]);
      if (wasRevealed) delete next[liveRound.id];
      else next[liveRound.id] = true;
      return {
        ...current,
        live: {
          ...current.live,
          revealedRounds: next,
          teamScreen: wasRevealed ? (current.live?.questionIndex >= 0 ? "question" : "lobby") : "round_review",
        },
      };
    });
  }

  function startLockTimer() {
    if (!liveRound) return;
    const duration = Math.max(5, Number(timerChoice) || 30);
    updateLive({
      teamScreen: "round_review",
      timerActive: true,
      timerEndsAt: Date.now() + duration * 1000,
      timerDurationSeconds: duration,
      timerRoundId: liveRound.id,
    });
  }

  function cancelTimer() {
    updateLive({ timerActive: false, timerEndsAt: 0, timerDurationSeconds: 0, timerRoundId: "" });
  }

  function lockLiveRoundNow() {
    if (!liveRound) return;
    updateState((current) => ({
      ...current,
      live: {
        ...current.live,
        timerActive: false,
        timerEndsAt: 0,
        timerDurationSeconds: 0,
        timerRoundId: "",
        teamScreen: "round_locked",
        forceLockedRounds: {
          ...(current.live.forceLockedRounds ?? {}),
          [liveRound.id]: true,
        },
      },
    }));
  }

  function unlockLiveRound() {
    if (!liveRound) return;
    updateState((current) => {
      const forceLockedRounds = { ...(current.live.forceLockedRounds ?? {}) };
      delete forceLockedRounds[liveRound.id];
      return {
        ...current,
        live: {
          ...current.live,
          forceLockedRounds,
          teamScreen: "round_review",
        },
      };
    });
  }

  function markAnswer(questionId, teamId, score) {
    const markedQuestion = quiz?.rounds?.flatMap((round) => round.questions ?? []).find((item) => item.id === questionId);
    if (!markedQuestion) return;
    const max = Number(markedQuestion.points ?? 1);
    const nextScore = Math.max(0, Math.min(max, Number(score) || 0));
    updateState((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [markedQuestion.id]: {
          ...(current.answers?.[markedQuestion.id] ?? {}),
          [teamId]: {
            ...(current.answers?.[markedQuestion.id]?.[teamId] ?? {}),
            score: nextScore,
            status: nextScore >= max ? "correct" : nextScore > 0 ? "half" : "incorrect",
            markSource: "manual",
            reason: "Quizmaster override",
          },
        },
      },
    }));
  }

  function autoMarkQuestion(question) {
    if (!question) return;
    updateState((current) => {
      const existing = current.answers?.[question.id] ?? {};
      const nextAnswers = { ...existing };

      for (const [teamId, answer] of Object.entries(existing)) {
        const text = String(answer?.text ?? "").trim();
        if (!text) continue;
        const result = autoScoreAnswer(question, text);
        nextAnswers[teamId] = {
          ...answer,
          score: ["correct", "incorrect"].includes(result.status) ? result.score : null,
          status: result.status,
          reason: result.reason,
          markSource: "auto",
        };
      }

      return {
        ...current,
        answers: {
          ...current.answers,
          [question.id]: nextAnswers,
        },
      };
    });
  }

  function autoMarkRound(round) {
    if (!round) return;
    updateState((current) => {
      const answers = { ...current.answers };

      for (const question of round.questions ?? []) {
        const existing = current.answers?.[question.id] ?? {};
        const nextQuestionAnswers = { ...existing };

        for (const [teamId, answer] of Object.entries(existing)) {
          const text = String(answer?.text ?? "").trim();
          if (!text) continue;
          const result = autoScoreAnswer(question, text);
          nextQuestionAnswers[teamId] = {
            ...answer,
            score: ["correct", "incorrect"].includes(result.status) ? result.score : null,
            status: result.status,
            reason: result.reason,
            markSource: "auto",
          };
        }

        answers[question.id] = nextQuestionAnswers;
      }

      return { ...current, answers };
    });
  }

  function replayHostOnly() {
    const audio = hostAudioRef.current;
    if (!audio) return;
    audio.pause();
    try { audio.currentTime = 0; } catch { /* ignored */ }
    audio.play().catch(() => {});
  }

  function replayOnAllDevices() {
    if (!reviewQuestion?.audio || !reviewingLiveQuestion) return;
    replayHostOnly();
    updateState((current) => ({
      ...current,
      live: {
        ...current.live,
        audio: {
          questionId: reviewQuestion.id,
          playNonce: Number(current.live?.audio?.playNonce ?? 0) + 1,
        },
      },
    }));
  }

  function beginFinalReveal() {
    updateLive({
      teamScreen: "final",
      status: "Completed",
      finalRevealCount: 0,
      timerActive: false,
      timerEndsAt: 0,
    });
  }

  function revealNextFinalTeam() {
    updateLive({
      finalRevealCount: Math.min(state.teams.length, Number(state.live.finalRevealCount ?? 0) + 1),
    });
  }

  function previewTeamScreen(screen) {
    if (screen === "waiting" && quiz?.rounds?.length) {
      const suggested = Math.min(
        quiz.rounds.length - 1,
        Math.max(0, liveRoundIndex + (liveQuestionIndex >= 0 ? 1 : 0)),
      );
      setWaitingRoundIndex(suggested);
    }
    setScreenPreview(screen);
    setControlsOpen(false);
    setOpenPanel(null);
  }

  function pushPreviewedScreen() {
    if (!screenPreview) return;

    if (screenPreview === "waiting") {
      const targetIndex = Math.min(
        Math.max(0, Number(waitingRoundIndex) || 0),
        Math.max(0, (quiz?.rounds?.length ?? 1) - 1),
      );
      updateLive({
        teamScreen: "lobby",
        roundIndex: targetIndex,
        waitingRoundIndex: targetIndex,
        questionIndex: -1,
        timerActive: false,
        timerEndsAt: 0,
        timerDurationSeconds: 0,
        timerRoundId: "",
      });
      return;
    }

    if (screenPreview === "round_locked") {
      if (!liveRound) return;
      updateState((current) => ({
        ...current,
        live: {
          ...current.live,
          teamScreen: "round_locked",
          timerActive: false,
          timerEndsAt: 0,
          timerDurationSeconds: 0,
          timerRoundId: "",
          forceLockedRounds: {
            ...(current.live?.forceLockedRounds ?? {}),
            [liveRound.id]: true,
          },
        },
      }));
      return;
    }

    if (screenPreview === "leaderboard") {
      updateLive({
        teamScreen: "leaderboard",
        timerActive: false,
        timerEndsAt: 0,
        timerDurationSeconds: 0,
        timerRoundId: "",
      });
      return;
    }

    if (screenPreview === "final") {
      beginFinalReveal();
    }
  }

  if (!state.live?.sessionActive || !quiz) {
    return (
      <main className="simple-page simple-live-page planuf-live-page">
        <div className="simple-page-heading">
          <div><h1>Run a Quiz</h1><p>Select one of your saved quizzes when you are ready to run it.</p></div>
        </div>
        <section className="simple-card planuf-soft-card">
          <h2>Saved quizzes</h2>
          <div className="simple-live-quiz-list">
            {state.quizzes.filter((item) => !item.archived).map((item) => (
              <div key={item.id}>
                <div><strong>{item.title || "Untitled quiz"}</strong><span>{quizMeta(item)}</span></div>
                <button className="primary-button" disabled={!item.rounds?.some((roundItem) => roundItem.questions?.length)} onClick={() => loadQuiz(item.id)}>
                  <Play size={15} /> Load quiz
                </button>
              </div>
            ))}
            {!state.quizzes.filter((item) => !item.archived).length ? <p className="simple-empty-copy">No quizzes are saved yet.</p> : null}
          </div>
        </section>
      </main>
    );
  }

  const liveLocked = liveRound ? isRoundForceLocked(state, liveRound.id) : false;
  const teamLocks = liveRound ? Object.values(state.teamRoundLocks?.[liveRound.id] ?? {}).filter(Boolean).length : 0;
  const reviewAnswers = reviewQuestion ? state.answers?.[reviewQuestion.id] ?? {} : {};
  const askedQuestionIds = new Set(state.live?.askedQuestionIds ?? []);
  if (liveQuestion?.id) askedQuestionIds.add(liveQuestion.id);
  for (const round of quiz?.rounds ?? []) {
    for (const question of round.questions ?? []) {
      if (Object.keys(state.answers?.[question.id] ?? {}).length) askedQuestionIds.add(question.id);
    }
  }
  const askedReviewQuestions = (reviewRound?.questions ?? []).filter((item) => askedQuestionIds.has(item.id));
  const reviewQuestionAsked = Boolean(reviewQuestion && askedQuestionIds.has(reviewQuestion.id));
  const reviewQuestionRevealed = Boolean(
    reviewQuestion &&
    (
      state.live?.revealedQuestions?.[reviewQuestion.id] ||
      (reviewRound && state.live?.revealedRounds?.[reviewRound.id])
    )
  );
  const canReviewNext = Boolean(reviewRound && reviewQuestionIndex < (reviewRound.questions?.length ?? 0) - 1);
  const questionExplicitlyRevealed = Boolean(liveQuestion && state.live?.revealedQuestions?.[liveQuestion.id]);
  const liveRoundRevealed = Boolean(liveRound && state.live?.revealedRounds?.[liveRound.id]);
  const liveQuestionRevealed = Boolean(liveQuestion && (questionExplicitlyRevealed || liveRoundRevealed));
  const finalRevealCount = Number(state.live.finalRevealCount ?? 0);
  const selectedTeam = state.teams.find((team) => team.id === selectedTeamId) ?? null;

  return (
    <main className="simple-page simple-live-page planuf-live-page">
      <div className="planuf-bubble planuf-bubble-a" />
      <div className="planuf-bubble planuf-bubble-b" />
      <div className="simple-page-heading planuf-live-heading">
        <div><span className="planuf-mini-pill">QUIZMASTER</span><h1>Live Quiz</h1><p>{quiz.title || "Untitled quiz"}</p></div>
        <div className="simple-live-heading-actions">
          <NetworkBadge network={network} />
          <button className="ghost-button" onClick={stopSession}>Finish session</button>
        </div>
      </div>

      {network?.status === "code-conflict" ? <div className="simple-warning"><WifiOff size={16} /> This live session code is already in use.</div> : null}

      <section className={`host-control-deck ${controlsOpen ? "menu-open" : ""}`}>
        <div className="host-live-status-strip host-live-mobile-banner">
          <button
            type="button"
            className={`host-live-menu-toggle ${controlsOpen ? "active" : ""}`}
            aria-label="Open live quiz controls"
            aria-expanded={controlsOpen}
            onClick={() => setControlsOpen((open) => !open)}
          >
            <Menu size={18} />
          </button>
          <div><span>Teams see</span><strong>R{liveRoundIndex + 1}{liveQuestion ? ` · Q${liveQuestionIndex + 1}` : " · waiting"}</strong></div>
          <div><span>Session</span><strong>{state.live.sessionCode}</strong></div>
          <button
            type="button"
            className={`host-live-banner-timer ${state.live.timerActive ? "active" : ""}`}
            disabled={liveLocked || !liveRound}
            onClick={state.live.timerActive ? cancelTimer : startLockTimer}
          >
            <Clock3 size={15} />
            {state.live.timerActive ? `${timerSeconds}s · Stop` : "Start Timer"}
          </button>
        </div>

        <button type="button" className="host-manage-teams-button" onClick={openTeamsPanel}>
          <Users size={16} />
          <span>Manage Teams</span>
          <b>{state.teams.length}</b>
        </button>

        {controlsOpen ? (
          <div className="host-live-controls-popout">
            <label className="host-live-timer-setting">
              <span>Timer length</span>
              <select value={timerChoice} onChange={(event) => setTimerChoice(Number(event.target.value))}>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={180}>3 minutes</option>
                <option value={300}>5 minutes</option>
              </select>
            </label>

            <div className="host-tool-row">
              <button className={openPanel === "teams" ? "active" : ""} onClick={openTeamsPanel}><Users size={16} /> Teams <b>{state.teams.length}</b></button>
              <button className={openPanel === "answers" ? "active" : ""} onClick={() => togglePanel("answers")}><Check size={16} /> Round answers <b>{reviewRound?.questions?.reduce((count, item) => count + Object.keys(state.answers?.[item.id] ?? {}).length, 0) ?? 0}</b></button>
              <button className={`${openPanel === "round" ? "active" : ""} ${liveLocked ? "locked" : ""}`} onClick={() => togglePanel("round")}><Settings2 size={16} /> Round</button>
            </div>

            <div className="host-screen-menu">
              <span>SCREENS</span>
              <div className="host-screen-menu-grid">
                <button type="button" onClick={() => previewTeamScreen("waiting")}><Unlock size={15} /> Waiting</button>
                <button type="button" onClick={() => previewTeamScreen("round_locked")}><Lock size={15} /> Round Locked</button>
                <button type="button" onClick={() => previewTeamScreen("leaderboard")}><Trophy size={15} /> Leaderboard</button>
                <button type="button" onClick={() => previewTeamScreen("final")}><Trophy size={15} /> Final</button>
              </div>
            </div>

            <div className="host-reveal-mode-row">
              <span>Reveal answers</span>
              <button className={state.live.revealMode === "question" ? "selected" : ""} onClick={() => updateLive({ revealMode: "question" })}>After each question</button>
              <button className={state.live.revealMode === "round" ? "selected" : ""} onClick={() => updateLive({ revealMode: "round" })}>End of round</button>
            </div>
          </div>
        ) : null}

        {openPanel ? (
          <div className={`host-tool-drawer ${openPanel}`}>
            <button className="host-drawer-close" aria-label="Close" onClick={() => setOpenPanel(null)}><X size={16} /></button>

            {openPanel === "teams" ? (
              <>
                <div className="host-drawer-title"><div><h3>Teams & QR codes</h3><p>Add a team, then let them scan their unique code.</p></div></div>
                <div className="simple-add-team-row compact-add-team">
                  <label>Table<input value={table} onChange={(event) => setTable(event.target.value)} placeholder="7" /></label>
                  <label>Players<input type="number" min="1" max="30" value={players} onChange={(event) => setPlayers(Number(event.target.value) || 1)} /></label>
                  <button className="primary-button" onClick={addTeam}><Plus size={15} /> Add team</button>
                </div>
                <div className="host-team-tile-grid">
                  {state.teams.map((team) => (
                    <button
                      type="button"
                      key={team.id}
                      className={`host-team-tile ${team.paid ? "paid" : ""}`}
                      onClick={() => setSelectedTeamId(team.id)}
                    >
                      {team.table ? <span className="host-team-tile-table">Table {team.table}</span> : null}
                      <span className="host-team-tile-players">{Math.max(1, Number(team.players) || 1)} Player{Number(team.players) === 1 ? "" : "s"}</span>
                      <strong>{team.name || "No Team Name"}</strong>
                    </button>
                  ))}
                  {!state.teams.length ? <p className="simple-empty-copy">No teams added yet.</p> : null}
                </div>
              </>
            ) : null}

            {openPanel === "answers" ? (
              <>
                <div className="host-drawer-title">
                  <div><h3>{reviewRound?.title || "Round answers"}</h3><p>Every answer in this round, live as teams submit.</p></div>
                  <div className="answer-drawer-actions">
                    <button className="ghost-button compact" disabled={!reviewRound} onClick={() => autoMarkRound(reviewRound)}>
                      <RefreshCcw size={13} /> Auto mark round
                    </button>
                  </div>
                </div>
                <div className="round-answer-matrix">
                  {(reviewRound?.questions ?? []).map((item, questionIndex) => {
                    const questionAnswers = state.answers?.[item.id] ?? {};
                    return (
                      <section className={`round-answer-question ${reviewRoundIndex === liveRoundIndex && questionIndex === liveQuestionIndex ? "is-live" : ""}`} key={item.id}>
                        <button className="round-answer-question-head" onClick={() => setReviewQuestionIndex(questionIndex)}>
                          <span>Q{questionIndex + 1}</span>
                          <div><strong>{item.text || "Untitled question"}</strong><small>Correct answer: <b>{item.answer || "Not set"}</b></small></div>
                          <em>{Object.keys(questionAnswers).length}/{state.teams.length}</em>
                        </button>
                        <div className="round-answer-team-list">
                          {state.teams.map((team) => {
                            const answer = questionAnswers[team.id];
                            return (
                              <div className={`round-answer-team ${answer?.status || "unanswered"}`} key={team.id}>
                                <strong>{team.name || `Table ${team.table || "?"}`}</strong>
                                <span>{answer?.text || "No answer yet"}</span>
                                {answer ? <div className="round-answer-marks">
                                  <button aria-label={`Mark ${team.name || "team"} incorrect`} className={answer.status === "incorrect" ? "selected incorrect" : ""} onClick={() => markAnswer(item.id, team.id, 0)}>0</button>
                                  <button aria-label={`Award ${team.name || "team"} half points`} className={answer.status === "half" ? "selected half" : ""} onClick={() => markAnswer(item.id, team.id, Number(item.points ?? 1) / 2)}>½</button>
                                  <button aria-label={`Mark ${team.name || "team"} correct`} className={answer.status === "correct" ? "selected correct" : ""} onClick={() => markAnswer(item.id, team.id, Number(item.points ?? 1))}><Check size={14} /></button>
                                </div> : <small>WAITING</small>}
                              </div>
                            );
                          })}
                          {!state.teams.length ? <p className="simple-empty-copy">Add teams to see their answers here.</p> : null}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            ) : null}

            {openPanel === "round" ? (
              <>
                <div className="host-drawer-title"><div><h3>{liveRound?.title || "Live round"}</h3><p>Team answers save automatically while the round is in progress.</p></div><span className={liveLocked ? "drawer-state locked" : "drawer-state"}>{liveLocked ? "ROUND OVER" : "IN PROGRESS"}</span></div>
                <div className="host-drawer-actions">
                  {!liveLocked ? <button className="danger-soft-button" onClick={lockLiveRoundNow}><Lock size={15} /> End round now</button> : <button className="ghost-button" onClick={unlockLiveRound}><Unlock size={15} /> Re-open round for edits</button>}
                  <button className="ghost-button" disabled={!liveRound} onClick={() => autoMarkRound(liveRound)}><RefreshCcw size={15} /> Auto mark round</button>
                  <button className={`reveal-toggle ${liveRoundRevealed ? "active" : ""}`} onClick={toggleLiveRoundAnswers}>
                    {liveRoundRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                    {liveRoundRevealed ? "Hide round answers" : "Reveal round answers"}
                  </button>
                </div>
              </>
            ) : null}

            {openPanel === "timer" ? (
              <>
                <div className="host-drawer-title"><div><h3>Round end timer</h3><p>Teams see how long they have left to make sure every question has an answer.</p></div>{state.live.timerActive ? <strong className="drawer-countdown">{timerSeconds}s</strong> : null}</div>
                <div className="host-timer-controls">
                  <select value={timerChoice} onChange={(event) => setTimerChoice(Number(event.target.value))}>
                    <option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option><option value={300}>5 minutes</option>
                  </select>
                  {!state.live.timerActive ? <button className="primary-button" disabled={liveLocked || !liveRound} onClick={startLockTimer}><Clock3 size={15} /> Start round-end timer</button> : <button className="ghost-button" onClick={cancelTimer}><X size={15} /> Cancel timer</button>}
                </div>
              </>
            ) : null}

          </div>
        ) : null}
      </section>

      {selectedTeam ? (
        <div className="host-team-popup-backdrop" role="presentation" onClick={() => setSelectedTeamId(null)}>
          <section
            className="host-team-popup"
            role="dialog"
            aria-modal="true"
            aria-label={selectedTeam.name ? `${selectedTeam.name} team details` : "No Team Name team details"}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="host-team-popup-close"
              aria-label="Close team details"
              onClick={() => setSelectedTeamId(null)}
            >
              <X size={22} />
            </button>

            <div className="host-team-popup-details">
              <span>TEAM DETAILS</span>
              <h2>{selectedTeam.name || "No Team Name"}</h2>
            </div>

            <div className="host-team-popup-edit">
              <label className="host-team-popup-name-field">
                <span>Team Name</span>
                <input
                  value={selectedTeam.name ?? ""}
                  onChange={(event) => {
                    const name = event.target.value;
                    updateTeam(selectedTeam.id, { name, nameLocked: Boolean(name.trim()) });
                  }}
                  placeholder="No Team Name"
                />
              </label>

              <div className="host-team-popup-meta-row">
                <label>
                  <span>Table Number</span>
                  <input
                    value={selectedTeam.table ?? ""}
                    onChange={(event) => updateTeam(selectedTeam.id, { table: event.target.value })}
                    placeholder="No table"
                  />
                </label>

                <label>
                  <span>Number of Players</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={selectedTeam.players ?? 1}
                    onChange={(event) => updateTeam(selectedTeam.id, { players: Math.max(1, Number(event.target.value) || 1) })}
                  />
                </label>

                <button
                  type="button"
                  className={`host-team-paid-toggle ${selectedTeam.paid ? "paid" : ""}`}
                  onClick={() => updateTeam(selectedTeam.id, { paid: !selectedTeam.paid })}
                >
                  <Check size={16} />
                  <span>{selectedTeam.paid ? "Paid" : "Paid"}</span>
                </button>
              </div>
            </div>

            <div className="host-team-popup-qr">
              <QRCodeSVG
                value={joinUrl(state.live.sessionCode, selectedTeam.token)}
                size={512}
                marginSize={2}
              />
            </div>

            <button
              type="button"
              className="danger-soft-button host-team-popup-remove"
              onClick={() => removeTeam(selectedTeam.id)}
            >
              <Trash2 size={15} /> Remove Team
            </button>
          </section>
        </div>
      ) : null}

      <nav className="host-live-tabs" aria-label="Live quiz views">
        <button type="button" className={!screenPreview && liveTab === "questions" ? "active" : ""} onClick={() => { setScreenPreview(null); setLiveTab("questions"); }}>Questions</button>
        <button type="button" className={!screenPreview && liveTab === "answers" ? "active" : ""} onClick={() => { setScreenPreview(null); setLiveTab("answers"); }}>Answers</button>
      </nav>

      {screenPreview ? (
        <section className={`host-screen-preview host-screen-preview-${screenPreview}`}>
          <div className="host-screen-preview-top">
            <div>
              <span>PRIVATE QUIZMASTER PREVIEW</span>
              <strong>
                {screenPreview === "waiting" ? "Waiting Screen" :
                 screenPreview === "round_locked" ? "Round Locked" :
                 screenPreview === "leaderboard" ? "Leaderboard" : "Final"}
              </strong>
            </div>
            <button type="button" className="primary-button host-push-screen-button" onClick={pushPreviewedScreen}>
              <Send size={16} /> Push To Teams
            </button>
          </div>

          {screenPreview === "waiting" ? (
            <>
              <label className="host-waiting-round-selector">
                <span>Waiting for round</span>
                <select value={waitingRoundIndex} onChange={(event) => setWaitingRoundIndex(Number(event.target.value))}>
                  {(quiz?.rounds ?? []).map((roundItem, index) => (
                    <option key={roundItem.id || index} value={index}>
                      Round {index + 1} · {roundItem.title || `Round ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="host-screen-preview-card waiting">
                <Unlock size={30} />
                <span>GET READY</span>
                <h2>The Quiz Will Begin Soon</h2>
                <p>
                  Round {waitingRoundIndex + 1} · {quiz?.rounds?.[waitingRoundIndex]?.title || `Round ${waitingRoundIndex + 1}`}
                </p>
              </div>
            </>
          ) : null}

          {screenPreview === "round_locked" ? (
            <div className="host-screen-preview-card locked">
              <Lock size={30} />
              <span>ROUND COMPLETE</span>
              <h2>Answers Locked</h2>
              <p>Teams can no longer change their answers for this round.</p>
            </div>
          ) : null}

          {screenPreview === "leaderboard" ? (
            <div className="host-screen-preview-card leaderboard">
              <span>LEADERBOARD</span>
              <h2>Current Standings</h2>
              {leaderboard.length ? (
                <ol className="simple-leaderboard compact-leaderboard host-screen-leaderboard">
                  {leaderboard.map((team, index) => {
                    const revealedToTeams = state.live?.teamScreen === "final"
                      && index >= Math.max(0, leaderboard.length - finalRevealCount);
                    return (
                      <li key={team.id} className={revealedToTeams ? "revealed-to-teams" : ""}>
                        <span>{index + 1}</span><strong>{team.name || "Unnamed team"}</strong><b>{team.score}</b>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className="simple-empty-copy">Scores will appear here as answers are marked.</p>}
            </div>
          ) : null}

          {screenPreview === "final" ? (
            <div className="host-screen-preview-card final">
              <div className="host-final-preview-heading">
                <div><span>FINAL LEADERBOARD</span><h2>Final Results</h2></div>
                <button
                  type="button"
                  className="primary-button"
                  disabled={state.live?.teamScreen !== "final" || finalRevealCount >= state.teams.length}
                  onClick={revealNextFinalTeam}
                >
                  <Eye size={15} /> Reveal Next
                </button>
              </div>
              <div className="host-final-reveal-status">
                Teams: {state.live?.teamScreen === "final" ? `${finalRevealCount}/${state.teams.length} revealed` : "Final not pushed yet"}
              </div>
              {leaderboard.length ? (
                <ol className="simple-leaderboard compact-leaderboard host-screen-leaderboard host-final-full-leaderboard">
                  {leaderboard.map((team, index) => (
                    <li key={team.id}><span>{index + 1}</span><strong>{team.name || "Unnamed team"}</strong><b>{team.score}</b></li>
                  ))}
                </ol>
              ) : <p className="simple-empty-copy">Final standings will appear here once scores are available.</p>}
            </div>
          ) : null}
        </section>
      ) : (
      <section className="host-question-workspace">
        <div className="host-round-carousel">
          {quiz.rounds.map((item, index) => (
            <button key={item.id} className={`${index === reviewRoundIndex ? "selected" : ""} ${index === liveRoundIndex ? "live-on-teams" : ""}`} onClick={() => reviewRoundAt(index)}>
              <span>R{index + 1}</span><strong>{item.title || `Round ${index + 1}`}</strong>{index === liveRoundIndex ? <small>LIVE</small> : null}
            </button>
          ))}
        </div>

        {reviewRoundIndex !== liveRoundIndex ? (
          <button className="push-round-button" onClick={() => activateRound(reviewRoundIndex)}><Send size={15} /> Push this round to teams</button>
        ) : null}

        {reviewRound?.questions?.length ? (
          <>
            <div className="host-question-dot-row">
              {reviewRound.questions.map((item, index) => (
                <button key={item.id} className={`${index === reviewQuestionIndex ? "current" : ""} ${reviewRoundIndex === liveRoundIndex && index === liveQuestionIndex ? "pushed" : ""}`} onClick={() => setReviewQuestionIndex(index)}>Q{index + 1}</button>
              ))}
            </div>

            <div className="host-live-top-navigation">
              <button className="icon-step-button host-question-step previous" disabled={reviewQuestionIndex <= 0} onClick={() => setReviewQuestionIndex((index) => Math.max(0, index - 1))}><ArrowLeft size={16} /> Previous</button>
              {liveTab === "questions" ? (
                <button className="icon-step-button host-question-step next" disabled={!canReviewNext} onClick={() => setReviewQuestionIndex((index) => Math.min(reviewRound.questions.length - 1, index + 1))}>Next <ArrowRight size={16} /></button>
              ) : (
                <button
                  className={reviewQuestionRevealed ? "icon-step-button host-question-step next" : "primary-button host-answer-flow-button"}
                  disabled={reviewQuestionRevealed && !canReviewNext}
                  onClick={() => runAnswerFlow(reviewQuestionAsked, reviewQuestionRevealed)}
                >
                  {reviewQuestionRevealed ? <>Next Question <ArrowRight size={16} /></> : reviewQuestionAsked ? <><Eye size={16} /> Push Answer</> : <><Send size={16} /> Push Question</>}
                </button>
              )}
            </div>

            {reviewQuestion ? (
              <div className="host-focus-question-card">
                <div className="host-review-kicker">
                  <span>HOST REVIEW</span>
                  {reviewingLiveQuestion ? <b>ON TEAM SCREENS</b> : reviewQuestionAsked ? <em>Already asked</em> : <em>Private preview</em>}
                </div>
                {reviewQuestion.image ? <img src={reviewQuestion.image} alt={reviewQuestion.imageName || "Question"} /> : null}
                <div className={`host-question-title-row ${liveTab === "answers" ? "answers-mode" : ""}`}>
                  <h2>{reviewQuestion.text || "Untitled question"}</h2>
                  {liveTab === "questions" ? (
                    <button
                      className={`host-question-live-button ${reviewingLiveQuestion ? "is-live" : reviewQuestionAsked ? "was-asked" : ""}`}
                      disabled={reviewingLiveQuestion || reviewQuestionAsked}
                      onClick={pushReviewedQuestion}
                    >
                      {reviewingLiveQuestion ? <><Check size={16} /> Question Live</> : reviewQuestionAsked ? <><Check size={16} /> Question Asked</> : <><Send size={16} /> Send Question</>}
                    </button>
                  ) : null}
                </div>

                <div className="host-answer-key"><span>CORRECT ANSWER</span><strong>{reviewQuestion.answer || "No answer set"}</strong></div>

                {reviewQuestion.audio ? (
                  <div className="simple-host-audio host-replay-audio">
                    <audio ref={hostAudioRef} src={reviewQuestion.audio} preload="auto" />
                    <button className="ghost-button" onClick={replayHostOnly}><RotateCcw size={15} /> Preview audio</button>
                    <button className="primary-button" disabled={!reviewingLiveQuestion} onClick={replayOnAllDevices}><RotateCcw size={15} /> Play / replay to teams</button>
                  </div>
                ) : null}

              </div>
            ) : null}

            {askedReviewQuestions.length ? (
              <section className="host-answer-matrix-section">
                <div className="host-answer-matrix-heading">
                  <div>
                    <span>LIVE ANSWER GRID</span>
                    <strong>{askedReviewQuestions.length} question{askedReviewQuestions.length === 1 ? "" : "s"} asked</strong>
                  </div>
                  <small>Tap 0 / ½ / ✓ to override auto-marking</small>
                </div>

                <div className="host-answer-matrix-scroll">
                  <div
                    className="host-answer-matrix"
                    style={{ "--host-answer-columns": askedReviewQuestions.length }}
                  >
                    <div className="host-answer-matrix-corner">TEAM</div>
                    {askedReviewQuestions.map((item) => {
                      const index = (reviewRound?.questions ?? []).findIndex((question) => question.id === item.id);
                      return (
                        <button
                          type="button"
                          key={`head-${item.id}`}
                          className={`host-answer-matrix-question ${reviewRoundIndex === liveRoundIndex && index === liveQuestionIndex ? "is-live" : ""}`}
                          onClick={() => setReviewQuestionIndex(Math.max(0, index))}
                        >
                          <b>Q{index + 1}</b>
                          <span>{reviewRoundIndex === liveRoundIndex && index === liveQuestionIndex ? "LIVE" : "ASKED"}</span>
                        </button>
                      );
                    })}

                    <div className="host-answer-matrix-row-label correct-label">CORRECT</div>
                    {askedReviewQuestions.map((item) => (
                      <div className="host-answer-matrix-correct" key={`correct-${item.id}`}>
                        {item.answer || "Not set"}
                      </div>
                    ))}

                    {state.teams.map((team) => (
                      <Fragment key={team.id}>
                        <div className="host-answer-matrix-row-label">
                          <strong>{team.name || `Table ${team.table || "?"}`}</strong>
                          <small>{team.table ? `Table ${team.table}` : "Team"}</small>
                        </div>
                        {askedReviewQuestions.map((item) => {
                          const answer = state.answers?.[item.id]?.[team.id];
                          const max = Number(item.points ?? 1);
                          return (
                            <div className={`host-answer-matrix-cell ${answer?.status || "unanswered"}`} key={`${team.id}-${item.id}`}>
                              <span className="host-answer-matrix-text">{answer?.text || "Waiting…"}</span>
                              {answer ? (
                                <div className="host-answer-matrix-marks">
                                  <button type="button" aria-label="Mark incorrect" className={answer.status === "incorrect" ? "selected incorrect" : ""} onClick={() => markAnswer(item.id, team.id, 0)}>0</button>
                                  <button type="button" aria-label="Award half points" className={answer.status === "half" ? "selected half" : ""} onClick={() => markAnswer(item.id, team.id, max / 2)}>½</button>
                                  <button type="button" aria-label="Mark correct" className={answer.status === "correct" ? "selected correct" : ""} onClick={() => markAnswer(item.id, team.id, max)}><Check size={12} /></button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <div className="host-answer-matrix-empty">Send the first question to start the live answer grid.</div>
            )}
          </>
        ) : <p className="simple-empty-copy">This round has no questions.</p>}
      </section>

      )}

    </main>
  );
}
