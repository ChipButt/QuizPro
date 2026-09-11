import { autoScoreAnswer, computeLeaderboard, createId } from "./quiz.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const WAITING_FACT_POOL = [
  { text: "Octopuses have three hearts.", terms: ["octopus", "octopuses", "three hearts", "3 hearts"] },
  { text: "A group of flamingos is called a flamboyance.", terms: ["flamingo", "flamingos", "flamboyance"] },
  { text: "Wombat droppings are cube-shaped.", terms: ["wombat", "wombats", "cube-shaped", "cube shaped"] },
  { text: "Venus takes longer to rotate once than it takes to orbit the Sun.", terms: ["venus", "rotate once", "orbit the sun"] },
  { text: "Hummingbirds are the only birds that can fly backwards.", terms: ["hummingbird", "hummingbirds", "fly backwards"] },
  { text: "The national animal of Scotland is the unicorn.", terms: ["national animal of scotland", "scotland", "unicorn"] },
  { text: "Butterflies taste with receptors on their feet.", terms: ["butterfly", "butterflies", "taste with", "feet"] },
  { text: "Polar bears have black skin beneath their fur.", terms: ["polar bear", "polar bears", "black skin"] },
  { text: "Penguins have knees; much of their upper leg is hidden inside their bodies.", terms: ["penguin", "penguins", "knees"] },
  { text: "The dot above a lowercase i or j is called a tittle.", terms: ["tittle"] },
  { text: "The Eiffel Tower can grow by around 15 cm in hot weather as its metal expands.", terms: ["eiffel tower", "15 cm", "metal expands"] },
  { text: "Sea otters sometimes hold hands while resting so they do not drift apart.", terms: ["sea otter", "sea otters", "hold hands"] },
  { text: "Crows can recognise individual human faces.", terms: ["crow", "crows", "human faces"] },
  { text: "Ravens can imitate human speech.", terms: ["raven", "ravens", "human speech"] },
  { text: "The Moon experiences moonquakes.", terms: ["moonquake", "moonquakes"] },
  { text: "Some bamboo species can grow more than 90 cm in a single day.", terms: ["bamboo", "90 cm"] },
  { text: "A bolt of lightning can heat the surrounding air to roughly five times the temperature of the Sun's surface.", terms: ["lightning", "five times", "sun's surface", "sun surface"] },
  { text: "An ostrich's eye is larger than its brain.", terms: ["ostrich", "ostrich's eye", "larger than its brain"] },
  { text: "A snail can have thousands of tiny teeth on a ribbon-like structure called a radula.", terms: ["snail", "snails", "radula"] },
  { text: "The smell that often follows rain has a name: petrichor.", terms: ["petrichor"] },
  { text: "A narwhal's tusk is actually a long tooth.", terms: ["narwhal", "narwhals", "tusk", "long tooth"] },
  { text: "Cashews grow attached to the bottom of a fruit called a cashew apple.", terms: ["cashew", "cashews", "cashew apple"] },
  { text: "The tiny pocket on jeans was originally designed to hold a pocket watch.", terms: ["jeans", "pocket watch", "watch pocket"] },
  { text: "There are more possible orders for a shuffled 52-card deck than there are atoms on Earth.", terms: ["52-card", "52 card", "shuffle", "shuffled", "atoms on earth"] },
  { text: "The inventor of the Pringles can had some of his ashes buried in one.", terms: ["pringles", "ashes", "inventor of the pringles can"] },
  { text: "A pineapple is formed from many individual flowers whose fruits fuse together.", terms: ["pineapple", "many individual flowers"] },
  { text: "A group of porcupines is called a prickle.", terms: ["porcupine", "porcupines", "prickle"] },
  { text: "A group of giraffes standing still is sometimes called a tower.", terms: ["giraffe", "giraffes", "tower of giraffes"] },
  { text: "The fingerprints of koalas are remarkably similar to human fingerprints.", terms: ["koala", "koalas", "fingerprints"] },
  { text: "Some turtles can absorb oxygen through specialised tissue near their cloaca while underwater.", terms: ["turtle", "turtles", "cloaca", "absorb oxygen"] },
];

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

function quizSearchText(quiz) {
  if (!quiz) return "";
  const values = [quiz.title];
  for (const round of quiz.rounds ?? []) {
    values.push(round.title);
    for (const question of round.questions ?? []) {
      values.push(
        question.text,
        question.answer,
        ...(question.alternatives ?? []),
        ...(question.options ?? []),
      );
    }
  }
  return values.filter(Boolean).join(" ").toLowerCase();
}

function waitingFactsForQuiz(quiz) {
  const quizText = quizSearchText(quiz);
  const safe = WAITING_FACT_POOL
    .filter((fact) => !fact.terms.some((term) => quizText.includes(String(term).toLowerCase())))
    .map((fact) => fact.text);
  return safe.slice(0, 16);
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
  const liveRoundIndex = Math.max(0, Number(state.live?.roundIndex ?? 0));
  const questionIndex = Number(state.live?.questionIndex ?? -1);
  const teamScreen = state.live?.teamScreen ?? "lobby";

  let completedThrough = liveRoundIndex - 1;
  if (teamScreen === "round_locked") completedThrough = liveRoundIndex;
  if (questionIndex < 0 && liveRoundIndex === 0 && teamScreen === "lobby") completedThrough = -1;

  return (quiz.rounds ?? [])
    .slice(0, Math.max(0, completedThrough + 1))
    .map((round, index) => ({
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
    ? computeLeaderboard(state).map((item) => ({
        id: item.id,
        name: item.name || "Unnamed team",
        score: item.score,
      }))
    : [];

  const liveAudio = state.live?.audio ?? {};

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
      questionIndex: maxQuestionIndex,
      revealMode: state.live?.revealMode ?? "round",
      timerActive: Boolean(state.live?.timerActive),
      timerEndsAt: Number(state.live?.timerEndsAt ?? 0),
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
