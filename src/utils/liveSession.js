import { autoScoreAnswer, computeLeaderboard, createId } from "./quiz.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createSessionCode(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => CODE_CHARS[value % CODE_CHARS.length]).join("");
}

export function createTeamToken() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "").slice(0, 18);
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function createTeamSlot({ players = 1, table = "", name = "" } = {}) {
  return {
    id: createId("team"),
    token: createTeamToken(),
    name,
    table: String(table ?? ""),
    players: Math.max(1, Number(players) || 1),
    registeredAt: "",
    nameLocked: Boolean(name),
    approved: true,
    scoreAdjustment: 0,
  };
}

export function getLiveQuiz(state) {
  const quizId = state.live?.quizId || state.selectedQuizId;
  return state.quizzes.find((quiz) => quiz.id === quizId) ?? null;
}

export function getLiveRound(state) {
  const quiz = getLiveQuiz(state);
  return quiz?.rounds?.[state.live?.roundIndex ?? 0] ?? null;
}

export function isRoundForceLocked(state, roundId) {
  return Boolean(roundId && state.live?.forceLockedRounds?.[roundId]);
}

export function isTeamRoundLocked(state, roundId, teamId) {
  if (!roundId || !teamId) return false;
  return isRoundForceLocked(state, roundId) || Boolean(state.teamRoundLocks?.[roundId]?.[teamId]);
}

function questionIsRevealed(state, roundId, questionId) {
  return Boolean(
    state.live?.revealedQuestions?.[questionId] ||
    state.live?.revealedRounds?.[roundId],
  );
}

function safeQuestion(state, roundId, question) {
  const revealed = questionIsRevealed(state, roundId, question.id);
  return {
    id: question.id,
    number: question.number,
    text: question.text,
    points: question.points,
    type: question.type,
    options: question.type === "Multiple choice" ? (question.options ?? []) : [],
    image: question.image ?? "",
    imageName: question.imageName ?? "",
    audio: question.audio ?? "",
    audioName: question.audioName ?? "",
    units: question.units ?? "",
    revealed,
    answer: revealed ? question.answer : undefined,
    alternatives: revealed ? (question.alternatives ?? []) : undefined,
  };
}

export function buildTeamSnapshot(state, teamToken) {
  const team = state.teams.find((item) => item.token === teamToken) ?? null;
  const quiz = getLiveQuiz(state);
  const round = getLiveRound(state);
  const maxQuestionIndex = Math.max(-1, Number(state.live?.questionIndex ?? -1));
  const allowedQuestions = round
    ? round.questions.slice(0, maxQuestionIndex + 1).map((question) => safeQuestion(state, round.id, question))
    : [];

  const teamAnswers = {};
  if (team) {
    for (const question of allowedQuestions) {
      const answer = state.answers?.[question.id]?.[team.id];
      if (!answer) continue;
      teamAnswers[question.id] = {
        text: answer.text ?? "",
        submittedAt: answer.submittedAt ?? "",
        status: question.revealed ? answer.status : "saved",
        score: question.revealed ? answer.score : undefined,
      };
    }
  }

  const shouldShowLeaderboard = ["leaderboard", "final"].includes(state.live?.teamScreen);
  const leaderboard = shouldShowLeaderboard
    ? computeLeaderboard(state).map((item) => ({ id: item.id, name: item.name || "Unnamed team", score: item.score }))
    : [];

  return {
    type: "snapshot",
    sessionCode: state.live?.sessionCode ?? "",
    sessionActive: Boolean(state.live?.sessionActive),
    quiz: quiz ? { id: quiz.id, title: quiz.title } : null,
    team: team
      ? {
          id: team.id,
          token: team.token,
          name: team.name,
          table: team.table,
          players: team.players,
          nameLocked: Boolean(team.nameLocked),
        }
      : null,
    live: {
      status: state.live?.status ?? "Setup",
      teamScreen: state.live?.teamScreen ?? "lobby",
      roundIndex: state.live?.roundIndex ?? 0,
      questionIndex: maxQuestionIndex,
      revealMode: state.live?.revealMode ?? "round",
      timerActive: Boolean(state.live?.timerActive),
      timerEndsAt: Number(state.live?.timerEndsAt ?? 0),
      timerRoundId: state.live?.timerRoundId ?? "",
      finalRevealCount: Number(state.live?.finalRevealCount ?? 0),
    },
    round: round
      ? {
          id: round.id,
          title: round.title || `Round ${(state.live?.roundIndex ?? 0) + 1}`,
          type: round.type,
          totalQuestions: round.questions.length,
          questions: allowedQuestions,
          forceLocked: isRoundForceLocked(state, round.id),
          teamLocked: team ? isTeamRoundLocked(state, round.id, team.id) : false,
          revealed: Boolean(state.live?.revealedRounds?.[round.id]),
        }
      : null,
    teamAnswers,
    leaderboard,
  };
}

export function applyTeamMessage(state, teamToken, message) {
  const team = state.teams.find((item) => item.token === teamToken);
  if (!team || !message || typeof message !== "object") return state;

  if (message.type === "set-team-name") {
    const name = String(message.name ?? "").trim().slice(0, 60);
    if (!name) return state;
    return {
      ...state,
      teams: state.teams.map((item) =>
        item.id === team.id
          ? {
              ...item,
              name,
              nameLocked: true,
              registeredAt: item.registeredAt || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }
          : item,
      ),
    };
  }

  if (message.type === "save-answer") {
    const round = getLiveRound(state);
    if (!round || isTeamRoundLocked(state, round.id, team.id)) return state;
    const question = round.questions.find((item) => item.id === message.questionId);
    const maxQuestionIndex = Math.max(-1, Number(state.live?.questionIndex ?? -1));
    const questionIndex = round.questions.findIndex((item) => item.id === message.questionId);
    if (!question || questionIndex < 0 || questionIndex > maxQuestionIndex) return state;

    const text = String(message.text ?? "").trim().slice(0, 500);
    if (!text) return state;
    const suggestion = question.autoMark
      ? autoScoreAnswer(question, text)
      : { score: null, status: "pending", reason: "Manual marking" };

    return {
      ...state,
      answers: {
        ...state.answers,
        [question.id]: {
          ...(state.answers?.[question.id] ?? {}),
          [team.id]: {
            text,
            submittedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: suggestion.status,
            score: suggestion.status === "correct" ? suggestion.score : null,
            reason: suggestion.reason,
          },
        },
      },
    };
  }

  if (message.type === "lock-round") {
    const round = getLiveRound(state);
    if (!round) return state;
    return {
      ...state,
      teamRoundLocks: {
        ...(state.teamRoundLocks ?? {}),
        [round.id]: {
          ...(state.teamRoundLocks?.[round.id] ?? {}),
          [team.id]: true,
        },
      },
    };
  }

  return state;
}
