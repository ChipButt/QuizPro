const ANSWER_SELECTOR = ".question-team-card .answer-input-shell textarea";
const PAGE_SELECTOR = ".team-page.live-team-page";
const SHELL_SELECTOR = ".live-phone-shell";
const QUESTION_STAGE_SELECTOR = ".question-team-card .team-question-stage";
const QUESTION_STAGE_KEYBOARD_GAP_PX = 150;
const KEYBOARD_OPEN_THRESHOLD_PX = 100;
const QUESTION_STAGE_SAFE_TOP_PX = 12;
const QUESTION_STAGE_MIN_GAP_PX = 18;

let baselineHeight = 0;
let baselineViewportHeight = 0;
let stableViewportHeight = Math.max(
  window.visualViewport?.height ?? 0,
  window.innerHeight,
);
let cleanupPending = null;
let originalScrollX = 0;
let originalScrollY = 0;
let restoreTimers = [];
let keyboardCloseCleanup = null;
let keyboardAlignTimer = null;
let keyboardFallbackTimers = [];
let keyboardWasOpen = false;
let keyboardAlignmentApplied = false;
let keyboardAlignmentFrame = null;

function setKeyboardSlide(value) {
  const next = Math.max(0, Math.round(Number(value) || 0));
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

  if (keyboardAlignmentFrame !== null) {
    window.cancelAnimationFrame(keyboardAlignmentFrame);
    keyboardAlignmentFrame = null;
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

function restoreDocumentScroll() {
  try {
    window.scrollTo({ left: originalScrollX, top: originalScrollY, behavior: "auto" });
  } catch {
    window.scrollTo(originalScrollX, originalScrollY);
  }

  const scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    scrollingElement.scrollLeft = originalScrollX;
    scrollingElement.scrollTop = originalScrollY;
  }
}

function captureNormalKeyboardBaseline() {
  const page = document.querySelector(PAGE_SELECTOR);
  const pageHeight =
    page instanceof HTMLElement ? page.getBoundingClientRect().height : 0;
  const viewportHeight = Math.max(
    180,
    window.visualViewport?.height ?? window.innerHeight,
  );

  stableViewportHeight = Math.max(stableViewportHeight, viewportHeight);
  baselineViewportHeight = Math.max(stableViewportHeight, viewportHeight);
  baselineHeight = Math.max(
    180,
    Math.round(pageHeight || window.innerHeight || baselineViewportHeight),
  );
}

function applyCleanKeyboardClosedState() {
  const root = document.documentElement;
  const page = document.querySelector(PAGE_SELECTOR);

  forceKeyboardClasses(false);
  resetKeyboardSlide();

  root.style.setProperty("--team-visible-top", "0px");
  root.style.setProperty("--team-visible-left", "0px");
  root.style.removeProperty("--team-visible-height");
  root.style.removeProperty("--team-visible-width");
  root.style.removeProperty("--team-keyboard-layout-height");

  if (page instanceof HTMLElement) {
    page.scrollTop = 0;
    page.scrollLeft = 0;
  }

  restoreDocumentScroll();
}

function finishKeyboardClose({ watchViewport = false } = {}) {
  clearKeyboardAlignmentTimers();
  cleanupPending?.();
  cleanupPending = null;
  clearRestoreTimers();

  keyboardWasOpen = false;
  keyboardAlignmentApplied = false;
  baselineHeight = 0;
  baselineViewportHeight = 0;

  /*
   * The live team page always returns to the document origin. iOS can finish
   * its native focus pan after blur, so keep re-asserting this clean state for
   * a short period instead of trusting one visualViewport event.
   */
  originalScrollX = 0;
  originalScrollY = 0;
  applyCleanKeyboardClosedState();

  const reassertClosedState = () => {
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement && active.matches(ANSWER_SELECTOR)) {
      return;
    }

    const viewportHeight = Math.max(
      180,
      window.visualViewport?.height ?? window.innerHeight,
    );
    stableViewportHeight = Math.max(stableViewportHeight, viewportHeight);
    applyCleanKeyboardClosedState();
  };

  if (watchViewport) {
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", reassertClosedState);
    viewport?.addEventListener("scroll", reassertClosedState);
    window.addEventListener("resize", reassertClosedState);

    keyboardCloseCleanup = () => {
      viewport?.removeEventListener("resize", reassertClosedState);
      viewport?.removeEventListener("scroll", reassertClosedState);
      window.removeEventListener("resize", reassertClosedState);
    };
  }

  restoreTimers = [60, 180, 360, 700].map((delay) =>
    window.setTimeout(reassertClosedState, delay)
  );

  restoreTimers.push(
    window.setTimeout(() => {
      reassertClosedState();
      keyboardCloseCleanup?.();
      keyboardCloseCleanup = null;
    }, 900),
  );
}

function keyboardReductionPx() {
  const viewportHeight = Math.max(
    180,
    window.visualViewport?.height ?? window.innerHeight,
  );
  const normalViewportHeight = Math.max(
    baselineViewportHeight || 0,
    stableViewportHeight || 0,
  );

  return Math.max(0, normalViewportHeight - viewportHeight);
}

