import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const STOP = new Set("a an the is are was were will would which what who whose whom where when why how do does did in on of for by to from with at as and or it its this that these those name named called known give identify can you me us country city person film movie book song year number many first last originally".split(" "));
const normalize = (value) => String(value ?? "").normalize("NFKD").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const terms = (value) => new Set(normalize(value).split(" ").filter((t) => t && !STOP.has(t)));
const overlap = (a, b) => {
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((x) => b.has(x)).length;
  return common / (a.size + b.size - common);
};
const dice = (a, b) => {
  const grams = (s) => {
    const v = normalize(s).replace(/ /g, "");
    return new Set(Array.from({ length: Math.max(0, v.length - 1) }, (_, i) => v.slice(i, i + 2)));
  };
  const x = grams(a), y = grams(b);
  if (!x.size || !y.size) return 0;
  return (2 * [...x].filter((g) => y.has(g)).length) / (x.size + y.size);
};

/**
 * Conservative candidate finder, NOT a proof that a fact is unused.
 * Exact text matches always block. Rephrased questions receive a review flag.
 * An answer alone is never sufficient evidence of duplication.
 */
export function checkQuestion(candidate, history, { limit = 8 } = {}) {
  const question = String(candidate?.question ?? candidate?.text ?? "").trim();
  const answer = String(candidate?.answer ?? "").trim();
  if (!question) throw new Error("A question is required.");
  const normalizedQuestion = normalize(question);
  const normalizedAnswer = normalize(answer);
  const candidateTerms = terms(question);
  const candidates = [];
  for (const entry of history.questions ?? []) {
    const existingQuestion = String(entry.question ?? "");
    const exact = normalizedQuestion === normalize(existingQuestion);
    const wordScore = overlap(candidateTerms, terms(existingQuestion));
    const phraseScore = dice(question, existingQuestion);
    const sameAnswer = Boolean(normalizedAnswer && normalizedAnswer === normalize(entry.answer));
    const score = Math.max(wordScore, phraseScore * 0.88);
    // The same short answer is common across unrelated facts; use it only
    // to elevate questions already similar in subject matter.
    if (!exact && !(wordScore >= 0.45 || phraseScore >= 0.73 || (sameAnswer && wordScore >= 0.25))) continue;
    candidates.push({
      status: exact ? "duplicate" : "review",
      question: existingQuestion,
      answer: entry.answer ?? "",
      occurrences: entry.occurrences ?? [],
      sameAnswer,
      similarity: Math.round(score * 100) / 100,
    });
  }
  candidates.sort((a, b) =>
    (a.status === "duplicate" ? -1 : 1) - (b.status === "duplicate" ? -1 : 1) ||
    Number(b.sameAnswer) - Number(a.sameAnswer) ||
    b.similarity - a.similarity
  );
  const matches = candidates.slice(0, limit);
  return {
    question,
    answer,
    status: candidates.some((x) => x.status === "duplicate") ? "duplicate" : candidates.length ? "review" : "no-match-found",
    matches,
    totalCandidates: candidates.length,
    warning: "No match found is not proof of a new fact. Review rewordings, synonyms, and alternative answers manually.",
  };
}

export function checkBatch(questions, history) {
  const previous = [];
  return questions.map((q, index) => {
    const result = checkQuestion(q, history);
    const local = checkQuestion(q, { questions: previous });
    previous.push({ question: q.question ?? q.text, answer: q.answer, occurrences: [{ quiz: "[Current draft]", round: "" }] });
    return { index: index + 1, ...result, draftMatches: local.status === "no-match-found" ? [] : local.matches };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const fileAt = args.indexOf("--file");
  const questionAt = args.indexOf("--question");
  const answerAt = args.indexOf("--answer");
  const path = new URL("../data/question-history.json", import.meta.url);
  const history = JSON.parse(await readFile(path, "utf8"));
  let questions;
  if (fileAt !== -1 && args[fileAt + 1]) {
    const source = JSON.parse(await readFile(args[fileAt + 1], "utf8"));
    questions = Array.isArray(source) ? source : source.questions;
  } else if (questionAt !== -1 && args[questionAt + 1]) {
    questions = [{ question: args[questionAt + 1], answer: answerAt !== -1 ? args[answerAt + 1] : "" }];
  } else {
    throw new Error('Usage: node scripts/check-questions.mjs --question "..." --answer "..." OR --file questions.json');
  }
  if (!Array.isArray(questions)) throw new Error("Expected a JSON array of {question, answer} items.");
  const results = checkBatch(questions, history);
  process.stdout.write(JSON.stringify({
    historyCount: history.distinctQuestions,
    sourceUpdatedAt: history.sourceUpdatedAt,
    results,
  }, null, 2) + "\n");
  if (results.some((r) => r.status === "duplicate" || r.draftMatches.some((m) => m.status === "duplicate"))) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
