import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crown,
  KeyRound,
  Lightbulb,
  Lock,
  RotateCcw,
  Trophy,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveTeamNetwork } from "../hooks/useLiveTeamNetwork.js";
const QUIZ_IN_LOGO_SOURCE = "/QuizPro/Quiz%20In%20Logo.png";

function QuizInLogo({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.src = QUIZ_IN_LOGO_SOURCE;

    image.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const maxWidth = 1024;
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const pixels = context.getImageData(0, 0, width, height);
      const data = pixels.data;

      for (let index = 0; index < data.length; index += 4) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const dominance = green - Math.max(red, blue);

        if (green > 115 && dominance > 38) {
          if (green > 175 && dominance > 82 && red < 150 && blue < 150) {
            data[index + 3] = 0;
          } else {
            const alpha = Math.max(0, Math.min(255, 255 - ((dominance - 38) / 44) * 255));
            data[index + 3] = Math.min(data[index + 3], alpha);
            if (alpha > 0) data[index + 1] = Math.min(green, Math.max(red, blue));
          }
        }
      }

      context.putImageData(pixels, 0, 0);
    };

    return () => {
      cancelled = true;
      image.onload = null;
    };
  }, []);

  return <canvas ref={canvasRef} className={className} role="img" aria-label="Quiz In" />;
}

function TeamChrome({ children, status, keyboardActive = false, rail = null, pageClass = "" }) {
  const connectionLabel = status === "online"
    ? "Connected to Quiz Host"
    : status === "reconnecting"
      ? "Reconnecting to Quiz Host"
      : status === "connecting"
        ? "Connecting to Quiz Host"
        : "Quiz Host connection unavailable";

  return (
    <main className={`team-page live-team-page ${pageClass} ${keyboardActive ? "keyboard-active-page" : ""}`}>
      <div className={`phone-shell live-phone-shell ${pageClass} ${keyboardActive ? "keyboard-active" : ""}`}>
        <header className="phone-topbar live-phone-topbar">
          <QuizInLogo className="team-global-logo" />
        </header>
        {children}
        {rail}
        <div className={`team-connection-note ${status === "online" ? "connected" : "not-connected"}`}>
          {connectionLabel}
        </div>
      </div>
    </main>
  );
}

function LeaderboardRail({ leaderboard, ownId }) {
  const teams = leaderboard ?? [];
  return (
    <aside className="gs-rail">
      <div className="gs-rail-head">
        <Trophy size={26} />
        <h2>Leaderboard</h2>
      </div>
      {teams.length ? (
        <ol className="gs-rankings">
          {teams.map((team, index) => (
            <li key={team.id} className={team.id === ownId ? "ours" : ""}>
              <span>{index + 1}</span>
              <strong>{team.name || "Unnamed team"}</strong>
              <b>{formatScore(team.score)}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="gs-rail-empty">Scores appear once the quizmaster releases them.</p>
      )}
    </aside>
  );
}

function useCountdown(endsAt, active) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active || !endsAt) {
      setSeconds(0);
      return undefined;
    }
    const tick = () => setSeconds(Math.max(0, Math.ceil((Number(endsAt) - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [active, endsAt]);
  return seconds;
}

function useVisibleViewportHeight() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const height = Math.max(320, Math.round(viewport?.height ?? window.innerHeight));
      document.documentElement.style.setProperty("--team-visible-height", `${height}px`);
    };

    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--team-visible-height");
    };
  }, []);
}

function formatScore(value) {
  const number = Number(value ?? 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, "");
}

function ConnectionScreen({ status, error }) {
  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card connection-card">
        {status === "error" ? <WifiOff size={36} /> : <Wifi size={36} />}
        <h1>{status === "error" ? "Team link unavailable" : "Connecting…"}</h1>
        {error ? <p>{error}</p> : null}
      </section>
    </TeamChrome>
  );
}

function TeamNameTableIcon() {
  return (
    <svg className="team-meta-svg" viewBox="0 0 72 72" aria-hidden="true">
      <defs>
        <linearGradient id="tableTop" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#36d7ff" />
          <stop offset="52%" stopColor="#0aa8ff" />
          <stop offset="100%" stopColor="#0869ee" />
        </linearGradient>
        <linearGradient id="tableLeg" x1="0" x2="1">
          <stop offset="0%" stopColor="#0877f2" />
          <stop offset="55%" stopColor="#18bfff" />
          <stop offset="100%" stopColor="#064cc9" />
        </linearGradient>
      </defs>
      <path className="team-icon-glow" d="M14 25c0-8 10-14 22-14s22 6 22 14-10 14-22 14-22-6-22-14Z" />
      <path className="team-table-leg" d="M22 37 18 58" />
      <path className="team-table-leg" d="M36 39v22" />
      <path className="team-table-leg" d="m50 37 4 21" />
      <ellipse cx="36" cy="25" rx="23" ry="13" fill="url(#tableTop)" />
      <ellipse cx="36" cy="23" rx="19" ry="8.5" fill="#49dbff" opacity=".42" />
      <path d="M17 27c5 7 33 10 39-1" fill="none" stroke="#0758d9" strokeWidth="4" strokeLinecap="round" opacity=".72" />
    </svg>
  );
}

