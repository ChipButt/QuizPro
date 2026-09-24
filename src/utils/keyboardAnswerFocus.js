const ANSWER_SELECTOR = ".question-team-card .answer-input-shell textarea";
const PAGE_SELECTOR = ".team-page.live-team-page";
const SHELL_SELECTOR = ".live-phone-shell";
const QUESTION_STAGE_KEYBOARD_GAP_PX = 20;
const QUESTION_STAGE_SELECTOR = ".question-team-card .team-question-stage";
const KEYBOARD_OPEN_THRESHOLD_PX = 100;

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

function forceKeyboardClasses(enabled) {
  document.querySelector(PAGE_SELECTOR)?.classList.toggle("keyboard-active-page", enabled);
  document.querySelector(SHELL_SELECTOR)?.classList.toggle("keyboard-active", enabled);
}

function restoreOriginalView() {
  resetKeyboardSlide();

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
  if (!(active instanceof HTMLTextAreaElement) || !active.matches(ANSWER_SELECTOR)) {
    resetKeyboardSlide();
    return;
  }

  const viewport = window.visualViewport;
  const viewportHeight = Math.max(180, viewport?.height ?? window.innerHeight);
  const viewportTop = Math.max(0, viewport?.offsetTop ?? 0);
  const viewportBottom = viewportTop + viewportHeight;
  const layoutHeight = Math.max(baselineHeight || 0, window.innerHeight);
  const keyboardReduction = Math.max(0, layoutHeight - viewportHeight);
  const keyboardOpen = keyboardReduction >= KEYBOARD_OPEN_THRESHOLD_PX;

  if (!keyboardOpen) {
    resetKeyboardSlide();
    return;
  }

  /*
   * Always measure from the intact, unshifted layout. The alignment target is
   * the complete blue/yellow Question Content Area (.team-question-stage),
   * not the textarea itself.
   */
  resetKeyboardSlide();
  const questionStage = document.querySelector(QUESTION_STAGE_SELECTOR);
  if (!(questionStage instanceof Element)) {
    resetKeyboardSlide();
    return;
  }
  const stageRect = questionStage.getBoundingClientRect();

  /*
   * visualViewport.bottom is the top edge of the software keyboard. Lift the
   * WHOLE quiz screen until the bottom of .team-question-stage sits exactly
   * 20px above that edge. If it is already at least 20px clear, do not move it.
   */
  const requiredShift = Math.max(
    0,
    stageRect.bottom + QUESTION_STAGE_KEYBOARD_GAP_PX - viewportBottom,
  );

  document.documentElement.style.setProperty(
    "--team-keyboard-slide",
    `${Math.ceil(requiredShift)}px`,
  );
}

function settleKeyboardLayout() {
  const delays = [0, 24, 60, 100, 160, 240, 360, 520, 760, 1050, 1400];
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
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  clearRestoreTimers();
  originalScrollX = window.scrollX;
  originalScrollY = window.scrollY;

  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  baselineHeight = Math.max(window.innerHeight, viewportHeight);
  syncVisualViewport();
  resetKeyboardSlide();

  /*
   * Apply the keyboard classes synchronously rather than waiting for React's
   * focus state render. That prevents Safari's initial focus-pan from winning
   * the race before our fixed-layout keyboard mode is active.
   */
  forceKeyboardClasses(true);

  cleanupPending?.();
  cleanupPending = settleKeyboardLayout();
});

document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  cleanupPending?.();
  cleanupPending = null;
  resetKeyboardSlide();

  settleKeyboardClose();

  window.setTimeout(() => {
    baselineHeight = 0;
    document.documentElement.style.removeProperty("--team-keyboard-layout-height");
    syncVisualViewport();
    restoreOriginalView();
    forceKeyboardClasses(false);
  }, 180);
});
