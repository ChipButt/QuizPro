const ANSWER_SELECTOR = ".question-team-card .answer-input-shell textarea";
const STAGE_SELECTOR = ".question-team-card.keyboard-active .team-question-stage";

function resetPageViewport() {
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } catch {
    window.scrollTo(0, 0);
  }

  const root = document.scrollingElement || document.documentElement;
  if (root) root.scrollTop = 0;
}

function keepFocusedAnswerVisible() {
  resetPageViewport();

  const stage = document.querySelector(STAGE_SELECTOR);
  const answer = document.activeElement;
  if (!stage || !(answer instanceof Element) || !answer.matches(ANSWER_SELECTOR)) return;

  // Start from the top so short questions still show the full question. For a
  // taller question, move only far enough to keep the answer box above the
  // keyboard instead of forcing the stage to stay at scrollTop = 0.
  stage.scrollTop = 0;

  window.requestAnimationFrame(() => {
    const stageRect = stage.getBoundingClientRect();
    const answerRect = answer.getBoundingClientRect();
    const viewportBottom = window.visualViewport?.height ?? window.innerHeight;
    const visibleBottom = Math.min(stageRect.bottom, viewportBottom) - 10;
    const visibleTop = Math.max(stageRect.top, 0) + 8;

    if (answerRect.bottom > visibleBottom) {
      stage.scrollTop += answerRect.bottom - visibleBottom;
    } else if (answerRect.top < visibleTop) {
      stage.scrollTop -= visibleTop - answerRect.top;
    }
  });
}

function settleKeyboardLayout() {
  const delays = [0, 40, 90, 160, 260, 420, 650];
  const timers = delays.map((delay) => window.setTimeout(keepFocusedAnswerVisible, delay));

  const viewport = window.visualViewport;
  const onViewportChange = () => keepFocusedAnswerVisible();
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
