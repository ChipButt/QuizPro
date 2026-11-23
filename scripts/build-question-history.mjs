import { readFile, writeFile } from "node:fs/promises";
const source = JSON.parse(await readFile(new URL("../data/quiz-library.json", import.meta.url), "utf8"));
const normalize = (value) => String(value ?? "").normalize("NFKD").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const byQuestion = new Map();
function add(question, quiz, round) {
  const text = String(question?.text ?? "").trim();
  if (!text) return;
  const key = normalize(text);
  if (!key) return;
  const answer = String(question?.answer ?? "").trim();
  const occurrence = { quiz, round };
  if (!byQuestion.has(key)) byQuestion.set(key, { question: text, answer, occurrences: [] });
  const row = byQuestion.get(key);
  if (!row.answer && answer) row.answer = answer;
  if (!row.occurrences.some((x) => x.quiz === quiz && x.round === round)) row.occurrences.push(occurrence);
}
for (const quiz of source.quizzes ?? []) {
  for (const round of quiz.rounds ?? []) {
    for (const question of round.questions ?? []) add(question, quiz.title ?? "", round.title ?? "");
  }
}
for (const round of source.roundLibrary ?? []) {
  for (const question of round.questions ?? []) add(question, "[Saved round]", round.title ?? "");
}
const questions = [...byQuestion.values()].sort((a, b) => normalize(a.question).localeCompare(normalize(b.question)));
const history = {
  schema: 1,
  sourceUpdatedAt: source.updatedAt ?? null,
  distinctQuestions: questions.length,
  note: "Exact and punctuation-normalised question history. A human/semantic check is still required for rewordings that test the same fact.",
  questions
};
const output = new URL("../data/question-history.json", import.meta.url);
await writeFile(output, JSON.stringify(history, null, 2) + "\n");
console.log("Question history:", questions.length, "distinct entries");
