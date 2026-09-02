import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crown,
  Edit3,
  KeyRound,
  Lock,
  RotateCcw,
  Timer,
  Trophy,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
            {status === "online" ? <Wifi size={14} /> : <WifiOff size={14} />}
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
        <h1>{status === "error" ? "Team link unavailable" : "Connecting…"}</h1>
        {error ? <p>{error}</p> : null}
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
        <form className="team-name-form" onSubmit={submit}>
          <label htmlFor="team-name">TEAM NAME</label>
          <input
            id="team-name"
            autoFocus
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="The Quizzy Rascals"
          />
          <button className="primary-button full-width" disabled={!name.trim()}>
            <Lock size={16} /> Lock in team name
          </button>
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
          <div><span>READY</span><strong>{snapshot.team.name}</strong></div>
        </div>
        <div className="team-ticket small">
          <span>TABLE</span><strong>{snapshot.team.table || "—"}</strong><small>{snapshot.team.players} player{Number(snapshot.team.players) === 1 ? "" : "s"}</small>
        </div>
        <h1>Waiting for the next question</h1>
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
        <Trophy size={34} />
        <h1>Leaderboard</h1>
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
        <Trophy size={40} />
        <h1>Final results</h1>
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
      </section>
    </TeamChrome>
  );
}

export default function TeamView({ sessionCode, teamToken }) {
  const { snapshot, status, error, send } = useLiveTeamNetwork(sessionCode, teamToken);
  const [viewIndex, setViewIndex] = useState(0);
  const [drafts, setDrafts] = useState({});
  const [editingQuestions, setEditingQuestions] = useState({});
  const [audioBlocked, setAudioBlocked] = useState(false);
  const teamAudioRef = useRef(null);
  const lastPlayNonceRef = useRef(0);
  const countdown = useCountdown(snapshot?.live?.timerEndsAt, snapshot?.live?.timerActive);

  const questions = snapshot?.round?.questions ?? [];
  const hostQuestionIndex = Math.max(0, Number(snapshot?.live?.questionIndex ?? 0));
  const question = questions[viewIndex] ?? questions[questions.length - 1] ?? null;
  const roundLocked = Boolean(
    snapshot?.round?.forceLocked ||
    snapshot?.round?.teamLocked ||
    (snapshot?.live?.timerActive && countdown <= 0)
  );
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

  useEffect(() => {
    const audio = teamAudioRef.current;
    const control = snapshot?.live?.audio ?? {};
    const nonce = Number(control.playNonce ?? 0);
    if (!audio || !question?.audio || control.questionId !== question.id || !nonce) return;
    if (nonce <= lastPlayNonceRef.current) return;
    lastPlayNonceRef.current = nonce;

    audio.pause();
    try { audio.currentTime = 0; } catch { /* media may still be loading */ }
    audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }, [question?.id, question?.audio, snapshot?.live?.audio?.questionId, snapshot?.live?.audio?.playNonce]);

  const savedAnswer = question ? snapshot?.teamAnswers?.[question.id] : null;
  const savedText = String(savedAnswer?.text ?? "");
  const draft = question ? drafts[question.id] ?? savedText : "";
  const draftMatchesSaved = Boolean(savedAnswer) && draft.trim() === savedText.trim();
  const isEditing = question ? (editingQuestions[question.id] ?? !savedAnswer) : false;
  const submitted = Boolean(savedAnswer && draftMatchesSaved && !isEditing);
  const submitting = Boolean(!isEditing && draft.trim() && !draftMatchesSaved);

  const submittedCount = useMemo(
    () => questions.filter((item) => String(snapshot?.teamAnswers?.[item.id]?.text ?? "").trim()).length,
    [questions, snapshot?.teamAnswers],
  );
  const totalRoundQuestions = Number(snapshot?.round?.totalQuestions ?? 0);
  const finalQuestionReleased = totalRoundQuestions > 0 && questions.length >= totalRoundQuestions;
  const canLockRound = !roundLocked && finalQuestionReleased;

  function setDraft(value) {
    if (!question || questionLocked || !isEditing) return;
    setDrafts((current) => ({ ...current, [question.id]: value }));
  }

  function chooseAnswer(option) {
    if (!question || questionLocked || !isEditing) return;
    setDrafts((current) => ({ ...current, [question.id]: option }));
  }

  function lockInAnswer() {
    if (!question || questionLocked || !isEditing || !draft.trim()) return;
    setEditingQuestions((current) => ({ ...current, [question.id]: false }));
    const sent = send({ type: "save-answer", questionId: question.id, text: draft.trim() });
    if (!sent) setEditingQuestions((current) => ({ ...current, [question.id]: true }));
  }

  function changeAnswer() {
    if (!question || questionLocked) return;
    setEditingQuestions((current) => ({ ...current, [question.id]: true }));
  }

  function lockRound() {
    if (!canLockRound) return;
    const unsaved = questions.filter((item) => {
      const local = String(drafts[item.id] ?? "").trim();
      const remote = String(snapshot?.teamAnswers?.[item.id]?.text ?? "").trim();
      return local && local !== remote;
    });
    const missing = Math.max(0, totalRoundQuestions - questions.filter((item) => String(drafts[item.id] ?? snapshot?.teamAnswers?.[item.id]?.text ?? "").trim()).length);
    const message = missing
      ? `Lock in ALL round answers? ${missing} question${missing === 1 ? " is" : "s are"} still blank.`
      : "Lock in ALL round answers? You will not be able to change them after this.";
    if (!window.confirm(message)) return;

    for (const item of unsaved) {
      send({ type: "save-answer", questionId: item.id, text: String(drafts[item.id]).trim() });
    }
    send({ type: "lock-round" });
  }

  function replayAudio() {
    const audio = teamAudioRef.current;
    if (!audio) return;
    audio.pause();
    try { audio.currentTime = 0; } catch { /* ignored */ }
    audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }

  if (!snapshot) return <ConnectionScreen status={status} error={error} />;
  if (!snapshot.team) return <ConnectionScreen status="error" error="This team QR code is no longer valid." />;
  if (!snapshot.team.nameLocked) return <TeamNameScreen snapshot={snapshot} send={send} status={status} />;
  if (screen === "leaderboard") return <LeaderboardScreen snapshot={snapshot} status={status} />;
  if (screen === "final") return <FinalScreen snapshot={snapshot} status={status} />;
  if (!question || (["lobby", "round_locked"].includes(screen) && !questions.length)) {
    return <WaitingScreen snapshot={snapshot} status={status} />;
  }

  const isMultipleChoice = question.type === "Multiple choice" && question.options?.length;
  const isTextEntry = !isMultipleChoice;
  const correctAnswer = String(question.answer ?? "").trim();

  return (
    <TeamChrome status={status}>
      {snapshot.live?.timerActive ? (
        <div className={`team-timer-overlay ${countdown <= 10 ? "urgent" : ""}`}>
          <Timer size={20} />
          <span>ANSWERS LOCK IN</span>
          <strong>{countdown}s</strong>
        </div>
      ) : null}

      <section className={`team-card live-team-card question-team-card ${snapshot.live?.timerActive ? "timer-running" : ""}`}>
        <div className="team-question-topline">
          <div><span>{snapshot.round?.title || "Round"}</span><strong>{snapshot.team.name}</strong></div>
          <div className="team-question-progress">{submittedCount}/{totalRoundQuestions || questions.length} locked in</div>
        </div>

        <div className="team-question-nav">
          <button disabled={viewIndex <= 0} onClick={() => setViewIndex((index) => Math.max(0, index - 1))}>
            <ArrowLeft size={17} />
          </button>
          <div><span>QUESTION</span><strong>{question.number ?? viewIndex + 1}</strong><small>of {totalRoundQuestions || questions.length}</small></div>
          <button disabled={viewIndex >= questions.length - 1} onClick={() => setViewIndex((index) => Math.min(questions.length - 1, index + 1))}>
            <ArrowRight size={17} />
          </button>
        </div>

        <div className={`team-question-stage ${questionLocked ? "is-locked" : ""} ${question.revealed ? "is-revealed" : ""} ${submitted ? "answer-submitted" : ""}`}>
          {questionLocked ? <span className="question-lock-key" aria-label="Question locked"><KeyRound size={18} /></span> : null}

          <div className="team-question-core lockable-zone">
            {question.image ? (
              <div className="team-media-frame live-team-image">
                <img src={question.image} alt={question.imageName || "Question"} />
              </div>
            ) : null}

            {question.audio ? (
              <div className="team-audio-frame compact-team-audio">
                <Volume2 size={17} />
                <strong>{question.audioName || "Audio question"}</strong>
                <audio ref={teamAudioRef} preload="auto" src={question.audio} />
                <button type="button" className="audio-replay-button" onClick={replayAudio}>
                  <RotateCcw size={15} /> {audioBlocked ? "Play audio" : "Replay"}
                </button>
              </div>
            ) : null}

            <h1 className="team-question-text">{question.text}</h1>
          </div>

          <div className="team-answer-zone lockable-zone">
            {isMultipleChoice ? (
              <div className="team-choice-list live-choice-list">
                {question.options.filter(Boolean).map((option, index) => {
                  const selected = draft === option;
                  const correct = question.revealed && correctAnswer === String(option).trim();
                  return (
                    <button
                      type="button"
                      key={index}
                      disabled={questionLocked || !isEditing}
                      className={`${selected ? "selected" : ""} ${submitted && selected ? "submitted-choice" : ""} ${correct ? "correct-reveal" : ""}`}
                      onClick={() => chooseAnswer(option)}
                    >
                      <span>{String.fromCharCode(65 + index)}</span>{option}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {isTextEntry ? (
              <div className="answer-input-shell">
                <textarea
                  className={`${draft.trim() ? "has-answer" : ""} ${submitted ? "submitted-answer" : ""}`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={questionLocked || !isEditing}
                  maxLength={500}
                  placeholder={question.type === "Picture" ? "Type what you think the picture is…" : "Type your answer…"}
                />
                {question.revealed ? (
                  <div className="revealed-answer-pill">
                    <CheckCircle2 size={18} />
                    <span>ANSWER</span>
                    <strong>{question.answer}</strong>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!questionLocked ? (
              <div className="question-submit-row">
                {submitted ? (
                  <>
                    <div className="question-submitted-state"><Lock size={15} /><strong>Answer locked in</strong><span>You can still change it until the round closes.</span></div>
                    <button type="button" className="change-answer-button" onClick={changeAnswer}><Edit3 size={15} /> Change answer</button>
                  </>
                ) : submitting ? (
                  <button type="button" className="lock-answer-button pending" disabled><Lock size={15} /> Locking in…</button>
                ) : (
                  <button type="button" className="lock-answer-button" disabled={!draft.trim()} onClick={lockInAnswer}><Lock size={15} /> Lock In Answer</button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="team-round-footer compact-round-footer">
          <div><span>Round</span><strong>{submittedCount}/{totalRoundQuestions || questions.length} locked in</strong></div>
          {snapshot.round?.teamLocked || roundLocked ? (
            <button className="team-lock-round-button" disabled><KeyRound size={15} /> Round locked</button>
          ) : canLockRound ? (
            <button className="team-lock-round-button all-answers-lock" onClick={lockRound}><Lock size={15} /> Lock In ALL Answers</button>
          ) : null}
        </div>
      </section>
    </TeamChrome>
  );
}
