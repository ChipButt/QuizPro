import { useEffect, useMemo, useRef, useState } from "react";

const OWNER = "ChipButt";
const REPO = "QuizPro";
const BRANCH = "main";
const LIBRARY_PATH = "data/quiz-library.json";
const TOKEN_KEY = "quizpro-github-write-token-v1";
const RAW_LIBRARY_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${LIBRARY_PATH}`;
const CONTENTS_API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${LIBRARY_PATH}`;

function emptyLibrary() {
  return { schema: 1, updatedAt: null, quizzes: [], media: [] };
}

function normalizeLibrary(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    schema: 1,
    updatedAt: source.updatedAt || null,
    quizzes: Array.isArray(source.quizzes) ? source.quizzes : [],
    media: Array.isArray(source.media) ? source.media : [],
  };
}

function snapshotFromState(state) {
  return {
    schema: 1,
    updatedAt: null,
    quizzes: Array.isArray(state?.quizzes) ? state.quizzes : [],
    media: Array.isArray(state?.media) ? state.media : [],
  };
}

function fingerprint(value) {
  const source = value?.quizzes || value?.media ? value : snapshotFromState(value);
  return JSON.stringify({
    quizzes: Array.isArray(source.quizzes) ? source.quizzes : [],
    media: Array.isArray(source.media) ? source.media : [],
  });
}

