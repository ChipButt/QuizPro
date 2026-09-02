import { CalendarDays, Play, Trophy, Users } from "lucide-react";
import { computeLeaderboard } from "../utils/quiz.js";
import { getLiveQuiz } from "../utils/liveSession.js";

export default function SimpleDashboard({ state, setActivePage }) {
  const liveQuiz = getLiveQuiz(state);
  const leaderboard = computeLeaderboard(state);
  const prepared = state.quizzes.filter((quiz) => !quiz.archived && quiz.rounds?.some((round) => round.questions?.length));

  return (
    <main className="simple-page simple-dashboard-page">
      <div className="simple-page-heading"><div><h1>Dashboard</h1><p>A quick view of what is ready and what is live.</p></div></div>

      <div className="simple-dashboard-stats">
        <button onClick={() => setActivePage("Quizzes")}><CalendarDays size={22} /><span>Prepared quizzes</span><strong>{prepared.length}</strong></button>
        <button onClick={() => setActivePage("Live Quiz")}><Users size={22} /><span>Live teams</span><strong>{state.live?.sessionActive ? state.teams.length : 0}</strong></button>
        <button onClick={() => setActivePage("Live Quiz")}><Trophy size={22} /><span>Current leader</span><strong>{leaderboard[0]?.name || "—"}</strong></button>
      </div>

      <section className="simple-card simple-dashboard-live">
        <div>
          <span className="utility-label">LIVE QUIZ</span>
          <h2>{state.live?.sessionActive && liveQuiz ? liveQuiz.title || "Untitled quiz" : "No quiz running"}</h2>
          <p>{state.live?.sessionActive ? `${state.teams.length} team${state.teams.length === 1 ? "" : "s"} currently added.` : "Load a saved quiz when you are ready to start a session."}</p>
        </div>
        <button className="primary-button" onClick={() => setActivePage("Live Quiz")}><Play size={15} /> {state.live?.sessionActive ? "Open live quiz" : "Run a quiz"}</button>
      </section>

      {state.live?.sessionActive && leaderboard.length ? (
        <section className="simple-card">
          <div className="simple-section-heading"><div><h2>Leaderboard</h2><p>Current scores for the live quiz.</p></div></div>
          <ol className="simple-leaderboard">{leaderboard.slice(0, 8).map((team, index) => <li key={team.id}><span>{index + 1}</span><strong>{team.name || "Unnamed team"}</strong><b>{team.score}</b></li>)}</ol>
        </section>
      ) : null}
    </main>
  );
}
