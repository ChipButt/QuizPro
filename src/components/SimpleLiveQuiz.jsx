import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Send,
  Trash2,
  Trophy,
  Unlock,
  Wifi,
  WifiOff,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeLeaderboard } from "../utils/quiz.js";
import {
  createSessionCode,
  createTeamSlot,
  createTeamToken,
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
  const [timerChoice, setTimerChoice] = useState(60);
  const timerSeconds = useCountdown(state.live?.timerEndsAt, state.live?.timerActive);
  const hostAudioRef = useRef(null);

  function updateLive(patch) {
    updateState((current) => ({ ...current, live: { ...current.live, ...patch } }));
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
  }

  function regenerateTeamQr(teamId) {
    updateTeam(teamId, { token: createTeamToken(), name: "", nameLocked: false, registeredAt: "" });
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
    updateLive({
      status: "Live",
      teamScreen: "question",
      roundIndex: reviewRoundIndex,
      questionIndex: reviewQuestionIndex,
      timerActive: false,
      timerEndsAt: 0,
      timerRoundId: "",
      audio: { questionId: "", playNonce: Number(state.live?.audio?.playNonce ?? 0) },
    });
  }

  function revealLiveAnswer() {
    if (!liveQuestion) return;
    updateState((current) => ({
      ...current,
      live: {
        ...current.live,
        revealedQuestions: {
          ...(current.live.revealedQuestions ?? {}),
          [liveQuestion.id]: true,
        },
      },
    }));
  }

  function revealLiveRoundAnswers() {
    if (!liveRound) return;
    updateState((current) => ({
      ...current,
      live: {
        ...current.live,
        revealedRounds: {
          ...(current.live.revealedRounds ?? {}),
          [liveRound.id]: true,
        },
        teamScreen: "round_review",
      },
    }));
  }

  function startLockTimer() {
    if (!liveRound) return;
    const duration = Math.max(5, Number(timerChoice) || 60);
    updateLive({
      teamScreen: "round_review",
      timerActive: true,
      timerEndsAt: Date.now() + duration * 1000,
      timerRoundId: liveRound.id,
    });
  }

  function lockLiveRoundNow() {
    if (!liveRound) return;
    updateState((current) => ({
      ...current,
      live: {
        ...current.live,
        timerActive: false,
        timerEndsAt: 0,
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
    const question = quiz?.rounds?.flatMap((round) => round.questions ?? []).find((item) => item.id === questionId);
    if (!question) return;
    const max = Number(question.points ?? 1);
    const nextScore = Math.max(0, Math.min(max, Number(score) || 0));
    updateState((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [question.id]: {
          ...(current.answers?.[question.id] ?? {}),
          [teamId]: {
            ...(current.answers?.[question.id]?.[teamId] ?? {}),
            score: nextScore,
            status: nextScore >= max ? "correct" : nextScore > 0 ? "half" : "incorrect",
          },
        },
      },
    }));
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

  if (!state.live?.sessionActive || !quiz) {
    return (
      <main className="simple-page simple-live-page">
        <div className="simple-page-heading">
          <div><h1>Run a Quiz</h1><p>Select one of your saved quizzes when you are ready to run it.</p></div>
        </div>
        <section className="simple-card">
          <h2>Saved quizzes</h2>
          <div className="simple-live-quiz-list">
            {state.quizzes.filter((item) => !item.archived).map((item) => (
              <div key={item.id}>
                <div><strong>{item.title || "Untitled quiz"}</strong><span>{quizMeta(item)}</span></div>
                <button
                  className="primary-button"
                  disabled={!item.rounds?.some((roundItem) => roundItem.questions?.length)}
                  onClick={() => loadQuiz(item.id)}
                >
                  <Play size={15} /> Load quiz
                </button>
              </div>
            ))}
            {!state.quizzes.filter((item) => !item.archived).length ? (
              <p className="simple-empty-copy">No quizzes are saved yet.</p>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  const liveLocked = liveRound ? isRoundForceLocked(state, liveRound.id) : false;
  const teamLocks = liveRound
    ? Object.values(state.teamRoundLocks?.[liveRound.id] ?? {}).filter(Boolean).length
    : 0;
  const reviewAnswers = reviewQuestion ? state.answers?.[reviewQuestion.id] ?? {} : {};
  const finalRevealCount = Number(state.live.finalRevealCount ?? 0);
  const finalRevealOrder = leaderboard.slice().reverse().slice(0, finalRevealCount);

  return (
    <main className="simple-page simple-live-page">
      <div className="simple-page-heading">
        <div><h1>Live Quiz</h1><p>{quiz.title || "Untitled quiz"}</p></div>
        <div className="simple-live-heading-actions">
          <NetworkBadge network={network} />
          <button className="ghost-button" onClick={stopSession}>Finish session</button>
        </div>
      </div>

      {network?.status === "code-conflict" ? (
        <div className="simple-warning"><WifiOff size={16} /> This live session code is already in use.</div>
      ) : null}

      <section className="simple-card simple-team-section">
        <div className="simple-section-heading">
          <div><h2>Teams</h2><p>Add each paid team, then let them scan their QR.</p></div>
          <span>{state.teams.length} team{state.teams.length === 1 ? "" : "s"}</span>
        </div>
        <div className="simple-add-team-row">
          <label>Table number<input value={table} onChange={(event) => setTable(event.target.value)} placeholder="e.g. 7" /></label>
          <label>Players<input type="number" min="1" max="30" value={players} onChange={(event) => setPlayers(Number(event.target.value) || 1)} /></label>
          <button className="primary-button" onClick={addTeam}><Plus size={16} /> Add team</button>
        </div>

        {state.teams.length ? (
          <div className="simple-team-grid">
            {state.teams.map((team, index) => {
              const url = joinUrl(state.live.sessionCode, team.token);
              const connected = network?.connectedTokens?.includes(team.token);
              return (
                <article key={team.id} className="simple-team-card">
                  <div className="simple-team-card-title">
                    <div>
                      <span>Team {index + 1}</span>
                      <strong>{team.name || `Table ${team.table || "?"}`}</strong>
                      <small>{connected ? "Connected" : team.nameLocked ? "Named · waiting" : "Waiting for scan/name"}</small>
                    </div>
                    <button className="icon-button" aria-label="Remove team" onClick={() => removeTeam(team.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <QRCodeSVG value={url} size={132} marginSize={1} />
                  <div className="simple-team-fields">
                    <label>Table<input value={team.table ?? ""} onChange={(event) => updateTeam(team.id, { table: event.target.value })} /></label>
                    <label>Players<input type="number" min="1" value={team.players ?? 1} onChange={(event) => updateTeam(team.id, { players: Math.max(1, Number(event.target.value) || 1) })} /></label>
                  </div>
                  <div className="simple-team-actions">
                    <button className="ghost-button compact" onClick={() => navigator.clipboard?.writeText(url)}>
                      <Copy size={13} /> Copy link
                    </button>
                    <button className="ghost-button compact" onClick={() => regenerateTeamQr(team.id)}>
                      <RefreshCcw size={13} /> New QR
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p className="simple-empty-copy">No teams added yet.</p>}
      </section>

      <section className="simple-card host-review-card">
        <div className="simple-section-heading">
          <div>
            <h2>Host review & question control</h2>
            <p>Browse anything privately. Teams only change when you press a button labelled “Push”.</p>
          </div>
          <span className="teams-currently-badge">
            Teams: R{liveRoundIndex + 1}{liveQuestion ? ` · Q${liveQuestionIndex + 1}` : " · waiting"}
          </span>
        </div>

        <div className="simple-round-run-tabs host-review-round-tabs">
          {quiz.rounds.map((item, index) => (
            <button
              key={item.id}
              className={`${index === reviewRoundIndex ? "selected" : ""} ${index === liveRoundIndex ? "live-on-teams" : ""}`}
              onClick={() => reviewRoundAt(index)}
            >
              <span>Round {index + 1}</span>
              <strong>{item.title || `Round ${index + 1}`}</strong>
              {index === liveRoundIndex ? <small>LIVE ROUND</small> : null}
            </button>
          ))}
        </div>

        <div className="simple-live-settings-row">
          <div className="simple-reveal-choice">
            <span>Reveal answers</span>
            <button className={state.live.revealMode === "question" ? "selected" : ""} onClick={() => updateLive({ revealMode: "question" })}>
              <Eye size={14} /> After each question
            </button>
            <button className={state.live.revealMode === "round" ? "selected" : ""} onClick={() => updateLive({ revealMode: "round" })}>
              <EyeOff size={14} /> End of round
            </button>
          </div>
          {reviewRoundIndex !== liveRoundIndex ? (
            <button className="ghost-button" onClick={() => activateRound(reviewRoundIndex)}>
              <Send size={15} /> Push this round to teams
            </button>
          ) : null}
        </div>

        {reviewRound?.questions?.length ? (
          <div className="simple-question-runner">
            <div className="simple-question-number-strip host-review-question-strip">
              {reviewRound.questions.map((item, index) => (
                <button
                  key={item.id}
                  className={`${index === reviewQuestionIndex ? "current" : ""} ${reviewRoundIndex === liveRoundIndex && index === liveQuestionIndex ? "pushed" : ""}`}
                  onClick={() => setReviewQuestionIndex(index)}
                >
                  Q{index + 1}
                </button>
              ))}
            </div>

            {reviewQuestion ? (
              <div className="simple-live-question-card host-private-question-card">
                <div className="host-review-kicker">
                  <span>HOST REVIEW</span>
                  {reviewingLiveQuestion ? <b>ON TEAM SCREENS</b> : <em>Private preview</em>}
                </div>

                {reviewQuestion.image ? <img src={reviewQuestion.image} alt={reviewQuestion.imageName || "Question"} /> : null}
                <h2>{reviewQuestion.text || "Untitled question"}</h2>

                {reviewQuestion.type === "Multiple choice" && reviewQuestion.options?.length ? (
                  <div className="simple-live-options">
                    {reviewQuestion.options.filter(Boolean).map((option, index) => (
                      <span key={index} className={String(option).trim() === String(reviewQuestion.answer ?? "").trim() ? "host-correct-option" : ""}>
                        <b>{String.fromCharCode(65 + index)}</b>{option}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="host-answer-key">
                  <span>CORRECT ANSWER</span>
                  <strong>{reviewQuestion.answer || "No answer set"}</strong>
                </div>

                {reviewQuestion.audio ? (
                  <div className="simple-host-audio host-replay-audio">
                    <audio ref={hostAudioRef} src={reviewQuestion.audio} preload="auto" />
                    <button className="ghost-button" onClick={replayHostOnly}>
                      <RotateCcw size={15} /> Preview audio
                    </button>
                    <button className="primary-button" disabled={!reviewingLiveQuestion} onClick={replayOnAllDevices}>
                      <RotateCcw size={15} /> Play / replay to teams
                    </button>
                  </div>
                ) : null}

                <div className="simple-question-controls">
                  <button className="ghost-button" disabled={reviewQuestionIndex <= 0} onClick={() => setReviewQuestionIndex((index) => Math.max(0, index - 1))}>
                    <ArrowLeft size={15} /> Previous
                  </button>
                  <button className="primary-button" onClick={pushReviewedQuestion}>
                    <Send size={15} /> Push this question
                  </button>
                  <button
                    className="ghost-button"
                    disabled={reviewQuestionIndex >= reviewRound.questions.length - 1}
                    onClick={() => setReviewQuestionIndex((index) => Math.min(reviewRound.questions.length - 1, index + 1))}
                  >
                    Next <ArrowRight size={15} />
                  </button>
                  <button className="ghost-button" disabled={!reviewingLiveQuestion} onClick={revealLiveAnswer}>
                    <Eye size={15} /> Reveal to teams
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : <p className="simple-empty-copy">This round has no questions.</p>}
      </section>

      {reviewQuestion ? (
        <section className="simple-card">
          <div className="simple-section-heading">
            <div><h2>Answers</h2><p>{reviewingLiveQuestion ? "Live answers" : "Reviewing saved answers privately"}</p></div>
            <span>{Object.keys(reviewAnswers).length}/{state.teams.length} received</span>
          </div>
          <div className="simple-answer-list">
            {state.teams.map((team) => {
              const answer = reviewAnswers[team.id];
              return (
                <div key={team.id} className="simple-answer-row">
                  <strong>{team.name || `Table ${team.table || "?"}`}</strong>
                  <span>{answer?.text || "No answer"}</span>
                  {answer ? (
                    <div className="simple-mark-buttons">
                      <button className={answer.status === "incorrect" ? "selected" : ""} onClick={() => markAnswer(reviewQuestion.id, team.id, 0)}>0</button>
                      <button className={answer.status === "half" ? "selected" : ""} onClick={() => markAnswer(reviewQuestion.id, team.id, Number(reviewQuestion.points ?? 1) / 2)}>½</button>
                      <button className={answer.status === "correct" ? "selected" : ""} onClick={() => markAnswer(reviewQuestion.id, team.id, Number(reviewQuestion.points ?? 1))}>
                        <Check size={13} /> Correct
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="simple-card simple-end-round-section">
        <div className="simple-section-heading">
          <div><h2>Live round lock</h2><p>{liveRound?.title || "No live round"}</p></div>
          <strong>{liveLocked ? "LOCKED" : "EDITABLE"}</strong>
        </div>
        <div className="simple-end-round-controls">
          <select value={timerChoice} onChange={(event) => setTimerChoice(Number(event.target.value))}>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={120}>2 minutes</option>
            <option value={180}>3 minutes</option>
            <option value={300}>5 minutes</option>
          </select>
          <button className="ghost-button" disabled={liveLocked || !liveRound} onClick={startLockTimer}>
            <Clock3 size={15} /> Start lock timer
          </button>
          {state.live.timerActive ? <strong className="simple-countdown">{timerSeconds}s</strong> : null}
          {!liveLocked ? (
            <button className="danger-soft-button" disabled={!liveRound} onClick={lockLiveRoundNow}>
              <Lock size={15} /> Lock round now
            </button>
          ) : (
            <button className="ghost-button" onClick={unlockLiveRound}><Unlock size={15} /> Re-open round</button>
          )}
          <button className="ghost-button" disabled={!liveRound} onClick={revealLiveRoundAnswers}>
            <Eye size={15} /> Reveal round answers
          </button>
          <span className="team-lock-count">{teamLocks}/{state.teams.length} teams locked</span>
        </div>
      </section>

      <section className="simple-card">
        <div className="simple-section-heading">
          <div><h2>Leaderboard</h2><p>Show it to teams only when you want to.</p></div>
          <button className="ghost-button" onClick={() => updateLive({ teamScreen: "leaderboard" })}>
            <Trophy size={15} /> Show to teams
          </button>
        </div>
        {leaderboard.length ? (
          <ol className="simple-leaderboard">
            {leaderboard.map((team, index) => (
              <li key={team.id}><span>{index + 1}</span><strong>{team.name || "Unnamed team"}</strong><b>{team.score}</b></li>
            ))}
          </ol>
        ) : <p className="simple-empty-copy">Scores will appear here as answers are marked.</p>}
        <div className="simple-between-round-buttons">
          <button className="ghost-button" onClick={() => updateLive({ teamScreen: liveQuestion ? "question" : "lobby" })}>Hide leaderboard</button>
          {liveRoundIndex < quiz.rounds.length - 1 ? (
            <button className="primary-button" onClick={() => activateRound(liveRoundIndex + 1)}>
              Next live round <ArrowRight size={15} />
            </button>
          ) : (
            <button className="primary-button" onClick={beginFinalReveal}><Trophy size={15} /> Final results</button>
          )}
        </div>
      </section>

      {state.live.teamScreen === "final" ? (
        <section className="simple-card">
          <div className="simple-section-heading">
            <div><h2>Final results</h2><p>Reveal teams from last place to first.</p></div>
            <button className="primary-button" disabled={finalRevealCount >= state.teams.length} onClick={revealNextFinalTeam}>
              <Trophy size={15} /> Reveal next place
            </button>
          </div>
          <div className="simple-final-list">
            {finalRevealOrder.map((team) => {
              const place = leaderboard.findIndex((item) => item.id === team.id) + 1;
              return (
                <div className={place === 1 ? "winner" : ""} key={team.id}>
                  <span>{place}</span><strong>{team.name || "Unnamed team"}</strong><b>{team.score} pts</b>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
