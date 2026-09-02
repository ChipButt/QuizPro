import { Copy, FileAudio, FileImage, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createId, getSelectedQuiz } from "../utils/quiz.js";

const ROUND_CHOICES = [
  { key: "text", label: "Enter the Answer", detail: "Teams type an answer into a text box.", type: "Standard question round" },
  { key: "multiple", label: "Multiple Choice", detail: "Every question has the same number of answer choices.", type: "Multiple choice round" },
  { key: "picture", label: "Picture", detail: "Upload an image for every question.", type: "Picture round" },
  { key: "music", label: "Music", detail: "Upload an audio file for every question.", type: "Music round" },
];

function roundKind(round) {
  const type = String(round?.type || "").toLowerCase();
  if (type.includes("picture")) return "picture";
  if (type.includes("music")) return "music";
  if (type.includes("multiple")) return "multiple";
  return "text";
}

function answerMode(round) {
  if (round?.answerMode === "multiple" || round?.answerMode === "text") return round.answerMode;
  if (roundKind(round) === "multiple") return "multiple";
  if ((round?.questions ?? []).some((question) => question.type === "Multiple choice")) return "multiple";
  return "text";
}

function choiceCount(round) {
  const configured = Number(round?.choiceCount || 0);
  if (configured >= 2) return Math.min(6, configured);
  const existing = Math.max(0, ...(round?.questions ?? []).map((question) => question.options?.length ?? 0));
  return existing >= 2 ? Math.min(6, existing) : 4;
}

function questionTypeForRound(round) {
  const kind = roundKind(round);
  const mode = answerMode(round);
  if (kind === "multiple" || mode === "multiple") return "Multiple choice";
  if (kind === "picture") return "Picture";
  if (kind === "music") return "Music";
  return "Text";
}

function createQuestionForRound(round, number) {
  const type = questionTypeForRound(round);
  return {
    id: createId("question"),
    number,
    text: "",
    answer: "",
    alternatives: [],
    points: 1,
    type,
    options: type === "Multiple choice" ? Array(choiceCount(round)).fill("") : [],
    category: "",
    difficulty: "Medium",
    image: "",
    imageName: "",
    audio: "",
    audioName: "",
    notes: "",
    timeLimit: 60,
    autoMark: true,
  };
}

function createRound(kind, order) {
  const choice = ROUND_CHOICES.find((item) => item.key === kind) ?? ROUND_CHOICES[0];
  const round = {
    id: createId("round"),
    title: `Round ${order}`,
    type: choice.type,
    answerMode: kind === "multiple" ? "multiple" : "text",
    choiceCount: 4,
    instructions: "",
    scoringRules: "",
    order,
    questions: [],
  };
  round.questions = [createQuestionForRound(round, 1)];
  return round;
}

