import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ClipboardCheck,
  Crown,
  Gauge,
  Home,
  Image,
  Monitor,
  Radio,
  Settings,
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
  QuizzesPage,
  ResultsPage,
  SettingsPage,
  TeamsPage,
} from "./HostPages.jsx";

const iconMap = {
  Dashboard: Home,
  Quizzes: CalendarDays,
  "Media Library": Image,
  "Live Quiz": Radio,
  Teams: Users,
  Marking: ClipboardCheck,
  Results: BarChart3,
  Settings,
};

function Sidebar({ activePage, setActivePage, collapsed, setCollapsed }) {
  return (
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
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
        <button className="nav-item" onClick={() => setCollapsed(!collapsed)}>
          <ChevronsLeft size={18} />
          <span>Collapse</span>
        </button>
      </div>
    </aside>
  );
}

function TopBar({ state, resetState, setActivePage }) {
  const quiz = getSelectedQuiz(state);
  const teamUrl = `${window.location.origin}${window.location.pathname}#/join/${state.joinCode}`;
  const quizTitle = quiz?.title?.trim() || "Quiz builder";
  const dateLabel = quiz?.date
    ? new Date(`${quiz.date}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="live-pill">{state.live.status}</span>
        <strong>{quizTitle}</strong>
        {quiz ? <ChevronDown size={16} /> : null}
        {dateLabel ? <span>{dateLabel}</span> : null}
        {quiz?.time ? <span>{quiz.time}</span> : null}
      </div>
      <div className="topbar-actions">
        <a className="ghost-button" href={teamUrl} target="_blank" rel="noreferrer">
          <Monitor size={16} />
          Team link
        </a>
        <button className="icon-button" aria-label="Display settings" onClick={() => setActivePage("Settings")}>
          <SlidersHorizontal size={17} />
        </button>
        <button className="ghost-button" onClick={resetState}>
          <Gauge size={16} />
          Clear workspace
        </button>
      </div>
    </header>
  );
}

export default function HostShell({ state, updateState, resetState }) {
  const [activePage, setActivePage] = useState("Quizzes");
  const [collapsed, setCollapsed] = useState(false);

  const page = useMemo(() => {
    const props = { state, updateState, setActivePage };
    switch (activePage) {
      case "Dashboard":
        return <DashboardPage {...props} />;
      case "Quizzes":
        return <QuizzesPage {...props} />;
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

  return (
    <div className={collapsed ? "host-app sidebar-collapsed" : "host-app"}>
      <Sidebar
        activePage={activePage}
        collapsed={collapsed}
        setActivePage={setActivePage}
        setCollapsed={setCollapsed}
      />
      <div className="host-main">
        <TopBar state={state} resetState={resetState} setActivePage={setActivePage} />
        {page}
      </div>
    </div>
  );
}
