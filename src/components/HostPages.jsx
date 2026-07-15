import {
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  Eye,
  FileAudio,
  FileImage,
  Folder,
  Image as ImageIcon,
  ListChecks,
  Lock,
  MailCheck,
  Mic2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCcw,
  RotateCcw,
  Save,
  Settings,
  SkipForward,
  Unlock,
  Upload,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import {
  autoScoreAnswer,
  computeLeaderboard,
  createId,
  flattenQuestions,
  formatClock,
  getCurrentQuestion,
  getCurrentRound,
  getQuestionAnswers,
  getSelectedQuiz,
  nextQuestionPosition,
  pointsLabel,
} from "../utils/quiz.js";

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

function StatTile({ label, value, detail, tone = "neutral" }) {
  return (
    <div className={`stat-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function StatusPill({ children, tone = "neutral" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function IconButton({ label, icon: Icon, onClick, className = "", disabled = false }) {
  return (
    <button className={`icon-action ${className}`} onClick={onClick} disabled={disabled}>
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );
}

function updateQuiz(state, quizId, updater) {
  return {
    ...state,
    quizzes: state.quizzes.map((quiz) => (quiz.id === quizId ? updater(quiz) : quiz)),
  };
}

const QUESTION_TYPES = ["Text", "Picture", "Music", "Multiple choice", "Numerical", "Nearest wins"];
const ROUND_TYPES = [
  "Standard question round",
  "Picture round",
  "Music round",
  "Multiple choice round",
  "Numerical round",
  "Nearest-wins question",
];

function questionTypeForRound(type = "") {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("picture")) return "Picture";
  if (lowerType.includes("music")) return "Music";
  if (lowerType.includes("multiple")) return "Multiple choice";
  if (lowerType.includes("numerical")) return "Numerical";
  if (lowerType.includes("nearest")) return "Nearest wins";
  return "Text";
}

function defaultOptions(options = []) {
  return [0, 1, 2, 3].map((index) => options[index] ?? "");
}

function normalizeQuestionForType(question, type) {
  const next = { ...question, type };
  if (type === "Multiple choice") {
    return {
      ...next,
      options: defaultOptions(next.options),
      answer: next.answer ?? "",
      autoMark: true,
    };
  }
  if (type === "Numerical" || type === "Nearest wins") {
    return {
      ...next,
      tolerance: next.tolerance ?? 0,
      units: next.units ?? "",
      autoMark: type === "Numerical" ? next.autoMark : false,
    };
  }
  if (type === "Music") {
    return {
      ...next,
      audio: next.audio ?? "",
      audioName: next.audioName ?? "",
    };
  }
  if (type === "Picture") {
    return {
      ...next,
      image: next.image ?? "",
      imageName: next.imageName ?? "",
    };
  }
  return next;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function createQuestion(number, overrides = {}) {
  const type = overrides.type ?? "Text";
  return normalizeQuestionForType({
    id: createId("question"),
    number,
    text: "",
    answer: "",
    alternatives: [],
    points: 1,
    type: "Text",
    category: "",
    difficulty: "Medium",
    image: "",
    audio: "",
    notes: "",
    timeLimit: 60,
    autoMark: true,
    ...overrides,
  }, type);
}

function createRound(order, overrides = {}) {
  return {
    id: createId("round"),
    title: "",
    type: "Standard question round",
    instructions: "",
    scoringRules: "",
    questions: [],
    order,
    ...overrides,
  };
}

function createQuiz(overrides = {}) {
  return {
    id: createId("quiz"),
    title: "",
    date: "",
    time: "",
    venue: "",
    status: "Draft",
    notes: "",
    archived: false,
    rounds: [],
    finalLeaderboard: [],
    ...overrides,
  };
}

function quizDisplayName(quiz) {
  return quiz?.title?.trim() || "Quiz";
}

function roundDisplayName(round, index = 0) {
  return round?.title?.trim() || `Round ${index + 1}`;
}

function scoreClass(status) {
  if (status === "correct") return "good";
  if (status === "incorrect") return "bad";
  if (status === "half") return "warn";
  return "pending";
}

function QuestionTypeIcon({ type, size = 25 }) {
  if (type === "Music") return <Mic2 size={size} />;
  if (type === "Picture") return <FileImage size={size} />;
  if (type === "Multiple choice") return <ListChecks size={size} />;
  return <ClipboardList size={size} />;
}

export function DashboardPage({ state, setActivePage }) {
  const upcoming = state.quizzes.filter((quiz) => ["Ready", "Scheduled", "Live"].includes(quiz.status));
  const drafts = state.quizzes.filter((quiz) => quiz.status === "Draft");
  const completed = state.quizzes.filter((quiz) => quiz.status === "Completed");
  const totalRounds = state.quizzes.reduce((count, quiz) => count + (quiz.rounds?.length ?? 0), 0);
  const leaderboard = computeLeaderboard(state).slice(0, 4);
  const currentQuestion = getCurrentQuestion(state);

  return (
    <main className="page dashboard-page">
      <div className="page-title-row">
        <div>
          <h1>Dashboard</h1>
          <p>Plan future events, monitor the live room, and keep quiz materials organised.</p>
        </div>
        <button className="primary-button" onClick={() => setActivePage("Quizzes")}>
          <Plus size={16} />
          New quiz
        </button>
      </div>
      <div className="stats-grid">
        <StatTile label="Upcoming quizzes" value={upcoming.length} detail="Ready or scheduled" tone="good" />
        <StatTile label="Draft quizzes" value={drafts.length} detail="Need review" tone="warn" />
        <StatTile label="Rounds built" value={totalRounds} detail="Across all quizzes" />
        <StatTile label="Media files" value={state.media.length} detail="In round folders" />
      </div>
      <div className="dashboard-grid">
        <Panel title="Upcoming quizzes">
          {upcoming.length ? (
            <div className="stack-list">
              {upcoming.map((quiz) => (
                <button
                  className="list-row button-row"
                  key={quiz.id}
                  onClick={() => setActivePage("Quizzes")}
                >
                  <div>
                    <strong>{quizDisplayName(quiz)}</strong>
                    <span>{[quiz.venue, quiz.date, quiz.time].filter(Boolean).join(" - ")}</span>
                  </div>
                  <StatusPill tone={quiz.status === "Live" ? "live" : "good"}>{quiz.status}</StatusPill>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="No scheduled quizzes" detail="Create a quiz and set its status when it is ready." />
          )}
        </Panel>
        <Panel title="Live room health">
          <div className="health-grid">
            <div>
              <span>Registration</span>
              <strong>{state.live.registrationOpen ? "Open" : "Closed"}</strong>
            </div>
            <div>
              <span>Teams</span>
              <strong>{state.teams.length} / 24</strong>
            </div>
            <div>
              <span>Current screen</span>
              <strong>{state.live.screen}</strong>
            </div>
            <div>
              <span>Submissions</span>
              <strong>{Object.keys(getQuestionAnswers(state, currentQuestion?.id)).length}</strong>
            </div>
          </div>
          <button className="ghost-button full-width" onClick={() => setActivePage("Live Quiz")}>
            Open live quiz
            <ChevronRight size={16} />
          </button>
        </Panel>
        <Panel title="Quiz build progress">
          <div className="health-grid">
            <div>
              <span>Completed</span>
              <strong>{completed.length}</strong>
            </div>
            <div>
              <span>Teams</span>
              <strong>{state.teams.length}</strong>
            </div>
            <div>
              <span>Answers</span>
              <strong>{Object.values(state.answers).reduce((count, answers) => count + Object.keys(answers).length, 0)}</strong>
            </div>
            <div>
              <span>Media</span>
              <strong>{state.media.length}</strong>
            </div>
          </div>
        </Panel>
        <Panel title="Current leaderboard">
          {leaderboard.length ? (
            <LeaderboardList leaderboard={leaderboard} />
          ) : (
            <EmptyState icon={BarChart3} title="No scores yet" detail="Teams and marked answers will appear here." />
          )}
        </Panel>
      </div>
    </main>
  );
}

export function LiveQuizPage({ state, updateState, setActivePage }) {
  const quiz = getSelectedQuiz(state);
  const round = getCurrentRound(state);
  const question = getCurrentQuestion(state);
  const answers = getQuestionAnswers(state, question?.id);
  const leaderboard = computeLeaderboard(state);
  const teamUrl = `${window.location.origin}${window.location.pathname}#/join/${state.joinCode}`;
  const teamUrlLabel = `${window.location.host}${window.location.pathname}#/join`;
  const audioLabel = question?.audioName || (question?.audio?.startsWith("data:") ? "Attached audio" : question?.audio) || "No track attached";
  const pendingAnswers = state.teams
    .map((team) => ({ team, answer: answers[team.id] }))
    .filter(({ answer }) => answer?.status === "pending");

  function setRegistration(open) {
    updateState((current) => ({
      ...current,
      live: { ...current.live, registrationOpen: open },
    }));
  }

  function setScreen(screen) {
    updateState((current) => ({
      ...current,
      live: { ...current.live, screen },
    }));
  }

  function lockAnswers() {
    updateState((current) => ({
      ...current,
      live: { ...current.live, locked: true, screen: "locked" },
    }));
  }

  function revealAnswer() {
    updateState((current) => ({
      ...current,
      live: { ...current.live, answerRevealed: true, screen: "answer" },
    }));
  }

  function nextQuestion() {
    updateState((current) => {
      const selected = getSelectedQuiz(current);
      if (!selected) {
        return current;
      }
      const next = nextQuestionPosition(selected, current.live);
      if (!next) {
        return {
          ...current,
          live: { ...current.live, screen: "final", status: "Completed", answerRevealed: true },
          quizzes: current.quizzes.map((item) =>
            item.id === selected.id ? { ...item, status: "Completed", finalLeaderboard: computeLeaderboard(current).map((team) => [team.name, team.score]) } : item,
          ),
        };
      }
      return {
        ...current,
        live: {
          ...current.live,
          ...next,
          locked: false,
          answerRevealed: false,
          screen: "question",
          elapsedSeconds: 0,
          questionSecondsRemaining: selected.rounds[next.roundIndex].questions[next.questionIndex].timeLimit ?? 60,
          audio: { ...current.live.audio, playing: false, progress: 0 },
        },
      };
    });
  }

  function updateAudio(changes) {
    updateState((current) => ({
      ...current,
      live: {
        ...current.live,
        audio: { ...current.live.audio, ...changes },
      },
    }));
  }

  function markAnswer(teamId, score) {
    if (!question) return;
    updateState((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [question.id]: {
          ...getQuestionAnswers(current, question.id),
          [teamId]: {
            ...getQuestionAnswers(current, question.id)[teamId],
            score,
            status: score === question.points ? "correct" : score > 0 ? "half" : "incorrect",
          },
        },
      },
    }));
  }

  function markAllCorrect() {
    if (!question) return;
    updateState((current) => {
      const currentAnswers = getQuestionAnswers(current, question.id);
      return {
        ...current,
        answers: {
          ...current.answers,
          [question.id]: Object.fromEntries(
            Object.entries(currentAnswers).map(([teamId, answer]) => [
              teamId,
              { ...answer, score: question.points, status: "correct" },
            ]),
          ),
        },
      };
    });
  }

  if (!quiz || !round || !question) {
    return (
      <main className="page live-page">
        <Panel className="empty-workspace-panel">
          <EmptyState
            icon={Radio}
            title="No live question ready"
            detail="Create a quiz, add at least one round, then add a question before running the live view."
          />
          <button className="primary-button" onClick={() => setActivePage("Quizzes")}>
            <Plus size={16} />
            Open quiz builder
          </button>
        </Panel>
      </main>
    );
  }

  return (
    <main className="page live-page">
      <section className="live-layout">
        <div className="live-left">
          <div className="top-metrics">
            <Panel className="join-panel">
              <div className="join-copy">
                <span>Join code</span>
                <strong>{state.joinCode}</strong>
                <a href={teamUrl} target="_blank" rel="noreferrer">
                  {teamUrlLabel}
                </a>
              </div>
              <div className="qr-box">
                <QRCodeSVG value={teamUrl} size={92} marginSize={1} />
                <span>Scan to join</span>
              </div>
            </Panel>
            <Panel className="registration-panel">
              <div>
                <span className="utility-label">Registration</span>
                <strong className="large-number">{state.teams.length}</strong>
                <span className="muted"> / 24 Teams</span>
                <small>{state.teams.filter((team) => !team.approved).length} pending approval</small>
              </div>
              <div className="split-actions">
                <button className="ghost-button" onClick={() => setActivePage("Teams")}>
                  Manage Teams
                </button>
                <button
                  className={state.live.registrationOpen ? "danger-soft-button" : "primary-button compact"}
                  onClick={() => setRegistration(!state.live.registrationOpen)}
                >
                  {state.live.registrationOpen ? <Lock size={15} /> : <Unlock size={15} />}
                  {state.live.registrationOpen ? "Close" : "Open"}
                </button>
              </div>
            </Panel>
            <Panel className="status-panel">
              <span className="utility-label">Quiz status</span>
              <strong className="status-line"><span className="amber-dot" /> {state.live.status}</strong>
              <small>{formatClock(state.live.elapsedSeconds)} elapsed</small>
              <button className="danger-outline-button" onClick={() => setScreen("final")}>End Quiz</button>
            </Panel>
          </div>

          <Panel className="current-panel">
            <div className="current-header">
              <div className="round-icon">
                <QuestionTypeIcon type={question?.type} />
              </div>
              <div>
                <span className="utility-label">Current</span>
                <h1>{round?.title || "Round"}</h1>
                <p>Q{question?.number} of {round?.questions.length} - {pointsLabel(question?.points)}</p>
              </div>
              <div className="timer-box">
                <span>Time elapsed</span>
                <strong>{formatClock(state.live.elapsedSeconds)}</strong>
                <button className="icon-button" onClick={() => setScreen(state.live.screen === "paused" ? "question" : "paused")}>
                  {state.live.screen === "paused" ? <Play size={17} /> : <Pause size={17} />}
                </button>
              </div>
            </div>
            <div className="question-display">
              {question?.image ? (
                <div className="media-frame">
                  <img src={question.image} alt="Question media" />
                </div>
              ) : question?.audio ? (
                <div className="audio-art">
                  <Mic2 size={42} />
                  <span>{audioLabel}</span>
                </div>
              ) : (
                <div className="audio-art">
                  <ImageIcon size={42} />
                  <span>No media added</span>
                </div>
              )}
              <div className="question-copy">
                <span className="utility-label">Question</span>
                <h2>{question?.text}</h2>
                <div className="mini-meta">
                  <StatusPill>{question?.type}</StatusPill>
                  <StatusPill tone={question?.autoMark ? "good" : "warn"}>
                    {question?.autoMark ? "Auto marking on" : "Manual marking"}
                  </StatusPill>
                  {question?.category ? <StatusPill>{question.category}</StatusPill> : null}
                </div>
                {question?.type === "Multiple choice" && question.options?.some((option) => option.trim()) ? (
                  <ol className="choice-preview">
                    {question.options.map((option, index) => (
                      option.trim() ? <li key={index}>{option}</li> : null
                    ))}
                  </ol>
                ) : null}
                {(question?.type === "Numerical" || question?.type === "Nearest wins") && question.units ? (
                  <div className="mini-meta">
                    <StatusPill>{question.units}</StatusPill>
                    {question?.type === "Numerical" ? <StatusPill>+/- {question.tolerance ?? 0}</StatusPill> : null}
                  </div>
                ) : null}
                {state.live.answerRevealed ? (
                  <div className="answer-reveal">
                    <span>Correct answer</span>
                    <strong>{question.answer}</strong>
                    <small>{question.alternatives?.length ? `Alternatives: ${question.alternatives.join(", ")}` : "No alternatives set"}</small>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="host-command-row">
              <IconButton label="Reveal Answer" icon={Eye} className="success" onClick={revealAnswer} />
              <IconButton label="Lock Answers" icon={Lock} className="danger" onClick={lockAnswers} disabled={state.live.locked} />
              <IconButton label="Show Scores" icon={ClipboardList} onClick={() => setScreen("scores")} />
              <IconButton label="Next Question" icon={SkipForward} onClick={nextQuestion} />
              <IconButton label="Edit questions" icon={MoreHorizontal} onClick={() => setActivePage("Quizzes")} />
            </div>
            <div className="audio-controls">
              <div className="audio-left">
                <Volume2 size={19} />
                <div>
                  <span>Audio controls {question?.type === "Music" ? "" : "(if playing)"}</span>
                  <strong>{audioLabel}</strong>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={state.live.audio.progress}
                onChange={(event) => updateAudio({ progress: Number(event.target.value) })}
                aria-label="Audio progress"
              />
              <span>{state.live.audio.volume}%</span>
              <button className="icon-button" onClick={() => updateAudio({ progress: 0, playing: false })} aria-label="Restart audio">
                <RotateCcw size={17} />
              </button>
              <button className="icon-button" onClick={() => updateAudio({ playing: !state.live.audio.playing })} aria-label="Play or pause audio">
                {state.live.audio.playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button className="icon-button" onClick={() => updateAudio({ volume: 15 })} aria-label="Fade out audio">
                <Volume2 size={17} />
              </button>
            </div>
          </Panel>

          <div className="bottom-grid">
            <Panel title={`Team answers (${Object.keys(answers).length})`}>
              <AnswersTable teams={state.teams} answers={answers} compact />
              <button className="ghost-button" onClick={() => setActivePage("Marking")}>View all answers</button>
            </Panel>
            <Panel
              title={`Marking queue (${pendingAnswers.length})`}
              action={<button className="text-button" onClick={markAllCorrect}>Mark all correct</button>}
            >
              <div className="marking-list">
                {pendingAnswers.length ? (
                  pendingAnswers.map(({ team, answer }) => (
                    <div className="mark-row" key={team.id}>
                      <span className="rank-number">{state.teams.findIndex((item) => item.id === team.id) + 1}</span>
                      <div>
                        <strong>{team.name}</strong>
                        <span>{answer.text}</span>
                      </div>
                      <div className="mark-actions">
                        <button className="score-button good" onClick={() => markAnswer(team.id, question.points)}><Check size={15} /></button>
                        <button className="score-button bad" onClick={() => markAnswer(team.id, 0)}><X size={15} /></button>
                        <button className="score-button" onClick={() => markAnswer(team.id, question.points / 2)}>1/2</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState icon={MailCheck} title="No manual checks waiting" detail="Submitted answers are either marked or not in yet." />
                )}
              </div>
            </Panel>
          </div>
        </div>

        <aside className="live-right">
          <Panel title="Leaderboard">
            <LeaderboardList leaderboard={leaderboard.slice(0, 5)} />
            <button className="ghost-button full-width" onClick={() => setActivePage("Results")}>
              View full leaderboard
            </button>
          </Panel>
          <Panel title="Upcoming quizzes">
            <div className="stack-list">
              {state.quizzes
                .filter((item) => item.id !== quiz.id && !item.archived)
                .slice(0, 3)
                .map((item) => (
                  <button className="list-row button-row" key={item.id} onClick={() => setActivePage("Quizzes")}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.date} - {item.time}</span>
                      <small>{item.venue}</small>
                    </div>
                    <StatusPill tone={item.status === "Draft" ? "warn" : "good"}>{item.status}</StatusPill>
                  </button>
                ))}
            </div>
            <button className="ghost-button full-width" onClick={() => setActivePage("Quizzes")}>
              View all quizzes
            </button>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function AnswersTable({ teams, answers, compact = false }) {
  const rows = teams
    .map((team) => ({ team, answer: answers[team.id] }))
    .filter(({ answer }) => answer);

  return (
    <div className="table-wrap">
      <table className={compact ? "compact-table" : ""}>
        <thead>
          <tr>
            <th>Team</th>
            <th>Answer</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ team, answer }, index) => (
            <tr key={team.id}>
              <td><span className="rank-number">{index + 1}</span> {team.name}</td>
              <td>{answer.text}</td>
              <td><span className={`status-dot ${scoreClass(answer.status)}`} /> {answer.status}</td>
              <td>{answer.submittedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardList({ leaderboard }) {
  return (
    <ol className="leaderboard-list">
      {leaderboard.map((team, index) => (
        <li key={team.id ?? team.name}>
          <span>{index + 1}</span>
          <strong>{team.name}</strong>
          <b>{team.score}</b>
        </li>
      ))}
    </ol>
  );
}

function EmptyState({ icon: Icon, title, detail }) {
  return (
    <div className="empty-state">
      <Icon size={24} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function QuizzesPage({ state, updateState }) {
  const quiz = getSelectedQuiz(state);
  const [selectedRoundId, setSelectedRoundId] = useState(quiz?.rounds[0]?.id ?? "");
  const [selectedQuestionId, setSelectedQuestionId] = useState(quiz?.rounds[0]?.questions?.[0]?.id ?? "");

  useEffect(() => {
    if (!quiz) {
      setSelectedRoundId("");
      setSelectedQuestionId("");
      return;
    }
    if (quiz.rounds.some((round) => round.id === selectedRoundId)) {
      return;
    }
    setSelectedRoundId(quiz.rounds[0]?.id ?? "");
  }, [quiz, selectedRoundId]);

  const selectedRound = quiz?.rounds.find((round) => round.id === selectedRoundId) ?? quiz?.rounds[0];

  useEffect(() => {
    const questionIds = new Set((selectedRound?.questions ?? []).map((item) => item.id));
    if (selectedQuestionId && questionIds.has(selectedQuestionId)) {
      return;
    }
    setSelectedQuestionId(selectedRound?.questions?.[0]?.id ?? "");
  }, [selectedQuestionId, selectedRound?.id, selectedRound?.questions]);

  const currentQuestion =
    selectedRound?.questions?.find((question) => question.id === selectedQuestionId) ??
    selectedRound?.questions?.[0];

  function selectQuiz(quizId) {
    const nextQuiz = state.quizzes.find((item) => item.id === quizId);
    const nextRound = nextQuiz?.rounds?.[0];
    setSelectedRoundId(nextRound?.id ?? "");
    setSelectedQuestionId(nextRound?.questions?.[0]?.id ?? "");
    updateState((current) => ({ ...current, selectedQuizId: quizId }));
  }

  function addQuiz() {
    const nextQuiz = createQuiz();
    updateState((current) => {
      return {
        ...current,
        selectedQuizId: nextQuiz.id,
        quizzes: [...current.quizzes, nextQuiz],
      };
    });
    setSelectedRoundId("");
    setSelectedQuestionId("");
  }

  function duplicateQuiz() {
    if (!quiz) return;
    updateState((current) => {
      const original = getSelectedQuiz(current);
      const id = createId("quiz");
      if (!original) return current;
      return {
        ...current,
        selectedQuizId: id,
        quizzes: [
          ...current.quizzes,
          {
            ...original,
            id,
            title: original.title,
            status: "Draft",
            rounds: original.rounds.map((round) => ({
              ...round,
              id: createId("round"),
              questions: round.questions.map((question) => ({ ...question, id: createId("question") })),
            })),
          },
        ],
      };
    });
  }

  function deleteQuiz() {
    if (!quiz) return;
    const nextQuiz = state.quizzes.find((item) => item.id !== quiz.id) ?? null;
    updateState((current) => ({
      ...current,
      selectedQuizId: nextQuiz?.id ?? "",
      quizzes: current.quizzes.filter((item) => item.id !== quiz.id),
    }));
    setSelectedRoundId(nextQuiz?.rounds[0]?.id ?? "");
    setSelectedQuestionId(nextQuiz?.rounds[0]?.questions[0]?.id ?? "");
  }

  function updateSelectedQuiz(field, value) {
    if (!quiz) return;
    updateState((current) => updateQuiz(current, current.selectedQuizId, (item) => ({ ...item, [field]: value })));
  }

  function addRound(type = "Standard question round") {
    if (!quiz) return;
    const round = createRound((selectedRound?.order ?? quiz.rounds.length) + 1, { type });
    updateState((current) =>
      updateQuiz(current, current.selectedQuizId, (item) => ({
        ...item,
        rounds: [...item.rounds, round],
      })),
    );
    setSelectedRoundId(round.id);
    setSelectedQuestionId("");
  }

  function updateSelectedRound(field, value) {
    if (!quiz || !selectedRound) return;
    const nextQuestionType = field === "type" ? questionTypeForRound(value) : null;
    updateState((current) =>
      updateQuiz(current, current.selectedQuizId, (item) => ({
        ...item,
        rounds: item.rounds.map((round) =>
          round.id === selectedRound.id
            ? {
                ...round,
                [field]: value,
                questions: nextQuestionType
                  ? round.questions.map((question) => normalizeQuestionForType(question, nextQuestionType))
                  : round.questions,
              }
            : round,
        ),
      })),
    );
  }

  function duplicateRound() {
    if (!quiz || !selectedRound) return;
    const round = {
      ...selectedRound,
      id: createId("round"),
      questions: selectedRound.questions.map((question) => ({ ...question, id: createId("question") })),
    };
    updateState((current) =>
      updateQuiz(current, current.selectedQuizId, (item) => ({
        ...item,
        rounds: [...item.rounds, round],
      })),
    );
    setSelectedRoundId(round.id);
    setSelectedQuestionId(round.questions[0]?.id ?? "");
  }

  function deleteRound() {
    if (!quiz || !selectedRound) return;
    const nextRound = quiz.rounds.find((round) => round.id !== selectedRound.id) ?? null;
    updateState((current) =>
      updateQuiz(current, current.selectedQuizId, (item) => ({
        ...item,
        rounds: item.rounds.filter((round) => round.id !== selectedRound.id),
      })),
    );
    setSelectedRoundId(nextRound?.id ?? "");
    setSelectedQuestionId(nextRound?.questions[0]?.id ?? "");
  }

  function addQuestion() {
    if (!selectedRound) {
      addRound();
      return;
    }

    const questionId = createId("question");
    updateState((current) =>
      updateQuiz(current, current.selectedQuizId, (item) => ({
        ...item,
        rounds: item.rounds.map((round) => {
          if (round.id !== selectedRound.id) {
            return round;
          }
          const nextNumber = Math.max(0, ...round.questions.map((question) => Number(question.number) || 0)) + 1;
          return {
            ...round,
            questions: [
              ...round.questions,
              createQuestion(nextNumber, {
                id: questionId,
                type: questionTypeForRound(round.type),
              }),
            ],
          };
        }),
      })),
    );
    setSelectedQuestionId(questionId);
  }

  function duplicateQuestion() {
    if (!selectedRound || !currentQuestion) return;
    const questionId = createId("question");
    updateState((current) =>
      updateQuiz(current, current.selectedQuizId, (item) => ({
        ...item,
        rounds: item.rounds.map((round) => {
          if (round.id !== selectedRound.id) {
            return round;
          }
          const nextNumber = Math.max(0, ...round.questions.map((question) => Number(question.number) || 0)) + 1;
          return {
            ...round,
            questions: [
              ...round.questions,
              {
                ...currentQuestion,
                id: questionId,
                number: nextNumber,
              },
            ],
          };
        }),
      })),
    );
    setSelectedQuestionId(questionId);
  }

  function deleteQuestion() {
    if (!selectedRound || !currentQuestion) return;
    const nextQuestion =
      selectedRound.questions.find((question) => question.id !== currentQuestion.id) ?? null;
    updateState((current) =>
      updateQuiz(current, current.selectedQuizId, (item) => ({
        ...item,
        rounds: item.rounds.map((round) =>
          round.id === selectedRound.id
            ? { ...round, questions: round.questions.filter((question) => question.id !== currentQuestion.id) }
            : round,
        ),
      })),
    );
    setSelectedQuestionId(nextQuestion?.id ?? "");
  }

  return (
    <main className="page quizzes-page">
      <div className="page-title-row">
        <div>
          <h1>Quizzes</h1>
          <p>Create the quiz, rounds, and questions from a clean workspace.</p>
        </div>
        <div className="button-row-inline">
          <button className="ghost-button" onClick={duplicateQuiz} disabled={!quiz}><Copy size={16} /> Duplicate quiz</button>
          <button className="danger-soft-button" onClick={deleteQuiz} disabled={!quiz}><Archive size={16} /> Delete quiz</button>
          <button className="primary-button" onClick={addQuiz}><Plus size={16} /> New quiz</button>
        </div>
      </div>
      <section className="builder-grid">
        <Panel title="Quiz library">
          {state.quizzes.filter((item) => !item.archived).length ? (
            <div className="stack-list">
              {state.quizzes.filter((item) => !item.archived).map((item) => (
              <button
                className={item.id === quiz?.id ? "list-row button-row selected" : "list-row button-row"}
                key={item.id}
                onClick={() => selectQuiz(item.id)}
              >
                <div>
                  <strong>{quizDisplayName(item)}</strong>
                  <span>{[item.date, item.time].filter(Boolean).join(" - ") || "No date set"}</span>
                  <small>{item.venue || "No venue set"}</small>
                </div>
                <StatusPill tone={item.status === "Draft" ? "warn" : item.status === "Live" ? "live" : "good"}>
                  {item.status}
                </StatusPill>
              </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={Plus} title="No quizzes yet" detail="Create a quiz to start building." />
          )}
        </Panel>
        <Panel title="Quiz details">
          {quiz ? (
            <div className="form-grid">
              <label>Title<input aria-label="Quiz title" value={quiz.title} onChange={(event) => updateSelectedQuiz("title", event.target.value)} /></label>
              <label>Date<input aria-label="Quiz date" type="date" value={quiz.date} onChange={(event) => updateSelectedQuiz("date", event.target.value)} /></label>
              <label>Time<input aria-label="Quiz time" type="time" value={quiz.time} onChange={(event) => updateSelectedQuiz("time", event.target.value)} /></label>
              <label>Status<select aria-label="Quiz status" value={quiz.status} onChange={(event) => updateSelectedQuiz("status", event.target.value)}>
                {["Draft", "Ready", "Scheduled", "Live", "Completed"].map((status) => <option key={status}>{status}</option>)}
              </select></label>
              <label className="span-2">Venue<input aria-label="Quiz venue" value={quiz.venue} onChange={(event) => updateSelectedQuiz("venue", event.target.value)} /></label>
              <label className="span-2">Notes<textarea aria-label="Quiz notes" value={quiz.notes} onChange={(event) => updateSelectedQuiz("notes", event.target.value)} /></label>
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="No quiz selected" detail="Create a quiz to edit its details." />
          )}
        </Panel>
        <Panel
          title="Rounds"
          action={quiz ? <button className="ghost-button compact" onClick={() => addRound()}><Plus size={15} /> Add round</button> : null}
        >
          <div className="round-tabs">
            {(quiz?.rounds ?? []).map((round, index) => (
              <button
                key={round.id}
                className={round.id === selectedRound?.id ? "active" : ""}
                onClick={() => setSelectedRoundId(round.id)}
              >
                {roundDisplayName(round, index)}
                <small>{round.type}</small>
              </button>
            ))}
            {quiz && !quiz.rounds.length ? <EmptyState icon={ClipboardList} title="No rounds yet" detail="Add a round, choose its type, then add questions." /> : null}
            {!quiz ? <EmptyState icon={ClipboardList} title="Create a quiz first" detail="Rounds belong to a quiz." /> : null}
          </div>
        </Panel>
        <Panel
          title="Round details"
          action={
            selectedRound ? (
              <div className="button-row-inline">
                <button className="ghost-button compact" onClick={duplicateRound}><Copy size={15} /> Duplicate</button>
                <button className="danger-soft-button compact" onClick={deleteRound}><X size={15} /> Delete</button>
              </div>
            ) : null
          }
        >
          {selectedRound ? (
            <div className="form-grid">
              <label>Round title<input aria-label="Round title" value={selectedRound.title} onChange={(event) => updateSelectedRound("title", event.target.value)} /></label>
              <label>Round type<select aria-label="Round type" value={selectedRound.type} onChange={(event) => updateSelectedRound("type", event.target.value)}>
                {ROUND_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select></label>
              <label className="span-2">Instructions<textarea aria-label="Round instructions" value={selectedRound.instructions} onChange={(event) => updateSelectedRound("instructions", event.target.value)} /></label>
              <label className="span-2">Scoring rules<textarea aria-label="Round scoring rules" value={selectedRound.scoringRules} onChange={(event) => updateSelectedRound("scoringRules", event.target.value)} /></label>
            </div>
          ) : (
            <EmptyState icon={ClipboardList} title="No round selected" detail="Add or select a round to edit its details." />
          )}
        </Panel>
        <Panel
          title="Question editor"
          action={
            selectedRound ? (
              <button className="primary-button compact" onClick={addQuestion}>
                <Plus size={15} />
                Add question
              </button>
            ) : null
          }
        >
          {selectedRound ? (
            <QuestionEditor
              round={selectedRound}
              question={currentQuestion}
              questions={selectedRound.questions}
              selectedQuestionId={selectedQuestionId}
              setSelectedQuestionId={setSelectedQuestionId}
              updateState={updateState}
              onAddQuestion={addQuestion}
              onDuplicateQuestion={duplicateQuestion}
              onDeleteQuestion={deleteQuestion}
            />
          ) : (
            <EmptyState icon={Plus} title="Create a round first" detail="Questions belong to rounds." />
          )}
        </Panel>
      </section>
    </main>
  );
}

function QuestionEditor({
  round,
  question,
  questions,
  selectedQuestionId,
  setSelectedQuestionId,
  updateState,
  onAddQuestion,
  onDuplicateQuestion,
  onDeleteQuestion,
}) {
  if (!question) {
    return (
      <div className="question-editor">
        <EmptyState icon={Plus} title="No questions in this round" detail="Add a question to start building this round." />
        <button className="primary-button" onClick={onAddQuestion}>
          <Plus size={16} />
          Add first question
        </button>
      </div>
    );
  }

  function updateQuestion(field, value) {
    updateQuestionPatch({ [field]: value });
  }

  function updateQuestionPatch(patch) {
    updateState((current) =>
      updateQuiz(current, current.selectedQuizId, (quiz) => ({
        ...quiz,
        rounds: quiz.rounds.map((item) =>
          item.id === round.id
            ? {
                ...item,
                questions: item.questions.map((candidate) =>
                  candidate.id === question.id ? { ...candidate, ...patch } : candidate,
                ),
              }
            : item,
        ),
      })),
    );
  }

  function updateQuestionType(type) {
    updateQuestionPatch(normalizeQuestionForType(question, type));
  }

  function updateChoiceOption(index, value) {
    const options = defaultOptions(question.options);
    const previousValue = options[index];
    options[index] = value;
    updateQuestionPatch({
      options,
      answer: question.answer === previousValue ? value : question.answer,
    });
  }

  async function attachMedia(field, file) {
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    const isAudio = field === "audio";
    const nameField = isAudio ? "audioName" : "imageName";
    const mediaItem = {
      id: createId("media"),
      name: file.name,
      type: isAudio ? "Audio" : "Image",
      src,
      quizId: "",
      roundId: round.id,
      questionId: question.id,
      usage: round.title || "Round media",
      status: "Attached",
    };

    updateState((current) => {
      const nextMedia = {
        ...mediaItem,
        quizId: current.selectedQuizId,
      };
      return updateQuiz(
        {
          ...current,
          media: [...current.media, nextMedia],
        },
        current.selectedQuizId,
        (quiz) => ({
          ...quiz,
          rounds: quiz.rounds.map((item) =>
            item.id === round.id
              ? {
                  ...item,
                  questions: item.questions.map((candidate) =>
                    candidate.id === question.id
                      ? { ...candidate, [field]: src, [nameField]: file.name }
                      : candidate,
                  ),
                }
              : item,
          ),
        }),
      );
    });
  }

  const effectiveType = question.type || questionTypeForRound(round.type);
  const choices = defaultOptions(question.options);

  function renderTypeFields() {
    if (effectiveType === "Multiple choice") {
      return (
        <div className="type-fields form-grid">
          {choices.map((option, index) => (
            <label key={index}>
              Option {String.fromCharCode(65 + index)}
              <input aria-label={`Option ${String.fromCharCode(65 + index)}`} value={option} onChange={(event) => updateChoiceOption(index, event.target.value)} />
            </label>
          ))}
          <label className="span-2">
            Correct option
            <select aria-label="Correct option" value={question.answer ?? ""} onChange={(event) => updateQuestion("answer", event.target.value)}>
              <option value="">Select correct option</option>
              {choices.map((option, index) => (
                <option key={index} value={option} disabled={!option.trim()}>
                  {option.trim() || `Option ${String.fromCharCode(65 + index)}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    if (effectiveType === "Picture") {
      const imageLabel = question.imageName || (question.image?.startsWith("data:") ? "Attached image" : question.image);
      return (
        <div className="type-fields form-grid">
          <label className="span-2">
            Picture file
            <input aria-label="Picture file" type="file" accept="image/*" onChange={(event) => attachMedia("image", event.target.files?.[0])} />
          </label>
          <label className="span-2">
            Image URL
            <input aria-label="Image URL" value={question.image?.startsWith("data:") ? "" : question.image ?? ""} onChange={(event) => updateQuestion("image", event.target.value)} />
          </label>
          {question.image ? (
            <div className="attached-media span-2">
              <img src={question.image} alt={imageLabel || "Question image"} />
              <span>{imageLabel}</span>
            </div>
          ) : null}
          <label>Correct answer<input aria-label="Correct answer" value={question.answer} onChange={(event) => updateQuestion("answer", event.target.value)} /></label>
          <label>Accepted alternatives<input aria-label="Accepted alternatives" value={(question.alternatives ?? []).join("; ")} onChange={(event) => updateQuestion("alternatives", event.target.value.split(";").map((item) => item.trim()).filter(Boolean))} /></label>
        </div>
      );
    }

    if (effectiveType === "Music") {
      const audioLabel = question.audioName || (question.audio?.startsWith("data:") ? "Attached audio" : question.audio);
      return (
        <div className="type-fields form-grid">
          <label className="span-2">
            Audio file
            <input aria-label="Audio file" type="file" accept="audio/*" onChange={(event) => attachMedia("audio", event.target.files?.[0])} />
          </label>
          <label className="span-2">
            Audio label
            <input aria-label="Audio label" value={question.audioName ?? ""} onChange={(event) => updateQuestion("audioName", event.target.value)} />
          </label>
          {question.audio ? (
            <div className="attached-media span-2">
              <FileAudio size={22} />
              <span>{audioLabel}</span>
              {question.audio.startsWith("data:") || question.audio.startsWith("http") ? (
                <audio controls src={question.audio} />
              ) : null}
            </div>
          ) : null}
          <label>Correct answer<input aria-label="Correct answer" value={question.answer} onChange={(event) => updateQuestion("answer", event.target.value)} /></label>
          <label>Accepted alternatives<input aria-label="Accepted alternatives" value={(question.alternatives ?? []).join("; ")} onChange={(event) => updateQuestion("alternatives", event.target.value.split(";").map((item) => item.trim()).filter(Boolean))} /></label>
        </div>
      );
    }

    if (effectiveType === "Numerical" || effectiveType === "Nearest wins") {
      return (
        <div className="type-fields form-grid">
          <label>{effectiveType === "Nearest wins" ? "Target number" : "Correct number"}<input aria-label={effectiveType === "Nearest wins" ? "Target number" : "Correct number"} type="number" value={question.answer} onChange={(event) => updateQuestion("answer", event.target.value)} /></label>
          {effectiveType === "Numerical" ? (
            <label>Tolerance<input aria-label="Tolerance" type="number" min="0" step="0.01" value={question.tolerance ?? 0} onChange={(event) => updateQuestion("tolerance", Number(event.target.value))} /></label>
          ) : null}
          <label>Units<input aria-label="Units" value={question.units ?? ""} onChange={(event) => updateQuestion("units", event.target.value)} /></label>
        </div>
      );
    }

    return (
      <div className="type-fields form-grid">
        <label>Correct answer<input aria-label="Correct answer" value={question.answer} onChange={(event) => updateQuestion("answer", event.target.value)} /></label>
        <label className="span-2">Accepted alternatives<input aria-label="Accepted alternatives" value={(question.alternatives ?? []).join("; ")} onChange={(event) => updateQuestion("alternatives", event.target.value.split(";").map((item) => item.trim()).filter(Boolean))} /></label>
      </div>
    );
  }

  return (
    <div className="question-editor">
      <div className="question-editor-toolbar">
        <label>
          Editing
          <select value={selectedQuestionId} onChange={(event) => setSelectedQuestionId(event.target.value)}>
            {questions.map((item) => (
              <option key={item.id} value={item.id}>
                Question {item.number}{item.text ? `: ${item.text}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="button-row-inline">
          <button className="ghost-button compact" onClick={onDuplicateQuestion}>
            <Copy size={15} />
            Duplicate
          </button>
          <button className="danger-soft-button compact" onClick={onDeleteQuestion} disabled={questions.length <= 1}>
            <X size={15} />
            Delete
          </button>
        </div>
      </div>
      <div className="question-type-strip">
        <StatusPill tone={effectiveType === "Music" || effectiveType === "Picture" ? "live" : "neutral"}>{effectiveType}</StatusPill>
        <span>{round.type}</span>
      </div>
      <div className="form-grid">
        <label>Number<input aria-label="Question number" type="number" min="1" value={question.number} onChange={(event) => updateQuestion("number", Number(event.target.value))} /></label>
        <label>Question format<select aria-label="Question format" value={effectiveType} onChange={(event) => updateQuestionType(event.target.value)}>
          {QUESTION_TYPES.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label className="span-2">Question<input aria-label="Question text" value={question.text} onChange={(event) => updateQuestion("text", event.target.value)} /></label>
        <label>Points<input aria-label="Question points" type="number" min="0" step="0.5" value={question.points} onChange={(event) => updateQuestion("points", Number(event.target.value))} /></label>
        <label>Time limit<input aria-label="Question time limit" type="number" min="5" step="5" value={question.timeLimit ?? 60} onChange={(event) => updateQuestion("timeLimit", Number(event.target.value))} /></label>
      </div>
      {renderTypeFields()}
      <div className="form-grid">
        <label>Category<input aria-label="Question category" value={question.category} onChange={(event) => updateQuestion("category", event.target.value)} /></label>
        <label>Difficulty<select aria-label="Question difficulty" value={question.difficulty} onChange={(event) => updateQuestion("difficulty", event.target.value)}>
          {["Easy", "Medium", "Hard"].map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label className="span-2">Quizmaster notes<textarea aria-label="Quizmaster notes" value={question.notes ?? ""} onChange={(event) => updateQuestion("notes", event.target.value)} /></label>
        {effectiveType !== "Nearest wins" ? (
          <label className="checkbox-line span-2">
            <input type="checkbox" checked={question.autoMark} onChange={(event) => updateQuestion("autoMark", event.target.checked)} />
            Automatic marking on
          </label>
        ) : null}
      </div>
    </div>
  );
}

export function MediaLibraryPage({ state, updateState }) {
  const roundFolders = state.quizzes.flatMap((quiz) =>
    (quiz.rounds ?? []).map((round, index) => ({
      id: round.id,
      quizId: quiz.id,
      quizTitle: quizDisplayName(quiz),
      title: roundDisplayName(round, index),
      type: round.type,
      count: state.media.filter((item) => item.roundId === round.id).length,
    })),
  );
  const [selectedFolderId, setSelectedFolderId] = useState(roundFolders[0]?.id ?? "unassigned");
  const selectedFolder = roundFolders.find((folder) => folder.id === selectedFolderId) ?? null;
  const visibleMedia =
    selectedFolderId === "unassigned"
      ? state.media.filter((item) => !item.roundId)
      : state.media.filter((item) => item.roundId === selectedFolderId);

  useEffect(() => {
    if (selectedFolderId === "unassigned" || roundFolders.some((folder) => folder.id === selectedFolderId)) {
      return;
    }
    setSelectedFolderId(roundFolders[0]?.id ?? "unassigned");
  }, [roundFolders, selectedFolderId]);

  async function addFiles(files) {
    const additions = await Promise.all([...files].map(async (file) => ({
      id: createId("media"),
      name: file.name,
      type: file.type.startsWith("audio") ? "Audio" : "Image",
      src: await readFileAsDataUrl(file),
      quizId: selectedFolder?.quizId ?? "",
      roundId: selectedFolder?.id ?? "",
      usage: selectedFolder ? selectedFolder.title : "Unassigned",
      status: "Uploaded",
    })));
    updateState((current) => ({ ...current, media: [...current.media, ...additions] }));
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Media Library</h1>
          <p>Keep images and audio grouped by the round they belong to.</p>
        </div>
        <label className="file-button primary-like">
          <Upload size={16} />
          Upload media
          <input aria-label="Upload media" type="file" multiple accept="image/*,audio/*" onChange={(event) => addFiles(event.target.files ?? [])} />
        </label>
      </div>
      <section className="media-library-layout">
        <Panel title="Round folders">
          <div className="folder-list">
            {roundFolders.map((folder) => (
              <button
                key={folder.id}
                className={folder.id === selectedFolderId ? "folder-row active" : "folder-row"}
                onClick={() => setSelectedFolderId(folder.id)}
              >
                <Folder size={18} />
                <div>
                  <strong>{folder.title}</strong>
                  <span>{folder.quizTitle} - {folder.type}</span>
                </div>
                <b>{folder.count}</b>
              </button>
            ))}
            <button
              className={selectedFolderId === "unassigned" ? "folder-row active" : "folder-row"}
              onClick={() => setSelectedFolderId("unassigned")}
            >
              <Folder size={18} />
              <div>
                <strong>Unassigned</strong>
                <span>Files not linked to a round</span>
              </div>
              <b>{state.media.filter((item) => !item.roundId).length}</b>
            </button>
          </div>
          {!roundFolders.length ? (
            <EmptyState icon={Folder} title="No round folders" detail="Create rounds in a quiz and their media folders will appear here." />
          ) : null}
        </Panel>
        <Panel
          title={selectedFolder ? selectedFolder.title : "Unassigned media"}
          action={
            <label className="file-button compact">
              <Upload size={15} />
              Upload
              <input aria-label="Upload media to folder" type="file" multiple accept="image/*,audio/*" onChange={(event) => addFiles(event.target.files ?? [])} />
            </label>
          }
        >
          {visibleMedia.length ? (
            <div className="media-grid">
              {visibleMedia.map((item) => (
                <div key={item.id} className="media-card">
                  <div className="media-icon">{item.type === "Audio" ? <FileAudio size={28} /> : <FileImage size={28} />}</div>
                  {item.type === "Image" && item.src ? <img src={item.src} alt={item.name} /> : null}
                  {item.type === "Audio" && item.src ? <audio controls src={item.src} /> : null}
                  <strong>{item.name}</strong>
                  <span>{item.usage}</span>
                  <StatusPill tone="good">{item.status}</StatusPill>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Upload} title="No media in this folder" detail="Upload images or audio for the selected round." />
          )}
        </Panel>
      </section>
    </main>
  );
}

export function TeamsPage({ state, updateState }) {
  const [teamName, setTeamName] = useState("");
  const leaderboard = computeLeaderboard(state);

  function addTeam() {
    if (!teamName.trim()) return;
    updateState((current) => ({
      ...current,
      teams: [
        ...current.teams,
        {
          id: createId("team"),
          name: teamName.trim(),
          table: "",
          players: 1,
          registeredAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          approved: true,
          scoreAdjustment: 0,
        },
      ],
    }));
    setTeamName("");
  }

  function adjustScore(teamId, delta) {
    updateState((current) => ({
      ...current,
      teams: current.teams.map((team) =>
        team.id === teamId ? { ...team, scoreAdjustment: Number(team.scoreAdjustment ?? 0) + delta } : team,
      ),
    }));
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Teams</h1>
          <p>Registration, approvals, table numbers, player counts, and manual score overrides.</p>
        </div>
        <button
          className={state.live.registrationOpen ? "danger-soft-button" : "primary-button"}
          onClick={() => updateState((current) => ({ ...current, live: { ...current.live, registrationOpen: !current.live.registrationOpen } }))}
        >
          {state.live.registrationOpen ? <Lock size={16} /> : <Unlock size={16} />}
          {state.live.registrationOpen ? "Close registration" : "Open registration"}
        </button>
      </div>
      <Panel title="Add a team">
        <div className="inline-form">
          <input aria-label="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} />
          <button className="primary-button compact" onClick={addTeam}><Plus size={15} /> Add team</button>
        </div>
      </Panel>
      <Panel>
        {leaderboard.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Rank</th><th>Team</th><th>Table</th><th>Players</th><th>Registered</th><th>Score</th><th>Adjust</th></tr>
              </thead>
              <tbody>
                {leaderboard.map((team, index) => (
                  <tr key={team.id}>
                    <td>{index + 1}</td>
                    <td>{team.name}</td>
                    <td>{team.table || "-"}</td>
                    <td>{team.players}</td>
                    <td>{team.registeredAt}</td>
                    <td><strong>{team.score}</strong></td>
                    <td>
                      <div className="button-row-inline">
                        <button className="score-button text" onClick={() => adjustScore(team.id, -1)}>-1</button>
                        <button className="score-button text" onClick={() => adjustScore(team.id, 1)}>+1</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Users} title="No teams registered" detail="Teams can join from the team link, or you can add them here." />
        )}
      </Panel>
    </main>
  );
}

export function MarkingPage({ state, updateState }) {
  const quiz = getSelectedQuiz(state);
  const questions = flattenQuestions(quiz);
  const [questionId, setQuestionId] = useState(getCurrentQuestion(state)?.id ?? questions[0]?.id);
  const question = questions.find((item) => item.id === questionId) ?? questions[0];
  const answers = getQuestionAnswers(state, question?.id);

  function mark(teamId, score) {
    if (!question) return;
    updateState((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [question.id]: {
          ...getQuestionAnswers(current, question.id),
          [teamId]: {
            ...getQuestionAnswers(current, question.id)[teamId],
            score,
            status: score === question.points ? "correct" : score > 0 ? "half" : "incorrect",
          },
        },
      },
    }));
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Marking</h1>
          <p>Auto suggestions are useful, but the quizmaster has final control.</p>
        </div>
        {questions.length ? (
          <select className="question-select" value={question?.id ?? ""} onChange={(event) => setQuestionId(event.target.value)}>
            {questions.map((item) => <option key={item.id} value={item.id}>{item.roundTitle || "Round"} - Q{item.number}</option>)}
          </select>
        ) : null}
      </div>
      <Panel title={question ? `Question: ${question.text}` : "No question selected"}>
        {question ? (
          <div className="marking-workbench">
            <div className="answer-key">
              <span>Correct answer</span>
              <strong>{question.answer}</strong>
              <small>{question.alternatives?.join(", ") || "No alternatives"}</small>
            </div>
            <div className="marking-table">
              {state.teams.map((team) => {
                const answer = answers[team.id];
                return (
                  <div className="mark-row large" key={team.id}>
                    <div>
                      <strong>{team.name}</strong>
                      <span>{answer?.text ?? "No answer submitted"}</span>
                    </div>
                    <StatusPill tone={scoreClass(answer?.status)}>{answer?.status ?? "missing"}</StatusPill>
                    <div className="mark-actions">
                      <button className="score-button good" onClick={() => mark(team.id, question.points)}>Full</button>
                      <button className="score-button warn" onClick={() => mark(team.id, question.points / 2)}>Half</button>
                      <button className="score-button bad" onClick={() => mark(team.id, 0)}>No</button>
                      <input
                        className="score-input"
                        type="number"
                        min="0"
                        step="0.5"
                        aria-label={`Custom score for ${team.name}`}
                        onBlur={(event) => event.target.value && mark(team.id, Number(event.target.value))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState icon={ClipboardList} title="No questions to mark" detail="Build a quiz and collect answers before marking." />
        )}
      </Panel>
    </main>
  );
}

export function ResultsPage({ state, updateState }) {
  const leaderboard = computeLeaderboard(state);
  const quiz = getSelectedQuiz(state);

  function completeQuiz() {
    if (!quiz) return;
    updateState((current) =>
      updateQuiz(current, current.selectedQuizId, (item) => ({
        ...item,
        status: "Completed",
        finalLeaderboard: leaderboard.map((team) => [team.name, team.score]),
      })),
    );
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Results</h1>
          <p>Reveal scores during the quiz, publish final results, and keep completed quizzes for review.</p>
        </div>
        <button className="primary-button" onClick={completeQuiz} disabled={!quiz}><Save size={16} /> Save completed quiz</button>
      </div>
      <section className="results-grid">
        <Panel title="Final leaderboard">
          {leaderboard.length ? (
            <LeaderboardList leaderboard={leaderboard} />
          ) : (
            <EmptyState icon={BarChart3} title="No leaderboard yet" detail="Teams and marked answers will appear here." />
          )}
        </Panel>
        <Panel title="Completed archive">
          {state.quizzes.some((item) => item.status === "Completed") ? (
            <div className="stack-list">
              {state.quizzes.filter((item) => item.status === "Completed").map((item) => (
                <div className="list-row" key={item.id}>
                  <div>
                    <strong>{quizDisplayName(item)}</strong>
                    <span>{[item.date, item.venue].filter(Boolean).join(" - ") || "No date or venue set"}</span>
                    <small>{item.finalLeaderboard?.[0]?.[0] ? `Winner: ${item.finalLeaderboard[0][0]}` : "No final leaderboard saved"}</small>
                  </div>
                  <StatusPill>Completed</StatusPill>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Archive} title="No completed quizzes" detail="Completed quizzes will be listed here." />
          )}
        </Panel>
        <Panel title="Projection controls">
          <div className="screen-controls">
            {["Welcome", "Team registration", "Break", "Scores", "Final results"].map((screen) => (
              <button
                key={screen}
                className="ghost-button"
                onClick={() => updateState((current) => ({ ...current, live: { ...current.live, screen: screen.toLowerCase() } }))}
              >
                {screen}
              </button>
            ))}
          </div>
          <div className="answer-key">
            <span>Current quiz</span>
            <strong>{quiz ? quizDisplayName(quiz) : "No quiz selected"}</strong>
            <small>{leaderboard.length} teams included</small>
          </div>
        </Panel>
      </section>
    </main>
  );
}

export function SettingsPage({ state, updateState, resetState }) {
  const quiz = getSelectedQuiz(state);

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h1>Settings</h1>
          <p>Workspace and live-room controls for this browser session.</p>
        </div>
      </div>
      <section className="settings-grid">
        <Panel title="Live room">
          <div className="form-grid">
            <label>Join code<input value={state.joinCode} readOnly /></label>
            <label>Status<select value={state.live.status} onChange={(event) => updateState((current) => ({ ...current, live: { ...current.live, status: event.target.value } }))}>
              {["Setup", "Ready", "Live", "Paused", "Completed"].map((status) => <option key={status}>{status}</option>)}
            </select></label>
            <label className="checkbox-line span-2">
              <input
                type="checkbox"
                checked={state.live.registrationOpen}
                onChange={(event) => updateState((current) => ({ ...current, live: { ...current.live, registrationOpen: event.target.checked } }))}
              />
              Team registration open
            </label>
          </div>
        </Panel>
        <Panel title="Selected quiz">
          {quiz ? (
            <div className="form-grid">
              <label>Venue<input value={quiz.venue} onChange={(event) => updateState((current) => updateQuiz(current, current.selectedQuizId, (item) => ({ ...item, venue: event.target.value })))} /></label>
              <label>Time<input type="time" value={quiz.time} onChange={(event) => updateState((current) => updateQuiz(current, current.selectedQuizId, (item) => ({ ...item, time: event.target.value })))} /></label>
            </div>
          ) : (
            <EmptyState icon={Settings} title="No quiz selected" detail="Create a quiz before editing quiz-specific settings." />
          )}
        </Panel>
        <Panel title="Workspace">
          <p className="panel-copy">Clearing the workspace removes quizzes, teams, answers, media, and local team registration from this browser.</p>
          <button className="danger-soft-button" onClick={resetState}><RefreshCcw size={16} /> Clear workspace</button>
        </Panel>
      </section>
    </main>
  );
}
