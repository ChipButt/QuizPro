import { CheckCircle2, Cloud, CloudOff, ExternalLink, Github, RefreshCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";

const TOKEN_SETUP_URL = "https://github.com/settings/personal-access-tokens/new?name=QuizPro%20editing&description=Allows%20QuizPro%20to%20save%20the%20shared%20quiz%20library%20to%20ChipButt%2FQuizPro&target_name=ChipButt&contents=write";

function label(library) {
  if (!library.remoteLoaded || library.status === "loading") return "Loading…";
  if (["saving", "local-changes"].includes(library.status)) return "Saving…";
  if (library.status === "saved") return "Saved";
  if (["error", "conflict"].includes(library.status)) return "Needs attention";
  if (library.status === "local-only") return "Not published";
  return "Ready";
}

function friendlyMessage(message) {
  const text = String(message || "");
  if (/Resource not accessible by personal access token/i.test(text)) {
    return "This token can identify your GitHub account, but it cannot write to QuizPro. The token must have Repository access to QuizPro and Contents: Read and write.";
  }
  return text;
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
    if (okay && library.status !== "error") {
      setToken("");
    }
  }

  async function reload() {
    if (library.dirty) {
      const okay = window.confirm("Reload the shared GitHub library? This replaces unsaved quiz-library changes on this device.");
      if (!okay) return;
    }
    await library.reload(true);
  }

  function fixAccess() {
    if (library.connected) library.disconnect();
    setToken("");
    setShowSetup(true);
  }

  return (
    <div className={`simple-sync-bar ${problem ? "problem" : working ? "working" : "good"}`}>
      <div className="simple-sync-main">
        {problem ? <CloudOff size={17} /> : working ? <Cloud size={17} /> : <CheckCircle2 size={17} />}
        <strong>Shared library</strong>
        <span>{label(library)}</span>
        <small>{friendlyMessage(library.message)}</small>
      </div>
      <div className="simple-sync-actions">
        <button className="ghost-button compact" onClick={reload} disabled={!library.remoteLoaded || library.status === "loading"}><RefreshCcw size={13} /> Reload</button>
        {problem ? (
          <button className="ghost-button compact" onClick={fixAccess}><Github size={13} /> Fix editing access</button>
        ) : !library.connected ? (
          <button className="ghost-button compact" onClick={() => setShowSetup((value) => !value)}><Github size={13} /> Connect editing</button>
        ) : (
          <span className="simple-sync-user">{library.login}</span>
        )}
      </div>
      {showSetup && (!library.connected || problem) ? (
        <div className="simple-sync-setup">
          <ShieldCheck size={18} />
          <div>
            <strong>One-time GitHub editing setup</strong>
            <p>The setup link now pre-fills <b>ChipButt</b> and <b>Contents: write</b>. On GitHub, under <b>Repository access</b>, you must also choose <b>Only select repositories</b> and select <b>QuizPro</b>. Then generate the token and paste it below.</p>
            <a href={TOKEN_SETUP_URL} target="_blank" rel="noreferrer">Create the correct QuizPro token <ExternalLink size={12} /></a>
          </div>
          <label>Token<input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="github_pat_…" /></label>
          <button className="primary-button" onClick={connect} disabled={!token.trim() || connecting}>{connecting ? "Connecting…" : "Connect"}</button>
        </div>
      ) : null}
    </div>
  );
}
