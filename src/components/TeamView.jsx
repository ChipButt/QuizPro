import {
  CheckCircle2,
  ChevronRight,
  Crown,
  Lock,
  Menu,
  Send,
  Timer,
  UserPlus,
  Volume2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  autoScoreAnswer,
  computeLeaderboard,
  createId,
  formatClock,
  getCurrentQuestion,
  getCurrentRound,
  getQuestionAnswers,
  pointsLabel,
} from "../utils/quiz.js";

function getStoredTeamId() {
  return window.localStorage.getItem("quizmaster-pro-team-id") ?? "";
}

function TeamChrome({ children }) {
  const joinUrl = `${window.location.host}${window.location.pathname}#/join`;

  return (
    <main className="team-page">
      <div className="phone-shell">
        <header className="phone-topbar">
          <div className="brand-lockup">
            <span className="brand-mark">
              <Crown size={19} />
            </span>
            <strong>Quizmaster<span>Pro</span></strong>
          </div>
          <button className="phone-menu" aria-label="Team menu">
            <Menu size={20} />
          </button>
        </header>
        <div className="phone-url">{joinUrl}</div>
        {children}
      </div>
    </main>
  );
}

function JoinForm({ state, updateState, onRegistered }) {
  const [teamName, setTeamName] = useState("");
  const [pin, setPin] = useState("");
  const [players, setPlayers] = useState(4);

  function submit(event) {
    event.preventDefault();
    if (!teamName.trim()) return;
    const id = createId("team");
    updateState((current) => ({
      ...current,
      teams: [
        ...current.teams,
        {
          id,
          name: teamName.trim(),
          table: pin,
          players: Number(players),
          registeredAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          approved: true,
          scoreAdjustment: 0,
        },
      ],
    }));
    window.localStorage.setItem("quizmaster-pro-team-id", id);
    onRegistered(id);
  }

  return (
    <TeamChrome>
      <section className="team-card">
        <span className="status-pill live">Join code {state.joinCode}</span>
        <h1>Register your team</h1>
        <p>One device per team. You can edit each answer until the host locks submissions.</p>
        {!state.live.registrationOpen ? (
          <div className="team-alert">
            <Lock size={17} />
            Registration is currently closed.
          </div>
        ) : null}
        <form onSubmit={submit} className="team-form">
          <label>Team name<input value={teamName} onChange={(event) => setTeamName(event.target.value)} /></label>
          <label>Table or PIN<input value={pin} onChange={(event) => setPin(event.target.value)} /></label>
          <label>Number of players<input type="number" min="1" value={players} onChange={(event) => setPlayers(event.target.value)} /></label>
          <button className="primary-button" disabled={!state.live.registrationOpen}>
            <UserPlus size={16} />
            Register team
          </button>
        </form>
      </section>
    </TeamChrome>
  );
}

function WaitingRoom({ team, state }) {
  return (
    <TeamChrome>
      <section className="team-card">
        <div className="registered-box">
          <CheckCircle2 size={18} />
          <div>
            <span>Registered</span>
            <strong>{team.name}</strong>
          </div>
        </div>
        <h1>Waiting for the host</h1>
        <p>The quizmaster controls what appears here. Keep this page open.</p>
        <div className="score-strip">
          <span>Current screen</span>
          <strong>{state.live.screen}</strong>
        </div>
      </section>
    </TeamChrome>
  );
}

