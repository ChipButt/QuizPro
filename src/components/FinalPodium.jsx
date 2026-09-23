// Ivory Monolith Columns podium for the final results.
// Renders the top three teams as plinths ordered 2nd / 1st / 3rd.
// Pass `revealedIds` (a Set of team ids) to mask teams the quizmaster
// has not revealed yet; omit it to show everything.

const PODIUM_PLACES = [2, 1, 3];

export function FinalTrophy() {
  return (
    <svg className="trophy" viewBox="0 0 74 74" fill="none" aria-hidden="true">
      <path d="M24 14h26v14c0 12-5 20-13 20S24 40 24 28V14Z" stroke="currentColor" strokeWidth="2" />
      <path d="M24 18H13v7c0 8 5 13 12 13M50 18h11v7c0 8-5 13-12 13M37 48v11M27 62h20M29 59h16" stroke="currentColor" strokeWidth="2" />
      <path d="M31 24h12M37 20v17" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export default function FinalPodium({ leaderboard, revealedIds = null }) {
  const teams = leaderboard ?? [];
  const columns = PODIUM_PLACES
    .map((place) => ({ place, team: teams[place - 1] }))
    .filter(({ team }) => team);

  if (!columns.length) return null;

  return (
    <div className="final-podium">
      <div className="podium">
        {columns.map(({ place, team }) => {
          const revealed = !revealedIds || revealedIds.has(team.id);
          return (
            <div key={team.id} className={`column place-${place}`} tabIndex={0}>
              {place === 1 ? <i className="winner-mark" aria-hidden="true" /> : null}
              <span className="place">{place}</span>
              <strong className="team-name">{revealed ? team.name || "Unnamed team" : "—"}</strong>
              <b className="score">{revealed ? `${team.score} pts` : "· · ·"}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}
