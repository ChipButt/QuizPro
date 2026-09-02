import { CheckCircle2, RefreshCcw, Smartphone, Wifi, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { createSessionCode } from "../utils/liveSession.js";

const PEERJS_CDN = "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js";
let peerPromise;

function loadPeerJs() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (peerPromise) return peerPromise;
  peerPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PEERJS_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => (window.Peer ? resolve(window.Peer) : reject(new Error("Device sync could not start."))), { once: true });
      existing.addEventListener("error", () => reject(new Error("Device sync could not start.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = PEERJS_CDN;
    script.async = true;
    script.onload = () => (window.Peer ? resolve(window.Peer) : reject(new Error("Device sync could not start.")));
    script.onerror = () => reject(new Error("Device sync could not start."));
    document.head.appendChild(script);
  });
  return peerPromise;
}

function peerIdForSync(code) {
  return `quizpro-library-${String(code || "").toLowerCase()}`;
}

function buildLibraryPayload(state) {
  return JSON.stringify({
    version: 1,
    selectedQuizId: state.selectedQuizId ?? "",
    quizzes: Array.isArray(state.quizzes) ? state.quizzes : [],
    media: Array.isArray(state.media) ? state.media : [],
  });
}

function sendLibrary(conn, state) {
  const text = buildLibraryPayload(state);
  const chunkSize = 12000;
  const total = Math.max(1, Math.ceil(text.length / chunkSize));
  conn.send({ type: "library-sync-start", total, quizCount: state.quizzes?.length ?? 0 });
  for (let index = 0; index < total; index += 1) {
    conn.send({ type: "library-sync-chunk", index, data: text.slice(index * chunkSize, (index + 1) * chunkSize) });
  }
  conn.send({ type: "library-sync-complete", total });
}

function mergeById(current = [], incoming = []) {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...current.filter((item) => !incomingIds.has(item.id)), ...incoming];
}

export function LibrarySyncHost({ state }) {
  const [code, setCode] = useState(() => createSessionCode(8));
  const [status, setStatus] = useState("starting");
  const [lastSent, setLastSent] = useState("");
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    let peer;
    setStatus("starting");

    loadPeerJs()
      .then((Peer) => {
        if (cancelled) return;
        peer = new Peer(peerIdForSync(code));
        peer.on("open", () => setStatus("ready"));
        peer.on("error", (error) => setStatus(error?.type === "unavailable-id" ? "conflict" : "error"));
        peer.on("connection", (conn) => {
          conn.on("data", (message) => {
            if (message?.type !== "request-library") return;
            sendLibrary(conn, stateRef.current);
            setLastSent(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          });
        });
      })
      .catch(() => setStatus("error"));

    return () => {
      cancelled = true;
      peer?.destroy();
    };
  }, [code]);

  const syncUrl = `${window.location.origin}${window.location.pathname}#/sync/${code}`;

  return (
    <div style={{ margin: "12px 28px 0", padding: "14px 16px", border: "1px solid var(--border, #d9dee8)", borderRadius: 14, background: "var(--panel, #fff)", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16, alignItems: "center" }}>
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: "block", marginBottom: 4 }}>Use this quiz library on another device</strong>
        <span style={{ opacity: 0.72, fontSize: 14 }}>
          Quizzes are kept safely in this browser. To copy your current library to your phone or another computer, scan this QR while this page is open.
        </span>
        <div style={{ marginTop: 9, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12, fontWeight: 800 }}>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {status === "ready" ? <Wifi size={14} /> : <WifiOff size={14} />}
            {status === "ready" ? "Ready to sync" : status === "starting" ? "Starting sync…" : status === "conflict" ? "Code in use" : "Sync unavailable"}
          </span>
          <span>{state.quizzes?.length ?? 0} quiz{(state.quizzes?.length ?? 0) === 1 ? "" : "zes"}</span>
          {lastSent ? <span>Last copied at {lastSent}</span> : null}
          <button className="text-button" type="button" onClick={() => setCode(createSessionCode(8))}><RefreshCcw size={13} /> New sync QR</button>
        </div>
      </div>
      <div style={{ display: "grid", placeItems: "center", gap: 5, padding: 8, background: "#fff", border: "1px solid var(--line)", borderRadius: 10 }}>
        <QRCodeSVG value={syncUrl} size={108} marginSize={1} />
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)" }}><Smartphone size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Scan on other device</span>
      </div>
    </div>
  );
}

