import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crown,
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

function TeamChrome({ children, status, keyboardActive = false }) {
  return (
    <main className={`team-page live-team-page ${keyboardActive ? "keyboard-active-page" : ""}`}>
      <div className={`phone-shell live-phone-shell ${keyboardActive ? "keyboard-active" : ""}`}>
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

function useVisibleViewportHeight() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const height = Math.max(320, Math.round(viewport?.height ?? window.innerHeight));
      document.documentElement.style.setProperty("--team-visible-height", `${height}px`);
    };

    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--team-visible-height");
    };
  }, []);
}

function formatScore(value) {
  const number = Number(value ?? 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, "");
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
  const facts = snapshot.waitingFacts ?? [];
  const seed = String(snapshot.team?.id || snapshot.team?.name || "quiz")
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  const [factIndex, setFactIndex] = useState(facts.length ? seed % facts.length : 0);

  useEffect(() => {
    if (facts.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setFactIndex((index) => (index + 1) % facts.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [facts.length]);

  useEffect(() => {
    if (facts.length && factIndex >= facts.length) setFactIndex(0);
  }, [facts.length, factIndex]);

  const scores = snapshot.roundScores ?? [];
  const liveRoundIndex = Number(snapshot.live?.roundIndex ?? 0);
  const totalRounds = Number(snapshot.quiz?.totalRounds ?? 0);
  const screen = snapshot.live?.teamScreen ?? "lobby";
  const beforeFirstRound = liveRoundIndex === 0 && Number(snapshot.live?.questionIndex ?? -1) < 0 && scores.length === 0;
  const afterFinalRound = screen === "round_locked" && totalRounds > 0 && liveRoundIndex >= totalRounds - 1;
  const heading = afterFinalRound
    ? "The Results Will Be Announced Soon"
    : beforeFirstRound
      ? "The Quiz Will Begin Soon"
      : "The Next Round Will Start Soon";
  const fact = facts.length ? facts[factIndex % facts.length] : "";

  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card waiting-team-card">
        <div className="waiting-team-banner">
          <div className="waiting-team-name">
            <span>TEAM</span>
            <strong>{snapshot.team.name}</strong>
          </div>
          <div className="waiting-team-meta">
            <div><span>TABLE</span><strong>{snapshot.team.table || "—"}</strong></div>
            <div><span>PLAYERS</span><strong>{snapshot.team.players || 1}</strong></div>
          </div>
        </div>

        <div className="waiting-headline">
          <span>{afterFinalRound ? "QUIZ COMPLETE" : beforeFirstRound ? "GET READY" : "BETWEEN ROUNDS"}</span>
          <h1>{heading}</h1>
        </div>

        {scores.length ? (
          <div className="waiting-score-panel">
            <div className="waiting-score-heading">
              <div><span>UNREVIEWED SCORES</span><strong>Your score so far</strong></div>
              <small>The Quizmaster can still adjust marks.</small>
            </div>
            <div className="waiting-round-scores">
              {scores.map((round) => (
                <div className="waiting-round-score" key={round.id}>
                  <div><span>ROUND {round.number}</span><strong>{round.title}</strong></div>
                  <b>{formatScore(round.score)} <small>/ {formatScore(round.max)}</small></b>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {fact ? (
          <div className="waiting-fun-fact" key={`${factIndex}-${fact}`}>
            <span>FUN FACT</span>
            <strong>{fact}</strong>
          </div>
        ) : null}
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
                <span>{place}</span><strong>{team.name || "Unnamed team"}</strong><b>{team.score} pts</b>
              </div>
            );
          })}
        </div>
      </section>
    </TeamChrome>
  );
}

export default function TeamView({ sessionCode, teamToken }) {
  useVisibleViewportHeight();
  const { snapshot, status, error, send } = useLiveTeamNetwork(sessionCode, teamToken);
  const [viewIndex, setViewIndex] = useState(0);
  const [drafts, setDrafts] = useState({});
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [answerFocused, setAnswerFocused] = useState(false);
  const [newQuestionWaiting, setNewQuestionWaiting] = useState(false);
  const teamAudioRef = useRef(null);
  const lastPlayNonceRef = useRef(0);
  const viewIndexRef = useRef(0);
  const previousRoundIdRef = useRef("");
  const previousHostQuestionRef = useRef(-1);
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
  const isMultipleChoice = Boolean(question?.type === "Multiple choice" && question.options?.length);
  const isTextEntry = Boolean(question && !isMultipleChoice);

  useEffect(() => {
    viewIndexRef.current = viewIndex;
    if (viewIndex >= hostQuestionIndex) setNewQuestionWaiting(false);
  }, [viewIndex, hostQuestionIndex]);

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
    const roundId = snapshot?.round?.id ?? "";
    const previousRoundId = previousRoundIdRef.current;
    const previousHostQuestion = previousHostQuestionRef.current;
    const latestAvailable = Math.min(hostQuestionIndex, questions.length - 1);

    if (roundId !== previousRoundId) {
      setViewIndex(latestAvailable);
      setNewQuestionWaiting(false);
      previousRoundIdRef.current = roundId;
      previousHostQuestionRef.current = hostQuestionIndex;
      return;
    }

    if (hostQuestionIndex > previousHostQuestion) {
      const wasReviewingOlderQuestion = previousHostQuestion >= 0 && viewIndexRef.current < previousHostQuestion;
      if (wasReviewingOlderQuestion) {
        setNewQuestionWaiting(true);
      } else {
        setViewIndex(latestAvailable);
        setNewQuestionWaiting(false);
      }
    } else if (hostQuestionIndex < previousHostQuestion) {
      setViewIndex(latestAvailable);
      setNewQuestionWaiting(false);
    }

    previousHostQuestionRef.current = hostQuestionIndex;
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
  const draftMatchesSaved = draft.trim() === savedText.trim() && (Boolean(savedAnswer) || !draft.trim());
  const answerSaving = Boolean(question && !questionLocked && draft.trim() !== savedText.trim());
  const submitted = Boolean(savedAnswer && draftMatchesSaved);

  useEffect(() => {
    if (!question || questionLocked || isMultipleChoice) return undefined;
    const nextText = String(draft ?? "").trim();
    const currentText = String(savedText ?? "").trim();
    if (nextText === currentText) return undefined;

    const timer = window.setTimeout(() => {
      send({ type: "save-answer", questionId: question.id, text: nextText });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draft, savedText, question?.id, questionLocked, isMultipleChoice, send]);

  const answeredCount = useMemo(
    () => questions.filter((item) => String(drafts[item.id] ?? snapshot?.teamAnswers?.[item.id]?.text ?? "").trim()).length,
    [questions, drafts, snapshot?.teamAnswers],
  );
  const totalRoundQuestions = Number(snapshot?.round?.totalQuestions ?? 0);
  const finalQuestionReleased = totalRoundQuestions > 0 && questions.length >= totalRoundQuestions;
  const canLockRound = !roundLocked && finalQuestionReleased;

  function setDraft(value) {
    if (!question || questionLocked) return;
    setDrafts((current) => ({ ...current, [question.id]: value }));
  }

  function chooseAnswer(option) {
    if (!question || questionLocked) return;
    setDrafts((current) => ({ ...current, [question.id]: option }));
    send({ type: "save-answer", questionId: question.id, text: option });
  }

  function lockRound() {
    if (!canLockRound) return;
    const unsaved = questions.filter((item) => {
      const remote = String(snapshot?.teamAnswers?.[item.id]?.text ?? "").trim();
      const local = String(drafts[item.id] ?? remote).trim();
      return local !== remote;
    });
    const missing = Math.max(0, totalRoundQuestions - questions.filter((item) => String(drafts[item.id] ?? snapshot?.teamAnswers?.[item.id]?.text ?? "").trim()).length);
    const message = missing
      ? `Lock in ALL round answers? ${missing} question${missing === 1 ? " is" : "s are"} still blank.`
      : "Lock in ALL round answers? You will not be able to change them after this.";
    if (!window.confirm(message)) return;

    for (const item of unsaved) {
      const remote = String(snapshot?.teamAnswers?.[item.id]?.text ?? "").trim();
      send({ type: "save-answer", questionId: item.id, text: String(drafts[item.id] ?? remote).trim() });
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
  if (screen === "round_locked" || !question || (screen === "lobby" && !questions.length)) {
    return <WaitingScreen snapshot={snapshot} status={status} />;
  }

  const correctAnswer = String(question.answer ?? "").trim();
  const canGoBack = viewIndex > 0;
  const canGoForward = viewIndex < questions.length - 1;
  const showNewQuestionAlert = Boolean(newQuestionWaiting && viewIndex < hostQuestionIndex && canGoForward);

  return (
    <TeamChrome status={status} keyboardActive={answerFocused}>
      {snapshot.live?.timerActive ? (
        <div className={`team-timer-overlay ${countdown <= 10 ? "urgent" : ""}`}>
          <Timer size={20} />
          <span>ANSWERS LOCK IN</span>
          <strong>{countdown}s</strong>
        </div>
      ) : null}

      <section className={`team-card live-team-card question-team-card ${snapshot.live?.timerActive ? "timer-running" : ""} ${answerFocused ? "keyboard-active" : ""}`}>
        <div className="team-question-topline">
          <div><span>{snapshot.round?.title || "Round"}</span><strong>{snapshot.team.name}</strong></div>
          <div className="team-question-progress">{answeredCount}/{totalRoundQuestions || questions.length} answered</div>
        </div>

        <div className="team-question-nav">
          <button className="question-nav-button previous" disabled={!canGoBack} onClick={() => setViewIndex((index) => Math.max(0, index - 1))}>
            <ArrowLeft size={24} />
            <span>Previous</span>
          </button>
          <div className="question-number-display"><span>QUESTION</span><strong>{question.number ?? viewIndex + 1}</strong><small>of {totalRoundQuestions || questions.length}</small></div>
          <button className={`question-nav-button next ${showNewQuestionAlert ? "new-question-waiting" : ""}`} disabled={!canGoForward} onClick={() => setViewIndex((index) => Math.min(questions.length - 1, index + 1))}>
            <span>Next</span>
            <ArrowRight size={24} />
            {showNewQuestionAlert ? <b>NEW</b> : null}
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
                      disabled={questionLocked}
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
                  onFocus={() => setAnswerFocused(true)}
                  onBlur={() => setAnswerFocused(false)}
                  disabled={questionLocked}
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

            {!questionLocked && draft.trim() && !answerSaving ? (
              <div className="answer-save-status saved">
                <CheckCircle2 size={15} />
                <strong>Answer Updated</strong>
              </div>
            ) : null}
          </div>
        </div>

        <div className="team-round-footer compact-round-footer">
          <div><span>Round</span><strong>{answeredCount}/{totalRoundQuestions || questions.length} answered</strong></div>
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
