import { CalendarDays, Home, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { navItems } from "../data/seed.js";
import { useLiveHostNetwork } from "../hooks/useLiveHostNetwork.js";
import { getSelectedQuiz } from "../utils/quiz.js";
import DocxQuizImport from "./DocxQuizImport.jsx";
import GitHubLibraryStatus from "./GitHubLibraryStatus.jsx";
import SimpleDashboard from "./SimpleDashboard.jsx";
import SimpleLiveQuiz from "./SimpleLiveQuiz.jsx";
import SimpleQuizBuilder from "./SimpleQuizBuilder.jsx";

const QUIZ_IN_LOGO_SOURCE = "/QuizPro/Quiz%20In%20Logo.png";

function QuizInSidebarLogo() {
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

  return <canvas ref={canvasRef} className="quiz-in-sidebar-logo" role="img" aria-label="Quiz In" />;
}


const iconMap = {
  Dashboard: Home,
  Quizzes: CalendarDays,
  "Live Quiz": Radio,
};

function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="sidebar simple-sidebar">
      <div className="brand-lockup sidebar-brand">
        <QuizInSidebarLogo />
      </div>
      <nav className="side-nav" aria-label="Host navigation">
        {navItems.map((item) => {
          const Icon = iconMap[item];
          return (
            <button key={item} className={item === activePage ? "nav-item active" : "nav-item"} onClick={() => setActivePage(item)}>
              <Icon size={18} /><span>{item}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function TopBar({ state }) {
  const quiz = getSelectedQuiz(state);
  return (
    <header className="topbar simple-topbar">
      <div className="topbar-title">
        <strong>{quiz?.title?.trim() || "Quiz In"}</strong>
        {state.live?.sessionActive ? <span className="live-pill">LIVE</span> : null}
      </div>
    </header>
  );
}

export default function HostShell({ state, updateState, sharedLibrary, storageError }) {
  const [activePage, setActivePage] = useState("Quizzes");
  const network = useLiveHostNetwork(state, updateState);

  const page = useMemo(() => {
    const props = { state, updateState, setActivePage, network };
    if (activePage === "Dashboard") return <SimpleDashboard {...props} />;
    if (activePage === "Live Quiz") return <SimpleLiveQuiz {...props} />;
    return (
      <>
        <GitHubLibraryStatus library={sharedLibrary} />
        {sharedLibrary.remoteLoaded ? (
          <>
            <DocxQuizImport updateState={updateState} />
            <SimpleQuizBuilder {...props} />
          </>
        ) : (
          <div className="shared-library-loading">Loading your shared quizzes from GitHub…</div>
        )}
      </>
    );
  }, [activePage, network, sharedLibrary, state, updateState]);

  return (
    <div className="host-app simple-host-app">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="host-main">
        <TopBar state={state} />
        {storageError ? <div className="storage-warning">{storageError}</div> : null}
        {page}
      </div>
    </div>
  );
}
