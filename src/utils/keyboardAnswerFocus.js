const ANSWER_SELECTOR = ".question-team-card .answer-input-shell textarea";
const STAGE_SELECTOR = ".question-team-card.keyboard-active .team-question-stage";
const CORE_SELECTOR = ".question-team-card.keyboard-active .team-question-core";

function resetKeyboardView() {
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } catch {
    window.scrollTo(0, 0);
  }

  const root = document.scrollingElement || document.documentElement;
  if (root) root.scrollTop = 0;

  // The keyboard layout now keeps the answer area fixed below a separate,
  // scrollable question pane. Never scroll the whole question stage toward the
  // textarea, because that was what allowed longer questions to disappear.
  const stage = document.querySelector(STAGE_SELECTOR);
  if (stage) stage.scrollTop = 0;

  const core = document.querySelector(CORE_SELECTOR);
  if (core) core.scrollTop = 0;
}

function settleKeyboardLayout() {
  const delays = [0, 40, 90, 160, 260, 420, 650];
  const timers = delays.map((delay) => window.setTimeout(resetKeyboardView, delay));

  const viewport = window.visualViewport;
  const onViewportChange = () => resetKeyboardView();
  viewport?.addEventListener("resize", onViewportChange);
  viewport?.addEventListener("scroll", onViewportChange);

  const cleanupTimer = window.setTimeout(() => {
    viewport?.removeEventListener("resize", onViewportChange);
    viewport?.removeEventListener("scroll", onViewportChange);
  }, 900);

  return () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    window.clearTimeout(cleanupTimer);
    viewport?.removeEventListener("resize", onViewportChange);
    viewport?.removeEventListener("scroll", onViewportChange);
  };
}

let cleanupPending = null;

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.matches(ANSWER_SELECTOR)) return;

  cleanupPending?.();
  cleanupPending = settleKeyboardLayout();
});

document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.matches(ANSWER_SELECTOR)) return;

  window.setTimeout(() => {
    cleanupPending?.();
    cleanupPending = null;
  }, 100);
});
