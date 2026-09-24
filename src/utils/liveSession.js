import { autoScoreAnswer, createId } from "./quiz.js";
import { waitingFactsForQuiz } from "../data/waitingFacts.js";

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
    paid: false,
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

function safeQuestion(state, roundId, question, revealedOverride = null) {
  const revealed = typeof revealedOverride === "boolean"
    ? revealedOverride
    : questionIsRevealed(state, roundId, question.id);
  return {
    id: question.id,
    number: question.number,
    text: question.text,
    points: question.points,
    type: question.type,
    options: question.type === "Multiple choice"
      ? (question.options ?? []).map((option) => {
          if (option && typeof option === "object" && !Array.isArray(option)) {
            return {
              text: String(option.text ?? ""),
              image: String(option.image ?? ""),
              imageName: String(option.imageName ?? ""),
            };
          }
          return String(option ?? "");
        })
      : [],
    image: question.image ?? "",
    imageName: question.imageName ?? "",
    audio: question.audio ?? "",
    audioName: question.audioName ?? "",
    units: question.units ?? "",
    hasAnswerImage: Boolean(question.answerImage),
    hasAnswerAudio: Boolean(question.answerAudio),
    hasAnswerText: Boolean(String(question.answer ?? "").trim()),
    revealed,
    answer: revealed ? question.answer : undefined,
    alternatives: revealed ? (question.alternatives ?? []) : undefined,
    answerImage: revealed ? (question.answerImage ?? "") : undefined,
    answerImageName: revealed ? (question.answerImageName ?? "") : undefined,
    answerAudio: revealed ? (question.answerAudio ?? "") : undefined,
    answerAudioName: revealed ? (question.answerAudioName ?? "") : undefined,
  };
}

function roundIsFullyRevealed(state, round) {
  if (!round) return false;
  if (state.live?.revealedRounds?.[round.id]) return true;
  const questions = round.questions ?? [];
  return questions.length > 0 && questions.every((question) => Boolean(state.live?.revealedQuestions?.[question.id]));
}