function TeamNamePlayersIcon() {
  return (
    <svg className="team-meta-svg" viewBox="0 0 72 72" aria-hidden="true">
      <defs>
        <linearGradient id="peopleBlue" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#38d9ff" />
          <stop offset="45%" stopColor="#109fff" />
          <stop offset="100%" stopColor="#0752dc" />
        </linearGradient>
      </defs>
      <circle className="team-icon-glow-fill" cx="19" cy="28" r="9" />
      <circle className="team-icon-glow-fill" cx="53" cy="28" r="9" />
      <circle className="team-icon-glow-fill" cx="36" cy="22" r="12" />
      <path className="team-icon-glow-fill" d="M8 55c0-11 5-18 13-18s13 7 13 18v5H8Z" />
      <path className="team-icon-glow-fill" d="M38 55c0-11 5-18 13-18s13 7 13 18v5H38Z" />
      <path className="team-icon-glow-fill" d="M18 57c0-15 7-24 18-24s18 9 18 24v6H18Z" />
      <circle cx="19" cy="28" r="8" fill="url(#peopleBlue)" />
      <circle cx="53" cy="28" r="8" fill="url(#peopleBlue)" />
      <circle cx="36" cy="22" r="11" fill="url(#peopleBlue)" />
      <path d="M9 55c0-10 5-17 12-17s12 7 12 17v4H9Z" fill="url(#peopleBlue)" />
      <path d="M39 55c0-10 5-17 12-17s12 7 12 17v4H39Z" fill="url(#peopleBlue)" />
      <path d="M19 57c0-14 6-23 17-23s17 9 17 23v5H19Z" fill="url(#peopleBlue)" />
      <path d="M29 13c3-3 11-4 15 0" fill="none" stroke="#7ceaff" strokeWidth="3" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

function TeamNamePencilIcon() {
  return (
    <svg className="team-name-pencil-svg" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="pencilBlue" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#54e4ff" />
          <stop offset="48%" stopColor="#159fff" />
          <stop offset="100%" stopColor="#0753db" />
        </linearGradient>
        <linearGradient id="pencilMetal" x1="0" x2="1">
          <stop offset="0%" stopColor="#d6edff" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#85bff1" />
        </linearGradient>
      </defs>
      <g transform="rotate(-43 32 32)">
        <path d="M27 10h10a5 5 0 0 1 5 5v31H22V15a5 5 0 0 1 5-5Z" fill="url(#pencilBlue)" />
        <path d="M22 19h20v7H22Z" fill="url(#pencilMetal)" />
        <path d="m22 46 10 14 10-14Z" fill="#f7e8d4" />
        <path d="m28 54 4 6 4-6Z" fill="#0a42a5" />
        <path d="M27 12h4v31h-4Z" fill="#8bedff" opacity=".72" />
        <path d="M23 15a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v31" fill="none" stroke="#b9f4ff" strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
      </g>
    </svg>
  );
}

function TeamNameScreen({ snapshot, send, status }) {
  const [name, setName] = useState("");

  function submit(event) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    send({ type: "set-team-name", name: clean });
  }

  return (
    <TeamChrome status={status} pageClass="team-name-screen">
      <section className="team-name-stage">
        <header className="team-name-hero">
          <span className="team-name-doodle question-mark" aria-hidden="true">?</span>
          <QuizInLogo className="quiz-in-logo-asset" />
        </header>

        <div className="team-name-meta-grid">
          <div className="team-name-meta-card">
            <span className="team-meta-icon coded-icon" aria-hidden="true"><TeamNameTableIcon /></span>
            <div>
              <span>TABLE</span>
              <strong>{snapshot.team?.table || "—"}</strong>
            </div>
          </div>

          <div className="team-name-meta-card">
            <span className="team-meta-icon coded-icon" aria-hidden="true"><TeamNamePlayersIcon /></span>
            <div>
              <span>PLAYERS</span>
              <strong>{snapshot.team?.players || 1}</strong>
            </div>
          </div>
        </div>

        <div className="team-name-prompt">
          <Crown className="team-name-crown" size={58} strokeWidth={2.7} />
          <h1>
            <span>Give your</span>
            <span><em>team</em> a name</span>
          </h1>
          <p>Something clever? Funny?<br />Or just your usual suspects?</p>
        </div>

        <form className="team-name-form team-name-form-v2" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="team-name">Team name</label>
          <div className="team-name-input-shell">
            <input
              id="team-name"
              autoFocus
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Team name..."
            />
            <span className="team-name-pencil-v2" aria-hidden="true"><TeamNamePencilIcon /></span>
          </div>
          <button className="team-name-lock-button" disabled={!name.trim()}>
            <Lock size={24} strokeWidth={3} />
            <span>LOCK IN TEAM NAME</span>
          </button>
        </form>

        <footer className="team-name-footer" aria-hidden="true">
          <span>PEOPLE</span><i /><span>QUESTIONS</span><i /><span>GOOD TIMES</span>
        </footer>
      </section>
    </TeamChrome>
  );
}


function WaitingScreen({ snapshot, status }) {
  const facts = snapshot.waitingFacts ?? [];
  const seed = String(snapshot.team?.id || snapshot.team?.name || "quiz")
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  const [factIndex, setFactIndex] = useState(facts.length ? seed % facts.length : 0);

  useEffect(() => {
    if (facts.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setFactIndex((index) => (index + 1) % facts.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [facts.length]);

  useEffect(() => {
    if (facts.length && factIndex >= facts.length) setFactIndex(0);
  }, [facts.length, factIndex]);

  const scores = snapshot.roundScores ?? [];
  const liveRoundIndex = Number(snapshot.live?.roundIndex ?? 0);
  const totalRounds = Number(snapshot.quiz?.totalRounds ?? 0);
  const screen = snapshot.live?.teamScreen ?? "lobby";
  const beforeFirstRound = liveRoundIndex === 0 && Number(snapshot.live?.questionIndex ?? -1) < 0 && scores.length === 0;
  const awaitingAnswerReview = screen === "round_locked" && !snapshot.round?.reviewComplete;
  const afterFinalRound = screen === "round_locked" && totalRounds > 0 && liveRoundIndex >= totalRounds - 1 && !awaitingAnswerReview;
  const heading = awaitingAnswerReview
    ? "The Answers Will Be Reviewed Soon"
    : afterFinalRound
      ? "The Results Will Be Announced Soon"
      : beforeFirstRound
        ? "The Quiz Will Begin Soon"
        : "The Next Round Will Start Soon";
  const fact = facts.length ? facts[factIndex % facts.length] : "";

  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card waiting-team-card">
        <div className="waiting-team-banner">
          <div className="waiting-team-name">
            <span>TEAM NAME</span>
            <strong>{snapshot.team.name}</strong>
          </div>
          <div className="waiting-team-meta">
            <div><span>TABLE</span><strong>{snapshot.team.table || "—"}</strong></div>
            <div><span>PLAYERS</span><strong>{snapshot.team.players || 1}</strong></div>
          </div>
        </div>

        <div className="waiting-headline">
          <span>{awaitingAnswerReview ? "ROUND COMPLETE" : afterFinalRound ? "QUIZ COMPLETE" : beforeFirstRound ? "GET READY" : "BETWEEN ROUNDS"}</span>
          <h1>{heading}</h1>
        </div>

        {!afterFinalRound && !awaitingAnswerReview && snapshot.nextRound ? (
          <div className="waiting-next-round">
            <span>NEXT UP · ROUND {snapshot.nextRound.number}</span>
            <strong>{snapshot.nextRound.title}</strong>
            <small>Get ready. The Quizmaster will start the round shortly.</small>
          </div>
        ) : null}

        {scores.length ? (
          <div className="waiting-score-panel">
            <div className="waiting-score-heading">
              <div><span>UNREVIEWED SCORES</span><strong>Your score so far</strong></div>
              <small>The Quizmaster can still adjust marks.</small>
            </div>
            <div className="waiting-round-scores">
              {scores.map((round) => (
                <div className="waiting-round-score" key={round.id}>
                  <div><span>ROUND {round.number}</span><strong>{round.title}</strong></div>
                  <b>{formatScore(round.score)} <small>/ {formatScore(round.max)}</small></b>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {fact ? (
          <div className="waiting-fun-fact waiting-fun-fact-v2" key={`${factIndex}-${fact}`}>
            <div className="waiting-fact-bulb-stage">
              <Lightbulb className="waiting-fact-bulb" strokeWidth={2.15} />
              <div className="waiting-fact-copy">
                <span>FUN FACT</span>
                <strong>{fact}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </TeamChrome>
  );
}

function LeaderboardScreen({ snapshot, status }) {
  const ownId = snapshot.team?.id;
  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card team-leaderboard-card">
        <Trophy size={34} />
        <h1>Leaderboard</h1>
        <ol className="team-live-leaderboard">
          {snapshot.leaderboard.map((team, index) => (
            <li key={team.id} className={team.id === ownId ? "ours" : ""}>
              <span>{index + 1}</span><strong>{team.name}</strong><b>{team.score}</b>
            </li>
          ))}
        </ol>
      </section>
    </TeamChrome>
  );
}

function FinalScreen({ snapshot, status }) {
  const count = Number(snapshot.live?.finalRevealCount ?? 0);
  const full = snapshot.leaderboard ?? [];
  const revealed = full.slice().reverse().slice(0, count);
  return (
    <TeamChrome status={status}>
      <section className="team-card live-team-card team-final-card">
        <Trophy size={40} />
        <h1>Final results</h1>
        <div className="team-final-list">
          {revealed.map((team) => {
            const place = full.findIndex((item) => item.id === team.id) + 1;
            return (
              <div key={team.id} className={place === 1 ? "winner" : ""}>
                <span>{place}</span><strong>{team.name || "Unnamed team"}</strong><b>{team.score} pts</b>
              </div>
            );
          })}
        </div>
      </section>
    </TeamChrome>
  );
}

export default function TeamView({ sessionCode, teamToken }) {
  useVisibleViewportHeight();
  const { snapshot, status, error, send } = useLiveTeamNetwork(sessionCode, teamToken);

  useEffect(() => {
    if (sessionCode !== "__PREVIEW__") return undefined;

    const root = document.querySelector(".live-phone-shell");
    if (!root) return undefined;

    const storageVersion = teamToken === "question" ? "v5" : teamToken === "timer" ? "v6" : ["waiting", "between-rounds"].includes(teamToken) ? "v3" : ["team-name", "multiple-choice", "answer-reveal", "locked"].includes(teamToken) ? "v2" : "v1";
    const storageKey = `quiz-layout-${storageVersion}:${teamToken || "preview"}`;
    let editEnabled = false;
    let selectedPath = "";
    let layout = {};
    let dragState = null;

    const overlay = document.createElement("div");
    overlay.className = "quiz-layout-overlay";
    overlay.innerHTML = `
      <div class="quiz-layout-overlay-label"></div>
      <button type="button" class="quiz-layout-handle quiz-layout-handle-x" data-resize="x" aria-label="Resize width"></button>
      <button type="button" class="quiz-layout-handle quiz-layout-handle-y" data-resize="y" aria-label="Resize height"></button>
      <button type="button" class="quiz-layout-handle quiz-layout-handle-both" data-resize="both" aria-label="Resize width and height"></button>
    `;
    document.body.appendChild(overlay);

    try {
      layout = JSON.parse(window.localStorage.getItem(storageKey) || "{}") || {};
    } catch {
      layout = {};
    }

    const saveLayout = () => {
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
    };

    const elementPath = (element) => {
      if (!element || element === root) return ":scope";
      const parts = [];
      let node = element;

      while (node && node !== root) {
        const parent = node.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children).filter((item) => item.tagName === node.tagName);
        const index = siblings.indexOf(node) + 1;
        parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${Math.max(1, index)})`);
        node = parent;
      }
      return parts.join(" > ");
    };

    const findByPath = (path) => {
      if (!path || path === ":scope") return root;
      try {
        return root.querySelector(path);
      } catch {
        return null;
      }
    };

    const describeElement = (element) => {
      const className = String(element?.className?.baseVal ?? element?.className ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join(".");
      const text = String(element?.innerText ?? element?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 34);
      const name = element?.tagName?.toLowerCase() || "element";
      return text ? `${name}${className ? `.${className}` : ""} · ${text}` : `${name}${className ? `.${className}` : ""}`;
    };

    const clearSelectionClasses = () => {
      root.querySelectorAll(".quiz-layout-selected,.quiz-layout-locked").forEach((element) => {
        element.classList.remove("quiz-layout-selected", "quiz-layout-locked");
      });
    };

    const updateOverlay = () => {
      if (!editEnabled || !selectedPath) {
        overlay.classList.remove("visible", "locked");
        return;
      }

      const element = findByPath(selectedPath);
      if (!element) {
        overlay.classList.remove("visible", "locked");
        return;
      }

      const rect = element.getBoundingClientRect();
      const locked = Boolean(layout[selectedPath]?.locked);
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${Math.max(1, rect.width)}px`;
      overlay.style.height = `${Math.max(1, rect.height)}px`;
      overlay.classList.add("visible");
      overlay.classList.toggle("locked", locked);

      const label = overlay.querySelector(".quiz-layout-overlay-label");
      if (label) label.textContent = locked ? "LOCKED" : "DRAG TO MOVE";
    };

    const applyRecord = (element, record = {}) => {
      if (!element) return;
      element.style.setProperty("--layout-editor-x", `${Number(record.x || 0)}px`);
      element.style.setProperty("--layout-editor-y", `${Number(record.y || 0)}px`);
      element.classList.add("quiz-layout-overridden");

      if (Number.isFinite(Number(record.width)) && Number(record.width) > 0) {
        element.style.setProperty("width", `${Number(record.width)}px`, "important");
        element.style.setProperty("min-width", "0", "important");
        element.style.setProperty("max-width", "none", "important");
      }
      if (Number.isFinite(Number(record.height)) && Number(record.height) > 0) {
        element.style.setProperty("height", `${Number(record.height)}px`, "important");
        element.style.setProperty("min-height", "0", "important");
        element.style.setProperty("max-height", "none", "important");
      }
      if (Number.isFinite(Number(record.fontSize)) && Number(record.fontSize) > 0) {
        element.style.fontSize = `${Number(record.fontSize)}px`;
      }
      if (Number.isFinite(Number(record.zIndex))) {
        const computedPosition = window.getComputedStyle(element).position;
        if (computedPosition === "static") element.classList.add("quiz-layout-layered");
        element.style.zIndex = String(Math.round(Number(record.zIndex)));
      }
    };

    const clearRecordStyles = (element) => {
      if (!element) return;
      element.classList.remove("quiz-layout-overridden", "quiz-layout-selected", "quiz-layout-locked", "quiz-layout-layered");
      element.style.removeProperty("--layout-editor-x");
      element.style.removeProperty("--layout-editor-y");
      element.style.removeProperty("width");
      element.style.removeProperty("height");
      element.style.removeProperty("min-width");
      element.style.removeProperty("min-height");
      element.style.removeProperty("max-width");
      element.style.removeProperty("max-height");
      element.style.removeProperty("font-size");
      element.style.removeProperty("z-index");
    };

    const applyAll = () => {
      Object.entries(layout).forEach(([path, record]) => {
        const element = findByPath(path);
        if (element) applyRecord(element, record);
      });

      if (selectedPath) {
        const selected = findByPath(selectedPath);
        if (selected) {
          selected.classList.add("quiz-layout-selected");
          if (layout[selectedPath]?.locked) selected.classList.add("quiz-layout-locked");
        }
      }
      updateOverlay();
    };

    const readValues = (element, path) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      const record = layout[path] || {};
      return {
        x: Number(record.x || 0),
        y: Number(record.y || 0),
        width: Math.round(Number(record.width || rect.width)),
        height: Math.round(Number(record.height || rect.height)),
        fontSize: Math.round((Number(record.fontSize || parseFloat(styles.fontSize) || 16)) * 10) / 10,
        zIndex: Number.isFinite(Number(record.zIndex))
          ? Math.round(Number(record.zIndex))
          : (styles.zIndex === "auto" ? 0 : Math.round(Number(styles.zIndex) || 0)),
        locked: Boolean(record.locked),
      };
    };

    const sendSelection = (element, path) => {
      const values = readValues(element, path);
      window.parent?.postMessage({
        type: "quiz-layout-selection",
        path,
        label: describeElement(element),
        ...values,
      }, window.location.origin);
    };

    const selectElement = (rawTarget) => {
      let element = rawTarget instanceof Element ? rawTarget : null;
      if (!element) return;

      if (element.closest(".team-timer-message")) element = element.closest(".team-timer-message");
      else if (element.closest(".team-timer-clock")) element = element.closest(".team-timer-clock");
      else if (element.closest(".team-timer-clock-wrap")) element = element.closest(".team-timer-clock-wrap");
      else if (element.closest("svg")) element = element.closest("svg");
      if (!root.contains(element) || element === root) return;

      clearSelectionClasses();
      selectedPath = elementPath(element);
      element.classList.add("quiz-layout-selected");
      if (layout[selectedPath]?.locked) element.classList.add("quiz-layout-locked");
      sendSelection(element, selectedPath);
      updateOverlay();
    };

    const beginDrag = (event, mode, path, element) => {
      const current = layout[path] || {};
      if (current.locked) return;

      const values = readValues(element, path);
      dragState = {
        mode,
        path,
        startX: event.clientX,
        startY: event.clientY,
        x: values.x,
        y: values.y,
        width: values.width,
        height: values.height,
      };
      document.documentElement.classList.add("quiz-layout-dragging");
      event.preventDefault();
      event.stopPropagation();
    };

    const onEditorPointerDown = (event) => {
      if (!editEnabled || event.button !== 0) return;
      let element = event.target instanceof Element ? event.target : null;
      if (!element || !root.contains(element) || element === root) return;
      if (element.closest(".team-timer-message")) element = element.closest(".team-timer-message");
      else if (element.closest(".team-timer-clock")) element = element.closest(".team-timer-clock");
      else if (element.closest(".team-timer-clock-wrap")) element = element.closest(".team-timer-clock-wrap");
      else if (element.closest("svg")) element = element.closest("svg");

      selectElement(element);
      if (layout[selectedPath]?.locked) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      beginDrag(event, "move", selectedPath, element);
    };

    const onPointerMove = (event) => {
      if (!dragState) return;
      const element = findByPath(dragState.path);
      if (!element) return;

      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      const current = layout[dragState.path] || {};

      if (dragState.mode === "move") {
        layout[dragState.path] = {
          ...current,
          x: Math.round(dragState.x + dx),
          y: Math.round(dragState.y + dy),
        };
      } else if (dragState.mode === "x") {
        layout[dragState.path] = {
          ...current,
          width: Math.max(18, Math.round(dragState.width + dx)),
        };
      } else if (dragState.mode === "y") {
        layout[dragState.path] = {
          ...current,
          height: Math.max(12, Math.round(dragState.height + dy)),
        };
      } else {
        layout[dragState.path] = {
          ...current,
          width: Math.max(18, Math.round(dragState.width + dx)),
          height: Math.max(12, Math.round(dragState.height + dy)),
        };
      }

      applyRecord(element, layout[dragState.path]);
      updateOverlay();
      sendSelection(element, dragState.path);
      event.preventDefault();
    };

    const onPointerUp = () => {
      if (!dragState) return;
      saveLayout();
      const element = findByPath(dragState.path);
      if (element) sendSelection(element, dragState.path);
      dragState = null;
      document.documentElement.classList.remove("quiz-layout-dragging");
      updateOverlay();
    };

    const onHandlePointerDown = (event) => {
      if (!editEnabled || !selectedPath || event.button !== 0) return;
      const element = findByPath(selectedPath);
      if (!element || layout[selectedPath]?.locked) return;
      const mode = event.currentTarget?.dataset?.resize || "both";
      beginDrag(event, mode, selectedPath, element);
    };

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data || {};

      if (message.type === "quiz-preview-style") {
        const bulb = Number(message.bulbSize);
        const factWidth = Number(message.factBoxWidth);
        const factX = Number(message.factBoxX);
        const factY = Number(message.factBoxY);
        if (Number.isFinite(bulb)) document.documentElement.style.setProperty("--preview-waiting-bulb-size", `${Math.max(220, Math.min(460, bulb))}px`);
        if (Number.isFinite(factWidth)) document.documentElement.style.setProperty("--preview-waiting-fact-width", `${Math.max(90, Math.min(260, factWidth))}px`);
        if (Number.isFinite(factX)) document.documentElement.style.setProperty("--preview-waiting-fact-x", `${Math.max(10, Math.min(90, factX))}%`);
        if (Number.isFinite(factY)) document.documentElement.style.setProperty("--preview-waiting-fact-y", `${Math.max(10, Math.min(90, factY))}%`);
        return;
      }

      if (message.type !== "quiz-layout-editor") return;

      if (message.action === "set-enabled") {
        editEnabled = Boolean(message.enabled);
        document.documentElement.classList.toggle("quiz-layout-editing", editEnabled);
        if (!editEnabled) {
          clearSelectionClasses();
          selectedPath = "";
          dragState = null;
          overlay.classList.remove("visible", "locked");
          window.parent?.postMessage({ type: "quiz-layout-selection-cleared" }, window.location.origin);
        } else {
          updateOverlay();
        }
        return;
      }

      if (message.action === "update-selected" && selectedPath) {
        const current = layout[selectedPath] || {};
        if (current.locked) return;
        layout[selectedPath] = {
          ...current,
          x: Number.isFinite(Number(message.values?.x)) ? Number(message.values.x) : Number(current.x || 0),
          y: Number.isFinite(Number(message.values?.y)) ? Number(message.values.y) : Number(current.y || 0),
          width: Number.isFinite(Number(message.values?.width)) ? Number(message.values.width) : current.width,
          height: Number.isFinite(Number(message.values?.height)) ? Number(message.values.height) : current.height,
          fontSize: Number.isFinite(Number(message.values?.fontSize)) ? Number(message.values.fontSize) : current.fontSize,
          zIndex: Number.isFinite(Number(message.values?.zIndex)) ? Math.round(Number(message.values.zIndex)) : current.zIndex,
        };
        saveLayout();
        const element = findByPath(selectedPath);
        applyRecord(element, layout[selectedPath]);
        updateOverlay();
        if (element) sendSelection(element, selectedPath);
        return;
      }

      if (message.action === "lock-selected" && selectedPath) {
        layout[selectedPath] = { ...(layout[selectedPath] || {}), locked: true };
        saveLayout();
        const element = findByPath(selectedPath);
        element?.classList.add("quiz-layout-locked");
        updateOverlay();
        if (element) sendSelection(element, selectedPath);
        return;
      }

      if (message.action === "unlock-selected" && selectedPath) {
        layout[selectedPath] = { ...(layout[selectedPath] || {}), locked: false };
        saveLayout();
        const element = findByPath(selectedPath);
        element?.classList.remove("quiz-layout-locked");
        updateOverlay();
        if (element) sendSelection(element, selectedPath);
        return;
      }

      if ((message.action === "layer-forward" || message.action === "layer-backward") && selectedPath) {
        const current = layout[selectedPath] || {};
        if (current.locked) return;
        const element = findByPath(selectedPath);
        if (!element) return;

        const styles = window.getComputedStyle(element);
        const currentLayer = Number.isFinite(Number(current.zIndex))
          ? Number(current.zIndex)
          : (styles.zIndex === "auto" ? 0 : Number(styles.zIndex) || 0);
        const delta = message.action === "layer-forward" ? 1 : -1;

        layout[selectedPath] = {
          ...current,
          zIndex: Math.round(currentLayer + delta),
        };
        saveLayout();
        applyRecord(element, layout[selectedPath]);
        updateOverlay();
        sendSelection(element, selectedPath);
        return;
      }

      if (message.action === "center-selected" && selectedPath) {
        const current = layout[selectedPath] || {};
        if (current.locked) return;
        const element = findByPath(selectedPath);
        if (!element) return;

        const rootRect = root.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const currentX = Number(current.x || 0);
        const deltaX = (rootRect.left + rootRect.width / 2) - (elementRect.left + elementRect.width / 2);

        layout[selectedPath] = {
          ...current,
          x: Math.round((currentX + deltaX) * 10) / 10,
        };
        saveLayout();
        applyRecord(element, layout[selectedPath]);
        updateOverlay();
        sendSelection(element, selectedPath);
        return;
      }

      if (message.action === "lock-all") {
        Object.keys(layout).forEach((path) => {
          layout[path] = { ...layout[path], locked: true };
        });
        saveLayout();
        applyAll();
        if (selectedPath) {
          const element = findByPath(selectedPath);
          if (element) sendSelection(element, selectedPath);
        }
        return;
      }

      if (message.action === "unlock-all") {
        Object.keys(layout).forEach((path) => {
          layout[path] = { ...layout[path], locked: false };
        });
        saveLayout();
        applyAll();
        if (selectedPath) {
          const element = findByPath(selectedPath);
          if (element) sendSelection(element, selectedPath);
        }
        return;
      }

      if (message.action === "reset-selected" && selectedPath) {
        const element = findByPath(selectedPath);
        clearRecordStyles(element);
        delete layout[selectedPath];
        saveLayout();
        if (element) {
          element.classList.add("quiz-layout-selected");
          sendSelection(element, selectedPath);
        }
        return;
      }

      if (message.action === "reset-page") {
        Object.keys(layout).forEach((path) => clearRecordStyles(findByPath(path)));
        layout = {};
        selectedPath = "";
        saveLayout();
        clearSelectionClasses();
        window.parent?.postMessage({ type: "quiz-layout-selection-cleared" }, window.location.origin);
        return;
      }

      if (message.action === "export") {
        const rootRect = root.getBoundingClientRect();
        const elements = Array.from(root.querySelectorAll("*"))
          .filter((element) => {
            if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
            if (element.closest(".quiz-layout-overlay")) return false;
            if (element instanceof SVGElement && element.tagName.toLowerCase() !== "svg") return false;
            const styles = window.getComputedStyle(element);
            if (styles.display === "none" || styles.visibility === "hidden") return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 2 && rect.height > 2;
          })
          .map((element) => {
            const path = elementPath(element);
            const rect = element.getBoundingClientRect();
            const styles = window.getComputedStyle(element);
            const record = layout[path] || {};
            return {
              path,
              label: describeElement(element),
              left: Math.round((rect.left - rootRect.left) * 10) / 10,
              top: Math.round((rect.top - rootRect.top) * 10) / 10,
              width: Math.round(rect.width * 10) / 10,
              height: Math.round(rect.height * 10) / 10,
              fontSize: Math.round((parseFloat(styles.fontSize) || 0) * 10) / 10,
              zIndex: Number.isFinite(Number(record.zIndex))
                ? Math.round(Number(record.zIndex))
                : (styles.zIndex === "auto" ? 0 : Math.round(Number(styles.zIndex) || 0)),
              x: Number(record.x || 0),
              y: Number(record.y || 0),
              locked: Boolean(record.locked),
              edited: Boolean(layout[path]),
            };
          });

        window.parent?.postMessage({
          type: "quiz-layout-export",
          version: 2,
          stage: teamToken || "preview",
          viewport: {
            width: Math.round(rootRect.width),
            height: Math.round(rootRect.height),
          },
          modified: layout,
          elements,
        }, window.location.origin);
      }
    };

    document.documentElement.classList.add("quiz-preview-mode");
    root.addEventListener("pointerdown", onEditorPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("resize", updateOverlay);
    window.addEventListener("scroll", updateOverlay, true);
    overlay.querySelectorAll(".quiz-layout-handle").forEach((handle) => {
      handle.addEventListener("pointerdown", onHandlePointerDown);
    });
    window.addEventListener("message", onMessage);

    const observer = new MutationObserver(() => window.requestAnimationFrame(applyAll));
    observer.observe(root, { childList: true, subtree: true });
    applyAll();

    window.parent?.postMessage({ type: "quiz-preview-ready" }, window.location.origin);

    return () => {
      observer.disconnect();
      root.removeEventListener("pointerdown", onEditorPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("resize", updateOverlay);
      window.removeEventListener("scroll", updateOverlay, true);
      overlay.querySelectorAll(".quiz-layout-handle").forEach((handle) => {
        handle.removeEventListener("pointerdown", onHandlePointerDown);
      });
      window.removeEventListener("message", onMessage);
      overlay.remove();
      document.documentElement.classList.remove("quiz-preview-mode", "quiz-layout-editing", "quiz-layout-dragging");
      clearSelectionClasses();
      document.documentElement.style.removeProperty("--preview-waiting-bulb-size");
      document.documentElement.style.removeProperty("--preview-waiting-fact-width");
      document.documentElement.style.removeProperty("--preview-waiting-fact-x");
      document.documentElement.style.removeProperty("--preview-waiting-fact-y");
    };
  }, [sessionCode, teamToken]);

  const [viewIndex, setViewIndex] = useState(0);
  const [drafts, setDrafts] = useState({});
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [newQuestionWaiting, setNewQuestionWaiting] = useState(false);
  const teamAudioRef = useRef(null);
  const lastPlayNonceRef = useRef(0);
  const viewIndexRef = useRef(0);
  const previousRoundIdRef = useRef("");
  const previousHostQuestionRef = useRef(-1);
  const countdownTick = useCountdown(snapshot?.live?.timerEndsAt, snapshot?.live?.timerActive);
  const timerEndsAt = Number(snapshot?.live?.timerEndsAt ?? 0);
  const countdown = snapshot?.live?.timerActive && countdownTick <= 0 && timerEndsAt > Date.now()
    ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000))
    : countdownTick;
  const timerDurationSeconds = Math.max(1, Number(snapshot?.live?.timerDurationSeconds ?? countdown ?? 1));
  const timerOverlayRef = useRef(null);

  useEffect(() => {
    const element = timerOverlayRef.current;
    if (!element) return undefined;

    const active = Boolean(snapshot?.live?.timerActive);
    const endsAt = Number(snapshot?.live?.timerEndsAt ?? 0);
    const durationMs = Math.max(1, Number(snapshot?.live?.timerDurationSeconds ?? 0)) * 1000;

    if (!active || !endsAt || !durationMs) {
      element.style.setProperty("--timer-fill-angle", "0deg");
      return undefined;
    }

    let frame = 0;
    const updateFill = () => {
      const remainingMs = Math.max(0, endsAt - Date.now());
      const progress = Math.max(0, Math.min(1, 1 - (remainingMs / durationMs)));
      element.style.setProperty("--timer-fill-angle", `${progress * 360}deg`);

      if (remainingMs > 0) {
        frame = window.requestAnimationFrame(updateFill);
      }
    };

    updateFill();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [snapshot?.live?.timerActive, snapshot?.live?.timerEndsAt, snapshot?.live?.timerDurationSeconds]);

  const questions = snapshot?.round?.questions ?? [];
  const hostQuestionIndex = Math.max(0, Number(snapshot?.live?.questionIndex ?? 0));
  const question = questions[viewIndex] ?? questions[questions.length - 1] ?? null;
  const roundLocked = Boolean(
    snapshot?.round?.forceLocked ||
    snapshot?.round?.teamLocked ||
    (snapshot?.live?.timerActive && countdown <= 0)
  );
  const questionLocked = roundLocked || Boolean(question?.revealed);
  const screen = snapshot?.live?.teamScreen ?? "lobby";
  const isMultipleChoice = Boolean(question?.type === "Multiple choice" && question.options?.length);
  const isTextEntry = Boolean(question && !isMultipleChoice);

  useEffect(() => {
    viewIndexRef.current = viewIndex;
    if (viewIndex >= hostQuestionIndex) setNewQuestionWaiting(false);
  }, [viewIndex, hostQuestionIndex]);

  useEffect(() => {
    if (!snapshot) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const [questionId, answer] of Object.entries(snapshot.teamAnswers ?? {})) {
        if (!(questionId in next)) next[questionId] = answer.text ?? "";
      }
      return next;
    });
  }, [snapshot]);

  useEffect(() => {
    if (!questions.length) return;
    const roundId = snapshot?.round?.id ?? "";
    const previousRoundId = previousRoundIdRef.current;
    const previousHostQuestion = previousHostQuestionRef.current;
    const latestAvailable = Math.min(hostQuestionIndex, questions.length - 1);

    if (roundId !== previousRoundId) {
      setViewIndex(latestAvailable);
      setNewQuestionWaiting(false);
      previousRoundIdRef.current = roundId;
      previousHostQuestionRef.current = hostQuestionIndex;
      return;
    }

    if (hostQuestionIndex > previousHostQuestion) {
      const wasReviewingOlderQuestion = previousHostQuestion >= 0 && viewIndexRef.current < previousHostQuestion;
      if (wasReviewingOlderQuestion) {
        setNewQuestionWaiting(true);
      } else {
        setViewIndex(latestAvailable);
        setNewQuestionWaiting(false);
      }
    } else if (hostQuestionIndex < previousHostQuestion) {
      setViewIndex(latestAvailable);
      setNewQuestionWaiting(false);
    }

    previousHostQuestionRef.current = hostQuestionIndex;
  }, [hostQuestionIndex, questions.length, snapshot?.round?.id]);

  useEffect(() => {
    const audio = teamAudioRef.current;
    const control = snapshot?.live?.audio ?? {};
    const nonce = Number(control.playNonce ?? 0);
    if (!audio || !question?.audio || control.questionId !== question.id || !nonce) return;
    if (nonce <= lastPlayNonceRef.current) return;
    lastPlayNonceRef.current = nonce;

    audio.pause();
    try { audio.currentTime = 0; } catch { /* media may still be loading */ }
    audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }, [question?.id, question?.audio, snapshot?.live?.audio?.questionId, snapshot?.live?.audio?.playNonce]);

  const savedAnswer = question ? snapshot?.teamAnswers?.[question.id] : null;
  const savedText = String(savedAnswer?.text ?? "");
  const draft = question ? drafts[question.id] ?? savedText : "";
  const draftMatchesSaved = draft.trim() === savedText.trim() && (Boolean(savedAnswer) || !draft.trim());
  const answerSaving = Boolean(question && !questionLocked && draft.trim() !== savedText.trim());
  const submitted = Boolean(savedAnswer && draftMatchesSaved);

  const answeredCount = useMemo(
    () => questions.filter((item) => String(drafts[item.id] ?? snapshot?.teamAnswers?.[item.id]?.text ?? "").trim()).length,
    [questions, drafts, snapshot?.teamAnswers],
  );
  const totalRoundQuestions = Number(snapshot?.round?.totalQuestions ?? 0);

  function setDraft(value) {
    if (!question || questionLocked) return;
    setDrafts((current) => ({ ...current, [question.id]: value }));
    send({ type: "save-answer", questionId: question.id, text: value });
  }

  function chooseAnswer(option) {
    if (!question || questionLocked) return;
    setDrafts((current) => ({ ...current, [question.id]: option }));
    send({ type: "save-answer", questionId: question.id, text: option });
  }

  function replayAudio() {
    const audio = teamAudioRef.current;
    if (!audio) return;
    audio.pause();
    try { audio.currentTime = 0; } catch { /* ignored */ }
    audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }

  if (!snapshot) return <ConnectionScreen status={status} error={error} />;
  if (!snapshot.team) return <ConnectionScreen status="error" error="This team QR code is no longer valid." />;
  if (!snapshot.team.nameLocked) return <TeamNameScreen snapshot={snapshot} send={send} status={status} />;
  if (screen === "leaderboard") return <LeaderboardScreen snapshot={snapshot} status={status} />;
  if (screen === "final") return <FinalScreen snapshot={snapshot} status={status} />;
  if (screen === "round_locked" || (snapshot.live?.timerActive && countdown <= 0) || !question || (screen === "lobby" && !questions.length)) {
    return <WaitingScreen snapshot={snapshot} status={status} />;
  }

  const correctAnswer = String(question.answer ?? "").trim();
  const canGoBack = viewIndex > 0;
  const canGoForward = viewIndex < questions.length - 1;
  const showNewQuestionAlert = Boolean(newQuestionWaiting && viewIndex < hostQuestionIndex && canGoForward);

  return (
    <TeamChrome status={status} rail={<LeaderboardRail leaderboard={snapshot.leaderboard} ownId={snapshot.team?.id} />}>
      {snapshot.live?.timerActive ? (
        <div
          className={`team-timer-overlay team-timer-clock-wrap ${countdown <= 10 ? "urgent" : ""}`}
          ref={timerOverlayRef}
          role="timer"
          aria-label={`${countdown} seconds remaining before the round ends`}
        >
          <div className="team-timer-message">
            <strong>LAST CHANCE FOR YOUR ANSWERS!</strong>
            <span>Pop in any final changes before time’s up</span>
          </div>
          <div className="team-timer-clock" aria-hidden="true">
            <i className="team-timer-clock-knob" />
            <strong>{countdown}</strong>
          </div>
        </div>
      ) : null}

      <section className={`team-card live-team-card question-team-card ${snapshot.live?.timerActive ? "timer-running" : ""}`}>
        <div className="team-question-topline">
          <div className="team-question-team-name"><span>TEAM</span><strong>{snapshot.team.name}</strong></div>
          <div className="team-question-progress">{answeredCount}/{totalRoundQuestions || questions.length} answered</div>
        </div>

        <div className="team-current-round-title">{snapshot.round?.title || "Round"}</div>

        <div className="team-question-nav">
          <button className="question-nav-button previous" disabled={!canGoBack} onClick={() => setViewIndex((index) => Math.max(0, index - 1))}>
            <ArrowLeft size={24} />
            <span>Previous</span>
          </button>
          <div className="question-number-display"><strong>{question.number ?? viewIndex + 1}</strong><small>QUESTION {question.number ?? viewIndex + 1} of {totalRoundQuestions || questions.length}</small></div>
          <button className={`question-nav-button next ${showNewQuestionAlert ? "new-question-waiting" : ""}`} disabled={!canGoForward} onClick={() => setViewIndex((index) => Math.min(questions.length - 1, index + 1))}>
            <span>Next</span>
            <ArrowRight size={24} />
            {showNewQuestionAlert ? <b>NEW</b> : null}
          </button>
        </div>

        <div className={`team-question-stage ${questionLocked ? "is-locked" : ""} ${question.revealed ? "is-revealed" : ""} ${submitted ? "answer-submitted" : ""}`}>
          {questionLocked ? <span className="question-lock-key" aria-label="Question locked"><KeyRound size={18} /></span> : null}

          <div className="team-question-core lockable-zone">
            {question.image ? (
              <div className="team-media-frame live-team-image">
                <img src={question.image} alt={question.imageName || "Question"} />
              </div>
            ) : null}

            {question.audio ? (
              <div className="team-audio-frame compact-team-audio">
                <Volume2 size={17} />
                <strong>{question.audioName || "Audio question"}</strong>
                <audio ref={teamAudioRef} preload="auto" src={question.audio} />
                <button type="button" className="audio-replay-button" onClick={replayAudio}>
                  <RotateCcw size={15} /> {audioBlocked ? "Play audio" : "Replay"}
                </button>
              </div>
            ) : null}

            <h1 className="team-question-text">{question.text}</h1>
          </div>

          <div className="team-answer-zone lockable-zone">
            {isMultipleChoice ? (
              <div className="team-choice-list live-choice-list">
                {question.options.filter(Boolean).map((option, index) => {
                  const selected = draft === option;
                  const correct = question.revealed && correctAnswer === String(option).trim();
                  return (
                    <button
                      type="button"
                      key={index}
                      disabled={questionLocked}
                      className={`${selected ? "selected" : ""} ${submitted && selected ? "submitted-choice" : ""} ${correct ? "correct-reveal" : ""}`}
                      onClick={() => chooseAnswer(option)}
                    >
                      <span>{String.fromCharCode(65 + index)}</span>{option}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {isTextEntry ? (
              <div className="answer-input-shell">
                <textarea
                  className={`${draft.trim() ? "has-answer" : ""} ${submitted ? "submitted-answer" : ""}`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={questionLocked}
                  maxLength={500}
                  placeholder={question.type === "Picture" ? "Type what you think the picture is…" : "Type your answer…"}
                />
                {question.revealed ? (
                  <div className="revealed-answer-pill">
                    <CheckCircle2 size={18} />
                    <span>ANSWER</span>
                    <strong>{question.answer}</strong>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!questionLocked && draft.trim() && !answerSaving ? (
              <div className="answer-save-status saved">
                <CheckCircle2 size={15} />
                <strong>Answer Updated</strong>
              </div>
            ) : null}
          </div>
        </div>

      </section>
    </TeamChrome>
  );
}
