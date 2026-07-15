export function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getSelectedQuiz(state) {
  return state.quizzes.find((quiz) => quiz.id === state.selectedQuizId) ?? state.quizzes[0] ?? null;
}

export function getCurrentRound(state) {
  const quiz = getSelectedQuiz(state);
  return quiz?.rounds?.[state.live.roundIndex] ?? quiz?.rounds?.[0] ?? null;
}

export function getCurrentQuestion(state) {
  const round = getCurrentRound(state);
  return round?.questions?.[state.live.questionIndex] ?? round?.questions?.[0] ?? null;
}

export function flattenQuestions(quiz) {
  return (quiz?.rounds ?? []).flatMap((round) =>
    (round.questions ?? []).map((question) => ({
      ...question,
      roundId: round.id,
      roundTitle: round.title,
      roundType: round.type,
    })),
  );
}

export function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function pointsLabel(points) {
  return `${points} ${Number(points) === 1 ? "point" : "points"}`;
}

export function normalizeAnswer(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

export function autoScoreAnswer(question, answerText) {
  if (!question || !answerText.trim()) {
    return { score: null, status: "pending", reason: "Missing answer" };
  }

  if (question.type === "Numerical") {
    const numericAnswer = Number(answerText);
    const target = Number(question.answer);
    const tolerance = Number(question.tolerance ?? 0);
    if (Number.isNaN(numericAnswer) || Number.isNaN(target)) {
      return { score: null, status: "pending", reason: "Manual check needed" };
    }
    const correct = Math.abs(numericAnswer - target) <= tolerance;
    return {
      score: correct ? question.points : 0,
      status: correct ? "correct" : "incorrect",
      reason: correct ? "Inside tolerance" : "Outside tolerance",
    };
  }

  const accepted = [question.answer, ...(question.alternatives ?? [])].map(normalizeAnswer);
  const candidate = normalizeAnswer(answerText);
  const correct = accepted.includes(candidate);
  return {
    score: correct ? question.points : null,
    status: correct ? "correct" : "pending",
    reason: correct ? "Matched accepted answer" : "Needs host review",
  };
}

export function getQuestionAnswers(state, questionId) {
  return state.answers?.[questionId] ?? {};
}

export function computeLeaderboard(state) {
  const scores = new Map();
  for (const team of state.teams) {
    scores.set(team.id, Number(team.scoreAdjustment ?? 0));
  }

  for (const questionAnswers of Object.values(state.answers ?? {})) {
    for (const [teamId, answer] of Object.entries(questionAnswers)) {
      if (!scores.has(teamId)) {
        scores.set(teamId, 0);
      }
      scores.set(teamId, scores.get(teamId) + Number(answer.score ?? 0));
    }
  }

  return state.teams
    .map((team) => ({
      ...team,
      score: scores.get(team.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function nextQuestionPosition(quiz, live) {
  if (!quiz?.rounds?.length) {
    return null;
  }
  const currentRound = quiz.rounds[live.roundIndex];
  if (currentRound?.questions?.[live.questionIndex + 1]) {
    return { roundIndex: live.roundIndex, questionIndex: live.questionIndex + 1 };
  }
  if (quiz.rounds[live.roundIndex + 1]?.questions?.length) {
    return { roundIndex: live.roundIndex + 1, questionIndex: 0 };
  }
  return null;
}
