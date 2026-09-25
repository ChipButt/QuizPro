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
let keyboardWasOpen = false;

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
  const page = document.querySelector(PAGE_SELECTOR);

  clearKeyboardAlignmentTimers();
  cleanupPending?.();
  cleanupPending = null;

  keyboardWasOpen = false;
  setKeyboardSlide(0);
  forceKeyboardClasses(false);

  root.style.setProperty("--team-visible-top", "0px");
  root.style.setProperty("--team-visible-left", "0px");
  root.style.removeProperty("--team-keyboard-layout-height");

  if (page instanceof HTMLElement) {
    page.scrollTop = 0;
    page.scrollLeft = 0;
  }

  try {
    window.scrollTo({ left: originalScrollX, top: originalScrollY, behavior: "auto" });
  } catch {
    window.scrollTo(originalScrollX, originalScrollY);
  }

  baselineHeight = 0;

  // Some mobile Chrome versions finish their viewport restoration a frame or
  // two after the keyboard disappears. Re-assert the clean state so the blue
  // header/logo cannot remain stranded off-screen.
  [0, 60, 180].forEach((delay) => {
    window.setTimeout(() => {
      forceKeyboardClasses(false);
      setKeyboardSlide(0);
      root.style.setProperty("--team-visible-top", "0px");
      root.style.setProperty("--team-visible-left", "0px");
      if (page instanceof HTMLElement) page.scrollTop = 0;
      try {
        window.scrollTo({ left: originalScrollX, top: originalScrollY, behavior: "auto" });
      } catch {
        window.scrollTo(originalScrollX, originalScrollY);
      }
    }, delay);
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
  syncVisualViewport();

  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement) || !active.matches(ANSWER_SELECTOR)) {
    return;
  }

  const viewport = window.visualViewport;
  const viewportHeight = Math.max(180, viewport?.height ?? window.innerHeight);
  const layoutHeight = Math.max(baselineHeight || 0, window.innerHeight);
  const keyboardReduction = Math.max(0, layoutHeight - viewportHeight);
  const keyboardOpen = keyboardReduction >= KEYBOARD_OPEN_THRESHOLD_PX;

  if (!keyboardOpen) {
    if (keyboardWasOpen) finishKeyboardClose();
    return;
  }

  keyboardWasOpen = true;
  forceKeyboardClasses(true);
  resetKeyboardSlide();

  const page = document.querySelector(PAGE_SELECTOR);
  if (!(page instanceof HTMLElement)) return;

  const viewportTop = Math.max(0, viewport?.offsetTop ?? 0);
  const viewportBottom = viewportTop + viewportHeight;
  const inputRect = active.getBoundingClientRect();
  const safeBottom = viewportBottom - 18;
  const overlap = Math.max(0, inputRect.bottom - safeBottom);

  /*
   * Chrome/iOS/Android normally pans the focused field itself. Never call
   * scrollIntoView() here: that can compound the native pan and create the
   * large jump seen on some phones. If Chrome still leaves a small overlap,
   * correct only the quiz page's own scroll position and cap that correction.
   */
  if (overlap > 0) {
    const correction = Math.min(140, Math.ceil(overlap + 12));
    page.scrollTop = Math.max(0, page.scrollTop + correction);
  }
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
    syncVisualViewport();

    const viewportHeight = Math.max(
      180,
      window.visualViewport?.height ?? window.innerHeight,
    );
    const layoutHeight = Math.max(baselineHeight || 0, window.innerHeight);
    const keyboardReduction = Math.max(0, layoutHeight - viewportHeight);

    if (keyboardWasOpen && keyboardReduction < KEYBOARD_OPEN_THRESHOLD_PX) {
      finishKeyboardClose();
      return;
    }

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
   * Do not alter layout during pointerdown. Moving/fixing the page while
   * Safari is still resolving the tap can make the textarea move out from
   * under the finger, which causes iOS to drop the first focus attempt.
   * Native focus must complete before keyboard layout begins.
   */
}, true);

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  clearRestoreTimers();
  clearKeyboardAlignmentTimers();
  originalScrollX = preFocusScrollX;
  originalScrollY = preFocusScrollY;

  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  baselineHeight = Math.max(window.innerHeight, viewportHeight);
  keyboardWasOpen = false;
  syncVisualViewport();
  resetKeyboardSlide();

  /*
   * Leave native Safari focus/layout alone until visualViewport confirms the
   * keyboard is actually open. updateKeyboardSlide() then enables the
   * responsive keyboard layout.
   */
  forceKeyboardClasses(false);

  cleanupPending?.();
  cleanupPending = settleKeyboardLayout();
});

document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  cleanupPending?.();
  cleanupPending = null;
  clearKeyboardAlignmentTimers();

  // Mobile Chrome does not always emit the same viewport event sequence on
  // keyboard dismissal. Start the normal close watcher, with an immediate
  // hard-reset fallback so the header/logo always returns.
  settleKeyboardClose();
  window.setTimeout(() => {
    if (document.activeElement !== target) finishKeyboardClose();
  }, 40);
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
