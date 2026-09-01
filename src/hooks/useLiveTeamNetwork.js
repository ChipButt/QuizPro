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

export function useLiveTeamNetwork(sessionCode, teamToken) {
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const connectionRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
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
  }, [sessionCode, teamToken]);

  const send = useCallback((message) => {
    const conn = connectionRef.current;
    if (!conn?.open) return false;
    conn.send(message);
    return true;
  }, []);

  return { snapshot, status, error, send };
}
