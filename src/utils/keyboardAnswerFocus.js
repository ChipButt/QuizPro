const ANSWER_SELECTOR = ".question-team-card .answer-input-shell textarea";
const PAGE_SELECTOR = ".team-page.live-team-page";
const SHELL_SELECTOR = ".live-phone-shell";
const QUESTION_STAGE_KEYBOARD_GAP_PX = 150;
const QUESTION_STAGE_SELECTOR = ".question-team-card .team-question-stage";
const KEYBOARD_OPEN_THRESHOLD_PX = 100;

let baselineHeight = 0;
let cleanupPending = null;
let originalScrollX = 0;
let originalScrollY = 0;
let preFocusScrollX = 0;
let preFocusScrollY = 0;
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

function holdDocumentPosition() {
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

function restoreOriginalView() {
  resetKeyboardSlide();
  holdDocumentPosition();
}

function finishKeyboardClose() {
  const root = document.documentElement;

  /*
   * Return the translated page, the document scroll position and the header
   * state in one synchronous frame. This prevents the content from snapping
   * back first and the blue header/logo appearing a moment later.
   */
  root.style.setProperty("--team-keyboard-slide", "0px");
  holdDocumentPosition();
  root.style.setProperty("--team-visible-top", "0px");
  root.style.setProperty("--team-visible-left", "0px");
  root.style.removeProperty("--team-keyboard-layout-height");
  baselineHeight = 0;
  forceKeyboardClasses(false);
  holdDocumentPosition();

  window.requestAnimationFrame(() => {
    holdDocumentPosition();
    window.requestAnimationFrame(holdDocumentPosition);
  });
}

function settleKeyboardClose() {
  clearRestoreTimers();

  /*
   * React's textarea onBlur removes its keyboard class immediately, but iOS
   * Safari continues animating visualViewport for several hundred ms. Keep
   * reasserting keyboard mode during that closing animation so Safari cannot
   * leave the page panned above the logo.
   */
  const delays = [0, 30, 70, 120, 180, 260, 380, 520, 700, 900, 1200, 1500];
  let finished = false;

  const tryRestore = (isLast = false) => {
    if (finished) return;

    /*
     * Keep the page in its keyboard-lifted position for the whole keyboard
     * close animation. Do not reset the transform early: that was what made
     * the main page return before the header/logo.
     */
    forceKeyboardClasses(true);
    holdDocumentPosition();

    const viewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
    const targetHeight = Math.max(1, Math.round(baselineHeight || window.innerHeight));
    const keyboardStillOpen = targetHeight - viewportHeight >= 60;

    if (!keyboardStillOpen || isLast) {
      finished = true;
      finishKeyboardClose();
    }
  };

  restoreTimers = delays.map((delay, index) => window.setTimeout(
    () => tryRestore(index === delays.length - 1),
    delay,
  ));
}

function updateKeyboardSlide() {
  // Safari must not be allowed to scroll the document underneath our own
  // keyboard translation. Reassert the pre-focus document position first.
  holdDocumentPosition();
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
   * 150px above that edge. If it is already at least 150px clear, do not move it.
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

document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  // Capture the real page position before Safari gets a chance to focus-pan.
  preFocusScrollX = window.scrollX;
  preFocusScrollY = window.scrollY;
  originalScrollX = preFocusScrollX;
  originalScrollY = preFocusScrollY;

  /*
   * iOS Safari's default textarea focus action scrolls the document toward the
   * bottom before visualViewport settles. Cancel that default and perform the
   * focus ourselves with preventScroll so the ONLY movement afterwards is our
   * calculated .team-question-stage keyboard lift.
   */
  event.preventDefault();
  forceKeyboardClasses(true);

  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
    holdDocumentPosition();
  }

  // A prevented pointerdown does not place the caret from the tap. Put it at
  // the end, which is the expected behaviour for a quiz-answer text box.
  try {
    const end = target.value.length;
    target.setSelectionRange(end, end);
  } catch {
    // Some browser/input modes do not expose selection ranges.
  }

  holdDocumentPosition();
  window.requestAnimationFrame(holdDocumentPosition);
}, true);

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  clearRestoreTimers();
  originalScrollX = preFocusScrollX;
  originalScrollY = preFocusScrollY;
  holdDocumentPosition();

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

  // Keep the current keyboard lift in place while Safari closes. The complete
  // page, including the header/logo, is restored together once it is closed.
  forceKeyboardClasses(true);
  settleKeyboardClose();
});
