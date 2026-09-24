import { useCallback, useEffect, useRef, useState } from "react";
import { WAITING_FACT_POOL } from "../data/waitingFacts.js";

const PEERJS_CDN = "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js";
let peerPromise;

function loadPeerJs() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (peerPromise) return peerPromise;
  peerPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PEERJS_CDN;
    script.async = true;
    script.onload = () => (window.Peer ? resolve(window.Peer) : reject(new Error("Peer connection library did not load.")));
    script.onerror = () => reject(new Error("Could not load the live connection service."));
    document.head.appendChild(script);
  });
  return peerPromise;
}

function peerIdForSession(code) {
  return `quizpro-${String(code || "").toLowerCase()}`;
}

function finishedStorageKey(sessionCode, teamToken) {
  return `quizpro-finished:${String(sessionCode || "")}:${String(teamToken || "")}`;
}

function readFinishedSnapshot(sessionCode, teamToken) {
  if (!sessionCode || !teamToken) return null;
  try {
    const raw = window.localStorage.getItem(finishedStorageKey(sessionCode, teamToken));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.live?.teamScreen === "finished" ? parsed : null;
  } catch {
    return null;
  }
}

function storeFinishedSnapshot(sessionCode, teamToken, snapshot) {
  if (!sessionCode || !teamToken || !snapshot) return;
  try {
    window.localStorage.setItem(finishedStorageKey(sessionCode, teamToken), JSON.stringify(snapshot));
  } catch {
    // Local persistence is a convenience only; the live finished screen still works without it.
  }
}

function previewSnapshot(stage) {
  const base = {
    type: "snapshot",
    team: { id: "preview-team", name: "The Quizzy Rascals", nameLocked: true, table: 7, players: 4 },
    quiz: { totalRounds: 5 },
    waitingFacts: WAITING_FACT_POOL.slice(0, 50).map((fact) => fact.text),
    roundScores: [],
    leaderboard: [
      { id: "team-2", name: "Universally Challenged", score: 38 },
      { id: "preview-team", name: "The Quizzy Rascals", score: 35 },
      { id: "team-3", name: "Agatha Quiztie", score: 31 },
      { id: "team-4", name: "No Eye Deer", score: 28 },
    ],
    teamAnswers: {},
    live: { teamScreen: "lobby", roundIndex: 0, questionIndex: -1, timerActive: false, finalRevealCount: 4 },
    nextRound: { number: 1, title: "General Knowledge" },
  };

  if (stage === "team-name") {
    base.team = { ...base.team, name: "", nameLocked: false };
    return base;
  }
  if (stage === "waiting") return base;
  if (stage === "between-rounds") {
    base.live = { ...base.live, teamScreen: "round_locked", roundIndex: 1, questionIndex: -1 };
    base.roundScores = [{ id: "r1", number: 1, title: "General Knowledge", score: 8, max: 10 }];
    base.nextRound = { number: 2, title: "Music" };
    return base;
  }
  if (stage === "leaderboard") {
    base.live = { ...base.live, teamScreen: "leaderboard" };
    base.leaderboard = [
      { id: "team-2", name: "Universally Challenged", score: 38 },
      { id: "preview-team", name: "The Quizzy Rascals", score: 35 },
      { id: "team-3", name: "Agatha Quiztie", score: 31 },
      { id: "team-4", name: "No Eye Deer", score: 28 },
      { id: "team-5", name: "The Smartinis", score: 27 },
      { id: "team-6", name: "Risky Quizness", score: 25 },
      { id: "team-7", name: "Norfolk 'n' Chance", score: 24 },
      { id: "team-8", name: "The Know It Ales", score: 22 },
      { id: "team-9", name: "Victorious Secret", score: 20 },
      { id: "team-10", name: "Google Wasn't Invited", score: 19 },
      { id: "team-11", name: "Les Quizerables", score: 17 },
      { id: "team-12", name: "Let's Get Quizzical", score: 15 },
      { id: "team-13", name: "The Guessing Game", score: 13 },
      { id: "team-14", name: "Table Trouble", score: 11 },
    ];
    return base;
  }
  if (stage === "final") {
    base.leaderboard = [
      { id: "team-2", name: "Universally Challenged", score: 38 },
      { id: "preview-team", name: "The Quizzy Rascals", score: 35 },
      { id: "team-3", name: "Agatha Quiztie", score: 31 },
      { id: "team-4", name: "No Eye Deer", score: 28 },
      { id: "team-5", name: "The Smartinis", score: 27 },
      { id: "team-6", name: "Risky Quizness", score: 25 },
      { id: "team-7", name: "Norfolk 'n' Chance", score: 24 },
      { id: "team-8", name: "The Know It Ales", score: 22 },
      { id: "team-9", name: "Victorious Secret", score: 20 },
      { id: "team-10", name: "Google Wasn't Invited", score: 19 },
      { id: "team-11", name: "Les Quizerables", score: 17 },
      { id: "team-12", name: "Let's Get Quizzical", score: 15 },
      { id: "team-13", name: "The Guessing Game", score: 13 },
      { id: "team-14", name: "Table Trouble", score: 11 },
    ];
    base.live = { ...base.live, teamScreen: "final", finalRevealCount: base.leaderboard.length };
    return base;
  }

  const multipleChoice = stage === "multiple-choice" || stage === "timer";
  const revealed = stage === "answer-reveal";
  base.live = {
    ...base.live,
    teamScreen: "question",
    roundIndex: 0,
    questionIndex: 0,
    timerActive: stage === "timer",
    timerEndsAt: stage === "timer" ? Date.now() + 45000 : null,
    timerDurationSeconds: stage === "timer" ? 45 : 0,
  };
  base.round = {
    id: "preview-round",
    title: "General Knowledge",
    totalQuestions: 10,
    teamLocked: false,
    forceLocked: false,
    questions: [{
      id: "q1",
      number: 1,
      type: multipleChoice ? "Multiple choice" : "Text",
      text: multipleChoice ? "Which planet is known as the Red Planet?" : "What is the capital city of Australia?",
      answer: multipleChoice ? "Mars" : "Canberra",
      options: multipleChoice ? ["Venus", "Mars", "Jupiter", "Mercury"] : [],
      revealed,
    }],
  };
  if (revealed) base.teamAnswers = { q1: { text: multipleChoice ? "Mars" : "Canberra" } };
  return base;
}

