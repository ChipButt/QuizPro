const ANSWER_SELECTOR = ".question-team-card .answer-input-shell textarea";
const ANSWER_SECTION_SELECTOR = ".question-team-card .your-answer-section";
const QUESTION_STAGE_SELECTOR = ".question-team-card .team-question-stage";
const PAGE_SELECTOR = ".keyboard-active-page";
const SHELL_SELECTOR = ".live-phone-shell.keyboard-active";
const CLEARANCE_PX = 14;
const QUESTION_TOP_GAP_PX = 6;

let baselineHeight = 0;
let cleanupPending = null;
let originalScrollX = 0;
let originalScrollY = 0;
let restoreTimers = [];

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

  if (baselineHeight > 0) {
    root.style.setProperty("--team-keyboard-layout-height", `${baselineHeight}px`);
  }
}

function resetKeyboardSlide() {
  document.documentElement.style.setProperty("--team-keyboard-slide", "0px");
}

function clearRestoreTimers() {
  restoreTimers.forEach((timer) => window.clearTimeout(timer));
  restoreTimers = [];
}

function restoreOriginalView() {
  resetKeyboardSlide();

  // Mobile Safari may keep its own focus-pan after the textarea blurs.
  // Restore both the window and the scrolling element so the full original
  // Quiz Taker screen, including the logo, comes back into view.
  try {
    window.scrollTo(originalScrollX, originalScrollY);
  } catch {
    window.scrollTo({ left: originalScrollX, top: originalScrollY, behavior: "auto" });
  }

  const scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    scrollingElement.scrollLeft = originalScrollX;
    scrollingElement.scrollTop = originalScrollY;
  }
}

function settleKeyboardClose() {
  clearRestoreTimers();

  // iOS can continue changing visualViewport offset/height after blur. Reapply
  // the original position across that settling period instead of trusting one
  // immediate scrollTo call.
  const delays = [0, 40, 100, 180, 300, 480, 700, 950, 1250];
  restoreTimers = delays.map((delay) => window.setTimeout(() => {
    restoreOriginalView();

    const viewport = window.visualViewport;
    const viewportHeight = Math.round(viewport?.height ?? window.innerHeight);
    const layoutHeight = Math.round(window.innerHeight);

    if (Math.abs(viewportHeight - layoutHeight) <= 4) {
      document.documentElement.style.setProperty("--team-visible-top", "0px");
      document.documentElement.style.setProperty("--team-visible-left", "0px");
    }
  }, delay));
}

function updateKeyboardSlide() {
  syncVisualViewport();

  const active = document.activeElement;
  if (!(active instanceof Element) || !active.matches(ANSWER_SELECTOR)) {
    resetKeyboardSlide();
    return;
  }

  const page = document.querySelector(PAGE_SELECTOR);
  const shell = document.querySelector(SHELL_SELECTOR);
  const stage = document.querySelector(QUESTION_STAGE_SELECTOR);
  const answerSection = document.querySelector(ANSWER_SECTION_SELECTOR) || active;

  if (!page || !shell || !stage || !answerSection) {
    resetKeyboardSlide();
    return;
  }

  const root = document.documentElement;
  const viewport = window.visualViewport;
  const viewportTop = Math.max(0, viewport?.offsetTop ?? 0);
  const viewportHeight = Math.max(180, viewport?.height ?? window.innerHeight);
  const viewportBottom = viewportTop + viewportHeight;

  // Always measure from the intact, unshifted layout. This avoids accumulating
  // translation across repeated visualViewport resize/scroll events.
  root.style.setProperty("--team-keyboard-slide", "0px");

  const answerRect = answerSection.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();

  const overlap = Math.max(0, answerRect.bottom + CLEARANCE_PX - viewportBottom);

  // Do not slide farther than the point where the question box itself reaches
  // the top of the visible browser viewport.
  const maxShift = Math.max(0, stageRect.top - viewportTop - QUESTION_TOP_GAP_PX);
  const shift = Math.min(overlap, maxShift);

  root.style.setProperty("--team-keyboard-slide", `${Math.round(shift)}px`);
}

function settleKeyboardLayout() {
  const delays = [0, 24, 60, 100, 160, 240, 360, 520, 760, 1050];
  const timers = delays.map((delay) => window.setTimeout(updateKeyboardSlide, delay));

  const viewport = window.visualViewport;
  const onViewportChange = () => updateKeyboardSlide();
  viewport?.addEventListener("resize", onViewportChange);
  viewport?.addEventListener("scroll", onViewportChange);
  window.addEventListener("resize", onViewportChange);

  return () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    viewport?.removeEventListener("resize", onViewportChange);
    viewport?.removeEventListener("scroll", onViewportChange);
    window.removeEventListener("resize", onViewportChange);
  };
}

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.matches(ANSWER_SELECTOR)) return;

  clearRestoreTimers();
  originalScrollX = window.scrollX;
  originalScrollY = window.scrollY;

  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  baselineHeight = Math.max(window.innerHeight, viewportHeight);
  syncVisualViewport();
  resetKeyboardSlide();

  cleanupPending?.();
  cleanupPending = settleKeyboardLayout();
});

document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.matches(ANSWER_SELECTOR)) return;

  cleanupPending?.();
  cleanupPending = null;
  resetKeyboardSlide();

  // Start restoring immediately, then keep correcting while the software
  // keyboard finishes its close animation and Safari releases its focus-pan.
  settleKeyboardClose();

  window.setTimeout(() => {
    baselineHeight = 0;
    document.documentElement.style.removeProperty("--team-keyboard-layout-height");
    syncVisualViewport();
    restoreOriginalView();
  }, 180);
});
