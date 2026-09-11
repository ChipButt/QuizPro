const ANSWER_SELECTOR = ".question-team-card .answer-input-shell textarea";
const STAGE_SELECTOR = ".question-team-card.keyboard-active .team-question-stage";
const CORE_SELECTOR = ".question-team-card.keyboard-active .team-question-core";

function syncVisualViewport() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const height = Math.max(180, Math.round(viewport?.height ?? window.innerHeight));
  const width = Math.max(240, Math.round(viewport?.width ?? window.innerWidth));
  const top = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
  const left = Math.max(0, Math.round(viewport?.offsetLeft ?? 0));

  root.style.setProperty("--team-visible-height", `${height}px`);
  root.style.setProperty("--team-visible-width", `${width}px`);
  root.style.setProperty("--team-visible-top", `${top}px`);
  root.style.setProperty("--team-visible-left", `${left}px`);
}

function resetKeyboardView() {
  syncVisualViewport();

  // Keep both internal panes at their own tops. The page itself is anchored to
  // the visual viewport by CSS, so we do not let the browser's focus scrolling
  // drag the question out of view.
  const stage = document.querySelector(STAGE_SELECTOR);
  if (stage) stage.scrollTop = 0;

  const core = document.querySelector(CORE_SELECTOR);
  if (core) core.scrollTop = 0;
}

function settleKeyboardLayout() {
  const delays = [0, 24, 60, 120, 220, 360, 520, 760, 1050];
  const timers = delays.map((delay) => window.setTimeout(resetKeyboardView, delay));

  const viewport = window.visualViewport;
  const onViewportChange = () => resetKeyboardView();
  viewport?.addEventListener("resize", onViewportChange);
  viewport?.addEventListener("scroll", onViewportChange);
  window.addEventListener("resize", onViewportChange);

  const cleanupTimer = window.setTimeout(() => {
    viewport?.removeEventListener("resize", onViewportChange);
    viewport?.removeEventListener("scroll", onViewportChange);
    window.removeEventListener("resize", onViewportChange);
  }, 1300);

  return () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    window.clearTimeout(cleanupTimer);
    viewport?.removeEventListener("resize", onViewportChange);
    viewport?.removeEventListener("scroll", onViewportChange);
    window.removeEventListener("resize", onViewportChange);
  };
}

let cleanupPending = null;

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.matches(ANSWER_SELECTOR)) return;

  syncVisualViewport();
  cleanupPending?.();
  cleanupPending = settleKeyboardLayout();
});

document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.matches(ANSWER_SELECTOR)) return;

  window.setTimeout(() => {
    cleanupPending?.();
    cleanupPending = null;
    syncVisualViewport();
  }, 100);
});
