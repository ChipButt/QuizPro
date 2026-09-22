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

  const sendPreviewStyle = () => {
    iframeRef.current?.contentWindow?.postMessage({
      type: "quiz-preview-style",
      bulbSize,
      factBoxWidth,
      factBoxX,
      factBoxY,
    }, window.location.origin);
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
              onLoad={sendPreviewStyle}
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
