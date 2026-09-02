import { useEffect, useState } from "react";
import HostShell from "./components/HostShell.jsx";
import TeamView from "./components/TeamView.jsx";
import { useGitHubQuizLibrary } from "./hooks/useGitHubQuizLibrary.js";
import { useQuizState } from "./hooks/useQuizState.js";

function getRoute() {
  const hash = window.location.hash || "#/host";
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
  const { state, updateState, resetState } = useQuizState();
  const sharedLibrary = useGitHubQuizLibrary(state, updateState);
  return <HostShell state={state} updateState={updateState} resetState={resetState} sharedLibrary={sharedLibrary} />;
}

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route.kind === "join") {
    return <TeamView sessionCode={route.sessionCode} teamToken={route.teamToken} />;
  }

  return <HostApp />;
}
