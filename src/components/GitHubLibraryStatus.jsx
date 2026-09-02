import { CheckCircle2, Cloud, CloudOff, ExternalLink, Github, RefreshCcw, Save, ShieldCheck, Unplug } from "lucide-react";
import { useState } from "react";

function statusLabel(library) {
  if (!library.remoteLoaded || library.status === "loading") return "Loading shared library";
  if (library.status === "saving" || library.status === "local-changes") return "Saving changes";
  if (library.status === "saved") return "Saved to GitHub";
  if (library.status === "conflict") return "Needs attention";
  if (library.status === "error") return "Shared library problem";
  if (library.status === "local-only") return "Changes not published";
  return "Shared library ready";
}

function statusTone(library) {
  if (["error", "conflict"].includes(library.status)) return "problem";
  if (["local-only", "local-changes", "saving"].includes(library.status)) return "working";
  if (library.remoteLoaded) return "good";
  return "neutral";
}

export default function GitHubLibraryStatus({ library }) {
  const [showSetup, setShowSetup] = useState(false);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const tone = statusTone(library);

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
      const okay = window.confirm("Reload the shared GitHub library? This will replace the unsaved quiz-library changes currently on this device.");
      if (!okay) return;
    }
    await library.reload(true);
  }

  return (
    <section className={`github-library-status ${tone}`}>
      <div className="github-library-icon">
        {tone === "good" ? <CheckCircle2 size={21} /> : tone === "problem" ? <CloudOff size={21} /> : <Cloud size={21} />}
      </div>
      <div className="github-library-copy">
        <div className="github-library-heading">
          <strong>Shared quiz library</strong>
          <span>{statusLabel(library)}</span>
        </div>
        <p>{library.message}</p>
        <small>
          {library.connected
            ? `GitHub editing connected as ${library.login}. Changes to quizzes and media save automatically.`
            : "Every device loads the same GitHub quiz library automatically. GitHub access is only needed on devices that publish edits."}
        </small>
      </div>
      <div className="github-library-actions">
        <button className="ghost-button compact" type="button" onClick={reload} disabled={!library.remoteLoaded || library.status === "loading"}>
          <RefreshCcw size={14} /> Reload shared
        </button>
        {library.connected ? (
          <>
            {library.dirty ? (
              <button className="primary-button compact" type="button" onClick={library.saveNow} disabled={library.status === "saving"}>
                <Save size={14} /> Save now
              </button>
            ) : null}
            <button className="ghost-button compact" type="button" onClick={library.disconnect}>
              <Unplug size={14} /> Disconnect editing
            </button>
          </>
        ) : (
          <button className="primary-button compact" type="button" onClick={() => setShowSetup((value) => !value)}>
            <Github size={15} /> {showSetup ? "Hide GitHub setup" : "Connect GitHub editing"}
          </button>
        )}
      </div>

      {showSetup && !library.connected ? (
        <div className="github-library-setup">
          <div className="github-library-setup-copy">
            <ShieldCheck size={20} />
            <div>
              <strong>One-time setup on an editing device</strong>
              <p>
                Create a fine-grained GitHub token restricted to <b>ChipButt/QuizPro</b>, with repository <b>Contents: Read and write</b>. Paste it here once. QuizPro stores it only in this browser and uses it to save the shared library directly to your GitHub repository.
              </p>
              <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                Open GitHub token setup <ExternalLink size={13} />
              </a>
            </div>
          </div>
          <div className="github-library-token-row">
            <label>
              GitHub access token
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="github_pat_…"
                onKeyDown={(event) => {
                  if (event.key === "Enter") connect();
                }}
              />
            </label>
            <button className="primary-button" type="button" onClick={connect} disabled={!token.trim() || connecting}>
              <Github size={16} /> {connecting ? "Connecting…" : "Connect & publish"}
            </button>
          </div>
          <p className="github-library-security-note">
            Running a quiz on another device does not require this token; that device simply loads the current shared library. Connect GitHub there only if you also want to edit and publish quizzes from it.
          </p>
        </div>
      ) : null}
    </section>
  );
}
