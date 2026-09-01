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
    notes: parsed.warnings.length
      ? `DOCX import notes:\n${parsed.warnings.join("\n")}`
      : "Imported from DOCX.",
    archived: false,
    finalLeaderboard: [],
    rounds: parsed.rounds.map((round, roundIndex) => ({
      id: createId("round"),
      title: round.title,
      type: round.type,
      instructions: "",
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
        category: "",
        difficulty: "Medium",
        image: "",
        audio: "",
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
    setStatus(`Reading ${file.name}...`);

    try {
      const parsed = await importQuizDocx(file);
      const quiz = buildImportedQuiz(parsed);

      updateState((current) => ({
        ...current,
        selectedQuizId: quiz.id,
        quizzes: [...current.quizzes, quiz],
      }));

      const warningText = parsed.warnings.length
        ? ` ${parsed.warnings.length} item${parsed.warnings.length === 1 ? "" : "s"} need checking; they are listed in the quiz Notes field.`
        : "";
      setStatus(`Imported ${parsed.rounds.length} rounds and ${parsed.questionCount} questions.${warningText}`);
    } catch (error) {
      setStatus(error?.message || "The Word document could not be imported.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      style={{
        margin: "24px 28px 0",
        padding: "14px 16px",
        border: "1px solid var(--border, #d9dee8)",
        borderRadius: 14,
        background: "var(--panel, #fff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 240, flex: "1 1 420px" }}>
        <strong style={{ display: "block", marginBottom: 4 }}>Import an existing Word quiz</strong>
        <span style={{ opacity: 0.72, fontSize: 14 }}>
          Upload a .docx containing Round headings, questions and labelled answers. It will create an editable draft quiz automatically.
        </span>
        {status ? (
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{status}</div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <button className="primary-button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <LoaderCircle size={16} className="spin" /> : <FileUp size={16} />}
        {busy ? "Importing..." : "Upload .docx"}
      </button>
    </div>
  );
}