export function LibrarySyncReceiver({ code, updateState }) {
  const [status, setStatus] = useState("connecting");
  const [detail, setDetail] = useState("Connecting to the device that has your quiz library…");
  const chunksRef = useRef([]);
  const totalRef = useRef(0);
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setDetail("This sync link is incomplete. Scan a fresh library QR from the Quizzes page.");
      return undefined;
    }

    let cancelled = false;
    let peer;
    let conn;

    function applyIfComplete() {
      if (appliedRef.current || !totalRef.current) return;
      const chunks = chunksRef.current;
      if (chunks.filter((item) => typeof item === "string").length !== totalRef.current) return;
      try {
        const payload = JSON.parse(chunks.join(""));
        const quizzes = Array.isArray(payload.quizzes) ? payload.quizzes : [];
        const media = Array.isArray(payload.media) ? payload.media : [];
        updateState((current) => ({
          ...current,
          quizzes: mergeById(current.quizzes, quizzes),
          media: mergeById(current.media, media),
          selectedQuizId: quizzes.some((quiz) => quiz.id === payload.selectedQuizId)
            ? payload.selectedQuizId
            : quizzes[0]?.id || current.selectedQuizId,
        }));
        appliedRef.current = true;
        setStatus("done");
        setDetail(`${quizzes.length} quiz${quizzes.length === 1 ? "" : "zes"} copied to this device. They are now saved here and ready to run.`);
      } catch {
        setStatus("error");
        setDetail("The quiz library arrived incomplete. Keep the other device open and scan its sync QR again.");
      }
    }

    loadPeerJs()
      .then((Peer) => {
        if (cancelled) return;
        peer = new Peer();
        peer.on("open", () => {
          if (cancelled) return;
          conn = peer.connect(peerIdForSync(code), { reliable: true });
          conn.on("open", () => {
            setDetail("Connected. Copying your quiz library…");
            conn.send({ type: "request-library" });
          });
          conn.on("data", (message) => {
            if (!message || typeof message !== "object") return;
            if (message.type === "library-sync-start") {
              totalRef.current = Number(message.total) || 0;
              chunksRef.current = new Array(totalRef.current);
              setDetail(`Copying ${message.quizCount ?? "your"} quiz${Number(message.quizCount) === 1 ? "" : "zes"}…`);
              return;
            }
            if (message.type === "library-sync-chunk") {
              chunksRef.current[Number(message.index)] = String(message.data ?? "");
              applyIfComplete();
              return;
            }
            if (message.type === "library-sync-complete") applyIfComplete();
          });
          conn.on("error", () => {
            if (!appliedRef.current) {
              setStatus("error");
              setDetail("The connection was interrupted. Keep the other device on its Quizzes page and scan the QR again.");
            }
          });
        });
        peer.on("error", () => {
          if (!appliedRef.current) {
            setStatus("error");
            setDetail("Could not reach the device holding your quiz library. Make sure its Quizzes page is still open and showing the sync QR.");
          }
        });
      })
      .catch(() => {
        setStatus("error");
        setDetail("Device sync could not start on this browser.");
      });

    return () => {
      cancelled = true;
      conn?.close();
      peer?.destroy();
    };
  }, [code, updateState]);

  return (
    <main className="team-page live-team-page">
      <div className="phone-shell live-phone-shell" style={{ display: "grid", placeItems: "center", padding: 20 }}>
        <section className="team-card live-team-card connection-card" style={{ width: "100%", maxWidth: 500 }}>
          {status === "done" ? <CheckCircle2 size={42} /> : status === "error" ? <WifiOff size={42} /> : <Wifi size={42} />}
          <h1>{status === "done" ? "Quiz library copied" : status === "error" ? "Could not sync library" : "Syncing quiz library"}</h1>
          <p>{detail}</p>
          {status === "done" ? <button className="primary-button full-width" onClick={() => { window.location.hash = "#/host"; }}>Open Quizmaster</button> : null}
        </section>
      </div>
    </main>
  );
}
