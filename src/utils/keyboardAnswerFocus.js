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
let keyboardAlignTimer = null;
let keyboardFallbackTimers = [];
let keyboardCloseCleanup = null;
let currentKeyboardSlide = 0;

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

function setKeyboardSlide(value) {
  const next = Math.max(0, Math.round(Number(value) || 0));
  currentKeyboardSlide = next;
  document.documentElement.style.setProperty("--team-keyboard-slide", `${next}px`);
}

function resetKeyboardSlide() {
  setKeyboardSlide(0);
}

function clearKeyboardAlignmentTimers() {
  if (keyboardAlignTimer !== null) {
    window.clearTimeout(keyboardAlignTimer);
    keyboardAlignTimer = null;
  }
  keyboardFallbackTimers.forEach((timer) => window.clearTimeout(timer));
  keyboardFallbackTimers = [];
}

function clearRestoreTimers() {
  restoreTimers.forEach((timer) => window.clearTimeout(timer));
  restoreTimers = [];

  keyboardCloseCleanup?.();
  keyboardCloseCleanup = null;
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
  setKeyboardSlide(0);
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
   * Restore as soon as iOS reports that the visual viewport has expanded back
   * to the non-keyboard size. This avoids the old timer-driven pause after the
   * keyboard had already visibly disappeared.
   */
  const viewport = window.visualViewport;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;

    keyboardCloseCleanup?.();
    keyboardCloseCleanup = null;
    restoreTimers.forEach((timer) => window.clearTimeout(timer));
    restoreTimers = [];

    finishKeyboardClose();
  };

  const checkKeyboardClosed = () => {
    if (finished) return;

    forceKeyboardClasses(true);
    holdDocumentPosition();

    const viewportHeight = Math.round(viewport?.height ?? window.innerHeight);
    const targetHeight = Math.max(1, Math.round(baselineHeight || window.innerHeight));
    const keyboardReduction = Math.max(0, targetHeight - viewportHeight);

    if (keyboardReduction < KEYBOARD_OPEN_THRESHOLD_PX) {
      finish();
    }
  };

  viewport?.addEventListener("resize", checkKeyboardClosed);
  viewport?.addEventListener("scroll", checkKeyboardClosed);
  window.addEventListener("resize", checkKeyboardClosed);

  keyboardCloseCleanup = () => {
    viewport?.removeEventListener("resize", checkKeyboardClosed);
    viewport?.removeEventListener("scroll", checkKeyboardClosed);
    window.removeEventListener("resize", checkKeyboardClosed);
  };

  // Check immediately in case Safari has already expanded the viewport by the
  // time blur fires.
  checkKeyboardClosed();

  // Emergency fallback only. Normal restoration should happen from the first
  // viewport event that reports the keyboard closed.
  restoreTimers = [
    window.setTimeout(checkKeyboardClosed, 120),
    window.setTimeout(checkKeyboardClosed, 260),
    window.setTimeout(finish, 700),
  ];
}

function updateKeyboardSlide() {
  // Safari must not be allowed to scroll the document underneath our own
  // keyboard translation. Reassert the pre-focus document position first.
  holdDocumentPosition();
  syncVisualViewport();

  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement) || !active.matches(ANSWER_SELECTOR)) {
    return;
  }

  const viewport = window.visualViewport;
  const viewportHeight = Math.max(180, viewport?.height ?? window.innerHeight);
  const viewportTop = Math.max(0, viewport?.offsetTop ?? 0);
  const viewportBottom = viewportTop + viewportHeight;
  const layoutHeight = Math.max(baselineHeight || 0, window.innerHeight);
  const keyboardReduction = Math.max(0, layoutHeight - viewportHeight);
  const keyboardOpen = keyboardReduction >= KEYBOARD_OPEN_THRESHOLD_PX;

  if (!keyboardOpen) return;

  const questionStage = document.querySelector(QUESTION_STAGE_SELECTOR);
  if (!(questionStage instanceof Element)) return;

  /*
   * Do NOT reset the page to zero before measuring. The stage rect already
   * includes the current shell translation, so add currentKeyboardSlide back
   * to recover its unshifted bottom without creating a visible jump.
   */
  const stageRect = questionStage.getBoundingClientRect();
  const unshiftedStageBottom = stageRect.bottom + currentKeyboardSlide;

  /*
   * visualViewport.bottom is the top edge of the software keyboard. Make one
   * move to the final target where .team-question-stage ends exactly 150px
   * above the keyboard.
   */
  const requiredShift = Math.max(
    0,
    unshiftedStageBottom + QUESTION_STAGE_KEYBOARD_GAP_PX - viewportBottom,
  );

  setKeyboardSlide(requiredShift);
}

