import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Lock,
  Menu,
  Play,
  RotateCcw,
  TimerReset,
  Trophy,
  Unlock,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

function formatScreen(screen) {
  return String(screen || "lobby")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function useQuizmasterLayoutEditor(rootRef, stage) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const storageKey = `quizmaster-layout-v1:${stage || "preview"}`;
    let editEnabled = false;
    let selectedPath = "";
    let layout = {};
    let dragState = null;

    const overlay = document.createElement("div");
    overlay.className = "quiz-layout-overlay";
    overlay.innerHTML = `
      <div class="quiz-layout-overlay-label"></div>
      <button type="button" class="quiz-layout-handle quiz-layout-handle-x" data-resize="x" aria-label="Resize width"></button>
      <button type="button" class="quiz-layout-handle quiz-layout-handle-y" data-resize="y" aria-label="Resize height"></button>
      <button type="button" class="quiz-layout-handle quiz-layout-handle-both" data-resize="both" aria-label="Resize width and height"></button>
    `;
    document.body.appendChild(overlay);

    try {
      layout = JSON.parse(window.localStorage.getItem(storageKey) || "{}") || {};
    } catch {
      layout = {};
    }

    const saveLayout = () => window.localStorage.setItem(storageKey, JSON.stringify(layout));

    const elementPath = (element) => {
      if (!element || element === root) return ":scope";
      const parts = [];
      let node = element;
      while (node && node !== root) {
        const parent = node.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children).filter((item) => item.tagName === node.tagName);
        const index = siblings.indexOf(node) + 1;
        parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${Math.max(1, index)})`);
        node = parent;
      }
      return parts.join(" > ");
    };

    const findByPath = (path) => {
      if (!path || path === ":scope") return root;
      try {
        return root.querySelector(path);
      } catch {
        return null;
      }
    };

    const describeElement = (element) => {
      const className = String(element?.className?.baseVal ?? element?.className ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join(".");
      const text = String(element?.innerText ?? element?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40);
      const name = element?.tagName?.toLowerCase() || "element";
      return text ? `${name}${className ? `.${className}` : ""} · ${text}` : `${name}${className ? `.${className}` : ""}`;
    };

    const clearSelection = () => {
      root.querySelectorAll(".quiz-layout-selected,.quiz-layout-locked").forEach((element) => {
        element.classList.remove("quiz-layout-selected", "quiz-layout-locked");
      });
    };

    const applyRecord = (element, record = {}) => {
      if (!element) return;
      element.style.setProperty("--layout-editor-x", `${Number(record.x || 0)}px`);
      element.style.setProperty("--layout-editor-y", `${Number(record.y || 0)}px`);
      element.classList.add("quiz-layout-overridden");

      if (Number.isFinite(Number(record.width)) && Number(record.width) > 0) {
        element.style.setProperty("width", `${Number(record.width)}px`, "important");
        element.style.setProperty("min-width", "0", "important");
        element.style.setProperty("max-width", "none", "important");
      }
      if (Number.isFinite(Number(record.height)) && Number(record.height) > 0) {
        element.style.setProperty("height", `${Number(record.height)}px`, "important");
        element.style.setProperty("min-height", "0", "important");
        element.style.setProperty("max-height", "none", "important");
      }
      if (Number.isFinite(Number(record.fontSize)) && Number(record.fontSize) > 0) {
        element.style.setProperty("font-size", `${Number(record.fontSize)}px`, "important");
      }
      if (Number.isFinite(Number(record.zIndex))) {
        if (window.getComputedStyle(element).position === "static") element.classList.add("quiz-layout-layered");
        element.style.zIndex = String(Math.round(Number(record.zIndex)));
      }
    };

    const clearRecordStyles = (element) => {
      if (!element) return;
      element.classList.remove("quiz-layout-overridden", "quiz-layout-selected", "quiz-layout-locked", "quiz-layout-layered");
      [
        "--layout-editor-x", "--layout-editor-y", "width", "height", "min-width", "min-height",
        "max-width", "max-height", "font-size", "z-index",
      ].forEach((property) => element.style.removeProperty(property));
    };

    const readValues = (element, path) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      const record = layout[path] || {};
      return {
        x: Number(record.x || 0),
        y: Number(record.y || 0),
        width: Math.round(Number(record.width || rect.width)),
        height: Math.round(Number(record.height || rect.height)),
        fontSize: Math.round((Number(record.fontSize || parseFloat(styles.fontSize) || 16)) * 10) / 10,
        zIndex: Number.isFinite(Number(record.zIndex))
          ? Math.round(Number(record.zIndex))
          : (styles.zIndex === "auto" ? 0 : Math.round(Number(styles.zIndex) || 0)),
        locked: Boolean(record.locked),
      };
    };

    const updateOverlay = () => {
      if (!editEnabled || !selectedPath) {
        overlay.classList.remove("visible", "locked");
        return;
      }
      const element = findByPath(selectedPath);
      if (!element) {
        overlay.classList.remove("visible", "locked");
        return;
      }
      const rect = element.getBoundingClientRect();
      const locked = Boolean(layout[selectedPath]?.locked);
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${Math.max(1, rect.width)}px`;
      overlay.style.height = `${Math.max(1, rect.height)}px`;
      overlay.classList.add("visible");
      overlay.classList.toggle("locked", locked);
      const label = overlay.querySelector(".quiz-layout-overlay-label");
      if (label) label.textContent = locked ? "LOCKED" : "DRAG TO MOVE";
    };

    const sendSelection = (element, path) => {
      window.parent?.postMessage({
        type: "quiz-layout-selection",
        path,
        label: describeElement(element),
        ...readValues(element, path),
      }, window.location.origin);
    };

    const selectElement = (rawTarget) => {
      let element = rawTarget instanceof Element ? rawTarget : null;
      if (!element || !root.contains(element) || element === root) return;
      if (element.closest("svg")) element = element.closest("svg");
      clearSelection();
      selectedPath = elementPath(element);
      element.classList.add("quiz-layout-selected");
      if (layout[selectedPath]?.locked) element.classList.add("quiz-layout-locked");
      sendSelection(element, selectedPath);
      updateOverlay();
    };

    const applyAll = () => {
      Object.entries(layout).forEach(([path, record]) => {
        const element = findByPath(path);
        if (element) applyRecord(element, record);
      });
      if (selectedPath) {
        const selected = findByPath(selectedPath);
        if (selected) {
          selected.classList.add("quiz-layout-selected");
          if (layout[selectedPath]?.locked) selected.classList.add("quiz-layout-locked");
        }
      }
      updateOverlay();
    };

    const beginDrag = (event, mode, path, element) => {
      const current = layout[path] || {};
      if (current.locked) return;
      const values = readValues(element, path);
      dragState = {
        mode,
        path,
        startX: event.clientX,
        startY: event.clientY,
        x: values.x,
        y: values.y,
        width: values.width,
        height: values.height,
      };
      document.documentElement.classList.add("quiz-layout-dragging");
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerDown = (event) => {
      if (!editEnabled || event.button !== 0) return;
      let element = event.target instanceof Element ? event.target : null;
      if (!element || !root.contains(element) || element === root) return;
      if (element.closest("svg")) element = element.closest("svg");
      selectElement(element);
      if (!selectedPath || layout[selectedPath]?.locked) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      beginDrag(event, "move", selectedPath, element);
    };

    const onPointerMove = (event) => {
      if (!dragState) return;
      const element = findByPath(dragState.path);
      if (!element) return;
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      const current = layout[dragState.path] || {};

      if (dragState.mode === "move") {
        layout[dragState.path] = { ...current, x: Math.round(dragState.x + dx), y: Math.round(dragState.y + dy) };
      } else if (dragState.mode === "x") {
        layout[dragState.path] = { ...current, width: Math.max(18, Math.round(dragState.width + dx)) };
      } else if (dragState.mode === "y") {
        layout[dragState.path] = { ...current, height: Math.max(12, Math.round(dragState.height + dy)) };
      } else {
        layout[dragState.path] = {
          ...current,
          width: Math.max(18, Math.round(dragState.width + dx)),
          height: Math.max(12, Math.round(dragState.height + dy)),
        };
      }
      applyRecord(element, layout[dragState.path]);
      updateOverlay();
      sendSelection(element, dragState.path);
      event.preventDefault();
    };

    const onPointerUp = () => {
      if (!dragState) return;
      saveLayout();
      const element = findByPath(dragState.path);
      if (element) sendSelection(element, dragState.path);
      dragState = null;
      document.documentElement.classList.remove("quiz-layout-dragging");
      updateOverlay();
    };

    const onHandlePointerDown = (event) => {
      if (!editEnabled || !selectedPath || event.button !== 0) return;
      const element = findByPath(selectedPath);
      if (!element || layout[selectedPath]?.locked) return;
      beginDrag(event, event.currentTarget?.dataset?.resize || "both", selectedPath, element);
    };

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data || {};
      if (message.type !== "quiz-layout-editor") return;

      if (message.action === "set-enabled") {
        editEnabled = Boolean(message.enabled);
        document.documentElement.classList.toggle("quiz-layout-editing", editEnabled);
        if (!editEnabled) {
          clearSelection();
          selectedPath = "";
          dragState = null;
          overlay.classList.remove("visible", "locked");
          window.parent?.postMessage({ type: "quiz-layout-selection-cleared" }, window.location.origin);
        } else {
          updateOverlay();
        }
        return;
      }

      if (message.action === "update-selected" && selectedPath) {
        const current = layout[selectedPath] || {};
        if (current.locked) return;
        const values = message.values || {};
        layout[selectedPath] = {
          ...current,
          x: Number.isFinite(Number(values.x)) ? Number(values.x) : Number(current.x || 0),
          y: Number.isFinite(Number(values.y)) ? Number(values.y) : Number(current.y || 0),
          width: Number.isFinite(Number(values.width)) ? Number(values.width) : current.width,
          height: Number.isFinite(Number(values.height)) ? Number(values.height) : current.height,
          fontSize: Number.isFinite(Number(values.fontSize)) ? Number(values.fontSize) : current.fontSize,
          zIndex: Number.isFinite(Number(values.zIndex)) ? Math.round(Number(values.zIndex)) : current.zIndex,
        };
        saveLayout();
        const element = findByPath(selectedPath);
        applyRecord(element, layout[selectedPath]);
        updateOverlay();
        if (element) sendSelection(element, selectedPath);
        return;
      }

      if (message.action === "center-selected" && selectedPath) {
        const current = layout[selectedPath] || {};
        if (current.locked) return;
        const element = findByPath(selectedPath);
        if (!element) return;
        const rootRect = root.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const deltaX = (rootRect.left + rootRect.width / 2) - (elementRect.left + elementRect.width / 2);
        layout[selectedPath] = { ...current, x: Math.round((Number(current.x || 0) + deltaX) * 10) / 10 };
        saveLayout();
        applyRecord(element, layout[selectedPath]);
        updateOverlay();
        sendSelection(element, selectedPath);
        return;
      }

      if ((message.action === "layer-forward" || message.action === "layer-backward") && selectedPath) {
        const current = layout[selectedPath] || {};
        if (current.locked) return;
        const element = findByPath(selectedPath);
        const styles = element ? window.getComputedStyle(element) : null;
        const currentLayer = Number.isFinite(Number(current.zIndex))
          ? Number(current.zIndex)
          : (styles?.zIndex === "auto" ? 0 : Number(styles?.zIndex) || 0);
        layout[selectedPath] = { ...current, zIndex: Math.round(currentLayer + (message.action === "layer-forward" ? 1 : -1)) };
        saveLayout();
        if (element) {
          applyRecord(element, layout[selectedPath]);
          updateOverlay();
          sendSelection(element, selectedPath);
        }
        return;
      }

      if (message.action === "lock-selected" && selectedPath) {
        layout[selectedPath] = { ...(layout[selectedPath] || {}), locked: true };
        saveLayout();
        const element = findByPath(selectedPath);
        element?.classList.add("quiz-layout-locked");
        updateOverlay();
        if (element) sendSelection(element, selectedPath);
        return;
      }

      if (message.action === "unlock-selected" && selectedPath) {
        layout[selectedPath] = { ...(layout[selectedPath] || {}), locked: false };
        saveLayout();
        const element = findByPath(selectedPath);
        element?.classList.remove("quiz-layout-locked");
        updateOverlay();
        if (element) sendSelection(element, selectedPath);
        return;
      }

      if (message.action === "lock-all") {
        Object.keys(layout).forEach((path) => { layout[path] = { ...layout[path], locked: true }; });
        saveLayout();
        applyAll();
        return;
      }

      if (message.action === "unlock-all") {
        Object.keys(layout).forEach((path) => { layout[path] = { ...layout[path], locked: false }; });
        saveLayout();
        applyAll();
        return;
      }

      if (message.action === "reset-selected" && selectedPath) {
        const element = findByPath(selectedPath);
        clearRecordStyles(element);
        delete layout[selectedPath];
        saveLayout();
        if (element) {
          selectElement(element);
        } else {
          selectedPath = "";
          window.parent?.postMessage({ type: "quiz-layout-selection-cleared" }, window.location.origin);
        }
        return;
      }

      if (message.action === "reset-page") {
        Object.keys(layout).forEach((path) => clearRecordStyles(findByPath(path)));
        layout = {};
        selectedPath = "";
        saveLayout();
        clearSelection();
        overlay.classList.remove("visible", "locked");
        window.parent?.postMessage({ type: "quiz-layout-selection-cleared" }, window.location.origin);
        return;
      }

      if (message.action === "export") {
        const rootRect = root.getBoundingClientRect();
        const elements = Array.from(root.querySelectorAll("*"))
          .filter((element) => {
            if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
            if (element instanceof SVGElement && element.tagName.toLowerCase() !== "svg") return false;
            const styles = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 2 && rect.height > 2;
          })
          .map((element) => {
            const path = elementPath(element);
            const rect = element.getBoundingClientRect();
            const styles = window.getComputedStyle(element);
            const record = layout[path] || {};
            return {
              path,
              label: describeElement(element),
              left: Math.round((rect.left - rootRect.left) * 10) / 10,
              top: Math.round((rect.top - rootRect.top) * 10) / 10,
              width: Math.round(rect.width * 10) / 10,
              height: Math.round(rect.height * 10) / 10,
              fontSize: Math.round((parseFloat(styles.fontSize) || 0) * 10) / 10,
              zIndex: Number.isFinite(Number(record.zIndex)) ? Math.round(Number(record.zIndex)) : 0,
              x: Number(record.x || 0),
              y: Number(record.y || 0),
              locked: Boolean(record.locked),
              edited: Boolean(layout[path]),
            };
          });
        window.parent?.postMessage({
          type: "quiz-layout-export",
          version: 1,
          stage: `quizmaster-${stage || "preview"}`,
          viewport: { width: Math.round(rootRect.width), height: Math.round(rootRect.height) },
          modified: layout,
          elements,
        }, window.location.origin);
      }
    };

    document.documentElement.classList.add("quiz-preview-mode");
    root.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("resize", updateOverlay);
    window.addEventListener("scroll", updateOverlay, true);
    overlay.querySelectorAll(".quiz-layout-handle").forEach((handle) => handle.addEventListener("pointerdown", onHandlePointerDown));
    window.addEventListener("message", onMessage);

    const observer = new MutationObserver(() => window.requestAnimationFrame(applyAll));
    observer.observe(root, { childList: true, subtree: true });
    applyAll();

    window.parent?.postMessage({ type: "quiz-preview-ready", target: "quizmaster" }, window.location.origin);

    return () => {
      observer.disconnect();
      root.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("resize", updateOverlay);
      window.removeEventListener("scroll", updateOverlay, true);
      overlay.querySelectorAll(".quiz-layout-handle").forEach((handle) => handle.removeEventListener("pointerdown", onHandlePointerDown));
      window.removeEventListener("message", onMessage);
      overlay.remove();
      document.documentElement.classList.remove("quiz-preview-mode", "quiz-layout-editing", "quiz-layout-dragging");
      clearSelection();
    };
  }, [rootRef, stage]);
}

