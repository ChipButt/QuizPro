import { RELAY_READY, RELAY_URL, RelayPeer } from "../utils/relayPeer.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { WAITING_FACT_POOL } from "../data/waitingFacts.js";

const PEERJS_CDN = "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js";
let peerPromise;

function loadPeerJs() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (peerPromise) return peerPromise;
  const sources = [PEERJS_CDN, "https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js"];
  const load = (url) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else resolve(window.Peer);
    };
    const timer = window.setTimeout(() => finish(new Error("Live connection library timed out.")), 8000);
    script.src = url;
    script.async = true;
    script.onload = () => finish(window.Peer ? null : new Error("Peer connection library did not load."));
    script.onerror = () => finish(new Error("Could not load the live connection service."));
    document.head.appendChild(script);
  });
  peerPromise = load(sources[0]).catch(() => window.Peer || load(sources[1])).catch((error) => {
    peerPromise = undefined;
    throw error;
  });
  return peerPromise;
}

function peerIdForSession(code) {
  return `quizpro-${String(code || "").toLowerCase()}`;
}

const MEDIA_FIELDS = ["image", "audio", "answerImage", "answerAudio"];

function hydrateSnapshotMedia(snapshot, cache) {
  if (!snapshot?.round?.questions?.length) return snapshot;

  const reuse = new Set(Array.isArray(snapshot.mediaReuse) ? snapshot.mediaReuse : []);
  const roundId = snapshot.round.id ?? "";
  const questions = snapshot.round.questions.map((question) => {
    const next = { ...question };

    for (const field of MEDIA_FIELDS) {
      const key = `${roundId}:${question.id ?? ""}:${field}`;
      const hasField = Object.prototype.hasOwnProperty.call(question, field);
      const value = question[field];

      if (hasField && typeof value === "string" && value) {
        cache.set(key, value);
        continue;
      }

      if (!hasField && reuse.has(key)) {
        const cached = cache.get(key);
        if (typeof cached === "string" && cached) next[field] = cached;
        continue;
      }

      cache.delete(key);
    }

    return next;
  });

  const nextSnapshot = {
    ...snapshot,
    round: { ...snapshot.round, questions },
  };
  delete nextSnapshot.mediaReuse;
  return nextSnapshot;
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

  const timerPreview = stage === "timer" || stage === "timer-editor";
  const pictureQuestionEditor = stage === "picture-question-editor";
  const pictureAnswerEditor = stage === "picture-answer-editor";
  const pictureEditor = pictureQuestionEditor || pictureAnswerEditor;
  const multipleChoice = stage === "multiple-choice" || timerPreview;
  const revealed = stage === "answer-reveal";

  const questionImage = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5a7f2b"/><stop offset="1" stop-color="#9ec75b"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><path d="M0 520 C190 330 330 610 800 270 L800 800 L0 800Z" fill="#315d24"/><path d="M90 720 C250 360 500 220 740 80" fill="none" stroke="#c7df8f" stroke-width="34" opacity=".5"/></svg>'
  );
  const answerImage = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="#fff"/><g transform="translate(55 85)"><ellipse cx="325" cy="390" rx="250" ry="175" fill="#d9274e"/><ellipse cx="470" cy="435" rx="185" ry="145" fill="#ef315f"/><ellipse cx="245" cy="500" rx="165" ry="135" fill="#b91f43"/><path d="M360 260 C390 110 500 30 650 0 C545 115 520 190 505 290Z" fill="#4e8c34"/><path d="M415 255 C520 105 645 85 700 105 C570 175 525 235 500 305Z" fill="#6ca543"/></g></svg>'
  );

  base.live = {
    ...base.live,
    teamScreen: "question",
    roundIndex: 0,
    questionIndex: 0,
    timerActive: timerPreview,
    timerEndsAt: timerPreview ? Date.now() + 45000 : null,
    timerDurationSeconds: timerPreview ? 45 : 0,
  };
  base.round = {
    id: "preview-round",
    title: pictureEditor ? "Cropped Crops" : "General Knowledge",
    totalQuestions: 10,
    teamLocked: false,
    forceLocked: false,
    questions: [{
      id: "q1",
      number: 1,
      type: pictureEditor ? "Picture" : multipleChoice ? "Multiple choice" : "Text",
      text: pictureEditor ? "What vegetable is this?" : multipleChoice ? "Which planet is known as the Red Planet?" : "What is the capital city of Australia?",
      image: pictureEditor ? (pictureAnswerEditor ? answerImage : questionImage) : "",
      imageName: pictureEditor ? (pictureAnswerEditor ? "Answer image" : "Question image") : "",
      answer: pictureEditor ? "Radish" : multipleChoice ? "Mars" : "Canberra",
      answerImage: pictureEditor ? answerImage : "",
      answerImageName: pictureEditor ? "Answer image" : "",
      hasAnswerImage: pictureEditor,
      hasAnswerText: true,
      editorAnswerPreview: pictureAnswerEditor,
      options: multipleChoice ? ["Venus", "Mars", "Jupiter", "Mercury"] : [],
      revealed,
    }],
  };
  if (revealed) {
    base.teamAnswers = {
      q1: {
        text: pictureEditor ? "Radish" : multipleChoice ? "Mars" : "Canberra",
        status: "correct",
        score: 1,
      },
    };
  }
  return base;
}

