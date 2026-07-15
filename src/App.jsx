import { useEffect, useMemo, useState } from "react";
import HostShell from "./components/HostShell.jsx";
import TeamView from "./components/TeamView.jsx";
import { useQuizState } from "./hooks/useQuizState.js";

function getRoute() {
  const hash = window.location.hash || "#/host";
  if (hash.startsWith("#/join")) return "join";
  return "host";
}

export default function App() {
  const { state, updateState, resetState } = useQuizState();
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (state.live.status !== "Live" || state.live.screen !== "question" || state.live.locked) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      updateState((current) => ({
        ...current,
        live: {
          ...current.live,
          elapsedSeconds: current.live.elapsedSeconds + 1,
          questionSecondsRemaining: Math.max(0, current.live.questionSecondsRemaining - 1),
        },
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.live.locked, state.live.screen, state.live.status, updateState]);

  useEffect(() => {
    if (
      state.live.status !== "Live" ||
      state.live.locked ||
      state.live.screen !== "question" ||
      state.live.questionSecondsRemaining > 0
    ) {
      return;
    }
    updateState((current) => {
      if (
        current.live.status !== "Live" ||
        current.live.locked ||
        current.live.screen !== "question" ||
        current.live.questionSecondsRemaining > 0
      ) {
        return current;
      }
      return {
        ...current,
        live: {
          ...current.live,
          locked: true,
          screen: "locked",
        },
      };
    });
  }, [
    state.live.locked,
    state.live.questionSecondsRemaining,
    state.live.screen,
    state.live.status,
    updateState,
  ]);

  const appContext = useMemo(
    () => ({ state, updateState, resetState }),
    [state, updateState, resetState],
  );

  if (route === "join") {
    return <TeamView {...appContext} />;
  }

  return <HostShell {...appContext} />;
}
