import { Copy, FileAudio, FileImage, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createId, getSelectedQuiz } from "../utils/quiz.js";
import { prepareQuizImage, readMediaAsDataUrl } from "../utils/media.js";

const ROUND_CHOICES = [
  { key: "text", label: "Enter the Answer", detail: "Teams type an answer into a text box.", type: "Standard question round" },
  { key: "multiple", label: "Multiple Choice", detail: "Every question has the same number of answer choices.", type: "Multiple choice round" },
  { key: "picture", label: "Picture", detail: "Upload an image for every question.", type: "Picture round" },
  { key: "music", label: "Music", detail: "Upload an audio file for every question.", type: "Music round" },
];

const ROUND_CATEGORIES = [
  "General Knowledge",
  "Picture",
  "Music (Text Questions)",
  "Music (Audio Questions)",
  "Film & TV",
  "Sport",
  "History",
  "Geography",
  "Science & Nature",
  "Food & Drink",
  "Arts & Literature",
  "Current Affairs",
  "Other",
];

function suggestedRoundCategory(kind) {
  if (kind === "picture") return "Picture";
  if (kind === "music") return "Music (Audio Questions)";
  return "General Knowledge";
}

function cloneQuestion(question, number) {
  return {
    ...question,
    id: createId("question"),
    number,
    alternatives: [...(question?.alternatives ?? [])],
    options: (question?.options ?? []).map((option) => (
      option && typeof option === "object" && !Array.isArray(option) ? { ...option } : option
    )),
  };
}

function cloneSavedRoundForQuiz(savedRound, order) {
  return {
    ...savedRound,
    id: createId("round"),
    librarySourceId: savedRound.id,
    order,
    questions: (savedRound.questions ?? []).map((question, index) => cloneQuestion(question, index + 1)),
  };
}

function librarySnapshotFromRound(round, libraryId, createdAt = "") {
  const now = new Date().toISOString();
  const {
    id: _roundId,
    order: _order,
    librarySourceId: _librarySourceId,
    savedAt: _savedAt,
    updatedAt: _updatedAt,
    ...content
  } = round;

  return {
    ...content,
    id: libraryId,
    category: String(round.category || suggestedRoundCategory(roundKind(round))).trim() || "General Knowledge",
    createdAt: createdAt || now,
    updatedAt: now,
    questions: (round.questions ?? []).map((question, index) => ({
      ...question,
      number: index + 1,
      alternatives: [...(question?.alternatives ?? [])],
      options: (question?.options ?? []).map((option) => (
        option && typeof option === "object" && !Array.isArray(option) ? { ...option } : option
      )),
    })),
  };
}

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

function optionRecord(option) {
  if (option && typeof option === "object" && !Array.isArray(option)) {
    return {
      text: String(option.text ?? ""),
      image: String(option.image ?? ""),
      imageName: String(option.imageName ?? ""),
    };
  }
  return { text: String(option ?? ""), image: "", imageName: "" };
}

function optionValue(option, index) {
  const record = optionRecord(option);
  const text = record.text.trim();
  if (text) return text;
  return record.image ? `Option ${String.fromCharCode(65 + index)}` : "";
}

