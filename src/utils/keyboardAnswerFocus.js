const ANSWER_SELECTOR = ".question-team-card .answer-input-shell textarea";

function resetAnswerViewport() {
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } catch {
    window.scrollTo(0, 0);
  }

  const root = document.scrollingElement || document.documentElement;
  if (root) root.scrollTop = 0;

  const stage = document.querySelector(
    ".question-team-card.keyboard-active .team-question-stage",
  );
  if (stage) stage.scrollTop = 0;
}

function settleKeyboardLayout() {
  const delays = [0, 40, 90, 160, 260, 420, 650];
  const timers = delays.map((delay) => window.setTimeout(resetAnswerViewport, delay));

  const viewport = window.visualViewport;
  const onViewportChange = () => resetAnswerViewport();
  viewport?.addEventListener("resize", onViewportChange);

  const cleanupTimer = window.setTimeout(() => {
    viewport?.removeEventListener("resize", onViewportChange);
  }, 850);

  return () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    window.clearTimeout(cleanupTimer);
    viewport?.removeEventListener("resize", onViewportChange);
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
