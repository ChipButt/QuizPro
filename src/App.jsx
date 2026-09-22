import { useEffect, useRef, useState } from "react";
import HostShell from "./components/HostShell.jsx";
import TeamView from "./components/TeamView.jsx";
import { useGitHubQuizLibrary } from "./hooks/useGitHubQuizLibrary.js";
import { useQuizState } from "./hooks/useQuizState.js";

const PREVIEW_STAGES = [
  ["team-name", "Team name"],
  ["waiting", "Pre-quiz waiting"],
  ["question", "Text question"],
  ["multiple-choice", "Multiple choice"],
  ["timer", "Timer running"],
  ["answer-reveal", "Answer reveal"],
  ["locked", "Round locked"],
  ["between-rounds", "Between rounds"],
  ["leaderboard", "Leaderboard"],
  ["final", "Final results"],
];

function getRoute() {
  const hash = window.location.hash || "#/host";
  if (hash.startsWith("#/preview/")) {
    return { kind: "preview", stage: decodeURIComponent(hash.split("/")[2] || "team-name") };
  }
  if (hash === "#/preview" || hash === "#/preview/") return { kind: "preview", stage: "team-name" };
  if (hash.startsWith("#/join/")) {
    const parts = hash.replace(/^#\//, "").split("/");
    return {
      kind: "join",
      sessionCode: decodeURIComponent(parts[1] ?? "").trim().toUpperCase(),
      teamToken: decodeURIComponent(parts[2] ?? "").trim(),
    };
  }
  if (hash === "#/join" || hash === "#/join/") {
    return { kind: "join", sessionCode: "", teamToken: "" };
  }
  return { kind: "host" };
}

function HostApp() {
  const { state, updateState, resetState, storageError } = useQuizState();
  const sharedLibrary = useGitHubQuizLibrary(state, updateState);
  return <HostShell state={state} updateState={updateState} resetState={resetState} sharedLibrary={sharedLibrary} storageError={storageError} />;
}

function TeamPreview({ stage }) {
  const PHONE_WIDTH = 390;
  const PHONE_HEIGHT = 844;
  const FRAME_BORDER = 8;
  const FRAME_WIDTH = PHONE_WIDTH + FRAME_BORDER * 2;
  const FRAME_HEIGHT = PHONE_HEIGHT + FRAME_BORDER * 2;
  const iframeRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [bulbSize, setBulbSize] = useState(360);
  const [factBoxWidth, setFactBoxWidth] = useState(158);
  const [factBoxX, setFactBoxX] = useState(50);
  const [factBoxY, setFactBoxY] = useState(39);
  const [editorEnabled, setEditorEnabled] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [layoutExport, setLayoutExport] = useState("");

  const sendPreviewStyle = () => {
    iframeRef.current?.contentWindow?.postMessage({
      type: "quiz-preview-style",
      bulbSize,
      factBoxWidth,
      factBoxX,
      factBoxY,
    }, window.location.origin);
  };

  const sendEditor = (action, values = {}) => {
    iframeRef.current?.contentWindow?.postMessage({
      type: "quiz-layout-editor",
      action,
      ...values,
    }, window.location.origin);
  };

  const updateSelectedField = (field, rawValue) => {
    if (!selectedElement || selectedElement.locked) return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    const next = { ...selectedElement, [field]: value };
    setSelectedElement(next);
    sendEditor("update-selected", { values: { [field]: value } });
  };

  useEffect(() => {
    const updateScale = () => {
      const sidebarWidth = window.innerWidth >= 760 ? 220 : 0;
      const horizontalChrome = window.innerWidth >= 760 ? 28 + 56 : 28;
      const verticalChrome = window.innerWidth >= 760 ? 56 : 160;
      const availableWidth = Math.max(260, window.innerWidth - sidebarWidth - horizontalChrome);
      const availableHeight = Math.max(420, window.innerHeight - verticalChrome);
      setPreviewScale(Math.min(1, availableWidth / FRAME_WIDTH, availableHeight / FRAME_HEIGHT));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [FRAME_HEIGHT, FRAME_WIDTH]);

  useEffect(() => {
    sendPreviewStyle();
  }, [bulbSize, factBoxWidth, factBoxX, factBoxY, stage]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data || {};

      if (message.type === "quiz-layout-selection") {
        setSelectedElement({
          path: message.path,
          label: message.label,
          x: Number(message.x || 0),
          y: Number(message.y || 0),
          width: Number(message.width || 0),
          height: Number(message.height || 0),
          fontSize: Number(message.fontSize || 16),
          locked: Boolean(message.locked),
        });
        return;
      }

      if (message.type === "quiz-layout-selection-cleared") {
        setSelectedElement(null);
        return;
      }

      if (message.type === "quiz-layout-export") {
        setLayoutExport(JSON.stringify({
          version: message.version || 2,
          stage: message.stage,
          viewport: message.viewport,
          modified: message.modified || {},
          elements: message.elements || [],
        }, null, 2));
        return;
      }

      if (message.type === "quiz-preview-ready") {
        sendPreviewStyle();
        sendEditor("set-enabled", { enabled: editorEnabled });
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editorEnabled, bulbSize, factBoxWidth, factBoxX, factBoxY, stage]);

  useEffect(() => {
    setSelectedElement(null);
    setLayoutExport("");
  }, [stage]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#111827",
      display: "grid",
      gridTemplateColumns: window.innerWidth >= 760 ? "220px minmax(0, 1fr)" : "1fr",
      gap: 28,
      alignItems: "start",
      justifyContent: "center",
      padding: "28px",
      boxSizing: "border-box",
      overflow: "auto"
    }}>
      <aside style={{
        position: window.innerWidth >= 760 ? "sticky" : "static",
        top: 28,
        width: window.innerWidth >= 760 ? 220 : "100%",
        padding: 14,
        borderRadius: 14,
        background: "#0b1220",
        boxShadow: "0 8px 30px rgba(0,0,0,.35)",
        boxSizing: "border-box"
      }}>
        <div style={{ color: "#fff", font: "700 14px system-ui", margin: "2px 4px 12px" }}>Quiz-taker testing</div>
        <div style={{ display: "grid", gap: 6, gridTemplateColumns: window.innerWidth >= 760 ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
          {PREVIEW_STAGES.map(([id, label]) => (
            <a key={id} href={`#/preview/${id}`} style={{
              color: id === stage ? "#111" : "#fff",
              background: id === stage ? "#f3c94b" : "#26324a",
              textDecoration: "none", padding: "9px 10px", borderRadius: 8,
              font: "600 12px system-ui"
            }}>{label}</a>
          ))}
          <a href="#/host" style={{
            color: "#fff", background: "#7b2d36", textDecoration: "none",
            padding: "9px 10px", borderRadius: 8, font: "600 12px system-ui",
            marginTop: window.innerWidth >= 760 ? 6 : 0
          }}>Exit preview</a>
        </div>

        <div style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid #26324a",
          display: "grid",
          gap: 10
        }}>
          <div style={{ color: "#fff", font: "800 12px system-ui" }}>Layout editor</div>

          <button
            type="button"
            onClick={() => {
              const next = !editorEnabled;
              setEditorEnabled(next);
              setSelectedElement(null);
              sendEditor("set-enabled", { enabled: next });
            }}
            style={{
              border: 0,
              borderRadius: 8,
              padding: "9px 10px",
              background: editorEnabled ? "#0891b2" : "#26324a",
              color: "#fff",
              font: "800 11px system-ui",
              cursor: "pointer"
            }}
          >
            {editorEnabled ? "Editing ON" : "Enable editing"}
          </button>

          <div style={{ color: "#9ca3af", font: "500 10px/1.35 system-ui" }}>
            {editorEnabled
              ? "Click any item. Drag it to move. Use the right, bottom or corner handle to resize."
              : "Enable editing to move and resize anything on this page."}
          </div>

          {editorEnabled && selectedElement ? (
            <div style={{
              display: "grid",
              gap: 9,
              padding: 10,
              borderRadius: 9,
              background: "#111827",
              border: selectedElement.locked ? "1px solid #f59e0b" : "1px solid #334155"
            }}>
              <div style={{
                color: selectedElement.locked ? "#fbbf24" : "#67e8f9",
                font: "700 10px/1.3 system-ui",
                wordBreak: "break-word"
              }}>
                {selectedElement.label}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {[
                  ["x", "X"],
                  ["y", "Y"],
                  ["width", "Width"],
                  ["height", "Height"],
                  ["fontSize", "Text size"],
                ].map(([field, label]) => (
                  <label key={field} style={{
                    display: "grid",
                    gap: 3,
                    gridColumn: field === "fontSize" ? "1 / -1" : undefined,
                    color: "#9ca3af",
                    font: "600 9px system-ui"
                  }}>
                    <span>{label}</span>
                    <input
                      type="number"
                      step={field === "fontSize" ? "0.5" : "1"}
                      value={selectedElement[field]}
                      disabled={selectedElement.locked}
                      onChange={(event) => updateSelectedField(field, event.target.value)}
                      style={{
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        background: selectedElement.locked ? "#1f2937" : "#0f172a",
                        color: "#fff",
                        padding: "6px 7px",
                        font: "600 10px system-ui"
                      }}
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={() => sendEditor(selectedElement.locked ? "unlock-selected" : "lock-selected")}
                style={{
                  border: 0,
                  borderRadius: 7,
                  padding: "8px 9px",
                  background: selectedElement.locked ? "#92400e" : "#0f766e",
                  color: "#fff",
                  font: "800 10px system-ui",
                  cursor: "pointer"
                }}
              >
                {selectedElement.locked ? "Unlock element" : "Lock element"}
              </button>

              <button
                type="button"
                disabled={selectedElement.locked}
                onClick={() => sendEditor("reset-selected")}
                style={{
                  border: 0,
                  borderRadius: 7,
                  padding: "7px 9px",
                  background: "#26324a",
                  color: selectedElement.locked ? "#6b7280" : "#fff",
                  font: "700 10px system-ui",
                  cursor: selectedElement.locked ? "not-allowed" : "pointer"
                }}
              >
                Reset selected
              </button>
            </div>
          ) : null}

          {editorEnabled && !selectedElement ? (
            <div style={{ color: "#94a3b8", font: "600 10px/1.35 system-ui" }}>
              Click an element inside the phone to select it.
            </div>
          ) : null}

          {editorEnabled ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button
                type="button"
                onClick={() => sendEditor("lock-all")}
                style={{ border: 0, borderRadius: 7, padding: "7px", background: "#78350f", color: "#fff", font: "700 9px system-ui", cursor: "pointer" }}
              >
                Lock all
              </button>
              <button
                type="button"
                onClick={() => sendEditor("unlock-all")}
                style={{ border: 0, borderRadius: 7, padding: "7px", background: "#26324a", color: "#fff", font: "700 9px system-ui", cursor: "pointer" }}
              >
                Unlock all
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Reset every layout edit on this preview page?")) sendEditor("reset-page");
                }}
                style={{ gridColumn: "1 / -1", border: 0, borderRadius: 7, padding: "7px", background: "#7f1d1d", color: "#fff", font: "700 9px system-ui", cursor: "pointer" }}
              >
                Reset this page
              </button>
              <button
                type="button"
                onClick={() => sendEditor("export")}
                style={{ gridColumn: "1 / -1", border: 0, borderRadius: 7, padding: "7px", background: "#312e81", color: "#fff", font: "700 9px system-ui", cursor: "pointer" }}
              >
                Generate full page JSON
              </button>
            </div>
          ) : null}

          {layoutExport ? (
            <div style={{ display: "grid", gap: 7 }}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(layoutExport);
                  } catch {
                    // The textarea remains available for manual copy if clipboard permission is blocked.
                  }
                }}
                style={{
                  border: 0,
                  borderRadius: 7,
                  padding: "8px 9px",
                  background: "#0f766e",
                  color: "#fff",
                  font: "800 10px system-ui",
                  cursor: "pointer"
                }}
              >
                Copy full page JSON
              </button>
              <textarea
                readOnly
                value={layoutExport}
                style={{
                  width: "100%",
                  minHeight: 150,
                  boxSizing: "border-box",
                  resize: "vertical",
                  border: "1px solid #334155",
                  borderRadius: 7,
                  background: "#020617",
                  color: "#cbd5e1",
                  padding: 7,
                  font: "500 8px/1.3 monospace"
                }}
              />
            </div>
          ) : null}
        </div>

        {stage === "waiting" ? (
          <div style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid #26324a",
            display: "grid",
            gap: 14
          }}>
            <div style={{ color: "#fff", font: "700 12px system-ui" }}>Waiting-page sizing</div>

            <label style={{ display: "grid", gap: 6, color: "#d1d5db", font: "600 11px system-ui" }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>Light bulb</span><strong style={{ color: "#f3c94b" }}>{bulbSize}px</strong>
              </span>
              <input
                type="range"
                min="240"
                max="430"
                step="5"
                value={bulbSize}
                onChange={(event) => setBulbSize(Number(event.target.value))}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, color: "#d1d5db", font: "600 11px system-ui" }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>Fact box width</span><strong style={{ color: "#f3c94b" }}>{factBoxWidth}px</strong>
              </span>
              <input
                type="range"
                min="105"
                max="230"
                step="5"
                value={factBoxWidth}
                onChange={(event) => setFactBoxWidth(Number(event.target.value))}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, color: "#d1d5db", font: "600 11px system-ui" }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>Fact box horizontal</span><strong style={{ color: "#f3c94b" }}>{factBoxX}%</strong>
              </span>
              <input
                type="range"
                min="20"
                max="80"
                step="1"
                value={factBoxX}
                onChange={(event) => setFactBoxX(Number(event.target.value))}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, color: "#d1d5db", font: "600 11px system-ui" }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>Fact box vertical</span><strong style={{ color: "#f3c94b" }}>{factBoxY}%</strong>
              </span>
              <input
                type="range"
                min="18"
                max="72"
                step="1"
                value={factBoxY}
                onChange={(event) => setFactBoxY(Number(event.target.value))}
                style={{ width: "100%" }}
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setBulbSize(360);
                setFactBoxWidth(158);
                setFactBoxX(50);
                setFactBoxY(39);
              }}
              style={{
                border: 0,
                borderRadius: 8,
                padding: "8px 10px",
                background: "#26324a",
                color: "#fff",
                font: "700 11px system-ui",
                cursor: "pointer"
              }}
            >
              Reset sizes
            </button>
          </div>
        ) : null}
      </aside>

      <div style={{
        minWidth: 0,
        display: "grid",
        justifyItems: "center",
        alignItems: "start"
      }}>
        <div style={{
          width: FRAME_WIDTH * previewScale,
          height: FRAME_HEIGHT * previewScale,
          position: "relative"
        }}>
          <div style={{
            width: FRAME_WIDTH,
            height: FRAME_HEIGHT,
            position: "absolute",
            inset: 0,
            transform: `scale(${previewScale})`,
            transformOrigin: "top left",
            borderRadius: 28,
            background: "#05070b",
            boxShadow: "0 14px 50px rgba(0,0,0,.5)",
            padding: FRAME_BORDER,
            boxSizing: "border-box",
            overflow: "hidden"
          }}>
            <iframe
              ref={iframeRef}
              key={stage}
              title={`Quiz-taker preview: ${stage}`}
              src={`#/join/__PREVIEW__/${encodeURIComponent(stage)}`}
              onLoad={() => {
                sendPreviewStyle();
                sendEditor("set-enabled", { enabled: editorEnabled });
              }}
              style={{
                display: "block",
                width: PHONE_WIDTH,
                height: PHONE_HEIGHT,
                border: 0,
                borderRadius: 20,
                background: "#fff"
              }}
            />
          </div>
        </div>
        <div style={{
          marginTop: 12,
          color: "#9ca3af",
          font: "600 11px system-ui",
          letterSpacing: ".02em"
        }}>
          390 × 844 phone viewport · scaled to fit your browser
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route.kind === "preview") return <TeamPreview stage={route.stage} />;
  if (route.kind === "join") return <TeamView sessionCode={route.sessionCode} teamToken={route.teamToken} />;
  return <HostApp />;
}
