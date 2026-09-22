import { useEffect, useState } from "react";
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
  return (
    <div style={{
      minHeight: "100vh",
      background: "#111827",
      display: "grid",
      gridTemplateColumns: "220px minmax(0, 1fr)",
      gap: 28,
      alignItems: "start",
      justifyContent: "center",
      padding: "28px",
      boxSizing: "border-box",
      overflow: "auto"
    }}>
      <aside style={{
        position: "sticky",
        top: 28,
        width: 220,
        padding: 14,
        borderRadius: 14,
        background: "#0b1220",
        boxShadow: "0 8px 30px rgba(0,0,0,.35)",
        boxSizing: "border-box"
      }}>
        <div style={{ color: "#fff", font: "700 14px system-ui", margin: "2px 4px 12px" }}>Quiz-taker testing</div>
        <div style={{ display: "grid", gap: 6 }}>
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
            marginTop: 6
          }}>Exit preview</a>
        </div>
      </aside>

      <div style={{
        width: "100%",
        maxWidth: 1100,
        height: "calc(100vh - 56px)",
        flex: "0 0 auto",
        overflow: "hidden",
        borderRadius: 28,
        background: "#fff",
        boxShadow: "0 14px 50px rgba(0,0,0,.5)",
        border: "8px solid #05070b",
        boxSizing: "border-box",
        position: "relative"
      }}>
        <TeamView sessionCode="__PREVIEW__" teamToken={stage} />
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
