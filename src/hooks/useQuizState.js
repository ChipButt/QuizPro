import { useCallback, useEffect, useMemo, useState } from "react";
import { createInitialState } from "../data/seed.js";

const STORAGE_KEY = "quizmaster-pro-state-v2";
const LEGACY_STORAGE_KEYS = ["quizmaster-pro-state-v1", "quizmaster-pro-host-unlocked"];

function normalizeStoredState(stored) {
  const initial = createInitialState();
  const next = stored && typeof stored === "object" ? stored : {};
  return {
    ...initial,
    ...next,
    live: {
      ...initial.live,
      ...(next.live ?? {}),
      revealedQuestions: { ...initial.live.revealedQuestions, ...(next.live?.revealedQuestions ?? {}) },
      revealedRounds: { ...initial.live.revealedRounds, ...(next.live?.revealedRounds ?? {}) },
      forceLockedRounds: { ...initial.live.forceLockedRounds, ...(next.live?.forceLockedRounds ?? {}) },
      audio: { ...initial.live.audio, ...(next.live?.audio ?? {}) },
    },
    quizzes: Array.isArray(next.quizzes) ? next.quizzes : [],
    media: Array.isArray(next.media) ? next.media : [],
    teams: Array.isArray(next.teams) ? next.teams : [],
    teamRoundLocks: next.teamRoundLocks && typeof next.teamRoundLocks === "object" ? next.teamRoundLocks : {},
    answers: next.answers && typeof next.answers === "object" ? next.answers : {},
  };
}

function readStoredState() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeStoredState(JSON.parse(stored)) : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function useQuizState() {
  const [state, setState] = useState(readStoredState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      setState((current) => {
        const next = normalizeStoredState(JSON.parse(event.newValue));
        return JSON.stringify(current) === JSON.stringify(next) ? current : next;
      });
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateState = useCallback((updater) => {
    setState((current) => normalizeStoredState(typeof updater === "function" ? updater(current) : updater));
  }, []);

  const resetState = useCallback(() => {
    setState(createInitialState());
    window.localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.removeItem("quizmaster-pro-team-id");
  }, []);

  return useMemo(() => ({ state, updateState, resetState }), [state, updateState, resetState]);
}
