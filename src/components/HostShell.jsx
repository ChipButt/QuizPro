import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ClipboardCheck,
  Crown,
  FileQuestion,
  Gauge,
  Home,
  Image,
  Library,
  ListChecks,
  Monitor,
  Radio,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { navItems } from "../data/seed.js";
import { getSelectedQuiz } from "../utils/quiz.js";
import {
  DashboardPage,
  LiveQuizPage,
  MarkingPage,
  MediaLibraryPage,
  QuestionLibraryPage,
  QuizzesPage,
  ResultsPage,
  SettingsPage,
  TeamsPage,
} from "./HostPages.jsx";

const iconMap = {
  Dashboard: Home,
  Quizzes: CalendarDays,
  "Question Library": Library,
  "Media Library": Image,
  "Live Quiz": Radio,
  Teams: Users,
  Marking: ClipboardCheck,
  Results: BarChart3,
  Settings,
};

function HostLogin({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (password.trim().toLowerCase() === "demo") {
      window.localStorage.setItem("quizmaster-pro-host-unlocked", "true");
      onUnlock();
      return;
    }
    setError("Use demo for this local MVP.");
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Crown size={24} />
          </span>
          <strong>Quizmaster<span>Pro</span></strong>
        </div>
        <h1>Private quizmaster console</h1>
        <p>
          Host pages are gated separately from the team join link. This local build uses a demo
          password for the first version.
        </p>
        <form onSubmit={submit} className="login-form">
          <label>
            Host password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="demo"
            />
          </label>
          <button className="primary-button" type="submit">
            <ShieldCheck size={16} />
            Unlock host view
          </button>
          {error ? <span className="form-error">{error}</span> : null}
        </form>
      </section>
    </main>
  );
}

function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup sidebar-brand">
        <span className="brand-mark">
          <Crown size={23} />
        </span>
        <strong>Quizmaster<span>Pro</span></strong>
      </div>
      <nav className="side-nav" aria-label="Host navigation">
        {navItems.map((item) => {
          const Icon = iconMap[item];
          return (
            <button
              key={item}
              className={item === activePage ? "nav-item active" : "nav-item"}
              onClick={() => setActivePage(item)}
            >
              <Icon size={18} />
              <span>{item}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <button className="nav-item">
          <FileQuestion size={18} />
          <span>Support</span>
        </button>
        <button className="nav-item">
          <ChevronsLeft size={18} />
          <span>Collapse</span>
        </button>
      </div>
    </aside>
  );
}

function TopBar({ state, resetState }) {
  const quiz = getSelectedQuiz(state);
  const teamUrl = `${window.location.origin}${window.location.pathname}#/join/${state.joinCode}`;

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="live-pill">Live</span>
        <strong>{quiz.title}</strong>
        <ChevronDown size={16} />
        <span>{new Date(`${quiz.date}T12:00:00`).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}</span>
        <span>{quiz.time}</span>
      </div>
      <div className="topbar-actions">
        <span className="connection-dot" />
        <span className="connected-text">Connected</span>
        <a className="ghost-button" href={teamUrl} target="_blank" rel="noreferrer">
          <Monitor size={16} />
          Team link
        </a>
        <button className="icon-button" aria-label="Display settings">
          <SlidersHorizontal size={17} />
        </button>
        <button className="ghost-button" onClick={resetState}>
          <Gauge size={16} />
          Reset demo
        </button>
        <div className="host-avatar">
          <span>JM</span>
          <div>
            <strong>John</strong>
            <small>Host</small>
          </div>
          <ChevronDown size={15} />
        </div>
      </div>
    </header>
  );
}

export default function HostShell({ state, updateState, resetState }) {
  const [unlocked, setUnlocked] = useState(
    () => window.localStorage.getItem("quizmaster-pro-host-unlocked") === "true",
  );
  const [activePage, setActivePage] = useState("Live Quiz");

  const page = useMemo(() => {
    const props = { state, updateState, setActivePage };
    switch (activePage) {
      case "Dashboard":
        return <DashboardPage {...props} />;
      case "Quizzes":
        return <QuizzesPage {...props} />;
      case "Question Library":
        return <QuestionLibraryPage {...props} />;
      case "Media Library":
        return <MediaLibraryPage {...props} />;
      case "Teams":
        return <TeamsPage {...props} />;
      case "Marking":
        return <MarkingPage {...props} />;
      case "Results":
        return <ResultsPage {...props} />;
      case "Settings":
        return <SettingsPage {...props} resetState={resetState} />;
      case "Live Quiz":
      default:
        return <LiveQuizPage {...props} />;
    }
  }, [activePage, resetState, state, updateState]);

  if (!unlocked) {
    return <HostLogin onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="host-app">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="host-main">
        <TopBar state={state} resetState={resetState} />
        {page}
      </div>
    </div>
  );
}
