import { CheckCircle2, Cloud, CloudOff, ExternalLink, Github, RefreshCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";

function label(library) {
  if (!library.remoteLoaded || library.status === "loading") return "Loading…";
  if (["saving", "local-changes"].includes(library.status)) return "Saving…";
  if (library.status === "saved") return "Saved";
  if (["error", "conflict"].includes(library.status)) return "Needs attention";
  if (library.status === "local-only") return "Not published";
  return "Ready";
}

export default function GitHubLibraryStatus({ library }) {
  const [showSetup, setShowSetup] = useState(false);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const problem = ["error", "conflict"].includes(library.status);
  const working = ["saving", "local-changes", "loading"].includes(library.status);

  async function connect() {
    if (!token.trim()) return;
    setConnecting(true);
    const okay = await library.connect(token.trim());
    setConnecting(false);
    if (okay) {
      setToken("");
      setShowSetup(false);
    }
  }

  async function reload() {
    if (library.dirty) {
      const okay = window.confirm("Reload the shared GitHub library? This replaces unsaved quiz-library changes on this device.");
      if (!okay) return;
    }
    await library.reload(true);
  }

  return (
    <div className={`simple-sync-bar ${problem ? "problem" : working ? "working" : "good"}`}>
      <div className="simple-sync-main">
        {problem ? <CloudOff size={17} /> : working ? <Cloud size={17} /> : <CheckCircle2 size={17} />}
        <strong>Shared library</strong>
        <span>{label(library)}</span>
        <small>{library.message}</small>
      </div>
      <div className="simple-sync-actions">
        <button className="ghost-button compact" onClick={reload} disabled={!library.remoteLoaded || library.status === "loading"}><RefreshCcw size={13} /> Reload</button>
        {!library.connected ? <button className="ghost-button compact" onClick={() => setShowSetup((value) => !value)}><Github size={13} /> Connect editing</button> : <span className="simple-sync-user">{library.login}</span>}
      </div>
      {showSetup && !library.connected ? (
        <div className="simple-sync-setup">
          <ShieldCheck size={18} />
          <div>
            <strong>One-time GitHub editing setup</strong>
            <p>Create a fine-grained token for <b>ChipButt/QuizPro</b> with <b>Contents: Read and write</b>, then paste it below. Devices that only run quizzes do not need this.</p>
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Open GitHub token setup <ExternalLink size={12} /></a>
          </div>
          <label>Token<input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="github_pat_…" /></label>
          <button className="primary-button" onClick={connect} disabled={!token.trim() || connecting}>{connecting ? "Connecting…" : "Connect"}</button>
        </div>
      ) : null}
    </div>
  );
}