export function useLiveTeamNetwork(sessionCode, teamToken) {
  const previewMode = sessionCode === "__PREVIEW__";
  const restoredFinishedSnapshot = previewMode ? null : readFinishedSnapshot(sessionCode, teamToken);
  const [snapshot, setSnapshot] = useState(() => previewMode ? previewSnapshot(teamToken) : restoredFinishedSnapshot);
  const [status, setStatus] = useState(previewMode ? "online" : restoredFinishedSnapshot ? "finished" : "connecting");
  const [error, setError] = useState("");
  const connectionRef = useRef(null);
  const peerRef = useRef(null);
  const finishedRef = useRef(Boolean(restoredFinishedSnapshot));

  useEffect(() => {
    if (previewMode) {
      setSnapshot(previewSnapshot(teamToken));
      setStatus("online");
      setError("");
      return undefined;
    }
    if (finishedRef.current) {
      const restored = readFinishedSnapshot(sessionCode, teamToken);
      if (restored) setSnapshot(restored);
      setStatus("finished");
      setError("");
      return undefined;
    }
    if (!sessionCode || !teamToken) {
      setStatus("error");
      setError("This QR code is incomplete. Ask the quizmaster for a new team QR code.");
      return undefined;
    }

    let cancelled = false;
    let retryTimer;

    function closeTransport() {
      try { connectionRef.current?.close(); } catch { /* ignore */ }
      try { peerRef.current?.destroy(); } catch { /* ignore */ }
      connectionRef.current = null;
      peerRef.current = null;
    }

    function retry() {
      if (cancelled || finishedRef.current) return;
      window.clearTimeout(retryTimer);
      closeTransport();
      retryTimer = window.setTimeout(connect, 1600);
    }

    async function connect() {
      if (cancelled) return;
      setStatus("connecting");
      setError("");
      try {
        const Peer = await loadPeerJs();
        if (cancelled) return;
        closeTransport();
        const peer = new Peer();
        peerRef.current = peer;

        peer.on("open", () => {
          if (cancelled) return;
          const conn = peer.connect(peerIdForSession(sessionCode), { reliable: true });
          connectionRef.current = conn;

          conn.on("open", () => {
            setStatus("online");
            setError("");
            conn.send({ type: "hello", teamToken });
          });
          conn.on("data", (message) => {
            if (message?.type === "snapshot") {
              if (message.live?.teamScreen === "finished") {
                finishedRef.current = true;
                storeFinishedSnapshot(sessionCode, teamToken, message);
                setSnapshot(message);
                setStatus("finished");
                setError("");
                return;
              }
              setSnapshot(message);
              setStatus("online");
              return;
            }
            if (message?.type === "session-finished") {
              finishedRef.current = true;
              setSnapshot((current) => {
                const finishedSnapshot = {
                  ...(current || {}),
                  type: "snapshot",
                  sessionActive: false,
                  live: {
                    ...(current?.live || {}),
                    status: "Completed",
                    teamScreen: "finished",
                    timerActive: false,
                    timerEndsAt: 0,
                    timerDurationSeconds: 0,
                    finishedAt: Number(message.finishedAt ?? Date.now()),
                  },
                };
                storeFinishedSnapshot(sessionCode, teamToken, finishedSnapshot);
                return finishedSnapshot;
              });
              setStatus("finished");
              setError("");
              return;
            }
            if (message?.type === "rejected") {
              setStatus("error");
              setError(message.reason || "This team QR code is not valid.");
            }
          });
          conn.on("close", () => {
            if (cancelled || finishedRef.current) return;
            setStatus("reconnecting");
            setError("Connection lost. Rejoining the quizmaster…");
            retry();
          });
          conn.on("error", () => {
            if (cancelled || finishedRef.current) return;
            setStatus("reconnecting");
            retry();
          });
        });

        peer.on("error", (peerError) => {
          if (cancelled || finishedRef.current) return;
          if (["peer-unavailable", "network", "server-error", "socket-error", "disconnected"].includes(peerError?.type)) {
            setStatus("reconnecting");
            setError("Trying to reconnect to the quizmaster…");
            retry();
          } else {
            setStatus("error");
            setError(peerError?.message || "Could not connect to the quizmaster.");
          }
        });
      } catch (connectError) {
        if (cancelled) return;
        setStatus("reconnecting");
        setError(connectError?.message || "Could not start the live connection. Retrying…");
        retry();
      }
    }

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      closeTransport();
    };
  }, [sessionCode, teamToken, previewMode]);

  useEffect(() => {
    if (!previewMode) return undefined;

    const onPreviewMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "quiz-preview-snapshot") return;
      if (!event.data.snapshot) return;
      setSnapshot(event.data.snapshot);
      setStatus("online");
      setError("");
    };

    window.addEventListener("message", onPreviewMessage);
    window.parent?.postMessage({ type: "quiz-taker-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onPreviewMessage);
  }, [previewMode]);

  const send = useCallback((message) => {
    if (previewMode) {
      window.parent?.postMessage({ type: "quiz-taker-preview-action", message }, window.location.origin);
      setSnapshot((current) => {
        if (!current) return current;
        if (message?.type === "set-team-name") {
          return { ...current, team: { ...current.team, name: message.name, nameLocked: true } };
        }
        if (message?.type === "save-answer") {
          return { ...current, teamAnswers: { ...current.teamAnswers, [message.questionId]: { text: message.text } } };
        }
        return current;
      });
      return true;
    }
    const conn = connectionRef.current;
    if (!conn?.open) return false;
    conn.send(message);
    return true;
  }, [previewMode]);

  return { snapshot, status, error, send };
}