function applyDeterministicKeyboardAlignment() {
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement) || !active.matches(ANSWER_SELECTOR)) {
    return;
  }

  const page = document.querySelector(PAGE_SELECTOR);
  const stage = document.querySelector(QUESTION_STAGE_SELECTOR);
  if (!(page instanceof HTMLElement) || !(stage instanceof HTMLElement)) {
    return;
  }

  /*
   * From this point on the browser's focus pan is not allowed to define the
   * Quiz In layout. Freeze the normal pre-keyboard composition, cancel the
   * document pan, then move the complete phone shell exactly once.
   */
  const root = document.documentElement;
  root.style.setProperty(
    "--team-keyboard-layout-height",
    `${Math.round(baselineHeight)}px`,
  );
  root.style.setProperty("--team-visible-top", "0px");
  root.style.setProperty("--team-visible-left", "0px");
  resetKeyboardSlide();
  forceKeyboardClasses(true);

  page.scrollTop = 0;
  page.scrollLeft = 0;
  restoreDocumentScroll();

  keyboardAlignmentFrame = window.requestAnimationFrame(() => {
    keyboardAlignmentFrame = null;

    const current = document.activeElement;
    if (!(current instanceof HTMLTextAreaElement) || !current.matches(ANSWER_SELECTOR)) {
      return;
    }

    const viewportHeight = Math.max(
      180,
      window.visualViewport?.height ?? window.innerHeight,
    );
    const stageRect = stage.getBoundingClientRect();

    /*
     * Keep the entire question stage visible. Use the approved 150px clearance
     * above the keyboard whenever the physical viewport can accommodate it;
     * on a genuinely shorter viewport use the largest possible gap rather than
     * cropping the question.
     */
    const largestGapThatKeepsStageVisible = Math.max(
      QUESTION_STAGE_MIN_GAP_PX,
      viewportHeight - QUESTION_STAGE_SAFE_TOP_PX - stageRect.height,
    );
    const targetGap = Math.min(
      QUESTION_STAGE_KEYBOARD_GAP_PX,
      largestGapThatKeepsStageVisible,
    );
    const targetStageBottom = viewportHeight - targetGap;
    const requestedSlide = Math.max(0, stageRect.bottom - targetStageBottom);
    const maxSlideWithoutCroppingStage = Math.max(
      0,
      stageRect.top - QUESTION_STAGE_SAFE_TOP_PX,
    );
    const slide = Math.min(requestedSlide, maxSlideWithoutCroppingStage);

    setKeyboardSlide(slide);
    restoreDocumentScroll();

    /*
     * Some WebKit builds try one final document pan after the fixed layout has
     * been applied. Re-cancel that pan once; never recalculate or chase the
     * shell position, so first focus and later focuses use the same geometry.
     */
    keyboardFallbackTimers.push(
      window.setTimeout(restoreDocumentScroll, 90),
    );

    keyboardWasOpen = true;
    keyboardAlignmentApplied = true;
  });
}

function updateKeyboardLayout() {
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement) || !active.matches(ANSWER_SELECTOR)) {
    return;
  }

  if (keyboardReductionPx() < KEYBOARD_OPEN_THRESHOLD_PX) {
    if (keyboardWasOpen) finishKeyboardClose({ watchViewport: true });
    return;
  }

  if (!keyboardAlignmentApplied && keyboardAlignmentFrame === null) {
    applyDeterministicKeyboardAlignment();
  }
}

function settleKeyboardLayout() {
  const viewport = window.visualViewport;

  const scheduleAlignment = (delay = 140) => {
    if (keyboardAlignmentApplied || keyboardAlignmentFrame !== null) return;
    if (keyboardAlignTimer !== null) window.clearTimeout(keyboardAlignTimer);

    keyboardAlignTimer = window.setTimeout(() => {
      keyboardAlignTimer = null;
      updateKeyboardLayout();
    }, delay);
  };

  const onViewportChange = () => {
    const reduction = keyboardReductionPx();

    if (keyboardWasOpen && reduction < KEYBOARD_OPEN_THRESHOLD_PX) {
      finishKeyboardClose({ watchViewport: true });
      return;
    }

    if (!keyboardAlignmentApplied && keyboardAlignmentFrame === null) {
      scheduleAlignment();
    }
  };

  viewport?.addEventListener("resize", onViewportChange);
  viewport?.addEventListener("scroll", onViewportChange);
  window.addEventListener("resize", onViewportChange);

  scheduleAlignment(180);

  keyboardFallbackTimers = [500, 900].map((delay) =>
    window.setTimeout(() => {
      if (!keyboardAlignmentApplied && keyboardAlignmentFrame === null) {
        updateKeyboardLayout();
      }
    }, delay)
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

  /*
   * Do not focus, preventDefault or alter layout on pointerdown. Safari owns
   * the native focus gesture. Only capture the normal composition before it
   * begins moving anything.
   */
  originalScrollX = 0;
  originalScrollY = 0;
  captureNormalKeyboardBaseline();
}, true);

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  clearRestoreTimers();
  clearKeyboardAlignmentTimers();
  cleanupPending?.();
  cleanupPending = null;

  originalScrollX = 0;
  originalScrollY = 0;
  if (!baselineHeight || !baselineViewportHeight) {
    captureNormalKeyboardBaseline();
  }

  keyboardWasOpen = false;
  keyboardAlignmentApplied = false;
  resetKeyboardSlide();
  forceKeyboardClasses(false);

  cleanupPending = settleKeyboardLayout();
});

document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  finishKeyboardClose({ watchViewport: true });
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
