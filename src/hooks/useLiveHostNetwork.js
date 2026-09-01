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

export function useLiveHostNetwork(state, updateState) {
  const stateRef = useRef(state);
  const updateRef = useRef(updateState);
  const peerRef = useRef(null);
  const connectionsRef = useRef(new Map());
  const [status, setStatus] = useState("offline");
  const [connectedTokens, setConnectedTokens] = useState([]);

  stateRef.current = state;
  updateRef.current = updateState;

  function refreshConnectedTokens() {
    setConnectedTokens([...connectionsRef.current.keys()]);
  }

  function sendSnapshot(teamToken, conn) {
    if (!conn?.open) return;
    try {
      conn.send(buildTeamSnapshot(stateRef.current, teamToken));
    } catch {
      // Connection cleanup is handled by PeerJS close/error events.
    }
  }

  useEffect(() => {
    if (!state.live?.sessionActive || !state.live?.sessionCode) {
      setStatus("offline");
      connectionsRef.current.forEach((conn) => conn.close());
      connectionsRef.current.clear();
      refreshConnectedTokens();
      peerRef.current?.destroy();
      peerRef.current = null;
      return undefined;
    }

    let cancelled = false;
    setStatus("connecting");

    loadPeerJs()
      .then((Peer) => {
        if (cancelled) return;
        const peer = new Peer(peerIdForSession(state.live.sessionCode));
        peerRef.current = peer;

        peer.on("open", () => setStatus("online"));
        peer.on("disconnected", () => setStatus("reconnecting"));
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
      connectionsRef.current.forEach((conn) => conn.close());
      connectionsRef.current.clear();
      refreshConnectedTokens();
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [state.live?.sessionActive, state.live?.sessionCode]);

  useEffect(() => {
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
