import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Play,
  Plus,
  QrCode,
  Radio,
  RefreshCcw,
  Send,
  TimerReset,
  Trash2,
  Trophy,
  Unlock,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { computeLeaderboard } from "../utils/quiz.js";
import {
  createSessionCode,
  createTeamSlot,
  createTeamToken,
  getLiveQuiz,
  isRoundForceLocked,
} from "../utils/liveSession.js";

function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {title || action ? (
        <div className="panel-header">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function NetworkBadge({ network }) {
  const online = network?.status === "online";
  return (
    <span className={`live-network-badge ${online ? "online" : "offline"}`}>
      {online ? <Wifi size={14} /> : <WifiOff size={14} />}
      {online ? `Live · ${network.connectedCount} team${network.connectedCount === 1 ? "" : "s"} connected` : network?.status || "offline"}
    </span>
  );
}

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

function teamJoinUrl(sessionCode, token) {
  return `${window.location.origin}${window.location.pathname}#/join/${sessionCode}/${token}`;
}

function shortQuizMeta(quiz) {
  const rounds = quiz.rounds?.length ?? 0;
  const questions = (quiz.rounds ?? []).reduce((total, round) => total + (round.questions?.length ?? 0), 0);
  return `${rounds} round${rounds === 1 ? "" : "s"} · ${questions} question${questions === 1 ? "" : "s"}`;
}

export function TeamManagerPage({ state, updateState, setActivePage, network }) {
  const quiz = getLiveQuiz(state);
  const [players, setPlayers] = useState(4);
  const [table, setTable] = useState("");

  function addTeam() {
    if (!state.live?.sessionActive) return;
    const team = createTeamSlot({ players, table });
    updateState((current) => ({ ...current, teams: [...current.teams, team] }));
    setTable("");
  }

  function updateTeam(teamId, patch) {
    updateState((current) => ({
      ...current,
      teams: current.teams.map((team) => (team.id === teamId ? { ...team, ...patch } : team)),
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

  function regenerateQr(teamId) {
    updateTeam(teamId, { token: createTeamToken(), nameLocked: false, name: "", registeredAt: "" });
  }

  if (!quiz || !state.live?.sessionActive) {
    return (
      <main className="page">
        <div className="page-title-row">
          <div>
            <h1>Teams</h1>
            <p>Load a quiz into the live runner first. Team QR codes belong to that live quiz session.</p>
          </div>
          <button className="primary-button" onClick={() => setActivePage("Live Quiz")}><Play size={16} /> Choose a quiz to run</button>
        </div>
        <Panel>
          <div className="live-empty-state">
            <Users size={30} />
            <strong>No live quiz loaded</strong>
            <span>Your stored quizzes are untouched. Choose one in Live Quiz when you are ready to run it.</span>
          </div>
        </Panel>
      </main>
    );
  }

  return (
    <main className="page live-teams-page">
      <div className="page-title-row">
        <div>
          <h1>Teams</h1>
          <p>Create each paid team here first. The QR code is unique to that team and this quiz session.</p>
        </div>
        <NetworkBadge network={network} />
      </div>

      <div className="live-session-strip">
        <div><span>Running quiz</span><strong>{quiz.title || "Untitled quiz"}</strong></div>
        <div><span>Session</span><strong>{state.live.sessionCode}</strong></div>
        <div><span>Teams</span><strong>{state.teams.length}</strong></div>
        <button className="ghost-button" onClick={() => setActivePage("Live Quiz")}><Radio size={15} /> Live controls</button>
      </div>

      <Panel title="Add a paid team">
        <div className="team-create-row">
          <label>Table number<input value={table} onChange={(event) => setTable(event.target.value)} placeholder="e.g. 7" /></label>
          <label>Number of players<input type="number" min="1" max="30" value={players} onChange={(event) => setPlayers(event.target.value)} /></label>
          <button className="primary-button" onClick={addTeam}><Plus size={16} /> Create team & QR</button>
        </div>
        <p className="live-help-copy">The team name is deliberately left blank. After scanning their QR code, the players choose and lock in their own team name; it appears here immediately.</p>
      </Panel>

      {state.teams.length ? (
        <div className="team-qr-grid">
          {state.teams.map((team, index) => {
            const url = teamJoinUrl(state.live.sessionCode, team.token);
            const connected = network?.connectedTokens?.includes(team.token);
            return (
              <Panel key={team.id} className="team-qr-card">
                <div className="team-qr-card-head">
                  <div>
                    <span className="utility-label">Team {index + 1}</span>
                    <h3>{team.name || `Table ${team.table || "?"} · waiting for name`}</h3>
                  </div>
                  <span className={`team-connection-dot ${connected ? "connected" : ""}`}>{connected ? "Connected" : "Not connected"}</span>
                </div>
                <div className="team-qr-body">
                  <div className="team-qr-code"><QRCodeSVG value={url} size={156} marginSize={1} /></div>
                  <div className="team-qr-fields">
                    <label>Team name<input value={team.name ?? ""} onChange={(event) => updateTeam(team.id, { name: event.target.value, nameLocked: Boolean(event.target.value.trim()) })} placeholder="Set by team after scan" /></label>
                    <div className="form-grid">
                      <label>Table<input value={team.table ?? ""} onChange={(event) => updateTeam(team.id, { table: event.target.value })} /></label>
                      <label>Players<input type="number" min="1" value={team.players ?? 1} onChange={(event) => updateTeam(team.id, { players: Math.max(1, Number(event.target.value) || 1) })} /></label>
                    </div>
                    <div className="team-qr-meta">
                      <span>{team.registeredAt ? `Name locked at ${team.registeredAt}` : "QR not claimed yet"}</span>
                      <span>Score adjustment: {Number(team.scoreAdjustment ?? 0)}</span>
                    </div>
                    <div className="button-row-inline">
                      <button className="ghost-button compact" onClick={() => navigator.clipboard?.writeText(url)}><Copy size={14} /> Copy link</button>
                      <a className="ghost-button compact" href={url} target="_blank" rel="noreferrer"><QrCode size={14} /> Open team page</a>
                      <button className="ghost-button compact" onClick={() => regenerateQr(team.id)}><RefreshCcw size={14} /> New QR</button>
                      <button className="danger-soft-button compact" onClick={() => removeTeam(team.id)}><Trash2 size={14} /> Remove</button>
                    </div>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      ) : (
        <Panel><div className="live-empty-state"><QrCode size={30} /><strong>No teams yet</strong><span>Add the first team above. You will get one unique QR code per team.</span></div></Panel>
      )}
    </main>
  );
}

export function LiveRunnerPage({ state, updateState, setActivePage, network }) {
  const quiz = getLiveQuiz(state);
  const leaderboard = useMemo(() => computeLeaderboard(state), [state]);
  const round = quiz?.rounds?.[state.live?.roundIndex ?? 0] ?? null;
  const questionIndex = Number(state.live?.questionIndex ?? -1);
  const question = questionIndex >= 0 ? round?.questions?.[questionIndex] ?? null : null;
  const timerSeconds = useCountdown(state.live?.timerEndsAt, state.live?.timerActive);
  const [timerChoice, setTimerChoice] = useState(60);

  function loadQuiz(quizId) {
    if (state.live?.sessionActive && (state.teams.length || Object.keys(state.answers ?? {}).length)) {
      const okay = window.confirm("Start a new live quiz session? This clears the current live teams and submitted answers, but does not delete any stored quiz.");
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
        locked: false,
        answerRevealed: false,
      },
    }));
  }

  function replaceSessionCode() {
    const code = createSessionCode();
    updateState((current) => ({ ...current, joinCode: code, live: { ...current.live, sessionCode: code } }));
  }

  function updateLive(patch) {
    updateState((current) => ({ ...current, live: { ...current.live, ...patch } }));
  }

  function pushQuestion(index) {
    if (!round?.questions?.[index]) return;
    updateLive({
      status: "Live",
      teamScreen: "question",
      questionIndex: index,
      timerActive: false,
      timerEndsAt: 0,
      timerRoundId: "",
    });
  }

  function revealCurrentAnswer() {
    if (!question) return;
    updateState((current) => ({
      ...current,
      live: {
        ...current.live,
        revealedQuestions: { ...(current.live.revealedQuestions ?? {}), [question.id]: true },
      },
    }));
  }

  function revealRoundAnswers() {
    if (!round) return;
    updateState((current) => ({
      ...current,
      live: {
        ...current.live,
        revealedRounds: { ...(current.live.revealedRounds ?? {}), [round.id]: true },
        teamScreen: "round_review",
      },
    }));
  }

  function startLockTimer() {
    if (!round) return;
    const duration = Math.max(5, Number(timerChoice) || 60);
    updateLive({
      teamScreen: "round_review",
      timerActive: true,
      timerEndsAt: Date.now() + duration * 1000,
      timerRoundId: round.id,
    });
  }

  function cancelTimer() {
    updateLive({ timerActive: false, timerEndsAt: 0, timerRoundId: "" });
  }

  function lockRoundNow() {
    if (!round) return;
    updateState((current) => ({
      ...current,
      live: {
        ...current.live,
        timerActive: false,
        timerEndsAt: 0,
        timerRoundId: "",
        teamScreen: "round_locked",
        forceLockedRounds: { ...(current.live.forceLockedRounds ?? {}), [round.id]: true },
      },
    }));
  }

  function unlockRound() {
    if (!round) return;
    updateState((current) => {
      const nextLocks = { ...(current.live.forceLockedRounds ?? {}) };
      delete nextLocks[round.id];
      return { ...current, live: { ...current.live, forceLockedRounds: nextLocks, teamScreen: "round_review" } };
    });
  }

  function goToRound(nextIndex) {
    if (!quiz?.rounds?.[nextIndex]) return;
    updateLive({
      roundIndex: nextIndex,
      questionIndex: -1,
      teamScreen: "lobby",
      timerActive: false,
      timerEndsAt: 0,
      timerRoundId: "",
      status: "Live",
    });
  }

  function beginFinalReveal() {
    updateLive({ teamScreen: "final", status: "Completed", finalRevealCount: 0, timerActive: false, timerEndsAt: 0 });
  }

  function revealNextFinalTeam() {
    updateLive({ finalRevealCount: Math.min(state.teams.length, Number(state.live.finalRevealCount ?? 0) + 1) });
  }

  if (!state.live?.sessionActive || !quiz) {
    return (
      <main className="page live-runner-page">
        <div className="page-title-row">
          <div>
            <h1>Run a Quiz</h1>
            <p>Your quiz library is the permanent store. Choose one only when you are ready to run it live.</p>
          </div>
        </div>
        <Panel title="Choose a quiz to run">
          {state.quizzes.filter((item) => !item.archived).length ? (
            <div className="live-quiz-picker">
              {state.quizzes.filter((item) => !item.archived).map((item) => (
                <div className="live-quiz-pick" key={item.id}>
                  <div><strong>{item.title || "Untitled quiz"}</strong><span>{shortQuizMeta(item)}</span></div>
                  <button className="primary-button" disabled={!item.rounds?.some((r) => r.questions?.length)} onClick={() => loadQuiz(item.id)}><Play size={15} /> Load & run</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="live-empty-state"><Radio size={30} /><strong>No quizzes stored</strong><span>Build or import a quiz first, then return here.</span></div>
          )}
        </Panel>
      </main>
    );
  }

  const locked = round ? isRoundForceLocked(state, round.id) : false;
  const teamLocks = round ? Object.values(state.teamRoundLocks?.[round.id] ?? {}).filter(Boolean).length : 0;
  const finalRevealCount = Number(state.live.finalRevealCount ?? 0);
  const finalRevealOrder = leaderboard.slice().reverse().slice(0, finalRevealCount);

  return (
    <main className="page live-runner-page">
      <div className="page-title-row">
        <div>
          <h1>Live Quiz</h1>
          <p>{quiz.title || "Untitled quiz"}</p>
        </div>
        <div className="button-row-inline"><NetworkBadge network={network} /><button className="ghost-button" onClick={() => setActivePage("Teams")}><Users size={15} /> Teams & QR codes</button></div>
      </div>

      <div className="live-session-strip">
        <div><span>Session</span><strong>{state.live.sessionCode}</strong></div>
        <div><span>Teams</span><strong>{state.teams.length}</strong></div>
        <div><span>Team names locked</span><strong>{state.teams.filter((team) => team.nameLocked).length}</strong></div>
        <div><span>Round locks</span><strong>{teamLocks}/{state.teams.length}</strong></div>
        <button className="ghost-button compact" onClick={replaceSessionCode}><RefreshCcw size={14} /> New session code</button>
      </div>

      {network?.status === "code-conflict" ? (
        <div className="live-warning"><WifiOff size={16} /> That session code is already in use. Generate a new session code before teams scan their QR codes.</div>
      ) : null}

      <section className="live-control-grid">
        <Panel title="Round control">
          <div className="round-control-tabs">
            {(quiz.rounds ?? []).map((item, index) => (
              <button key={item.id} className={index === state.live.roundIndex ? "active" : ""} onClick={() => goToRound(index)}>
                <span>Round {index + 1}</span><strong>{item.title || `Round ${index + 1}`}</strong>
              </button>
            ))}
          </div>
          {round ? (
            <div className="round-control-summary">
              <strong>{round.title || `Round ${state.live.roundIndex + 1}`}</strong>
              <span>{round.questions.length} questions · {locked ? "answers locked" : "answers editable"}</span>
            </div>
          ) : null}
        </Panel>

        <Panel title="Answer reveal policy">
          <div className="reveal-policy">
            <button className={state.live.revealMode === "question" ? "active" : ""} onClick={() => updateLive({ revealMode: "question" })}><Eye size={16} /><strong>After each question</strong><span>Reveal answers as you go.</span></button>
            <button className={state.live.revealMode === "round" ? "active" : ""} onClick={() => updateLive({ revealMode: "round" })}><EyeOff size={16} /><strong>End of round</strong><span>Keep answers hidden until the round finishes.</span></button>
          </div>
        </Panel>

        <Panel className="wide-panel" title="Question push">
          {round?.questions?.length ? (
            <>
              <div className="question-push-tabs">
                {round.questions.map((item, index) => (
                  <button key={item.id} className={index === questionIndex ? "active" : index < questionIndex ? "sent" : ""} onClick={() => pushQuestion(index)}>
                    Q{item.number ?? index + 1}
                  </button>
                ))}
              </div>
              <div className="live-current-question">
                {question ? (
                  <>
                    <span className="utility-label">Currently pushed to teams</span>
                    <h2>{question.text}</h2>
                    <div className="button-row-inline">
                      <button className="ghost-button" disabled={questionIndex <= 0} onClick={() => pushQuestion(questionIndex - 1)}><ArrowLeft size={15} /> Previous</button>
                      <button className="primary-button" disabled={questionIndex >= round.questions.length - 1} onClick={() => pushQuestion(questionIndex + 1)}><Send size={15} /> Push next question</button>
                      <button className="ghost-button" onClick={revealCurrentAnswer}><Eye size={15} /> Reveal this answer</button>
                      <button className="ghost-button" onClick={() => updateLive({ teamScreen: "round_review" })}><CheckCircle2 size={15} /> Team review screen</button>
                    </div>
                  </>
                ) : (
                  <div className="live-start-round"><strong>Round ready</strong><span>Teams are waiting. Push Question 1 when you are ready.</span><button className="primary-button" onClick={() => pushQuestion(0)}><Play size={15} /> Push Question 1</button></div>
                )}
              </div>
            </>
          ) : (
            <div className="live-empty-state"><Radio size={28} /><strong>This round has no text questions</strong><span>Add questions in the builder, or use it as a manual/picture round.</span></div>
          )}
        </Panel>

        <Panel title="End-of-round locking">
          <div className="round-lock-controls">
            <div className="round-lock-status"><span>Current state</span><strong>{locked ? "LOCKED" : "EDITABLE"}</strong><small>{teamLocks} of {state.teams.length} teams have voluntarily locked in.</small></div>
            <div className="timer-start-row">
              <select value={timerChoice} onChange={(event) => setTimerChoice(Number(event.target.value))}>
                <option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option><option value={300}>5 minutes</option>
              </select>
              <button className="primary-button" disabled={locked} onClick={startLockTimer}><Clock3 size={15} /> Start lock timer</button>
            </div>
            {state.live.timerActive ? <div className="host-countdown"><TimerReset size={18} /><strong>{timerSeconds}s</strong><span>Teams see this countdown. At zero, the round locks automatically.</span><button className="ghost-button compact" onClick={cancelTimer}>Cancel</button></div> : null}
            <div className="button-row-inline">
              {!locked ? <button className="danger-soft-button" onClick={lockRoundNow}><Lock size={15} /> Lock all round answers now</button> : <button className="ghost-button" onClick={unlockRound}><Unlock size={15} /> Re-open round</button>}
              <button className="ghost-button" onClick={revealRoundAnswers}><Eye size={15} /> Reveal round answers</button>
            </div>
          </div>
        </Panel>

        <Panel title="Between rounds">
          <div className="between-round-actions">
            <button className="ghost-button" onClick={() => updateLive({ teamScreen: "leaderboard" })}><Trophy size={15} /> Show leaderboard to teams</button>
            <button className="ghost-button" onClick={() => updateLive({ teamScreen: question ? "question" : "lobby" })}><Radio size={15} /> Return to quiz</button>
            {state.live.roundIndex < quiz.rounds.length - 1 ? (
              <button className="primary-button" onClick={() => goToRound(state.live.roundIndex + 1)}><ArrowRight size={15} /> Next round</button>
            ) : (
              <button className="primary-button" onClick={beginFinalReveal}><Trophy size={15} /> Start final results</button>
            )}
          </div>
          {leaderboard.length ? <ol className="mini-live-leaderboard">{leaderboard.slice(0, 5).map((team, index) => <li key={team.id}><span>{index + 1}</span><strong>{team.name || "Unnamed team"}</strong><b>{team.score}</b></li>)}</ol> : <p className="live-help-copy">Scores appear here once answers have been marked.</p>}
        </Panel>

        {state.live.teamScreen === "final" ? (
          <Panel className="wide-panel final-reveal-panel" title="Final results reveal">
            <div className="final-reveal-controls">
              <div><strong>{finalRevealCount} / {state.teams.length}</strong><span>teams revealed, starting from last place</span></div>
              <button className="primary-button" disabled={finalRevealCount >= state.teams.length} onClick={revealNextFinalTeam}><Trophy size={16} /> Reveal next place</button>
            </div>
            <div className="final-reveal-list">
              {finalRevealOrder.map((team, index) => {
                const actualPlace = leaderboard.findIndex((item) => item.id === team.id) + 1;
                return <div className={actualPlace === 1 ? "winner" : ""} key={team.id}><span>{actualPlace}</span><strong>{team.name || "Unnamed team"}</strong><b>{team.score} pts</b></div>;
              })}
            </div>
          </Panel>
        ) : null}
      </section>
    </main>
  );
}
