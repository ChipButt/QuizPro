const ANSWER_SELECTOR = ".question-team-card .answer-input-shell textarea";
const PAGE_SELECTOR = ".team-page.live-team-page";
const SHELL_SELECTOR = ".live-phone-shell";
const KEYBOARD_OPEN_THRESHOLD_PX = 100;

let baselineHeight = 0;
let cleanupPending = null;
let originalScrollX = 0;
let originalScrollY = 0;
let restoreTimers = [];
let keyboardCloseCleanup = null;
let keyboardAlignTimer = null;
let keyboardFallbackTimers = [];
let keyboardWasOpen = false;
let keyboardAlignmentApplied = false;

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

  /*
   * The live team page's normal resting position is the top of the document.
   * iOS can finish its own keyboard pan well after blur, so restore immediately
   * and, on close, keep re-asserting the clean state while the visual viewport
   * completes its final resize/scroll sequence.
   */
  originalScrollX = 0;
  originalScrollY = 0;
  applyCleanKeyboardClosedState();

  const reassertClosedState = () => {
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement && active.matches(ANSWER_SELECTOR)) {
      return;
    }
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
  const layoutHeight = Math.max(baselineHeight || 0, window.innerHeight);
  return Math.max(0, layoutHeight - viewportHeight);
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

  /*
   * The browser owns the native focus gesture and its initial pan. Once the
   * visual viewport has settled, capture that final viewport exactly once and
   * pin the fixed quiz page to it. Do not call scrollIntoView(), do not add a
   * second document scroll, and do not keep chasing visualViewport animation.
   */
  syncVisualViewport();
  keyboardWasOpen = true;
  keyboardAlignmentApplied = true;
  resetKeyboardSlide();

  const page = document.querySelector(PAGE_SELECTOR);
  if (page instanceof HTMLElement) {
    page.scrollTop = 0;
    page.scrollLeft = 0;
  }

  forceKeyboardClasses(true);
}

function settleKeyboardLayout() {
  const viewport = window.visualViewport;

  const scheduleAlignment = (delay = 140) => {
    if (keyboardAlignmentApplied) return;
    if (keyboardAlignTimer !== null) window.clearTimeout(keyboardAlignTimer);

    keyboardAlignTimer = window.setTimeout(() => {
      keyboardAlignTimer = null;
      updateKeyboardLayout();
    }, delay);
  };

  const onViewportChange = () => {
    const reduction = keyboardReductionPx();

    if (keyboardWasOpen && reduction < KEYBOARD_OPEN_THRESHOLD_PX) {
      finishKeyboardClose();
      return;
    }

    if (!keyboardAlignmentApplied) {
      // Track the native viewport only until it has settled. Once the keyboard
      // layout is applied, its anchor is intentionally frozen for this focus.
      syncVisualViewport();
      scheduleAlignment();
    }
  };

  viewport?.addEventListener("resize", onViewportChange);
  viewport?.addEventListener("scroll", onViewportChange);
  window.addEventListener("resize", onViewportChange);

  scheduleAlignment(180);

  // Short missed-event fallbacks. They can apply the layout once, never stack
  // repeated movements on top of Safari's own pan.
  keyboardFallbackTimers = [500, 900].map((delay) =>
    window.setTimeout(() => {
      if (!keyboardAlignmentApplied) updateKeyboardLayout();
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

  // Safari retains ownership of the native tap/focus gesture. Do not move,
  // focus or prevent anything here. Only establish the intended normal resting
  // position so a previous iOS keyboard pan can never become the next baseline.
  originalScrollX = 0;
  originalScrollY = 0;
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
  baselineHeight = Math.max(
    window.innerHeight,
    window.visualViewport?.height ?? 0,
  );
  keyboardWasOpen = false;
  keyboardAlignmentApplied = false;

  resetKeyboardSlide();
  forceKeyboardClasses(false);
  syncVisualViewport();

  cleanupPending = settleKeyboardLayout();
});

document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  // Focus loss is authoritative: restore immediately rather than waiting for a
  // particular visualViewport event sequence that differs between iPhones.
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
