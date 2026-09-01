import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crown,
  Lock,
  Send,
  Timer,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLiveTeamNetwork } from "../hooks/useLiveTeamNetwork.js";

function TeamChrome({ children, status }) {
  return (
    <main className="team-page live-team-page">
      <div className="phone-shell live-phone-shell">
        <header className="phone-topbar live-phone-topbar">
          <div className="brand-lockup">
            <span className="brand-mark"><Crown size={19} /></span>
            <strong>Quizmaster<span>Pro</span></strong>
          </div>
          <span className={`team-live-status ${status === "online" ? "online" : "offline"}`}>
            {status === "online" ? <Wifi size={15} /> : <WifiOff size={15} />}
            {status === "online" ? "Live" : status}
          </span>
        </header>
        {children}
      </div>
    </main>
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

function ConnectionScreen({ status, error }) {
  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card connection-card">
        {status === "error" ? <WifiOff size={36} /> : <Wifi size={36} />}
        <h1>{status === "error" ? "Team link unavailable" : "Connecting to the quizmaster…"}</h1>
        <p>{error || "Keep this page open. Your team page will appear as soon as the quizmaster connection is ready."}</p>
      </section>
    </TeamChrome>
  );
}

function TeamNameScreen({ snapshot, send, status }) {
  const [name, setName] = useState("");

  function submit(event) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    send({ type: "set-team-name", name: clean });
  }

  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card team-name-card">
        <div className="team-ticket">
          <span>YOUR TEAM</span>
          <strong>Table {snapshot.team?.table || "—"}</strong>
          <small>{snapshot.team?.players || 1} player{Number(snapshot.team?.players || 1) === 1 ? "" : "s"}</small>
        </div>
        <div className="team-name-burst">🎉</div>
        <h1>Give your team a name</h1>
        <p>This is what everyone will see on the leaderboard. Choose wisely.</p>
        <form className="team-name-form" onSubmit={submit}>
          <label htmlFor="team-name">TEAM NAME</label>
          <input id="team-name" autoFocus maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="The Quizzy Rascals" />
          <button className="primary-button full-width" disabled={!name.trim()}><Lock size={16} /> Lock in team name</button>
        </form>
      </section>
    </TeamChrome>
  );
}

function WaitingScreen({ snapshot, status }) {
  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card waiting-team-card">
        <div className="registered-box">
          <CheckCircle2 size={19} />
          <div><span>READY TO PLAY</span><strong>{snapshot.team.name}</strong></div>
        </div>
        <div className="team-ticket small">
          <span>TABLE</span><strong>{snapshot.team.table || "—"}</strong><small>{snapshot.team.players} player{Number(snapshot.team.players) === 1 ? "" : "s"}</small>
        </div>
        <h1>Waiting for the next question</h1>
        <p>The quizmaster controls what appears here. You do not need a room code or another login.</p>
        <div className="team-wait-pulse"><span /><span /><span /></div>
      </section>
    </TeamChrome>
  );
}

function LeaderboardScreen({ snapshot, status }) {
  const ownId = snapshot.team?.id;
  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card team-leaderboard-card">
        <Trophy size={36} />
        <h1>Leaderboard</h1>
        <p>Current standings after marking so far.</p>
        <ol className="team-live-leaderboard">
          {snapshot.leaderboard.map((team, index) => (
            <li key={team.id} className={team.id === ownId ? "ours" : ""}>
              <span>{index + 1}</span><strong>{team.name}</strong><b>{team.score}</b>
            </li>
          ))}
        </ol>
      </section>
    </TeamChrome>
  );
}

function FinalScreen({ snapshot, status }) {
  const count = Number(snapshot.live?.finalRevealCount ?? 0);
  const full = snapshot.leaderboard ?? [];
  const revealed = full.slice().reverse().slice(0, count);
  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card team-final-card">
        <Trophy size={42} />
        <h1>Final results</h1>
        <p>Places are being revealed from last to first.</p>
        <div className="team-final-list">
          {revealed.map((team) => {
            const place = full.findIndex((item) => item.id === team.id) + 1;
            return (
              <div key={team.id} className={place === 1 ? "winner" : ""}>
                <span>{place}</span><strong>{team.name}</strong><b>{team.score} pts</b>
              </div>
            );
          })}
        </div>
        {!count ? <div className="waiting-note"><Timer size={16} /> Waiting for the first place to be revealed…</div> : null}
      </section>
    </TeamChrome>
  );
}

