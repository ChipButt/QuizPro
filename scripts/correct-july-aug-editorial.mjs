#!/usr/bin/env node
// One-time, exact editorial corrections in TPC July/August 2026.
// No other QuizPro questions, rounds, statuses or site content may change.
import {readFileSync,writeFileSync} from "node:fs";

const file="data/quiz-library.json";
const before=readFileSync(file,"utf8");
const original=JSON.parse(before);
const edits=[
  {
    roundId:"round-bws8y3a",
    questionId:"question-nxewikz",
    number:2,
    field:"text",
    old:"After watching streetcar drivers struggle to see through rain and snow, Mary Anderson patented a lever-operated, rubber-bladed device in 190 What was it?",
    next:"After watching streetcar drivers struggle to see through rain and snow, Mary Anderson patented a lever-operated, rubber-bladed device in 1903. What was it?"
  },
  {
    roundId:"round-goimj3i",
    questionId:"question-icor7h0",
    number:3,
    field:"answer",
    old:"Tomato (Botanically a fruit, Banana is actual “fruit”)",
    next:"Tomato"
  }
];

function findQuestion(doc,roundId,questionId,number) {
  const matches=[];
  for(const quiz of doc.quizzes||[])
    for(const round of quiz.rounds||[])
      if(round.id===roundId)
        for(const q of round.questions||[])
          if(q.id===questionId&&q.number===number)matches.push(q);
  for(const round of doc.roundLibrary||[])
    if(round.id===roundId)
      for(const q of round.questions||[])
        if(q.id===questionId&&q.number===number)matches.push(q);
  if(!matches.length)throw new Error("Target question not found: "+roundId+" / "+questionId);
  return matches;
}
const expected=structuredClone(original);
for(const edit of edits) {
  const questions=findQuestion(expected,edit.roundId,edit.questionId,edit.number);
  for(const q of questions) {
    if(q[edit.field]!==edit.old&&q[edit.field]!==edit.next)
      throw new Error("Target content changed unexpectedly: "+edit.questionId);
    q[edit.field]=edit.next;
  }
}
let updated=before,changes=0;
for(const edit of edits){
  const old=JSON.stringify(edit.old),next=JSON.stringify(edit.next);
  const occurrences=updated.split(old).length-1;
  const expectedOccurrences=findQuestion(original,edit.roundId,edit.questionId,edit.number)
    .filter(q=>q[edit.field]===edit.old).length;
  if(occurrences!==expectedOccurrences)
    throw new Error("Unexpected text occurrence count for "+edit.questionId+": found "+
      occurrences+", expected "+expectedOccurrences+"; refusing broad replacement");
  if(occurrences){
    updated=updated.replaceAll(old,next);
    changes+=occurrences;
  }
}
if(JSON.stringify(JSON.parse(updated))!==JSON.stringify(expected))
  throw new Error("Safety check failed: changes outside the two approved fields");
if(changes){
  writeFileSync(file,updated,"utf8");
}
console.log(JSON.stringify({result:changes?"corrected":"already-correct",changedFields:changes,
  preservedScienceAndNature:true,rounds:edits.map(e=>e.roundId)}));
