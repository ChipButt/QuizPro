export function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getSelectedQuiz(state) {
  return state.quizzes.find((quiz) => quiz.id === state.selectedQuizId) ?? state.quizzes[0];
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

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values, rowIndex) => {
    const record = { __row: rowIndex + 2 };
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });
}

export function validateImportRows(rows, existingQuestions, media) {
  const questionNumbers = new Set();
  const existingNumbers = new Set(existingQuestions.map((question) => String(question.number)));
  const mediaNames = new Set(media.map((item) => item.name.toLowerCase()));

  return rows.map((row) => {
    const warnings = [];
    const number = String(row["Question Number"] ?? "").trim();
    const image = String(row["Image Filename"] ?? "").trim();
    const audio = String(row["Audio Filename"] ?? "").trim();

    if (!row.Question) warnings.push("Missing question");
    if (!row.Answer) warnings.push("Missing answer");
    if (!number) warnings.push("Missing question number");
    if (number && (questionNumbers.has(number) || existingNumbers.has(number))) {
      warnings.push("Duplicate question number");
    }
    if (image && !mediaNames.has(image.toLowerCase())) {
      warnings.push("Image file not matched");
    }
    if (audio && !mediaNames.has(audio.toLowerCase())) {
      warnings.push("Audio file not matched");
    }
    questionNumbers.add(number);

    return {
      ...row,
      __warnings: warnings,
      __matchedMedia: [image, audio].filter((name) => name && mediaNames.has(name.toLowerCase())),
    };
  });
}

export function similarQuestionWarnings(questionBank, text) {
  const candidateWords = new Set(normalizeAnswer(text).split(" ").filter((word) => word.length > 3));
  if (candidateWords.size === 0) {
    return [];
  }

  return questionBank
    .map((question) => {
      const words = new Set(normalizeAnswer(question.text).split(" ").filter((word) => word.length > 3));
      const shared = [...candidateWords].filter((word) => words.has(word)).length;
      const ratio = shared / Math.max(candidateWords.size, 1);
      return { question, ratio };
    })
    .filter(({ ratio }) => ratio >= 0.45)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);
}

export function nextQuestionPosition(quiz, live) {
  const currentRound = quiz.rounds[live.roundIndex];
  if (currentRound?.questions?.[live.questionIndex + 1]) {
    return { roundIndex: live.roundIndex, questionIndex: live.questionIndex + 1 };
  }
  if (quiz.rounds[live.roundIndex + 1]?.questions?.length) {
    return { roundIndex: live.roundIndex + 1, questionIndex: 0 };
  }
  return null;
}
