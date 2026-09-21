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
    <>
      <div style={{
        position: "fixed", zIndex: 99999, left: 10, right: 10, bottom: 10,
        display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center",
        padding: 8, borderRadius: 12, background: "rgba(8,12,24,.94)",
        boxShadow: "0 6px 30px rgba(0,0,0,.35)"
      }}>
        {PREVIEW_STAGES.map(([id, label]) => (
          <a key={id} href={`#/preview/${id}`} style={{
            color: id === stage ? "#111" : "#fff",
            background: id === stage ? "#f3c94b" : "#26324a",
            textDecoration: "none", padding: "7px 10px", borderRadius: 8,
            font: "600 12px system-ui"
          }}>{label}</a>
        ))}
        <a href="#/host" style={{
          color: "#fff", background: "#7b2d36", textDecoration: "none",
          padding: "7px 10px", borderRadius: 8, font: "600 12px system-ui"
        }}>Exit preview</a>
      </div>
      <TeamView sessionCode="__PREVIEW__" teamToken={stage} />
    </>
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