function publishedLeaderboard(state, quiz) {
  const scores = new Map();
  for (const team of state.teams ?? []) {
    scores.set(team.id, Number(team.scoreAdjustment ?? 0));
  }

  for (const round of quiz?.rounds ?? []) {
    if (!roundIsFullyRevealed(state, round)) continue;
    for (const question of round.questions ?? []) {
      for (const [teamId, answer] of Object.entries(state.answers?.[question.id] ?? {})) {
        if (!scores.has(teamId)) scores.set(teamId, 0);
        scores.set(teamId, scores.get(teamId) + Number(answer.score ?? 0));
      }
    }
  }

  return (state.teams ?? [])
    .map((team) => ({
      ...team,
      score: scores.get(team.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score || String(a.name || "").localeCompare(String(b.name || "")));
}

function roundScoreForTeam(state, round, teamId) {
  let score = 0;
  let max = 0;
  let answered = 0;
  let marked = 0;

  for (const question of round.questions ?? []) {
    const points = Math.max(0, Number(question.points ?? 1) || 0);
    max += points;
    const answer = state.answers?.[question.id]?.[teamId];
    if (!answer) continue;
    answered += 1;
    const numericScore = Number(answer.score);
    if (Number.isFinite(numericScore)) {
      score += numericScore;
      marked += 1;
    }
  }

  return { score, max, answered, marked };
}

function completedRoundScores(state, quiz, team) {
  if (!quiz || !team) return [];

  return (quiz.rounds ?? [])
    .map((round, index) => ({ round, index }))
    .filter(({ round }) => roundIsFullyRevealed(state, round))
    .map(({ round, index }) => ({
      id: round.id,
      number: index + 1,
      title: round.title || `Round ${index + 1}`,
      ...roundScoreForTeam(state, round, team.id),
    }));
}

export function buildTeamSnapshot(state, teamToken) {
  const team = state.teams.find((item) => item.token === teamToken) ?? null;
  const quiz = getLiveQuiz(state);
  const round = getLiveRound(state);
  const numericQuestionIndex = Math.max(-1, Number(state.live?.questionIndex ?? -1));
  const reviewQuestionId = state.live?.teamScreen === "question"
    ? String(state.live?.answerReviewQuestionId ?? "")
    : "";
  const reviewQuestionIndex = reviewQuestionId && round
    ? round.questions.findIndex((question) => question.id === reviewQuestionId)
    : -1;
  const answerReviewActive = reviewQuestionIndex >= 0;
  const answerReviewAnswerVisible = Boolean(state.live?.answerReviewAnswerVisible);
  const maxQuestionIndex = answerReviewActive ? 0 : numericQuestionIndex;
  const allowedQuestions = round
    ? answerReviewActive
      ? [safeQuestion(state, round.id, round.questions[reviewQuestionIndex], answerReviewAnswerVisible)]
      : round.questions.slice(0, numericQuestionIndex + 1).map((question) => safeQuestion(state, round.id, question))
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
    ? publishedLeaderboard(state, quiz).map((item) => ({
        id: item.id,
        name: item.name || "Unnamed team",
        score: item.score,
      }))
    : [];

  const liveAudio = state.live?.audio ?? {};
  const liveRoundIndex = Number(state.live?.roundIndex ?? 0);
  const currentRoundComplete = Boolean(round && roundIsFullyRevealed(state, round));
  const explicitWaitingRoundIndex = Number(state.live?.waitingRoundIndex);
  const hasExplicitWaitingRound = state.live?.teamScreen === "lobby"
    && Number.isInteger(explicitWaitingRoundIndex)
    && explicitWaitingRoundIndex >= 0
    && explicitWaitingRoundIndex < (quiz?.rounds?.length ?? 0);
  const firstIncompleteRoundIndex = (quiz?.rounds ?? []).findIndex(
    (item, index) => index >= liveRoundIndex && !roundIsFullyRevealed(state, item)
  );
  const upcomingRoundIndex = hasExplicitWaitingRound
    ? explicitWaitingRoundIndex
    : firstIncompleteRoundIndex >= 0
      ? firstIncompleteRoundIndex
      : liveRoundIndex + (currentRoundComplete ? 1 : 0);
  const upcomingRound = quiz?.rounds?.[upcomingRoundIndex] ?? null;

  return {
    type: "snapshot",
    sessionCode: state.live?.sessionCode ?? "",
    sessionActive: Boolean(state.live?.sessionActive),
    quiz: quiz ? { id: quiz.id, title: quiz.title, totalRounds: quiz.rounds?.length ?? 0 } : null,
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
      waitingRoundIndex: Number.isInteger(Number(state.live?.waitingRoundIndex)) ? Number(state.live?.waitingRoundIndex) : null,
      questionIndex: maxQuestionIndex,
      answerReviewActive,
      answerReviewQuestionId: answerReviewActive ? reviewQuestionId : "",
      answerReviewAnswerVisible: answerReviewActive ? answerReviewAnswerVisible : false,
      revealMode: state.live?.revealMode ?? "round",
      timerActive: Boolean(state.live?.timerActive),
      timerEndsAt: Number(state.live?.timerEndsAt ?? 0),
      timerDurationSeconds: Number(state.live?.timerDurationSeconds ?? 0),
      timerRoundId: state.live?.timerRoundId ?? "",
      finalRevealCount: Number(state.live?.finalRevealCount ?? 0),
      audio: {
        questionId: liveAudio.questionId ?? "",
        playNonce: Number(liveAudio.playNonce ?? 0),
      },
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
          reviewComplete: roundIsFullyRevealed(state, round),
        }
      : null,
    nextRound: upcomingRound
      ? {
          number: upcomingRoundIndex + 1,
          title: upcomingRound.title || `Round ${upcomingRoundIndex + 1}`,
        }
      : null,
    teamAnswers,
    leaderboard,
    roundScores: completedRoundScores(state, quiz, team),
    waitingFacts: waitingFactsForQuiz(quiz),
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
              registeredAt: item.registeredAt || new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
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
    if (questionIsRevealed(state, round.id, question.id)) return state;

    const text = String(message.text ?? "").trim().slice(0, 500);

    if (!text) {
      const currentQuestionAnswers = { ...(state.answers?.[question.id] ?? {}) };
      delete currentQuestionAnswers[team.id];
      return {
        ...state,
        answers: {
          ...state.answers,
          [question.id]: currentQuestionAnswers,
        },
      };
    }

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
            submittedAt: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            status: suggestion.status,
            score: ["correct", "incorrect"].includes(suggestion.status) ? suggestion.score : null,
            reason: suggestion.reason,
            markSource: question.autoMark ? "auto" : "manual",
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