export default function TeamView({ sessionCode, teamToken }) {
  const { snapshot, status, error, send } = useLiveTeamNetwork(sessionCode, teamToken);
  const [viewIndex, setViewIndex] = useState(0);
  const [drafts, setDrafts] = useState({});
  const countdown = useCountdown(snapshot?.live?.timerEndsAt, snapshot?.live?.timerActive);

  const questions = snapshot?.round?.questions ?? [];
  const hostQuestionIndex = Math.max(0, Number(snapshot?.live?.questionIndex ?? 0));
  const question = questions[viewIndex] ?? questions[questions.length - 1] ?? null;
  const roundLocked = Boolean(snapshot?.round?.forceLocked || snapshot?.round?.teamLocked || (snapshot?.live?.timerActive && countdown <= 0));
  const questionLocked = roundLocked || Boolean(question?.revealed);
  const screen = snapshot?.live?.teamScreen ?? "lobby";

  useEffect(() => {
    if (!snapshot) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const [questionId, answer] of Object.entries(snapshot.teamAnswers ?? {})) {
        if (!(questionId in next)) next[questionId] = answer.text ?? "";
      }
      return next;
    });
  }, [snapshot]);

  useEffect(() => {
    if (!questions.length) return;
    setViewIndex(Math.min(hostQuestionIndex, questions.length - 1));
  }, [hostQuestionIndex, questions.length, snapshot?.round?.id]);

  const savedAnswer = question ? snapshot?.teamAnswers?.[question.id] : null;
  const draft = question ? drafts[question.id] ?? savedAnswer?.text ?? "" : "";
  const answeredCount = useMemo(
    () => questions.filter((item) => String(drafts[item.id] ?? snapshot?.teamAnswers?.[item.id]?.text ?? "").trim()).length,
    [drafts, questions, snapshot?.teamAnswers],
  );

  function setDraft(value) {
    if (!question || questionLocked) return;
    setDrafts((current) => ({ ...current, [question.id]: value }));
  }

  function saveAnswer(event) {
    event?.preventDefault?.();
    if (!question || questionLocked || !draft.trim()) return;
    send({ type: "save-answer", questionId: question.id, text: draft.trim() });
  }

  function lockRound() {
    if (roundLocked) return;
    const okay = window.confirm("Lock in this round? You will not be able to change any answers unless the quizmaster re-opens the round.");
    if (okay) send({ type: "lock-round" });
  }

  if (!snapshot) return <ConnectionScreen status={status} error={error} />;
  if (!snapshot.team) return <ConnectionScreen status="error" error="This team QR code is no longer valid. Ask the quizmaster to generate a new one." />;
  if (!snapshot.team.nameLocked) return <TeamNameScreen snapshot={snapshot} send={send} status={status} />;
  if (screen === "leaderboard") return <LeaderboardScreen snapshot={snapshot} status={status} />;
  if (screen === "final") return <FinalScreen snapshot={snapshot} status={status} />;
  if (!question || (["lobby", "round_locked"].includes(screen) && !questions.length)) return <WaitingScreen snapshot={snapshot} status={status} />;

  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card question-team-card">
        <div className="team-question-topline">
          <div><span>{snapshot.round?.title || "Round"}</span><strong>{snapshot.team.name}</strong></div>
          <div className="team-question-progress">{answeredCount}/{questions.length} answered</div>
        </div>

        {snapshot.live?.timerActive ? (
          <div className={`team-lock-countdown ${countdown <= 10 ? "urgent" : ""}`}>
            <Timer size={18} /><span>Answers lock in</span><strong>{countdown}s</strong>
          </div>
        ) : null}

        {screen === "round_review" ? (
          <div className="round-review-banner"><CheckCircle2 size={18} /><div><strong>Review your round</strong><span>Go back through any question and amend your answer, then lock in the whole round.</span></div></div>
        ) : null}

        {screen === "round_locked" || roundLocked ? (
          <div className="round-locked-banner"><Lock size={17} /> Round answers locked</div>
        ) : question?.revealed ? (
          <div className="round-locked-banner"><Lock size={17} /> This question is locked because its answer has been revealed</div>
        ) : null}

        <div className="team-question-nav">
          <button disabled={viewIndex <= 0} onClick={() => setViewIndex((index) => Math.max(0, index - 1))}><ArrowLeft size={17} /></button>
          <div><span>QUESTION</span><strong>{question.number ?? viewIndex + 1}</strong><small>of {snapshot.round?.totalQuestions ?? questions.length}</small></div>
          <button disabled={viewIndex >= questions.length - 1} onClick={() => setViewIndex((index) => Math.min(questions.length - 1, index + 1))}><ArrowRight size={17} /></button>
        </div>

        {question.image ? <div className="team-media-frame live-team-image"><img src={question.image} alt={question.imageName || "Question"} /></div> : null}
        {question.audio ? <div className="team-audio-frame"><span>{question.audioName || "Audio question"}</span><audio controls src={question.audio} /></div> : null}

        <h1 className="team-question-text">{question.text}</h1>

        {question.type === "Multiple choice" && question.options?.length ? (
          <div className="team-choice-list live-choice-list">
            {question.options.filter(Boolean).map((option, index) => (
              <button type="button" key={index} disabled={questionLocked} className={draft === option ? "selected" : ""} onClick={() => setDraft(option)}>
                <span>{String.fromCharCode(65 + index)}</span>{option}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={saveAnswer} className="team-answer-form live-answer-form">
          <div className="answer-label-row"><label>Your answer</label><span>{savedAnswer ? "Saved" : "Not saved"}</span></div>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} disabled={questionLocked} maxLength={500} placeholder={question.type === "Picture" ? "Type what you think the picture is…" : "Type your answer…"} />
          <button className="primary-button full-width" disabled={questionLocked || !draft.trim()}><Send size={16} /> {savedAnswer ? "Save amended answer" : "Save answer"}</button>
        </form>

        {question.revealed ? (
          <div className="answer-reveal phone-reveal"><span>Correct answer</span><strong>{question.answer}</strong><small>Your answer: {savedAnswer?.text || draft || "No answer"}{savedAnswer?.score !== undefined ? ` · ${savedAnswer.score ?? 0} point(s)` : ""}</small></div>
        ) : null}

        <div className="team-round-footer">
          <div><span>Round progress</span><strong>{answeredCount} of {questions.length} answered</strong></div>
          <button className="team-lock-round-button" disabled={roundLocked || !questions.length} onClick={lockRound}><Lock size={16} /> {snapshot.round?.teamLocked ? "Round locked in" : "Lock in round"}</button>
        </div>

        {!roundLocked ? <div className="team-edit-reminder"><Users size={15} /> You can move back through any unrevealed question already sent and change your answers until this round is locked.</div> : null}
      </section>
    </TeamChrome>
  );
}
