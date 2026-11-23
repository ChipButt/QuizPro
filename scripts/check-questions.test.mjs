import test from "node:test";
import assert from "node:assert/strict";
import { checkQuestion, checkBatch } from "./check-questions.mjs";

const history = { questions: [
  { question: "What is the capital of Canada?", answer: "Ottawa", occurrences: [{quiz:"Quiz 1",round:"General Knowledge"}] },
  { question: "What year was the first modern Olympic Games held?", answer: "1896", occurrences: [] },
] };

test("exact and punctuation-equivalent questions block", () => {
  assert.equal(checkQuestion({question:"What is the capital of Canada?"}, history).status, "duplicate");
  assert.equal(checkQuestion({question:"What IS the capital of Canada?!"}, history).status, "duplicate");
});
test("different wording about the same fact is raised for review", () => {
  assert.equal(checkQuestion({question:"Which Canadian city is the capital of Canada?", answer:"Ottawa"}, history).status, "review");
});
test("same answer alone does not mark unrelated questions as duplicates", () => {
  assert.equal(checkQuestion({question:"Which river runs through the city of Ottawa?", answer:"Ottawa"}, history).status, "no-match-found");
});
test("duplicate questions within a draft are reported", () => {
  const results = checkBatch([{question:"What is the capital of Australia?",answer:"Canberra"},{question:"What is the capital of Australia?",answer:"Canberra"}], {questions:[]});
  assert.equal(results[1].draftMatches[0].status, "duplicate");
});