export default function TeamView({ state, updateState }) {
  const [teamId, setTeamId] = useState(getStoredTeamId);
  const team = state.teams.find((item) => item.id === teamId);
  const round = getCurrentRound(state);
  const question = getCurrentQuestion(state);
  const answers = getQuestionAnswers(state, question?.id);
  const existingAnswer = team ? answers[team.id] : null;
  const [answerText, setAnswerText] = useState(existingAnswer?.text ?? "");
  const leaderboard = useMemo(() => computeLeaderboard(state), [state]);
  const teamRank = leaderboard.findIndex((item) => item.id === team?.id) + 1;
  const teamScore = leaderboard.find((item) => item.id === team?.id)?.score ?? 0;
  const audioLabel = question?.audioName || (question?.audio?.startsWith("data:") ? "Attached audio" : question?.audio);

  if (!team) {
    return <JoinForm state={state} updateState={updateState} onRegistered={setTeamId} />;
  }

  if (!question || ["welcome", "team registration", "break"].includes(state.live.screen)) {
    return <WaitingRoom team={team} state={state} />;
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (!answerText.trim() || state.live.locked) return;
    updateState((current) => {
      const currentQuestion = getCurrentQuestion(current);
      const suggestion = currentQuestion.autoMark
        ? autoScoreAnswer(currentQuestion, answerText)
        : { score: null, status: "pending", reason: "Manual marking" };
      return {
        ...current,
        answers: {
          ...current.answers,
          [currentQuestion.id]: {
            ...getQuestionAnswers(current, currentQuestion.id),
            [team.id]: {
              text: answerText.trim(),
              submittedAt: formatClock(current.live.elapsedSeconds),
              status: suggestion.status,
              score: suggestion.status === "correct" ? suggestion.score : null,
              reason: suggestion.reason,
            },
          },
        },
      };
    });
  }

  return (
    <TeamChrome>
      <section className="team-card compact">
        <div className="registered-box">
          <CheckCircle2 size={18} />
          <div>
            <span>Registered</span>
            <strong>{team.name}</strong>
          </div>
          <button onClick={() => window.localStorage.removeItem("quizmaster-pro-team-id")}>Edit team</button>
        </div>
        <div className="team-question-meta">
          <div>
            <strong>{round.title || "Round"}</strong>
            <span>Question {question.number} of {round.questions.length}</span>
          </div>
          <span className="status-pill good">{pointsLabel(question.points)}</span>
        </div>
        {question.image ? (
          <div className="team-media-frame">
            <img src={question.image} alt={question.imageName || "Question media"} />
          </div>
        ) : question.audio ? (
          <div className="team-audio-frame">
            <Volume2 size={25} />
            <span>{audioLabel}</span>
            {question.audio.startsWith("data:") || question.audio.startsWith("http") ? (
              <audio controls src={question.audio} />
            ) : null}
          </div>
        ) : null}
        <h1>{question.text}</h1>
        {question.type === "Multiple choice" && question.options?.some((option) => option.trim()) ? (
          <div className="team-choice-list">
            {question.options.map((option, index) => (
              option.trim() ? <button type="button" key={index} onClick={() => setAnswerText(option)}>{option}</button> : null
            ))}
          </div>
        ) : null}
        <form onSubmit={submitAnswer} className="team-answer-form">
          <div className="answer-label-row">
            <label>Your answer</label>
            {state.live.locked ? (
              <span><Lock size={13} /> Locked</span>
            ) : (
              <span>{state.live.questionSecondsRemaining}s remaining</span>
            )}
          </div>
          <textarea
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            disabled={state.live.locked}
            maxLength={100}
          />
          <div className="char-count">{answerText.length} / 100</div>
          <button className="primary-button full-width" disabled={state.live.locked || !answerText.trim()}>
            <Send size={16} />
            {existingAnswer ? "Update Answer" : "Submit Answer"}
          </button>
        </form>
        {existingAnswer ? (
          <div className="submitted-row">
            <CheckCircle2 size={17} />
            <span>Answer submitted</span>
            <time>{existingAnswer.submittedAt}</time>
          </div>
        ) : null}
        {state.live.answerRevealed ? (
          <div className="answer-reveal phone-reveal">
            <span>Correct answer</span>
            <strong>{question.answer}</strong>
            <small>Your mark: {existingAnswer?.score ?? "waiting for host"}</small>
          </div>
        ) : null}
        <div className="team-score-card">
          <span>Score so far</span>
          <strong>{pointsLabel(teamScore)}</strong>
          <small>{teamRank ? `Rank ${teamRank}` : "Waiting for first score"}</small>
          <a href="#scores">View team scores <ChevronRight size={14} /></a>
        </div>
        <div className="waiting-note">
          <Timer size={16} />
          {state.live.answerRevealed ? "Waiting for host to move on..." : "Waiting for host to reveal..."}
        </div>
      </section>
    </TeamChrome>
  );
}
