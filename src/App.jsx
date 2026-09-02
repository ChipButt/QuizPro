import { useEffect, useState } from "react";
import HostShell from "./components/HostShell.jsx";
import { LibrarySyncReceiver } from "./components/LibrarySync.jsx";
import TeamView from "./components/TeamView.jsx";
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
  if (hash.startsWith("#/sync/")) {
    const parts = hash.replace(/^#\//, "").split("/");
    return { kind: "sync", code: decodeURIComponent(parts[1] ?? "").trim().toUpperCase() };
  }
  return { kind: "host" };
}

function HostApp() {
  const { state, updateState, resetState } = useQuizState();
  return <HostShell state={state} updateState={updateState} resetState={resetState} />;
}

function SyncApp({ code }) {
  const { updateState } = useQuizState();
  return <LibrarySyncReceiver code={code} updateState={updateState} />;
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

  if (route.kind === "sync") {
    return <SyncApp code={route.code} />;
  }

  return <HostApp />;
}
