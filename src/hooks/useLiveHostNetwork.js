import { useEffect, useRef, useState } from "react";
import { applyTeamMessage, buildTeamSnapshot } from "../utils/liveSession.js";

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

const MEDIA_FIELDS = ["image", "audio", "answerImage", "answerAudio"];

function mediaKey(roundId, questionId, field) {
  return `${roundId || ""}:${questionId || ""}:${field}`;
}

function dedupeSnapshotMedia(snapshot, cache) {
  if (!snapshot?.round?.questions?.length) return snapshot;

  const reuse = [];
  const roundId = snapshot.round.id ?? "";
  const questions = snapshot.round.questions.map((question) => {
    const next = { ...question };

    for (const field of MEDIA_FIELDS) {
      const key = mediaKey(roundId, question.id, field);
      const value = question[field];

      if (typeof value === "string" && value) {
        if (cache.get(key) === value) {
          delete next[field];
          reuse.push(key);
        } else {
          cache.set(key, value);
        }
      } else {
        cache.delete(key);
      }
    }

    return next;
  });

  return {
    ...snapshot,
    round: { ...snapshot.round, questions },
    mediaReuse: reuse,
  };
}

function changedAnswerTeamIds(previousAnswers = {}, nextAnswers = {}) {
  const changed = new Set();
  const questionIds = new Set([
    ...Object.keys(previousAnswers || {}),
    ...Object.keys(nextAnswers || {}),
  ]);

  for (const questionId of questionIds) {
    const before = previousAnswers?.[questionId] ?? {};
    const after = nextAnswers?.[questionId] ?? {};
    if (before === after) continue;

    const teamIds = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const teamId of teamIds) {
      if (before[teamId] !== after[teamId]) changed.add(teamId);
    }
  }

  return changed;
}

export function useLiveHostNetwork(state, updateState) {
  const stateRef = useRef(state);
  const updateRef = useRef(updateState);
  const peerRef = useRef(null);
  const connectionsRef = useRef(new Map());
  const mediaCacheRef = useRef(new Map());
  const previousStateRef = useRef(state);
  const [status, setStatus] = useState("offline");
  const [connectedTokens, setConnectedTokens] = useState([]);

  stateRef.current = state;
  updateRef.current = updateState;

  const networkEnabled = Boolean(
    state.live?.sessionCode &&
    (state.live?.sessionActive || state.live?.teamScreen === "finished")
  );

  function refreshConnectedTokens() {
    setConnectedTokens([...connectionsRef.current.keys()]);
  }

  function sendSnapshot(teamToken, conn) {
    if (!conn?.open) return;
    try {
      let mediaCache = mediaCacheRef.current.get(teamToken);
      if (!mediaCache) {
        mediaCache = new Map();
        mediaCacheRef.current.set(teamToken, mediaCache);
      }
      const snapshot = buildTeamSnapshot(stateRef.current, teamToken);
      conn.send(dedupeSnapshotMedia(snapshot, mediaCache));
    } catch {
      // Connection cleanup is handled by PeerJS close/error events.
    }
  }

  useEffect(() => {
    if (!networkEnabled) {
      setStatus("offline");
      connectionsRef.current.forEach((conn) => conn.close());
      connectionsRef.current.clear();
      mediaCacheRef.current.clear();
      refreshConnectedTokens();
      peerRef.current?.destroy();
      peerRef.current = null;
      return undefined;
    }

    let cancelled = false;
    let reconnectTimer;
    setStatus("connecting");

    loadPeerJs()
      .then((Peer) => {
        if (cancelled) return;
        const peer = new Peer(peerIdForSession(state.live.sessionCode));
        peerRef.current = peer;

        peer.on("open", () => setStatus("online"));
        peer.on("disconnected", () => {
          if (cancelled) return;
          setStatus("reconnecting");
          reconnectTimer = window.setTimeout(() => {
            try {
              if (!peer.destroyed && peer.disconnected) peer.reconnect();
            } catch {
              setStatus("error");
            }
          }, 1200);
        });
        peer.on("error", (error) => {
          setStatus(error?.type === "unavailable-id" ? "code-conflict" : "error");
        });

        peer.on("connection", (conn) => {
          let teamToken = "";

          conn.on("data", (message) => {
            if (!message || typeof message !== "object") return;

            if (message.type === "hello") {
              const token = String(message.teamToken ?? "");
              const validTeam = stateRef.current.teams.some((item) => item.token === token);
              if (!validTeam) {
                conn.send({ type: "rejected", reason: "This team QR code is no longer valid." });
                conn.close();
                return;
              }
              teamToken = token;
              const previous = connectionsRef.current.get(teamToken);
              if (previous && previous !== conn) previous.close();
              connectionsRef.current.set(teamToken, conn);
              mediaCacheRef.current.delete(teamToken);
              refreshConnectedTokens();
              sendSnapshot(teamToken, conn);
              return;
            }

            if (!teamToken) return;
            updateRef.current((current) => applyTeamMessage(current, teamToken, message));
          });

          const cleanup = () => {
            if (teamToken && connectionsRef.current.get(teamToken) === conn) {
              connectionsRef.current.delete(teamToken);
              mediaCacheRef.current.delete(teamToken);
              refreshConnectedTokens();
            }
          };
          conn.on("close", cleanup);
          conn.on("error", cleanup);
        });
      })
      .catch(() => setStatus("error"));

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectTimer);
      connectionsRef.current.forEach((conn) => conn.close());
      connectionsRef.current.clear();
      refreshConnectedTokens();
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [networkEnabled, state.live?.sessionCode]);

  useEffect(() => {
    const previous = previousStateRef.current;
    previousStateRef.current = state;

    if (!state.live?.sessionActive && state.live?.teamScreen !== "finished") return;

    const answersOnlyChanged = Boolean(
      previous
      && previous.answers !== state.answers
      && previous.live === state.live
      && previous.quizzes === state.quizzes
      && previous.teams === state.teams
    );

    if (answersOnlyChanged && !["leaderboard", "final"].includes(state.live?.teamScreen)) {
      const changedTeamIds = changedAnswerTeamIds(previous.answers, state.answers);
      for (const team of state.teams ?? []) {
        if (!changedTeamIds.has(team.id)) continue;
        const conn = connectionsRef.current.get(team.token);
        if (conn) sendSnapshot(team.token, conn);
      }
      return;
    }

    for (const [token, conn] of connectionsRef.current.entries()) {
      sendSnapshot(token, conn);
    }
  }, [state]);

  useEffect(() => {
    if (!state.live?.timerActive || !state.live?.timerEndsAt || !state.live?.timerRoundId) return undefined;
    const wait = Math.max(0, Number(state.live.timerEndsAt) - Date.now());
    const timeout = window.setTimeout(() => {
      updateRef.current((current) => {
        if (!current.live?.timerActive || current.live.timerRoundId !== state.live.timerRoundId) return current;
        return {
          ...current,
          live: {
            ...current.live,
            timerActive: false,
            timerEndsAt: 0,
            forceLockedRounds: {
              ...(current.live.forceLockedRounds ?? {}),
              [current.live.timerRoundId]: true,
            },
            teamScreen: "round_locked",
          },
        };
      });
    }, wait);
    return () => window.clearTimeout(timeout);
  }, [state.live?.timerActive, state.live?.timerEndsAt, state.live?.timerRoundId]);

  return {
    status,
    connectedTokens,
    connectedCount: connectedTokens.length,
  };
}