function settleKeyboardLayout() {
  const viewport = window.visualViewport;

  /*
   * iOS emits a stream of visualViewport resize/scroll events while the
   * keyboard animates. Debounce them so the page does not chase every
   * intermediate keyboard position. Once the viewport has been quiet briefly,
   * calculate one final alignment and move the page once.
   */
  const scheduleAlignment = (delay = 110) => {
    if (keyboardAlignTimer !== null) window.clearTimeout(keyboardAlignTimer);
    keyboardAlignTimer = window.setTimeout(() => {
      keyboardAlignTimer = null;
      updateKeyboardSlide();
    }, delay);
  };

  const onViewportChange = () => {
    holdDocumentPosition();
    syncVisualViewport();
    scheduleAlignment();
  };

  viewport?.addEventListener("resize", onViewportChange);
  viewport?.addEventListener("scroll", onViewportChange);
  window.addEventListener("resize", onViewportChange);

  scheduleAlignment(180);

  // Fallback checks only correct the position if an iOS viewport event was
  // missed. Because measurement accounts for the current translation, these
  // do not create a reset/jump when the page is already aligned.
  keyboardFallbackTimers = [650, 1100].map((delay) =>
    window.setTimeout(updateKeyboardSlide, delay)
  );

  return () => {
    clearKeyboardAlignmentTimers();
    viewport?.removeEventListener("resize", onViewportChange);
    viewport?.removeEventListener("scroll", onViewportChange);
    window.removeEventListener("resize", onViewportChange);
  };
}

document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  // Capture the real page position before Safari performs its native focus.
  preFocusScrollX = window.scrollX;
  preFocusScrollY = window.scrollY;
  originalScrollX = preFocusScrollX;
  originalScrollY = preFocusScrollY;

  /*
   * Do not prevent the pointer event and do not call focus() ourselves.
   * iPhone Safari must own the actual focus gesture or it can briefly open
   * the software keyboard and immediately dismiss it. We only prepare the
   * fixed page mode here; focusin handles the positioning once focus is real.
   */
  forceKeyboardClasses(true);
}, true);

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  clearRestoreTimers();
  clearKeyboardAlignmentTimers();
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
  clearKeyboardAlignmentTimers();

  // Keep the current keyboard lift in place while Safari closes. The complete
  // page, including the header/logo, is restored together once it is closed.
  forceKeyboardClasses(true);
  settleKeyboardClose();
});


/* ---------- Team-name keyboard: move the complete page as one composition ---------- */
const TEAM_NAME_INPUT_SELECTOR = ".team-page.live-team-page.team-name-screen #team-name";
const TEAM_NAME_PAGE_SELECTOR = ".team-page.live-team-page.team-name-screen";
const TEAM_NAME_SHELL_SELECTOR = ".live-phone-shell.team-name-screen";
const TEAM_NAME_KEYBOARD_GAP_PX = 20;

let teamNameBaselineHeight = 0;
let teamNameOriginalScrollX = 0;
let teamNameOriginalScrollY = 0;
let teamNameKeyboardSlide = 0;
let teamNameAlignTimer = null;
let teamNameFallbackTimers = [];
let teamNameLayoutCleanup = null;
let teamNameCloseCleanup = null;

function setTeamNameKeyboardSlide(value) {
  const next = Math.max(0, Math.round(Number(value) || 0));
  teamNameKeyboardSlide = next;
  document.documentElement.style.setProperty("--team-name-keyboard-slide", `${next}px`);
}

function holdTeamNameDocumentPosition() {
  try {
    window.scrollTo(teamNameOriginalScrollX, teamNameOriginalScrollY);
  } catch {
    window.scrollTo({
      left: teamNameOriginalScrollX,
      top: teamNameOriginalScrollY,
      behavior: "auto",
    });
  }

  const scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    scrollingElement.scrollLeft = teamNameOriginalScrollX;
    scrollingElement.scrollTop = teamNameOriginalScrollY;
  }
}

function clearTeamNameAlignmentTimers() {
  if (teamNameAlignTimer !== null) {
    window.clearTimeout(teamNameAlignTimer);
    teamNameAlignTimer = null;
  }
  teamNameFallbackTimers.forEach((timer) => window.clearTimeout(timer));
  teamNameFallbackTimers = [];
}

function setTeamNameKeyboardClasses(enabled) {
  const page = document.querySelector(TEAM_NAME_PAGE_SELECTOR);
  const shell = document.querySelector(TEAM_NAME_SHELL_SELECTOR);

  page?.classList.toggle("team-name-keyboard-active-page", enabled);
  shell?.classList.toggle("team-name-keyboard-active", enabled);

  if (page) {
    page.classList.toggle(
      "team-name-keyboard-tall-baseline",
      enabled && teamNameBaselineHeight > 760,
    );
  }
}

function finishTeamNameKeyboardClose() {
  clearTeamNameAlignmentTimers();
  teamNameLayoutCleanup?.();
  teamNameLayoutCleanup = null;
  teamNameCloseCleanup?.();
  teamNameCloseCleanup = null;

  setTeamNameKeyboardSlide(0);
  holdTeamNameDocumentPosition();
  setTeamNameKeyboardClasses(false);

  const root = document.documentElement;
  root.style.removeProperty("--team-name-keyboard-layout-height");

  teamNameBaselineHeight = 0;

  window.requestAnimationFrame(() => {
    holdTeamNameDocumentPosition();
  });
}