function hasLibraryContent(value) {
  return Boolean((value?.quizzes?.length ?? 0) || (value?.media?.length ?? 0));
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToUtf8(base64) {
  const binary = atob(String(base64 || "").replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function readStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function storeToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // The shared library still works read-only if storage is unavailable.
  }
}

function authHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function parseGitHubLibraryPayload(payload) {
  if (!payload?.content) return emptyLibrary();
  try {
    return normalizeLibrary(JSON.parse(base64ToUtf8(payload.content)));
  } catch {
    throw new Error("The shared QuizPro library on GitHub is not valid JSON.");
  }
}

export function useGitHubQuizLibrary(state, updateState) {
  const stateRef = useRef(state);
  stateRef.current = state;

  const [token, setToken] = useState(readStoredToken);
  const [login, setLogin] = useState("");
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Loading the shared quiz library from GitHub…");
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [remoteQuizCount, setRemoteQuizCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [baselineFingerprint, setBaselineFingerprintState] = useState("");
  const baselineRef = useRef("");
  const latestUpdatedAtRef = useRef("");
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);

  const currentFingerprint = useMemo(
    () => fingerprint({ quizzes: state.quizzes, media: state.media }),
    [state.quizzes, state.media],
  );
  const dirty = Boolean(remoteLoaded && baselineFingerprint && currentFingerprint !== baselineFingerprint);
  const connected = Boolean(token && login);

  function setBaseline(next) {
    baselineRef.current = next;
    setBaselineFingerprintState(next);
  }

  function rememberUpdatedAt(value) {
    if (!value) return;
    if (!latestUpdatedAtRef.current || value > latestUpdatedAtRef.current) latestUpdatedAtRef.current = value;
    setLastSyncedAt(latestUpdatedAtRef.current);
  }

  function applyRemoteLibrary(library, remoteFingerprint) {
    const quizzes = library.quizzes;
    const media = library.media;
    updateState((current) => {
      const selectedStillExists = quizzes.some((quiz) => quiz.id === current.selectedQuizId);
      return {
        ...current,
        quizzes,
        media,
        selectedQuizId: selectedStillExists ? current.selectedQuizId : quizzes[0]?.id || "",
      };
    });
    setBaseline(remoteFingerprint);
    setRemoteQuizCount(quizzes.length);
    rememberUpdatedAt(library.updatedAt || "");
  }

  async function loadRemote({ force = false, quiet = false } = {}) {
    if (!quiet) {
      setStatus("loading");
      setMessage("Checking the shared quiz library on GitHub…");
    }

    try {
      const response = await fetch(`${RAW_LIBRARY_URL}?_=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`GitHub library returned ${response.status}.`);
      const library = normalizeLibrary(await response.json());
      const remoteFingerprint = fingerprint(library);
      const localSnapshot = snapshotFromState(stateRef.current);
      const localFingerprint = fingerprint(localSnapshot);
      const baseline = baselineRef.current;
      const knownUpdatedAt = latestUpdatedAtRef.current;

      setRemoteLoaded(true);

      if (
        knownUpdatedAt
        && library.updatedAt
        && library.updatedAt < knownUpdatedAt
        && remoteFingerprint !== baseline
      ) {
        return library;
      }
      if (knownUpdatedAt && !library.updatedAt && remoteFingerprint !== baseline) {
        return library;
      }

      setRemoteQuizCount(library.quizzes.length);
      rememberUpdatedAt(library.updatedAt || "");

      if (!baseline) {
        setBaseline(remoteFingerprint);
        if (hasLibraryContent(library) || !hasLibraryContent(localSnapshot)) {
          applyRemoteLibrary(library, remoteFingerprint);
          setStatus("ready");
          setMessage(`Loaded ${library.quizzes.length} shared quiz${library.quizzes.length === 1 ? "" : "zes"} from GitHub.`);
        } else {
          setStatus(token ? "local-changes" : "local-only");
          setMessage("This device has quizzes that are not yet in the shared GitHub library.");
        }
        return library;
      }

      if (remoteFingerprint === baseline) {
        if (localFingerprint === baseline) {
          setStatus("ready");
          setMessage(`Shared library is up to date · ${library.quizzes.length} quiz${library.quizzes.length === 1 ? "" : "zes"}.`);
        }
        return library;
      }

      if (localFingerprint === baseline || force) {
        applyRemoteLibrary(library, remoteFingerprint);
        setStatus("ready");
        setMessage(`Updated from GitHub · ${library.quizzes.length} quiz${library.quizzes.length === 1 ? "" : "zes"}.`);
        return library;
      }

      setStatus("conflict");
      setMessage("This device and GitHub both have newer changes. Nothing has been overwritten; choose Reload shared or save from the device you want to keep.");
      return library;
    } catch (error) {
      setRemoteLoaded(true);
      setStatus("error");
      setMessage(error?.message || "Could not load the shared quiz library from GitHub.");
      return null;
    }
  }

  async function verifyToken(candidate) {
    const clean = String(candidate || "").trim();
    if (!clean) throw new Error("Paste a GitHub access token first.");

    const [userResponse, repoResponse] = await Promise.all([
      fetch("https://api.github.com/user", { headers: authHeaders(clean) }),
      fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers: authHeaders(clean) }),
    ]);

    if (!userResponse.ok) throw new Error("GitHub rejected that access token.");
    if (!repoResponse.ok) throw new Error("That token cannot access ChipButt/QuizPro.");

    const user = await userResponse.json();
    const repo = await repoResponse.json();
    if (!repo?.permissions?.push) {
      throw new Error("That token can read QuizPro but cannot save changes. Give it Contents: Read and write permission for this repository.");
    }
    return user?.login || "GitHub user";
  }

  async function saveLibrary(authToken = token) {
    const cleanToken = String(authToken || "").trim();
    if (!cleanToken || savingRef.current) return false;
    savingRef.current = true;
    setStatus("saving");
    setMessage("Saving quiz changes to GitHub…");

    try {
      if (!baselineRef.current) await loadRemote({ quiet: true });

      const localSnapshot = snapshotFromState(stateRef.current);
      const localFingerprint = fingerprint(localSnapshot);
      const readResponse = await fetch(`${CONTENTS_API_URL}?ref=${encodeURIComponent(BRANCH)}&_=${Date.now()}`, {
        cache: "no-store",
        headers: authHeaders(cleanToken),
      });

      let currentSha = "";
      let remoteLibrary = emptyLibrary();
      if (readResponse.status === 404) {
        currentSha = "";
      } else if (readResponse.ok) {
        const payload = await readResponse.json();
        currentSha = payload.sha || "";
        remoteLibrary = await parseGitHubLibraryPayload(payload);
      } else {
        throw new Error(`GitHub could not read the shared library (${readResponse.status}).`);
      }

      const remoteFingerprint = fingerprint(remoteLibrary);
      const baseline = baselineRef.current;
      if (baseline && remoteFingerprint !== baseline && localFingerprint !== baseline) {
        setStatus("conflict");
        setMessage("Another device saved a newer quiz library first. Your local changes are still here; reload the shared library before saving again.");
        return false;
      }

      if (localFingerprint === remoteFingerprint) {
        setBaseline(localFingerprint);
        setRemoteQuizCount(localSnapshot.quizzes.length);
        rememberUpdatedAt(remoteLibrary.updatedAt || "");
        setStatus("saved");
        setMessage("All quiz changes are already saved to GitHub.");
        return true;
      }

      const updatedAt = new Date().toISOString();
      const document = {
        schema: 1,
        updatedAt,
        quizzes: localSnapshot.quizzes,
        media: localSnapshot.media,
      };
      const body = {
        message: `QuizPro: save shared quiz library (${localSnapshot.quizzes.length} quizzes)`,
        content: utf8ToBase64(`${JSON.stringify(document, null, 2)}\n`),
        branch: BRANCH,
      };
      if (currentSha) body.sha = currentSha;

      const writeResponse = await fetch(CONTENTS_API_URL, {
        method: "PUT",
        headers: {
          ...authHeaders(cleanToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (writeResponse.status === 409) {
        setStatus("conflict");
        setMessage("GitHub changed while QuizPro was saving. Your local changes are safe; reload the shared library and try again.");
        return false;
      }
      if (!writeResponse.ok) {
        const detail = await writeResponse.json().catch(() => null);
        throw new Error(detail?.message || `GitHub save failed (${writeResponse.status}).`);
      }

      setBaseline(localFingerprint);
      setRemoteQuizCount(localSnapshot.quizzes.length);
      latestUpdatedAtRef.current = updatedAt;
      setLastSyncedAt(updatedAt);
      setStatus("saved");
      setMessage(`Saved automatically · ${localSnapshot.quizzes.length} quiz${localSnapshot.quizzes.length === 1 ? "" : "zes"} available to other devices.`);
      return true;
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "QuizPro could not save to GitHub.");
      return false;
    } finally {
      savingRef.current = false;
    }
  }

  async function connect(candidate) {
    const clean = String(candidate || "").trim();
    setStatus("connecting");
    setMessage("Checking GitHub access…");
    try {
      const userLogin = await verifyToken(clean);
      storeToken(clean);
      setToken(clean);
      setLogin(userLogin);
      setStatus("ready");
      setMessage(`Connected as ${userLogin}. Quiz edits on this device will save automatically.`);
      if (!remoteLoaded) await loadRemote({ quiet: true });
      const localFingerprint = fingerprint(snapshotFromState(stateRef.current));
      if (localFingerprint !== baselineRef.current) await saveLibrary(clean);
      return true;
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Could not connect this device to GitHub.");
      return false;
    }
  }

  function disconnect() {
    storeToken("");
    setToken("");
    setLogin("");
    setStatus(dirty ? "local-only" : "ready");
    setMessage(dirty
      ? "This device has unsaved quiz changes. Reconnect GitHub to publish them."
      : "Shared quizzes will still load here. Connect GitHub only when you want this device to publish edits.");
  }

  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      await loadRemote();
      if (cancelled || !token) return;
      try {
        const userLogin = await verifyToken(token);
        if (cancelled) return;
        setLogin(userLogin);
        const localFingerprint = fingerprint(snapshotFromState(stateRef.current));
        if (baselineRef.current && localFingerprint !== baselineRef.current) {
          await saveLibrary(token);
        } else {
          setStatus("ready");
          setMessage(`Connected as ${userLogin} · shared quiz library ready.`);
        }
      } catch (error) {
        if (cancelled) return;
        storeToken("");
        setToken("");
        setLogin("");
        setStatus("error");
        setMessage(`${error?.message || "Stored GitHub access is no longer valid."} Reconnect this device to publish edits.`);
      }
    }

    initialise();
    const refresh = () => loadRemote({ quiet: true });
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!remoteLoaded || !baselineRef.current) return undefined;
    if (currentFingerprint === baselineRef.current) return undefined;

    if (!token) {
      setStatus("local-only");
      setMessage("These quiz changes are saved on this device only. Connect GitHub editing once to publish them for every device.");
      return undefined;
    }

    setStatus("local-changes");
    setMessage("Changes detected · saving automatically…");
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveLibrary(token), 1800);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [currentFingerprint, remoteLoaded, token]);

  return {
    connected,
    dirty,
    lastSyncedAt,
    login,
    message,
    remoteLoaded,
    remoteQuizCount,
    status,
    connect,
    disconnect,
    reload: (force = false) => loadRemote({ force }),
    saveNow: () => saveLibrary(token),
  };
}