export function useLiveTeamNetwork(sessionCode, teamToken) {
  const previewMode = sessionCode === "__PREVIEW__";
  const restoredFinishedSnapshot = previewMode ? null : readFinishedSnapshot(sessionCode, teamToken);
  const [snapshot, setSnapshot] = useState(() => previewMode ? previewSnapshot(teamToken) : restoredFinishedSnapshot);
  const [status, setStatus] = useState(previewMode ? "online" : restoredFinishedSnapshot ? "finished" : "connecting");
  const [error, setError] = useState("");
  const [resumeNonce, setResumeNonce] = useState(0);
  const connectionRef = useRef(null);
  const peerRef = useRef(null);
  const mediaCacheRef = useRef(new Map());
  const finishedRef = useRef(Boolean(restoredFinishedSnapshot));
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    mediaCacheRef.current.clear();

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

    // A peer socket opening is not proof that the quiz host has supplied a snapshot.
    // Invalidate every previous attempt before closing it: PeerJS can emit close synchronously.
    let cancelled = false;
    let attempt = 0;
    let failures = 0;
    let retryTimer;
    let watchdog;
    let terminal = false;

    function closeTransport() {
      const conn = connectionRef.current;
      const peer = peerRef.current;
      connectionRef.current = null;
      peerRef.current = null;
      try { conn?.close(); } catch { /* ignore */ }
      try { peer?.destroy(); } catch { /* ignore */ }
    }

    function isCurrent(id) {
      return !cancelled && !terminal && !finishedRef.current && id === attempt;
    }

    function clearTimers() {
      window.clearTimeout(retryTimer);
      window.clearTimeout(watchdog);
    }

    function retry(id, reason) {
      if (!isCurrent(id)) return;
      attempt += 1;
      failures += 1;
      clearTimers();
      closeTransport();
      setStatus("reconnecting");
      setError(failures >= 2
        ? "Still trying to reach the quiz host. Open this link in Chrome or switch between Wi-Fi and mobile data."
        : reason || "Trying to reconnect to the quizmaster…");
      retryTimer = window.setTimeout(connect, Math.min(1600 * failures, 5000));
    }

    function stop(id, reason) {
      if (!isCurrent(id)) return;
      terminal = true;
      attempt += 1;
      clearTimers();
      closeTransport();
      setStatus("error");
      setError(reason);
    }

    function watch(id, delay, reason) {
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(() => retry(id, reason), delay);
    }

    async function connect() {
      if (cancelled || terminal || finishedRef.current) return;
      const id = ++attempt;
      clearTimers();
      closeTransport();
      setStatus(failures ? "reconnecting" : "connecting");
      if (!failures) setError("");
      watch(id, 20000, "The live connection service is taking too long. Retrying…");
      try {
        const Peer = RELAY_READY && RELAY_URL ? RelayPeer : await loadPeerJs();
        if (!isCurrent(id)) return;
        watch(id, 18000, "The connection to the quiz host timed out. Retrying…");
        const peer = new Peer();
        peerRef.current = peer;

        peer.on("open", () => {
          if (!isCurrent(id)) return;
          let conn;
          try {
            conn = peer.connect(peerIdForSession(sessionCode), { reliable: true });
          } catch {
            retry(id, "Could not open the team connection. Retrying…");
            return;
          }
          connectionRef.current = conn;
          conn.on("open", () => {
            if (!isCurrent(id)) return;
            watch(id, 30000, "Connected, but the quiz host has not sent the quiz data. Retrying…");
            try { conn.send({ type: "hello", teamToken }); }
            catch { retry(id, "Could not send the join request. Retrying…"); }
          });
          conn.on("data", (message) => {
            if (!isCurrent(id)) return;
            if (message?.type === "snapshot") {
              const hydratedMessage = hydrateSnapshotMedia(message, mediaCacheRef.current);
              window.clearTimeout(watchdog);
              failures = 0;
              if (hydratedMessage.live?.teamScreen === "finished") {
                finishedRef.current = true;
                storeFinishedSnapshot(sessionCode, teamToken, hydratedMessage);
                setSnapshot(hydratedMessage);
                setStatus("finished");
                setError("");
                return;
              }
              setSnapshot(hydratedMessage);
              setStatus("online");
              setError("");
              return;
            }
            if (message?.type === "session-finished") {
              window.clearTimeout(watchdog);
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
              stop(id, message.reason || "This team QR code is not valid.");
            }
          });
          conn.on("close", () => retry(id, "Connection lost. Rejoining the quizmaster…"));
          conn.on("error", () => retry(id, "Connection lost. Rejoining the quizmaster…"));
        });

        peer.on("disconnected", () => retry(id, "Connection lost. Rejoining the quizmaster…"));
        peer.on("error", (peerError) => {
          if (!isCurrent(id)) return;
          if (["peer-unavailable", "network", "server-error", "socket-error", "disconnected", "webrtc", "browser-incompatible", "ssl-unavailable"].includes(peerError?.type)) {
            retry(id, "Trying to reconnect to the quizmaster…");
          } else {
            stop(id, peerError?.message || "Could not connect to the quizmaster.");
          }
        });
      } catch (connectError) {
        retry(id, connectError?.message || "Could not start the live connection. Retrying…");
      }
    }

    connect();

    return () => {
      cancelled = true;
      attempt += 1;
      clearTimers();
      closeTransport();
    };
  }, [sessionCode, teamToken, previewMode, resumeNonce]);

  useEffect(() => {
    if (previewMode) return undefined;

    const resumeConnection = () => {
      if (finishedRef.current || !sessionCode || !teamToken) return;
      setStatus("reconnecting");
      setError("");
      setResumeNonce((value) => value + 1);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        return;
      }

      if (document.visibilityState === "visible" && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        resumeConnection();
      }
    };

    const onPageShow = (event) => {
      if (!event.persisted) return;
      wasHiddenRef.current = false;
      resumeConnection();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [previewMode, sessionCode, teamToken]);

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
