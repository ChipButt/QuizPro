import { useCallback, useEffect, useRef, useState } from "react";

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

function previewSnapshot(stage) {
  const base = {
    type: "snapshot",
    team: { id: "preview-team", name: "The Quizzy Rascals", nameLocked: true, table: 7, players: 4 },
    quiz: { totalRounds: 5 },
    waitingFacts: [
      "A group of flamingos is called a flamboyance.",
      "The shortest war in recorded history lasted less than an hour.",
    ],
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
    return base;
  }
  if (stage === "final") {
    base.live = { ...base.live, teamScreen: "final", finalRevealCount: 4 };
    return base;
  }

  const multipleChoice = stage === "multiple-choice";
  const revealed = stage === "answer-reveal";
  const locked = stage === "locked";
  base.live = {
    ...base.live,
    teamScreen: "question",
    roundIndex: 0,
    questionIndex: 0,
    timerActive: stage === "timer",
    timerEndsAt: stage === "timer" ? Date.now() + 45000 : null,
  };
  base.round = {
    id: "preview-round",
    title: "General Knowledge",
    totalQuestions: 10,
    teamLocked: locked,
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
  const [snapshot, setSnapshot] = useState(() => previewMode ? previewSnapshot(teamToken) : null);
  const [status, setStatus] = useState(previewMode ? "online" : "connecting");
  const [error, setError] = useState("");
  const connectionRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    if (previewMode) {
      setSnapshot(previewSnapshot(teamToken));
      setStatus("online");
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
      if (cancelled) return;
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
              setSnapshot(message);
              setStatus("online");
              return;
            }
            if (message?.type === "rejected") {
              setStatus("error");
              setError(message.reason || "This team QR code is not valid.");
            }
          });
          conn.on("close", () => {
            if (cancelled) return;
            setStatus("reconnecting");
            setError("Connection lost. Rejoining the quizmaster…");
            retry();
          });
          conn.on("error", () => {
            if (cancelled) return;
            setStatus("reconnecting");
            retry();
          });
        });

        peer.on("error", (peerError) => {
          if (cancelled) return;
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

  const send = useCallback((message) => {
    if (previewMode) {
      setSnapshot((current) => {
        if (!current) return current;
        if (message?.type === "set-team-name") {
          return { ...current, team: { ...current.team, name: message.name, nameLocked: true } };
        }
        if (message?.type === "save-answer") {
          return { ...current, teamAnswers: { ...current.teamAnswers, [message.questionId]: { text: message.text } } };
        }
        if (message?.type === "lock-round") {
          return { ...current, round: { ...current.round, teamLocked: true }, live: { ...current.live, teamScreen: "round_locked" } };
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
