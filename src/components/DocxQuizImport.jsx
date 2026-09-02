import { FileUp, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { createId } from "../utils/quiz.js";
import { importQuizDocx } from "../utils/docxImport.js";

function buildImportedQuiz(parsed) {
  return {
    id: createId("quiz"),
    title: parsed.title,
    date: "",
    time: "",
    venue: "",
    status: "Draft",
    notes: parsed.warnings.length ? `DOCX import notes:\n${parsed.warnings.join("\n")}` : "Imported from DOCX.",
    archived: false,
    finalLeaderboard: [],
    rounds: parsed.rounds.map((round, roundIndex) => ({
      id: createId("round"),
      title: round.title,
      type: round.type,
      answerMode: "text",
      choiceCount: 4,
      instructions: round.instructions || "",
      scoringRules: "",
      order: roundIndex + 1,
      questions: round.questions.map((question, questionIndex) => ({
        id: createId("question"),
        number: question.number || questionIndex + 1,
        text: question.text,
        answer: question.answer,
        alternatives: [],
        points: 1,
        type: round.type === "Picture round" ? "Picture" : round.type === "Music round" ? "Music" : "Text",
        options: [],
        category: "",
        difficulty: "Medium",
        image: "",
        imageName: "",
        audio: "",
        audioName: "",
        notes: "",
        timeLimit: 60,
        autoMark: true,
      })),
    })),
  };
}

export default function DocxQuizImport({ updateState }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    setBusy(true);
    setStatus(`Reading ${file.name}…`);
    try {
      const parsed = await importQuizDocx(file);
      const quiz = buildImportedQuiz(parsed);
      updateState((current) => ({ ...current, selectedQuizId: quiz.id, quizzes: [...current.quizzes, quiz] }));
      const warningText = parsed.warnings.length ? ` ${parsed.warnings.length} item${parsed.warnings.length === 1 ? "" : "s"} need checking.` : "";
      setStatus(`Imported ${parsed.rounds.length} rounds and ${parsed.questionCount} questions.${warningText}`);
    } catch (error) {
      setStatus(error?.message || "The Word document could not be imported.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="simple-import-bar">
      <div><strong>Already have a quiz?</strong><span>Upload a .docx and edit it here instead of retyping it.</span>{status ? <small>{status}</small> : null}</div>
      <input ref={inputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
      <button className="ghost-button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <LoaderCircle size={16} className="spin" /> : <FileUp size={16} />}{busy ? "Importing…" : "Upload .docx"}</button>
    </div>
  );
}
