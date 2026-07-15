import { useCallback, useEffect, useMemo, useState } from "react";
import { createInitialState } from "../data/seed.js";

const STORAGE_KEY = "quizmaster-pro-state-v2";
const LEGACY_STORAGE_KEYS = ["quizmaster-pro-state-v1", "quizmaster-pro-host-unlocked"];

function readStoredState() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? { ...createInitialState(), ...JSON.parse(stored) } : createInitialState();
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
        const next = JSON.parse(event.newValue);
        return JSON.stringify(current) === event.newValue ? current : next;
      });
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateState = useCallback((updater) => {
    setState((current) => (typeof updater === "function" ? updater(current) : updater));
  }, []);

  const resetState = useCallback(() => {
    setState(createInitialState());
    window.localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.removeItem("quizmaster-pro-team-id");
  }, []);

  return useMemo(() => ({ state, updateState, resetState }), [state, updateState, resetState]);
}