function updateTeamNameKeyboardSlide() {
  const input = document.querySelector(TEAM_NAME_INPUT_SELECTOR);
  if (!(input instanceof HTMLInputElement)) return;
  if (document.activeElement !== input) return;

  const viewport = window.visualViewport;
  const viewportHeight = Math.max(180, viewport?.height ?? window.innerHeight);
  const layoutHeight = Math.max(teamNameBaselineHeight || 0, window.innerHeight);
  const keyboardReduction = Math.max(0, layoutHeight - viewportHeight);

  if (keyboardReduction < KEYBOARD_OPEN_THRESHOLD_PX) return;

  const root = document.documentElement;
  root.style.setProperty(
    "--team-name-keyboard-layout-height",
    `${Math.round(layoutHeight)}px`,
  );

  setTeamNameKeyboardClasses(true);
  holdTeamNameDocumentPosition();

  const viewportTop = Math.max(0, viewport?.offsetTop ?? 0);
  const viewportBottom = viewportTop + viewportHeight;
  const inputRect = input.getBoundingClientRect();
  const unshiftedInputBottom = inputRect.bottom + teamNameKeyboardSlide;

  const requiredShift = Math.max(
    0,
    unshiftedInputBottom + TEAM_NAME_KEYBOARD_GAP_PX - viewportBottom,
  );

  setTeamNameKeyboardSlide(requiredShift);
}

function startTeamNameKeyboardLayout() {
  clearTeamNameAlignmentTimers();
  teamNameLayoutCleanup?.();

  const viewport = window.visualViewport;

  const scheduleAlignment = (delay = 110) => {
    if (teamNameAlignTimer !== null) window.clearTimeout(teamNameAlignTimer);
    teamNameAlignTimer = window.setTimeout(() => {
      teamNameAlignTimer = null;
      updateTeamNameKeyboardSlide();
    }, delay);
  };

  const onViewportChange = () => {
    holdTeamNameDocumentPosition();
    scheduleAlignment();
  };

  viewport?.addEventListener("resize", onViewportChange);
  viewport?.addEventListener("scroll", onViewportChange);
  window.addEventListener("resize", onViewportChange);

  scheduleAlignment(160);
  teamNameFallbackTimers = [600, 1000].map((delay) =>
    window.setTimeout(updateTeamNameKeyboardSlide, delay)
  );

  teamNameLayoutCleanup = () => {
    clearTeamNameAlignmentTimers();
    viewport?.removeEventListener("resize", onViewportChange);
    viewport?.removeEventListener("scroll", onViewportChange);
    window.removeEventListener("resize", onViewportChange);
  };
}

function settleTeamNameKeyboardClose() {
  teamNameLayoutCleanup?.();
  teamNameLayoutCleanup = null;
  clearTeamNameAlignmentTimers();

  const viewport = window.visualViewport;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    finishTeamNameKeyboardClose();
  };

  const checkClosed = () => {
    if (finished) return;

    const viewportHeight = Math.round(viewport?.height ?? window.innerHeight);
    const targetHeight = Math.max(
      1,
      Math.round(teamNameBaselineHeight || window.innerHeight),
    );
    const keyboardReduction = Math.max(0, targetHeight - viewportHeight);

    if (keyboardReduction < KEYBOARD_OPEN_THRESHOLD_PX) finish();
  };

  viewport?.addEventListener("resize", checkClosed);
  viewport?.addEventListener("scroll", checkClosed);
  window.addEventListener("resize", checkClosed);

  const fallback = window.setTimeout(finish, 700);

  teamNameCloseCleanup = () => {
    viewport?.removeEventListener("resize", checkClosed);
    viewport?.removeEventListener("scroll", checkClosed);
    window.removeEventListener("resize", checkClosed);
    window.clearTimeout(fallback);
  };

  checkClosed();
}

document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches(TEAM_NAME_INPUT_SELECTOR)) return;

  teamNameOriginalScrollX = window.scrollX;
  teamNameOriginalScrollY = window.scrollY;
  teamNameBaselineHeight = Math.max(
    window.innerHeight,
    window.visualViewport?.height ?? 0,
  );

  // Do not interfere with Safari's native focus gesture. Just prepare to move
  // the complete Team Name page once the keyboard is actually visible.
  startTeamNameKeyboardLayout();
}, true);

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches(TEAM_NAME_INPUT_SELECTOR)) return;

  if (!teamNameBaselineHeight) {
    teamNameOriginalScrollX = window.scrollX;
    teamNameOriginalScrollY = window.scrollY;
    teamNameBaselineHeight = Math.max(
      window.innerHeight,
      window.visualViewport?.height ?? 0,
    );
  }

  startTeamNameKeyboardLayout();
});

document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches(TEAM_NAME_INPUT_SELECTOR)) return;

  settleTeamNameKeyboardClose();
});