function createQuiz() {
  return {
    id: createId("quiz"),
    title: "Untitled quiz",
    date: "",
    time: "",
    venue: "",
    status: "Draft",
    notes: "",
    archived: false,
    rounds: [],
    finalLeaderboard: [],
  };
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function roundLabel(round) {
  return ROUND_CHOICES.find((item) => item.key === roundKind(round))?.label ?? "Enter the Answer";
}

export default function SimpleQuizBuilder({ state, updateState }) {
  const quiz = getSelectedQuiz(state);
  const [selectedRoundId, setSelectedRoundId] = useState(quiz?.rounds?.[0]?.id || "");
  const [choosingRound, setChoosingRound] = useState(false);

  useEffect(() => {
    if (!quiz) {
      setSelectedRoundId("");
      return;
    }
    if (!quiz.rounds?.some((round) => round.id === selectedRoundId)) {
      setSelectedRoundId(quiz.rounds?.[0]?.id || "");
    }
  }, [quiz, selectedRoundId]);

  const selectedRound = useMemo(
    () => quiz?.rounds?.find((round) => round.id === selectedRoundId) ?? quiz?.rounds?.[0] ?? null,
    [quiz, selectedRoundId],
  );

  function selectQuiz(quizId) {
    const next = state.quizzes.find((item) => item.id === quizId);
    setSelectedRoundId(next?.rounds?.[0]?.id || "");
    setChoosingRound(false);
    updateState((current) => ({ ...current, selectedQuizId: quizId }));
  }

  function addQuiz() {
    const next = createQuiz();
    updateState((current) => ({ ...current, selectedQuizId: next.id, quizzes: [...current.quizzes, next] }));
    setSelectedRoundId("");
    setChoosingRound(false);
  }

  function updateQuizTitle(value) {
    if (!quiz) return;
    updateState((current) => ({
      ...current,
      quizzes: current.quizzes.map((item) => item.id === quiz.id ? { ...item, title: value } : item),
    }));
  }

  function duplicateQuiz() {
    if (!quiz) return;
    const id = createId("quiz");
    const duplicate = {
      ...quiz,
      id,
      title: `${quiz.title || "Untitled quiz"} copy`,
      status: "Draft",
      rounds: (quiz.rounds ?? []).map((round) => ({
        ...round,
        id: createId("round"),
        questions: (round.questions ?? []).map((question) => ({ ...question, id: createId("question") })),
      })),
    };
    updateState((current) => ({ ...current, selectedQuizId: id, quizzes: [...current.quizzes, duplicate] }));
    setSelectedRoundId(duplicate.rounds?.[0]?.id || "");
  }

  function deleteQuiz() {
    if (!quiz) return;
    const okay = window.confirm(`Delete “${quiz.title || "Untitled quiz"}”?`);
    if (!okay) return;
    const remaining = state.quizzes.filter((item) => item.id !== quiz.id);
    updateState((current) => ({ ...current, quizzes: current.quizzes.filter((item) => item.id !== quiz.id), selectedQuizId: remaining[0]?.id || "" }));
    setSelectedRoundId(remaining[0]?.rounds?.[0]?.id || "");
  }

  function addRound(kind) {
    if (!quiz) return;
    const round = createRound(kind, (quiz.rounds?.length ?? 0) + 1);
    updateState((current) => ({
      ...current,
      quizzes: current.quizzes.map((item) => item.id === quiz.id ? { ...item, rounds: [...(item.rounds ?? []), round] } : item),
    }));
    setSelectedRoundId(round.id);
    setChoosingRound(false);
  }

  function updateRound(patch) {
    if (!quiz || !selectedRound) return;
    updateState((current) => ({
      ...current,
      quizzes: current.quizzes.map((item) => item.id === quiz.id ? {
        ...item,
        rounds: item.rounds.map((round) => round.id === selectedRound.id ? { ...round, ...patch } : round),
      } : item),
    }));
  }

  function setRoundAnswerMode(mode) {
    if (!selectedRound) return;
    const kind = roundKind(selectedRound);
    const nextType = kind === "picture" ? (mode === "multiple" ? "Multiple choice" : "Picture") : kind === "music" ? (mode === "multiple" ? "Multiple choice" : "Music") : questionTypeForRound(selectedRound);
    const count = choiceCount(selectedRound);
    updateRound({
      answerMode: mode,
      questions: selectedRound.questions.map((question) => ({
        ...question,
        type: nextType,
        options: mode === "multiple" ? Array.from({ length: count }, (_, index) => question.options?.[index] ?? "") : question.options ?? [],
      })),
    });
  }

  function setRoundChoiceCount(count) {
    const nextCount = Math.max(2, Math.min(6, Number(count) || 4));
    if (!selectedRound) return;
    updateRound({
      choiceCount: nextCount,
      questions: selectedRound.questions.map((question) => {
        const options = Array.from({ length: nextCount }, (_, index) => question.options?.[index] ?? "");
        return { ...question, options, answer: options.includes(question.answer) ? question.answer : "" };
      }),
    });
  }

  function deleteRound() {
    if (!quiz || !selectedRound) return;
    const okay = window.confirm(`Delete ${selectedRound.title || "this round"}?`);
    if (!okay) return;
    const nextRounds = quiz.rounds.filter((round) => round.id !== selectedRound.id);
    updateState((current) => ({
      ...current,
      quizzes: current.quizzes.map((item) => item.id === quiz.id ? { ...item, rounds: item.rounds.filter((round) => round.id !== selectedRound.id) } : item),
    }));
    setSelectedRoundId(nextRounds[0]?.id || "");
  }

  function addQuestion() {
    if (!quiz || !selectedRound) return;
    const number = Math.max(0, ...selectedRound.questions.map((question) => Number(question.number) || 0)) + 1;
    const question = createQuestionForRound(selectedRound, number);
    updateRound({ questions: [...selectedRound.questions, question] });
  }

  function updateQuestion(questionId, patch) {
    if (!selectedRound) return;
    updateRound({ questions: selectedRound.questions.map((question) => question.id === questionId ? { ...question, ...patch } : question) });
  }

  function deleteQuestion(questionId) {
    if (!selectedRound || selectedRound.questions.length <= 1) return;
    updateRound({
      questions: selectedRound.questions
        .filter((question) => question.id !== questionId)
        .map((question, index) => ({ ...question, number: index + 1 })),
    });
  }

  async function attachMedia(questionId, field, file) {
    if (!file) return;
    const src = await readAsDataUrl(file);
    updateQuestion(questionId, field === "image"
      ? { image: src, imageName: file.name }
      : { audio: src, audioName: file.name });
  }

  function updateOption(question, index, value) {
    const count = choiceCount(selectedRound);
    const options = Array.from({ length: count }, (_, itemIndex) => question.options?.[itemIndex] ?? "");
    const old = options[index];
    options[index] = value;
    updateQuestion(question.id, { options, answer: question.answer === old ? value : question.answer });
  }

  const kind = selectedRound ? roundKind(selectedRound) : "text";
  const mode = selectedRound ? answerMode(selectedRound) : "text";
  const choices = selectedRound ? choiceCount(selectedRound) : 4;

  return (
    <main className="simple-page simple-quizzes-page">
      <div className="simple-page-heading">
        <div><h1>Quizzes</h1><p>Build and store quizzes in rounds.</p></div>
        <button className="primary-button" onClick={addQuiz}><Plus size={16} /> New quiz</button>
      </div>

      <div className="simple-quiz-layout">
        <aside className="simple-library-panel">
          <h2>Saved quizzes</h2>
          <div className="simple-quiz-list">
            {state.quizzes.filter((item) => !item.archived).map((item) => (
              <button key={item.id} className={item.id === quiz?.id ? "selected" : ""} onClick={() => selectQuiz(item.id)}>
                <strong>{item.title || "Untitled quiz"}</strong>
                <span>{item.rounds?.length ?? 0} round{(item.rounds?.length ?? 0) === 1 ? "" : "s"}</span>
              </button>
            ))}
            {!state.quizzes.filter((item) => !item.archived).length ? <p className="simple-empty-copy">No quizzes yet.</p> : null}
          </div>
        </aside>

        <section className="simple-builder-panel">
          {!quiz ? (
            <div className="simple-empty-state"><h2>Create your first quiz</h2><p>Start from scratch or upload one of your Word quizzes above.</p><button className="primary-button" onClick={addQuiz}><Plus size={16} /> New quiz</button></div>
          ) : (
            <>
              <div className="simple-quiz-title-row">
                <input className="simple-quiz-title-input" value={quiz.title} onChange={(event) => updateQuizTitle(event.target.value)} aria-label="Quiz title" />
                <button className="ghost-button compact" onClick={duplicateQuiz}><Copy size={14} /> Duplicate</button>
                <button className="danger-soft-button compact" onClick={deleteQuiz}><Trash2 size={14} /> Delete</button>
              </div>

              <div className="simple-round-strip">
                {(quiz.rounds ?? []).map((round, index) => (
                  <button key={round.id} className={round.id === selectedRound?.id ? "selected" : ""} onClick={() => { setSelectedRoundId(round.id); setChoosingRound(false); }}>
                    <span>Round {index + 1}</span><strong>{round.title || `Round ${index + 1}`}</strong><small>{roundLabel(round)}</small>
                  </button>
                ))}
                <button className="add-round-button" onClick={() => setChoosingRound(true)}><Plus size={17} /> Add round</button>
              </div>

              {choosingRound ? (
                <div className="round-type-chooser">
                  <div className="round-type-heading"><div><h2>What type of round?</h2><p>This sets the format for every question in this round.</p></div><button className="ghost-button compact" onClick={() => setChoosingRound(false)}>Cancel</button></div>
                  <div className="round-type-grid">
                    {ROUND_CHOICES.map((choice) => (
                      <button key={choice.key} onClick={() => addRound(choice.key)}>
                        <strong>{choice.label}</strong><span>{choice.detail}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : selectedRound ? (
                <>
                  <div className="simple-round-settings">
                    <label>Round name<input value={selectedRound.title} onChange={(event) => updateRound({ title: event.target.value })} /></label>
                    {(kind === "multiple" || ((kind === "picture" || kind === "music") && mode === "multiple")) ? (
                      <label>Answers per question<select value={choices} onChange={(event) => setRoundChoiceCount(event.target.value)}>{[2,3,4,5,6].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
                    ) : null}
                    {(kind === "picture" || kind === "music") ? (
                      <div className="round-answer-mode"><span>How do teams answer?</span><div><button className={mode === "text" ? "selected" : ""} onClick={() => setRoundAnswerMode("text")}>Enter the answer</button><button className={mode === "multiple" ? "selected" : ""} onClick={() => setRoundAnswerMode("multiple")}>Multiple choice</button></div></div>
                    ) : null}
                    <button className="danger-soft-button compact" onClick={deleteRound}><Trash2 size={14} /> Delete round</button>
                  </div>

                  <div className="simple-question-stack">
                    {selectedRound.questions.map((question, index) => {
                      const multiple = question.type === "Multiple choice" || mode === "multiple" || kind === "multiple";
                      const options = Array.from({ length: choices }, (_, optionIndex) => question.options?.[optionIndex] ?? "");
                      return (
                        <article className="simple-question-card" key={question.id}>
                          <div className="simple-question-card-head"><strong>Question {index + 1}</strong>{selectedRound.questions.length > 1 ? <button className="icon-button" aria-label="Delete question" onClick={() => deleteQuestion(question.id)}><Trash2 size={15} /></button> : null}</div>
                          <label>Question<textarea value={question.text ?? ""} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} placeholder="Type the question…" /></label>

                          {kind === "picture" ? (
                            <div className="simple-media-field"><label className="file-button"><FileImage size={16} /> {question.image ? "Replace image" : "Upload image"}<input type="file" accept="image/*" onChange={(event) => attachMedia(question.id, "image", event.target.files?.[0])} /></label>{question.image ? <img src={question.image} alt={question.imageName || "Question"} /> : null}</div>
                          ) : null}

                          {kind === "music" ? (
                            <div className="simple-media-field"><label className="file-button"><FileAudio size={16} /> {question.audio ? "Replace audio" : "Upload audio"}<input type="file" accept="audio/*" onChange={(event) => attachMedia(question.id, "audio", event.target.files?.[0])} /></label>{question.audio ? <audio controls src={question.audio} /> : null}</div>
                          ) : null}

                          {multiple ? (
                            <div className="simple-choice-editor">
                              <div className="simple-choice-grid">{options.map((option, optionIndex) => <label key={optionIndex}>Option {String.fromCharCode(65 + optionIndex)}<input value={option} onChange={(event) => updateOption(question, optionIndex, event.target.value)} /></label>)}</div>
                              <label>Correct answer<select value={question.answer ?? ""} onChange={(event) => updateQuestion(question.id, { answer: event.target.value })}><option value="">Choose the correct answer</option>{options.map((option, optionIndex) => <option key={optionIndex} value={option} disabled={!option.trim()}>{option || `Option ${String.fromCharCode(65 + optionIndex)}`}</option>)}</select></label>
                            </div>
                          ) : (
                            <label>Correct answer<input value={question.answer ?? ""} onChange={(event) => updateQuestion(question.id, { answer: event.target.value })} placeholder="Correct answer…" /></label>
                          )}
                        </article>
                      );
                    })}
                    <button className="add-question-button" onClick={addQuestion}><Plus size={16} /> Add another question</button>
                  </div>
                </>
              ) : (
                <div className="simple-empty-state"><h2>Add the first round</h2><p>Choose the round format first. The first question will then appear automatically.</p><button className="primary-button" onClick={() => setChoosingRound(true)}><Plus size={16} /> Add round</button></div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
