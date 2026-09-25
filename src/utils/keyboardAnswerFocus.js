const ANSWER_SELECTOR = ".question-team-card .answer-input-shell textarea";
const PAGE_SELECTOR = ".team-page.live-team-page";
const SHELL_SELECTOR = ".live-phone-shell";
const ANSWER_KEYBOARD_OPEN_THRESHOLD_PX = 100;

let restoreTimers = [];
let keyboardCloseCleanup = null;
let answerKeyboardLayoutHeight = 0;
let answerKeyboardWasOpen = false;
let answerViewportCleanup = null;

function clearRestoreTimers() {
  restoreTimers.forEach((timer) => window.clearTimeout(timer));
  restoreTimers = [];

  keyboardCloseCleanup?.();
  keyboardCloseCleanup = null;
}

function clearAnswerViewportWatcher() {
  answerViewportCleanup?.();
  answerViewportCleanup = null;
}

function forceKeyboardClasses(enabled) {
  document.querySelector(PAGE_SELECTOR)?.classList.toggle("keyboard-active-page", enabled);
  document.querySelector(SHELL_SELECTOR)?.classList.toggle("keyboard-active", enabled);
}

function clearQuestionKeyboardVars() {
  const root = document.documentElement;
  root.style.setProperty("--team-keyboard-slide", "0px");
  root.style.setProperty("--team-visible-top", "0px");
  root.style.setProperty("--team-visible-left", "0px");
  root.style.removeProperty("--team-visible-height");
  root.style.removeProperty("--team-visible-width");
  root.style.removeProperty("--team-keyboard-layout-height");
}

function setQuestionKeyboardLayoutHeight() {
  if (answerKeyboardLayoutHeight <= 0) return;

  document.documentElement.style.setProperty(
    "--team-keyboard-layout-height",
    `${Math.round(answerKeyboardLayoutHeight)}px`,
  );
}

function resetQuestionPageOrigin({ force = false, preserveBaseline = false } = {}) {
  const active = document.activeElement;
  if (
    !force &&
    active instanceof HTMLTextAreaElement &&
    active.matches(ANSWER_SELECTOR)
  ) {
    return;
  }

  forceKeyboardClasses(false);
  clearQuestionKeyboardVars();
  if (!preserveBaseline) answerKeyboardLayoutHeight = 0;

  const page = document.querySelector(PAGE_SELECTOR);
  if (page instanceof HTMLElement) {
    page.scrollTop = 0;
    page.scrollLeft = 0;
  }

  const shell = document.querySelector(SHELL_SELECTOR);
  if (shell instanceof HTMLElement) {
    shell.scrollTop = 0;
    shell.scrollLeft = 0;
  }

  const scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    scrollingElement.scrollTop = 0;
    scrollingElement.scrollLeft = 0;
  }

  document.documentElement.scrollTop = 0;
  document.documentElement.scrollLeft = 0;
  if (document.body) {
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
  }

  try {
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  } catch {
    window.scrollTo(0, 0);
  }
}

function answerKeyboardReduction() {
  const viewportHeight = Math.max(
    180,
    window.visualViewport?.height ?? window.innerHeight,
  );
  return Math.max(0, answerKeyboardLayoutHeight - viewportHeight);
}

function restoreHiddenKeyboardState() {
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement) || !active.matches(ANSWER_SELECTOR)) {
    return;
  }

  if (answerKeyboardReduction() >= ANSWER_KEYBOARD_OPEN_THRESHOLD_PX) {
    return;
  }

  /*
   * iOS can dismiss the keyboard from its toolbar without blurring the textarea.
   * In that state focusout never fires, so restore the complete Quiz In origin
   * from the viewport expansion itself while retaining the baseline in case the
   * same focused textarea is tapped again to reopen the keyboard.
   */
  resetQuestionPageOrigin({ force: true, preserveBaseline: true });
}

