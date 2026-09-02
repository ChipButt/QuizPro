import { CalendarDays, Crown, Home, Radio } from "lucide-react";
import { useMemo, useState } from "react";
import { navItems } from "../data/seed.js";
import { useLiveHostNetwork } from "../hooks/useLiveHostNetwork.js";
import { getSelectedQuiz } from "../utils/quiz.js";
import DocxQuizImport from "./DocxQuizImport.jsx";
import GitHubLibraryStatus from "./GitHubLibraryStatus.jsx";
import SimpleDashboard from "./SimpleDashboard.jsx";
import SimpleLiveQuiz from "./SimpleLiveQuiz.jsx";
import SimpleQuizBuilder from "./SimpleQuizBuilder.jsx";

const iconMap = {
  Dashboard: Home,
  Quizzes: CalendarDays,
  "Live Quiz": Radio,
};

function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="sidebar simple-sidebar">
      <div className="brand-lockup sidebar-brand">
        <span className="brand-mark"><Crown size={23} /></span>
        <strong>Quizmaster<span>Pro</span></strong>
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
        <strong>{quiz?.title?.trim() || "Quizmaster"}</strong>
        {state.live?.sessionActive ? <span className="live-pill">LIVE</span> : null}
      </div>
    </header>
  );
}

export default function HostShell({ state, updateState, sharedLibrary }) {
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
        {page}
      </div>
    </div>
  );
}