function optionHasContent(option) {
  const record = optionRecord(option);
  return Boolean(record.text.trim() || record.image);
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
    options: type === "Multiple choice"
      ? Array.from({ length: choiceCount(round) }, () => ({ text: "", image: "", imageName: "" }))
      : [],
    category: "",
    difficulty: "Medium",
    image: "",
    imageName: "",
    audio: "",
    audioName: "",
    answerImage: "",
    answerImageName: "",
    answerAudio: "",
    answerAudioName: "",
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
    category: suggestedRoundCategory(kind),
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

function roundLabel(round) {
  return ROUND_CHOICES.find((item) => item.key === roundKind(round))?.label ?? "Enter the Answer";
}

export default function SimpleQuizBuilder({ state, updateState }) {
  const quiz = getSelectedQuiz(state);
  const [selectedRoundId, setSelectedRoundId] = useState(quiz?.rounds?.[0]?.id || "");
  const [choosingRound, setChoosingRound] = useState(false);
  const [roundChooserMode, setRoundChooserMode] = useState("new");
  const [roundLibraryFilter, setRoundLibraryFilter] = useState("All");
  const [mediaStatus, setMediaStatus] = useState({});

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
      quizzes: current.quizzes.map((item) => item.id === quiz.id ? {
        ...item,
        rounds: [...(item.rounds ?? []), round].map((itemRound, index) => ({ ...itemRound, order: index + 1 })),
      } : item),
    }));
    setSelectedRoundId(round.id);
    setChoosingRound(false);
  }

  function quizzesUsingSavedRound(libraryRoundId) {
    return (state.quizzes ?? [])
      .filter((item) => (item.rounds ?? []).some((round) => round.librarySourceId === libraryRoundId))
      .map((item) => item.title || "Untitled quiz");
  }

  function addSavedRound(savedRound) {
    if (!quiz || !savedRound) return;
    const round = cloneSavedRoundForQuiz(savedRound, (quiz.rounds?.length ?? 0) + 1);
    updateState((current) => ({
      ...current,
      quizzes: current.quizzes.map((item) => item.id === quiz.id ? {
        ...item,
        rounds: [...(item.rounds ?? []), round].map((itemRound, index) => ({ ...itemRound, order: index + 1 })),
      } : item),
    }));
    setSelectedRoundId(round.id);
    setChoosingRound(false);
  }

  function saveRoundToLibrary() {
    if (!quiz || !selectedRound) return;

    const existingId = selectedRound.librarySourceId;
    const existing = (state.roundLibrary ?? []).find((item) => item.id === existingId);
    const libraryId = existing?.id || createId("saved-round");
    const snapshot = librarySnapshotFromRound(selectedRound, libraryId, existing?.createdAt);

    updateState((current) => ({
      ...current,
      roundLibrary: existing
        ? (current.roundLibrary ?? []).map((item) => item.id === libraryId ? snapshot : item)
        : [...(current.roundLibrary ?? []), snapshot],
      quizzes: current.quizzes.map((item) => item.id === quiz.id ? {
        ...item,
        rounds: (item.rounds ?? []).map((round) => round.id === selectedRound.id ? {
          ...round,
          category: snapshot.category,
          librarySourceId: libraryId,
        } : round),
      } : item),
    }));
  }

  function moveRound(direction) {
    if (!quiz || !selectedRound) return;
    const rounds = [...(quiz.rounds ?? [])];
    const from = rounds.findIndex((round) => round.id === selectedRound.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= rounds.length) return;
    [rounds[from], rounds[to]] = [rounds[to], rounds[from]];
    const reordered = rounds.map((round, index) => ({ ...round, order: index + 1 }));
    updateState((current) => ({
      ...current,
      quizzes: current.quizzes.map((item) => item.id === quiz.id ? { ...item, rounds: reordered } : item),
    }));
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

  function setRoundKind(nextKind) {
    if (!selectedRound) return;
    const choice = ROUND_CHOICES.find((item) => item.key === nextKind) ?? ROUND_CHOICES[0];
    const currentMode = answerMode(selectedRound);
    const nextMode = nextKind === "multiple"
      ? "multiple"
      : nextKind === "text"
        ? "text"
        : currentMode;
    const count = choiceCount(selectedRound);

    updateRound({
      type: choice.type,
      answerMode: nextMode,
      questions: selectedRound.questions.map((question) => {
        const nextQuestionType = nextKind === "multiple" || nextMode === "multiple"
          ? "Multiple choice"
          : nextKind === "picture"
            ? "Picture"
            : nextKind === "music"
              ? "Music"
              : "Text";

        let options = question.options ?? [];
        if (nextQuestionType === "Multiple choice") {
          options = Array.from({ length: count }, (_, index) => optionRecord(options[index]));

          // Preserve an existing correct text answer when converting into
          // multiple choice by placing it in the first available empty option.
          const existingAnswer = String(question.answer ?? "").trim();
          if (existingAnswer && !options.some((option, index) => optionValue(option, index) === existingAnswer)) {
            const emptyIndex = options.findIndex((option) => !optionHasContent(option));
            if (emptyIndex >= 0) options[emptyIndex] = { ...options[emptyIndex], text: question.answer };
          }
        }

        return {
          ...question,
          type: nextQuestionType,
          options,
        };
      }),
    });
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
        options: mode === "multiple"
          ? Array.from({ length: count }, (_, index) => optionRecord(question.options?.[index]))
          : question.options ?? [],
      })),
    });
  }

  function setRoundChoiceCount(count) {
    const nextCount = Math.max(2, Math.min(6, Number(count) || 4));
    if (!selectedRound) return;
    updateRound({
      choiceCount: nextCount,
      questions: selectedRound.questions.map((question) => {
        const options = Array.from({ length: nextCount }, (_, index) => optionRecord(question.options?.[index]));
        const values = options.map((option, index) => optionValue(option, index));
        return { ...question, options, answer: values.includes(question.answer) ? question.answer : "" };
      }),
    });
  }

  function deleteRound() {
    if (!quiz || !selectedRound) return;
    const okay = window.confirm(`Delete ${selectedRound.title || "this round"}?`);
    if (!okay) return;
    const nextRounds = quiz.rounds
      .filter((round) => round.id !== selectedRound.id)
      .map((round, index) => ({ ...round, order: index + 1 }));
    updateState((current) => ({
      ...current,
      quizzes: current.quizzes.map((item) => item.id === quiz.id ? { ...item, rounds: nextRounds } : item),
    }));
    setSelectedRoundId(nextRounds[Math.min(Math.max(0, selectedRound.order - 2), Math.max(0, nextRounds.length - 1))]?.id || nextRounds[0]?.id || "");
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
    const key = `${questionId}:${field}`;
    const isImage = field === "image" || field === "answerImage";
    const nameField = field === "image"
      ? "imageName"
      : field === "audio"
        ? "audioName"
        : field === "answerImage"
          ? "answerImageName"
          : "answerAudioName";
    setMediaStatus((current) => ({ ...current, [key]: { busy: true, error: "" } }));

    try {
      const src = isImage
        ? await prepareQuizImage(file)
        : await readMediaAsDataUrl(file);

      updateQuestion(questionId, { [field]: src, [nameField]: file.name });

      setMediaStatus((current) => ({ ...current, [key]: { busy: false, error: "" } }));
    } catch (error) {
      const mediaType = isImage ? "image" : "audio";
      const message = error?.message || `Quiz In could not load that ${mediaType} file.`;
      setMediaStatus((current) => ({ ...current, [key]: { busy: false, error: message } }));
    }
  }

  function updateOption(question, index, value) {
    const count = choiceCount(selectedRound);
    const options = Array.from({ length: count }, (_, itemIndex) => optionRecord(question.options?.[itemIndex]));
    const oldValue = optionValue(options[index], index);
    options[index] = { ...options[index], text: value };
    const nextValue = optionValue(options[index], index);
    updateQuestion(question.id, {
      options,
      answer: question.answer === oldValue ? nextValue : question.answer,
    });
  }

  async function attachOptionImage(question, index, file) {
    if (!file) return;
    const key = `${question.id}:optionImage:${index}`;
    setMediaStatus((current) => ({ ...current, [key]: { busy: true, error: "" } }));
    try {
      const src = await prepareQuizImage(file);
      const count = choiceCount(selectedRound);
      const options = Array.from({ length: count }, (_, itemIndex) => optionRecord(question.options?.[itemIndex]));
      const oldValue = optionValue(options[index], index);
      options[index] = { ...options[index], image: src, imageName: file.name };
      const nextValue = optionValue(options[index], index);
      updateQuestion(question.id, {
        options,
        answer: question.answer === oldValue ? nextValue : question.answer,
      });
      setMediaStatus((current) => ({ ...current, [key]: { busy: false, error: "" } }));
    } catch (error) {
      setMediaStatus((current) => ({
        ...current,
        [key]: { busy: false, error: error?.message || "Quiz In could not load that option image." },
      }));
    }
  }

  const kind = selectedRound ? roundKind(selectedRound) : "text";
  const mode = selectedRound ? answerMode(selectedRound) : "text";
  const choices = selectedRound ? choiceCount(selectedRound) : 4;
  const savedRounds = Array.isArray(state.roundLibrary) ? state.roundLibrary : [];
  const availableCategories = Array.from(new Set([
    ...ROUND_CATEGORIES,
    ...savedRounds.map((round) => String(round.category || "").trim()).filter(Boolean),
  ]));
  const filteredSavedRounds = savedRounds.filter((round) => (
    roundLibraryFilter === "All" || (round.category || "General Knowledge") === roundLibraryFilter
  ));
  const groupedSavedRounds = filteredSavedRounds.reduce((groups, round) => {
    const category = String(round.category || "General Knowledge").trim() || "General Knowledge";
    if (!groups[category]) groups[category] = [];
    groups[category].push(round);
    return groups;
  }, {});

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
                    <span>Round {index + 1}</span>
                    <strong>{round.title || `Round ${index + 1}`}</strong>
                    <small>{round.category || suggestedRoundCategory(roundKind(round))} · {roundLabel(round)}</small>
                  </button>
                ))}
                <button className="add-round-button" onClick={() => {
                  setChoosingRound(true);
                  setRoundChooserMode(savedRounds.length ? "library" : "new");
                }}><Plus size={17} /> Add round</button>
              </div>

              {choosingRound ? (
                <div className="round-type-chooser round-library-chooser">
                  <div className="round-type-heading">
                    <div><h2>Add a round</h2><p>Create a new round or build this quiz from your saved Round Library.</p></div>
                    <button className="ghost-button compact" onClick={() => setChoosingRound(false)}>Cancel</button>
                  </div>

                  <div className="round-chooser-tabs">
                    <button className={roundChooserMode === "library" ? "selected" : ""} onClick={() => setRoundChooserMode("library")}>
                      Saved Round Library <span>{savedRounds.length}</span>
                    </button>
                    <button className={roundChooserMode === "new" ? "selected" : ""} onClick={() => setRoundChooserMode("new")}>Create new round</button>
                  </div>

                  {roundChooserMode === "library" ? (
                    <div className="round-library-browser">
                      <label className="round-library-filter">Category
                        <select value={roundLibraryFilter} onChange={(event) => setRoundLibraryFilter(event.target.value)}>
                          <option value="All">All categories</option>
                          {availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                      </label>

                      {!savedRounds.length ? (
                        <div className="round-library-empty">
                          <strong>No saved rounds yet.</strong>
                          <span>Open a round in a quiz and use “Save round to library” to make it reusable.</span>
                          <button className="primary-button compact" onClick={() => setRoundChooserMode("new")}>Create a new round</button>
                        </div>
                      ) : !filteredSavedRounds.length ? (
                        <div className="round-library-empty"><strong>No rounds in this category.</strong><span>Choose another category or save a round into this one.</span></div>
                      ) : (
                        Object.entries(groupedSavedRounds).map(([category, rounds]) => (
                          <section className="round-library-category" key={category}>
                            <h3>{category}<span>{rounds.length}</span></h3>
                            <div className="round-library-list">
                              {rounds.map((savedRound) => {
                                const usedBy = quizzesUsingSavedRound(savedRound.id);
                                return (
                                  <article className={`round-library-card ${usedBy.length ? "in-use" : ""}`} key={savedRound.id}>
                                    <div className="round-library-card-copy">
                                      <strong>{savedRound.title || "Untitled round"}</strong>
                                      <span>{(savedRound.questions ?? []).length} question{(savedRound.questions ?? []).length === 1 ? "" : "s"} · {roundLabel(savedRound)}</span>
                                      {usedBy.length ? <b>In use in: {usedBy.join(", ")}</b> : <b className="available">Not currently in a quiz</b>}
                                    </div>
                                    <button className={usedBy.length ? "ghost-button compact" : "primary-button compact"} onClick={() => addSavedRound(savedRound)}>
                                      {usedBy.length ? "Add again anyway" : "Add to quiz"}
                                    </button>
                                  </article>
                                );
                              })}
                            </div>
                          </section>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="round-type-grid">
                      {ROUND_CHOICES.map((choice) => (
                        <button key={choice.key} onClick={() => addRound(choice.key)}>
                          <strong>{choice.label}</strong><span>{choice.detail}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : selectedRound ? (
                <>
                  <div className="simple-round-settings">
                    <label>Round name<input value={selectedRound.title} onChange={(event) => updateRound({ title: event.target.value })} /></label>
                    <label>Category
                      <input
                        list="round-category-options"
                        value={selectedRound.category || suggestedRoundCategory(kind)}
                        onChange={(event) => updateRound({ category: event.target.value })}
                        placeholder="Choose or type a category"
                      />
                      <datalist id="round-category-options">
                        {availableCategories.map((category) => <option key={category} value={category} />)}
                      </datalist>
                    </label>
                    <label>Round type
                      <select value={kind} onChange={(event) => setRoundKind(event.target.value)}>
                        {ROUND_CHOICES.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
                      </select>
                    </label>
                    {(kind === "multiple" || ((kind === "picture" || kind === "music") && mode === "multiple")) ? (
                      <label>Answers per question<select value={choices} onChange={(event) => setRoundChoiceCount(event.target.value)}>{[2,3,4,5,6].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
                    ) : null}
                    {(kind === "picture" || kind === "music") ? (
                      <div className="round-answer-mode"><span>How do teams answer?</span><div><button className={mode === "text" ? "selected" : ""} onClick={() => setRoundAnswerMode("text")}>Enter the answer</button><button className={mode === "multiple" ? "selected" : ""} onClick={() => setRoundAnswerMode("multiple")}>Multiple choice</button></div></div>
                    ) : null}
                    <div className="round-library-actions">
                      <button className="ghost-button compact" disabled={(quiz.rounds ?? []).findIndex((round) => round.id === selectedRound.id) <= 0} onClick={() => moveRound(-1)}>↑ Move earlier</button>
                      <button className="ghost-button compact" disabled={(quiz.rounds ?? []).findIndex((round) => round.id === selectedRound.id) >= (quiz.rounds?.length ?? 0) - 1} onClick={() => moveRound(1)}>↓ Move later</button>
                      <button className="primary-button compact" onClick={saveRoundToLibrary}>
                        {selectedRound.librarySourceId && savedRounds.some((round) => round.id === selectedRound.librarySourceId) ? "Update saved round" : "Save round to library"}
                      </button>
                      <button className="danger-soft-button compact" onClick={deleteRound}><Trash2 size={14} /> Remove from quiz</button>
                    </div>
                  </div>

                  <div className="simple-question-stack">
                    {selectedRound.questions.map((question, index) => {
                      const multiple = question.type === "Multiple choice" || mode === "multiple" || kind === "multiple";
                      const options = Array.from({ length: choices }, (_, optionIndex) => optionRecord(question.options?.[optionIndex]));
                      return (
                        <article className="simple-question-card" key={question.id}>
                          <div className="simple-question-card-head"><strong>Question {index + 1}</strong>{selectedRound.questions.length > 1 ? <button className="icon-button" aria-label="Delete question" onClick={() => deleteQuestion(question.id)}><Trash2 size={15} /></button> : null}</div>
                          {kind !== "picture" && kind !== "music" ? (
                            <label>Question<textarea value={question.text ?? ""} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} placeholder="Type the question…" /></label>
                          ) : null}

                          {kind === "picture" ? (
                            <div className="simple-media-pair">
                              <div className="simple-media-block">
                                <span className="simple-media-label">QUESTION IMAGE <small>PRIMARY</small></span>
                                <div className="simple-media-field">
                                  <label className="file-button"><FileImage size={16} /> {mediaStatus[`${question.id}:image`]?.busy ? "Optimising…" : question.image ? "Replace question image" : "Upload question image"}<input type="file" accept="image/*" disabled={mediaStatus[`${question.id}:image`]?.busy} onChange={(event) => attachMedia(question.id, "image", event.target.files?.[0])} /></label>
                                  {mediaStatus[`${question.id}:image`]?.error ? <span className="media-upload-error">{mediaStatus[`${question.id}:image`].error}</span> : null}
                                  {question.image ? <img src={question.image} alt={question.imageName || "Question"} /> : null}
                                </div>
                              </div>
                              <div className="simple-media-block answer-media-block">
                                <span className="simple-media-label">ANSWER IMAGE <small>PRIMARY</small></span>
                                <div className="simple-media-field">
                                  <label className="file-button"><FileImage size={16} /> {mediaStatus[`${question.id}:answerImage`]?.busy ? "Optimising…" : question.answerImage ? "Replace answer image" : "Upload answer image"}<input type="file" accept="image/*" disabled={mediaStatus[`${question.id}:answerImage`]?.busy} onChange={(event) => attachMedia(question.id, "answerImage", event.target.files?.[0])} /></label>
                                  {mediaStatus[`${question.id}:answerImage`]?.error ? <span className="media-upload-error">{mediaStatus[`${question.id}:answerImage`].error}</span> : null}
                                  {question.answerImage ? <img src={question.answerImage} alt={question.answerImageName || "Answer"} /> : null}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {kind === "picture" ? (
                            <label>Question text <small>OPTIONAL</small><textarea value={question.text ?? ""} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} placeholder="Optional text to accompany the picture…" /></label>
                          ) : null}

                          {kind === "music" ? (
                            <div className="simple-media-pair">
                              <div className="simple-media-block">
                                <span className="simple-media-label">QUESTION AUDIO <small>PRIMARY</small></span>
                                <div className="simple-media-field">
                                  <label className="file-button"><FileAudio size={16} /> {mediaStatus[`${question.id}:audio`]?.busy ? "Loading…" : question.audio ? "Replace question audio" : "Upload question audio"}<input type="file" accept="audio/*" disabled={mediaStatus[`${question.id}:audio`]?.busy} onChange={(event) => attachMedia(question.id, "audio", event.target.files?.[0])} /></label>
                                  {mediaStatus[`${question.id}:audio`]?.error ? <span className="media-upload-error">{mediaStatus[`${question.id}:audio`].error}</span> : null}
                                  {question.audio ? <audio controls src={question.audio} /> : null}
                                </div>
                              </div>
                              <div className="simple-media-block answer-media-block">
                                <span className="simple-media-label">ANSWER AUDIO <small>PRIMARY</small></span>
                                <div className="simple-media-field">
                                  <label className="file-button"><FileAudio size={16} /> {mediaStatus[`${question.id}:answerAudio`]?.busy ? "Loading…" : question.answerAudio ? "Replace answer audio" : "Upload answer audio"}<input type="file" accept="audio/*" disabled={mediaStatus[`${question.id}:answerAudio`]?.busy} onChange={(event) => attachMedia(question.id, "answerAudio", event.target.files?.[0])} /></label>
                                  {mediaStatus[`${question.id}:answerAudio`]?.error ? <span className="media-upload-error">{mediaStatus[`${question.id}:answerAudio`].error}</span> : null}
                                  {question.answerAudio ? <audio controls src={question.answerAudio} /> : null}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {kind === "music" ? (
                            <label>Question text <small>OPTIONAL</small><textarea value={question.text ?? ""} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} placeholder="Optional text to accompany the audio…" /></label>
                          ) : null}

                          {multiple ? (
                            <div className="simple-choice-editor">
                              <div className="simple-choice-grid">
                                {options.map((option, optionIndex) => {
                                  const letter = String.fromCharCode(65 + optionIndex);
                                  const key = `${question.id}:optionImage:${optionIndex}`;
                                  return (
                                    <div className="simple-choice-option-editor" key={optionIndex}>
                                      <label>Option {letter} text <small>OPTIONAL</small><input value={option.text} onChange={(event) => updateOption(question, optionIndex, event.target.value)} placeholder={option.image ? "Optional caption…" : "Type option text…"} /></label>
                                      <label className="file-button simple-option-image-button">
                                        <FileImage size={15} />
                                        {mediaStatus[key]?.busy ? "Optimising…" : option.image ? "Replace option image" : "Add option image"}
                                        <input type="file" accept="image/*" disabled={mediaStatus[key]?.busy} onChange={(event) => attachOptionImage(question, optionIndex, event.target.files?.[0])} />
                                      </label>
                                      {mediaStatus[key]?.error ? <span className="media-upload-error">{mediaStatus[key].error}</span> : null}
                                      {option.image ? <img className="simple-choice-option-image" src={option.image} alt={option.imageName || `Option ${letter}`} /> : null}
                                    </div>
                                  );
                                })}
                              </div>
                              <label>Correct answer
                                <select value={question.answer ?? ""} onChange={(event) => updateQuestion(question.id, { answer: event.target.value })}>
                                  <option value="">Choose the correct answer</option>
                                  {options.map((option, optionIndex) => {
                                    const value = optionValue(option, optionIndex);
                                    return <option key={optionIndex} value={value} disabled={!optionHasContent(option)}>{option.text.trim() || (option.image ? `Option ${String.fromCharCode(65 + optionIndex)} · image` : `Option ${String.fromCharCode(65 + optionIndex)}`)}</option>;
                                  })}
                                </select>
                              </label>
                            </div>
                          ) : (
                            <label>{kind === "picture" || kind === "music" ? "Text answer (optional)" : "Correct answer"}<input value={question.answer ?? ""} onChange={(event) => updateQuestion(question.id, { answer: event.target.value })} placeholder={kind === "picture" || kind === "music" ? "Optional text answer…" : "Correct answer…"} /></label>
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
