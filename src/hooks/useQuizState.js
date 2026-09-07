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

function stateForLocalStorage(state) {
  return {
    ...state,
    quizzes: (state.quizzes ?? []).map((quiz) => ({
      ...quiz,
      rounds: (quiz.rounds ?? []).map((round) => ({
        ...round,
        questions: (round.questions ?? []).map((question) => ({
          ...question,
          image: String(question.image || "").startsWith("data:") ? "" : question.image,
          audio: String(question.audio || "").startsWith("data:") ? "" : question.audio,
        })),
      })),
    })),
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
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      // Embedded image/audio data can easily exceed the browser's localStorage quota.
      // The shared GitHub library remains the source of truth for quiz media, so the
      // local cache deliberately stores only lightweight quiz data.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateForLocalStorage(state)));
      setStorageError("");
    } catch (error) {
      console.error("QuizPro local backup failed", error);
      setStorageError("The local browser backup is full. QuizPro is still running, but make sure the Shared library shows Saved before closing this page.");
    }
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
    setStorageError("");
  }, []);

  return useMemo(() => ({ state, updateState, resetState, storageError }), [state, updateState, resetState, storageError]);
}