export default function QuizmasterPreviewView({ stage }) {
  const rootRef = useRef(null);
  const [previewState, setPreviewState] = useState(null);
  const [timerChoice, setTimerChoice] = useState(30);
  const [liveTab, setLiveTab] = useState("questions");
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useQuizmasterLayoutEditor(rootRef, stage);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "quizmaster-preview-state") setPreviewState(event.data.state || null);
    };
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "quizmaster-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const sendAction = (action, values = {}) => {
    window.parent?.postMessage({ type: "quizmaster-preview-action", action, ...values }, window.location.origin);
  };

  const countdown = previewState?.live?.timerActive
    ? Math.max(0, Math.ceil((Number(previewState.live.timerEndsAt || 0) - now) / 1000))
    : 0;

  if (!previewState) {
    return (
      <main className="qm-preview-phone" ref={rootRef}>
        <div className="qm-preview-loading">Loading Quizmaster preview…</div>
      </main>
    );
  }

  const questions = previewState.round?.questions || [];
  const hostQuestionIndex = Math.max(0, Math.min(Math.max(0, questions.length - 1), Number(previewState.hostQuestionIndex ?? 0)));
  const rawLiveQuestionIndex = Number(previewState.live?.questionIndex ?? -1);
  const liveQuestionIndex = rawLiveQuestionIndex >= 0
    ? Math.max(0, Math.min(Math.max(0, questions.length - 1), rawLiveQuestionIndex))
    : -1;
  const currentQuestion = questions[hostQuestionIndex] || questions[0] || null;
  const liveQuestion = liveQuestionIndex >= 0 ? questions[liveQuestionIndex] || null : null;
  const currentScreen = previewState.live?.teamScreen || "lobby";
  const revealed = Boolean(currentQuestion?.revealed);
  const teams = previewState.teams || [];
  const responses = previewState.teamResponses || {};
  const responseHistory = previewState.teamResponseHistory || {};
  const askedQuestionIds = previewState.askedQuestionIds || [];
  const askedQuestions = questions.filter((question) => askedQuestionIds.includes(question.id));
  const receivedCount = liveQuestion
    ? teams.filter((team) => responseHistory[liveQuestion.id]?.[team.id]).length
    : 0;
  const reviewingLiveQuestion = liveQuestionIndex >= 0 && hostQuestionIndex === liveQuestionIndex;
  const selectedQuestionAsked = Boolean(currentQuestion && askedQuestionIds.includes(currentQuestion.id));
  const selectedQuestionRevealed = Boolean(currentQuestion?.revealed);
  const canMoveNext = hostQuestionIndex < questions.length - 1;
  const answerFlowLabel = selectedQuestionRevealed
    ? "Next"
    : selectedQuestionAsked
      ? "Push Answer"
      : "Push Question";

  const runAnswerFlow = () => {
    if (!currentQuestion) return;
    if (selectedQuestionRevealed) {
      if (canMoveNext) sendAction("next-question");
      return;
    }
    if (selectedQuestionAsked) {
      sendAction("reveal-answer");
      return;
    }
    sendAction("send-question");
  };

  const renderTeamResponses = (compact = false) => (
    <section className={`qm-preview-control-card qm-team-response-card ${compact ? "compact" : ""}`}>
      <div className="qm-preview-section-title qm-response-title">
        <span>{liveQuestion ? `Team answers · Q${liveQuestionIndex + 1}` : "Team answers"}</span>
        <strong>{receivedCount}/{teams.length}</strong>
      </div>
      <div className="qm-team-response-list">
        {teams.map((team, index) => {
          const response = liveQuestion ? responseHistory[liveQuestion.id]?.[team.id] : null;
          return (
            <div key={team.id} className={`qm-team-response-row ${response ? "answered" : "pending"}`}>
              <div className="qm-team-response-team">
                <b>{team.name}</b>
                <span>Table {team.table}{index === 0 ? " · TEST PHONE" : ""}</span>
              </div>
              <div className="qm-team-response-answer">
                {response ? <strong>{response.answer || "—"}</strong> : <span>{liveQuestion ? "Waiting…" : "No live question"}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderAnswerGrid = () => (
    <section className="qm-preview-control-card qm-answer-grid-card">
      <div className="qm-preview-section-title qm-response-title">
        <span>Round answer grid</span>
        <strong>{askedQuestions.length} asked</strong>
      </div>
      {askedQuestions.length ? (
        <div className="qm-answer-grid-scroll">
          <div className="qm-answer-grid" style={{ "--qm-question-count": askedQuestions.length }}>
            <div className="qm-grid-corner">TEAM</div>
            {askedQuestions.map((question) => {
              const questionIndex = questions.findIndex((item) => item.id === question.id);
              return <div key={`head-${question.id}`} className={`qm-grid-question ${questionIndex === liveQuestionIndex ? "live" : ""}`}>Q{questionIndex + 1}</div>;
            })}

            <div className="qm-grid-team qm-grid-correct-label">CORRECT</div>
            {askedQuestions.map((question) => (
              <div key={`correct-${question.id}`} className="qm-grid-correct">{question.answer || "Not set"}</div>
            ))}

            {teams.map((team, teamIndex) => (
              <Fragment key={team.id}>
                <div className="qm-grid-team">
                  <strong>{team.name}</strong>
                  <small>{teamIndex === 0 ? "TEST PHONE" : `TABLE ${team.table}`}</small>
                </div>
                {askedQuestions.map((question) => {
                  const response = responseHistory[question.id]?.[team.id];
                  return (
                    <div key={`${team.id}-${question.id}`} className={`qm-grid-answer ${response?.status || "unanswered"}`}>
                      <span>{response?.answer || "Waiting…"}</span>
                      {response ? (
                        <div className="qm-grid-marking">
                          <button type="button" className={response.status === "incorrect" ? "selected" : ""} onClick={() => sendAction("mark-preview-answer", { questionId: question.id, teamId: team.id, status: "incorrect" })}>0</button>
                          <button type="button" className={response.status === "half" ? "selected" : ""} onClick={() => sendAction("mark-preview-answer", { questionId: question.id, teamId: team.id, status: "half" })}>½</button>
                          <button type="button" className={response.status === "correct" ? "selected" : ""} onClick={() => sendAction("mark-preview-answer", { questionId: question.id, teamId: team.id, status: "correct" })}><Check size={11} /></button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      ) : (
        <p className="qm-preview-helper">Send Question 1 to start the answer grid.</p>
      )}
    </section>
  );

  if (stage === "teams") {
    return (
      <main className="qm-preview-phone" ref={rootRef}>
        <header className="qm-preview-header">
          <div>
            <span>QUIZMASTER</span>
            <strong>Teams & Answers</strong>
          </div>
          <b>{teams.length} TEAMS</b>
        </header>

        <section className="qm-preview-round-card qm-live-question-strip">
          <div className="qm-preview-round-top">
            <span>LIVE QUESTION</span>
            <small>{liveQuestion ? `Q${liveQuestionIndex + 1}` : "WAITING"}</small>
          </div>
          <h1>{previewState.round?.title || "General Knowledge"}</h1>
          <p>{liveQuestion?.text || "Waiting for a question to be sent."}</p>
        </section>

        {renderAnswerGrid()}

        <section className="qm-preview-control-card compact">
          <div className="qm-preview-section-title">Testing note</div>
          <p className="qm-preview-helper">
            Four simulated teams answer automatically after a question is sent. The Quiz Taker phone is the fifth team and its real test answer appears here.
          </p>
        </section>

        <footer className="qm-preview-footer">
          <span>{receivedCount} answers received</span>
          <strong>{Math.max(0, teams.length - receivedCount)} waiting</strong>
        </footer>
      </main>
    );
  }

  if (stage === "results") {
    const playingIds = new Set(teams.map((team) => team.id));
    const playingLeaderboard = (previewState.leaderboard || []).filter((team) => playingIds.has(team.id));
    return (
      <main className="qm-preview-phone" ref={rootRef}>
        <header className="qm-preview-header">
          <div>
            <span>QUIZMASTER</span>
            <strong>Results</strong>
          </div>
          <b>{formatScreen(currentScreen)}</b>
        </header>

        <section className="qm-preview-round-card">
          <div className="qm-preview-round-top">
            <span>FIVE TEAM TEST</span>
            <small>ROUND 1</small>
          </div>
          <h1>Leaderboard preview</h1>
          <div className="qm-results-list">
            {playingLeaderboard.map((team, index) => (
              <div key={team.id} className="qm-result-row">
                <span>{index + 1}</span>
                <strong>{team.name}</strong>
                <b>{team.score}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="qm-preview-control-card compact">
          <div className="qm-preview-section-title">Result screens</div>
          <div className="qm-preview-action-grid">
            <button type="button" onClick={() => sendAction("show-leaderboard")}><Trophy size={15} /> Show leaderboard</button>
            <button type="button" onClick={() => sendAction("show-final")}><Trophy size={15} /> Start final reveal</button>
            <button type="button" onClick={() => sendAction("reveal-next-final")}><Eye size={15} /> Reveal next team</button>
            <button type="button" onClick={() => sendAction("show-waiting")}><Unlock size={15} /> Back to waiting</button>
          </div>
        </section>

        <footer className="qm-preview-footer">
          <span>Results controls affect the Quiz Taker display</span>
          <strong>{teams.length} teams</strong>
        </footer>
      </main>
    );
  }

  return (
    <main className="qm-preview-phone" ref={rootRef}>
      <header className="qm-preview-header qm-live-header">
        <button
          type="button"
          className={`qm-header-menu-button ${menuOpen ? "active" : ""}`}
          aria-label="Open screen controls"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu size={19} />
        </button>

        <div className="qm-live-header-title">
          <span>QUIZMASTER</span>
          <strong>Live Quiz</strong>
        </div>

        <button
          type="button"
          className={`qm-header-timer-button ${previewState.live?.timerActive ? "timer-live" : ""}`}
          onClick={() => previewState.live?.timerActive
            ? sendAction("cancel-timer")
            : sendAction("start-timer", { seconds: timerChoice })}
        >
          <TimerReset size={15} />
          {previewState.live?.timerActive ? `${countdown}s · Stop` : "Start Timer"}
        </button>
      </header>

      {menuOpen ? (
        <section className="qm-live-menu-popout">
          <div className="qm-live-menu-title">
            <strong>Screen controls</strong>
            <span>{formatScreen(currentScreen)}</span>
          </div>

          <label className="qm-live-timer-setting">
            <span>Timer length</span>
            <select value={timerChoice} onChange={(event) => setTimerChoice(Number(event.target.value))}>
              <option value={30}>30 seconds</option>
              <option value={45}>45 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={90}>90 seconds</option>
            </select>
          </label>

          <div className="qm-preview-action-grid three qm-live-screen-controls">
            <button type="button" onClick={() => sendAction("show-waiting")}><Unlock size={15} /> Waiting</button>
            <button type="button" onClick={() => sendAction("lock-round")}><Lock size={15} /> Lock round</button>
            <button type="button" onClick={() => sendAction("show-leaderboard")}><Trophy size={15} /> Leaderboard</button>
            <button type="button" onClick={() => sendAction("show-final")}><Trophy size={15} /> Final</button>
            <button type="button" onClick={() => sendAction("reveal-next-final")}><Eye size={15} /> Reveal next</button>
            <button type="button" onClick={() => sendAction("reset-scenario")}><RotateCcw size={15} /> Reset</button>
          </div>
        </section>
      ) : null}

      <nav className="qm-live-tabs" aria-label="Live quiz views">
        <button type="button" className={liveTab === "questions" ? "active" : ""} onClick={() => setLiveTab("questions")}>Questions</button>
        <button type="button" className={liveTab === "answers" ? "active" : ""} onClick={() => setLiveTab("answers")}>Answers</button>
      </nav>

      {liveTab === "questions" ? (
        <>
          <div className="qm-live-top-navigation">
            <button type="button" onClick={() => sendAction("previous-question")} disabled={hostQuestionIndex <= 0}>
              <ArrowLeft size={17} /> Previous
            </button>
            <button type="button" onClick={() => sendAction("next-question")} disabled={!canMoveNext}>
              Next <ArrowRight size={17} />
            </button>
          </div>

          <section className="qm-preview-round-card qm-question-led-card">
            <div className="qm-preview-round-top">
              <span>ROUND 1 · SELECTED Q{hostQuestionIndex + 1}</span>
              <small>{reviewingLiveQuestion ? "LIVE" : liveQuestion ? `LIVE Q${liveQuestionIndex + 1}` : "NOT SENT"}</small>
            </div>
            <h1>{previewState.round?.title || "General Knowledge"}</h1>
            <div className="qm-question-send-row">
              <p>{currentQuestion?.text || "No question currently selected."}</p>
              <button
                type="button"
                className={reviewingLiveQuestion || selectedQuestionAsked ? "question-live" : "primary"}
                disabled={reviewingLiveQuestion || selectedQuestionAsked}
                onClick={() => sendAction("send-question")}
              >
                {reviewingLiveQuestion ? <><Check size={15} /> Question Live</> : selectedQuestionAsked ? <><Check size={15} /> Question Asked</> : <><Play size={15} /> Send Question</>}
              </button>
            </div>
            <div className="qm-preview-answer qm-answer-key-always">CORRECT ANSWER · {currentQuestion?.answer || "Not set"}</div>
          </section>

          {renderAnswerGrid()}
        </>
      ) : (
        <>
          <div className="qm-live-top-navigation">
            <button type="button" onClick={() => sendAction("previous-question")} disabled={hostQuestionIndex <= 0}>
              <ArrowLeft size={17} /> Previous
            </button>
            <button
              type="button"
              className={selectedQuestionRevealed ? "" : "primary"}
              onClick={runAnswerFlow}
              disabled={selectedQuestionRevealed && !canMoveNext}
            >
              {selectedQuestionRevealed ? <>Next <ArrowRight size={17} /></> : selectedQuestionAsked ? <><Eye size={16} /> Push Answer</> : <><Play size={15} /> Push Question</>}
            </button>
          </div>

          <section className="qm-preview-round-card qm-question-led-card qm-answer-review-question">
            <div className="qm-preview-round-top">
              <span>ROUND 1 · Q{hostQuestionIndex + 1}</span>
              <small>{selectedQuestionRevealed ? "ANSWER REVEALED" : reviewingLiveQuestion ? "LIVE" : selectedQuestionAsked ? "ASKED" : "NOT SENT"}</small>
            </div>
            <h1>{previewState.round?.title || "General Knowledge"}</h1>
            <p>{currentQuestion?.text || "No question currently selected."}</p>
            <div className="qm-preview-answer qm-answer-key-always">CORRECT ANSWER · {currentQuestion?.answer || "Not set"}</div>
          </section>

          {renderAnswerGrid()}
        </>
      )}

      <footer className="qm-preview-footer">
        <span>{teams.length} teams connected</span>
        <strong>{liveQuestion ? `${receivedCount}/${teams.length} answered Q${liveQuestionIndex + 1}` : "No question live"}</strong>
      </footer>
    </main>
  );
}