function startAnswerViewportWatcher() {
  clearAnswerViewportWatcher();

  const viewport = window.visualViewport;

  const checkViewport = () => {
    const active = document.activeElement;
    if (!(active instanceof HTMLTextAreaElement) || !active.matches(ANSWER_SELECTOR)) {
      return;
    }

    const reduction = answerKeyboardReduction();

    if (reduction >= ANSWER_KEYBOARD_OPEN_THRESHOLD_PX) {
      answerKeyboardWasOpen = true;
      setQuestionKeyboardLayoutHeight();
      forceKeyboardClasses(true);
      return;
    }

    if (!answerKeyboardWasOpen) return;

    answerKeyboardWasOpen = false;
    restoreHiddenKeyboardState();

    /*
     * WebKit may finish the dismissal pan a frame or two after it reports the
     * viewport expanded. Reassert only while the keyboard remains closed.
     */
    window.requestAnimationFrame(restoreHiddenKeyboardState);
    [60, 180, 360].forEach((delay) => {
      window.setTimeout(restoreHiddenKeyboardState, delay);
    });
  };

  viewport?.addEventListener("resize", checkViewport);
  viewport?.addEventListener("scroll", checkViewport);
  window.addEventListener("resize", checkViewport);

  answerViewportCleanup = () => {
    viewport?.removeEventListener("resize", checkViewport);
    viewport?.removeEventListener("scroll", checkViewport);
    window.removeEventListener("resize", checkViewport);
  };

  window.setTimeout(checkViewport, 120);
}

function finishQuestionKeyboardClose() {
  clearAnswerViewportWatcher();
  answerKeyboardWasOpen = false;
  clearRestoreTimers();

  /*
   * A genuine focusout is authoritative even if WebKit has not yet updated
   * document.activeElement. Reset immediately, then reassert through the native
   * keyboard-dismiss animation so the logo/header returns with the rest of the
   * page rather than remaining above the visual viewport.
   */
  resetQuestionPageOrigin({ force: true });

  const viewport = window.visualViewport;
  const reassert = () => resetQuestionPageOrigin({ force: true });

  viewport?.addEventListener("resize", reassert);
  viewport?.addEventListener("scroll", reassert);
  window.addEventListener("resize", reassert);

  keyboardCloseCleanup = () => {
    viewport?.removeEventListener("resize", reassert);
    viewport?.removeEventListener("scroll", reassert);
    window.removeEventListener("resize", reassert);
  };

  restoreTimers = [0, 60, 180, 360, 700, 1000].map((delay) =>
    window.setTimeout(reassert, delay)
  );

  restoreTimers.push(
    window.setTimeout(() => {
      reassert();
      keyboardCloseCleanup?.();
      keyboardCloseCleanup = null;
    }, 1200),
  );
}

document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  /*
   * Measurement only, before the keyboard changes the visual viewport. Safari
   * still owns the tap/focus gesture; nothing is moved or prevented here.
   */
  if (answerKeyboardLayoutHeight <= 0) {
    answerKeyboardLayoutHeight = Math.max(
      window.innerHeight,
      window.visualViewport?.height ?? 0,
      document.documentElement.clientHeight,
    );
  }

  /*
   * If iOS dismissed the keyboard without blurring this already-focused field,
   * the next tap may not fire focusin. Keep the viewport watcher alive so its
   * resize event can put keyboard mode back when the keyboard reopens.
   */
  const active = document.activeElement;
  if (active === target && answerViewportCleanup === null) {
    startAnswerViewportWatcher();
  }
}, true);

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  clearRestoreTimers();
  clearAnswerViewportWatcher();
  clearQuestionKeyboardVars();

  if (answerKeyboardLayoutHeight <= 0) {
    answerKeyboardLayoutHeight = Math.max(
      window.innerHeight,
      window.visualViewport?.height ?? 0,
      document.documentElement.clientHeight,
    );
  }

  answerKeyboardWasOpen = false;
  setQuestionKeyboardLayoutHeight();
  forceKeyboardClasses(true);
  startAnswerViewportWatcher();
});

document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches(ANSWER_SELECTOR)) return;

  finishQuestionKeyboardClose();
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
