const ANSWER_SELECTOR = ".live-team-page .answer-input-shell textarea";
let noticeTimer = null;

function isQuizAnswerField(target) {
  return Boolean(target?.matches?.(ANSWER_SELECTOR));
}

function showPasteBlockedNotice() {
  let notice = document.getElementById("quizpro-paste-blocked");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "quizpro-paste-blocked";
    notice.className = "quizpro-paste-blocked";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.textContent = "Pasting is disabled — type your answer.";
    document.body.appendChild(notice);
  }

  notice.classList.remove("show");
  void notice.offsetWidth;
  notice.classList.add("show");

  if (noticeTimer) window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => notice?.classList.remove("show"), 2200);
}

function blockPasteLikeInput(event) {
  if (!isQuizAnswerField(event.target)) return;
  event.preventDefault();
  showPasteBlockedNotice();
}

document.addEventListener("paste", blockPasteLikeInput, true);
document.addEventListener("drop", blockPasteLikeInput, true);

document.addEventListener("beforeinput", (event) => {
  if (!isQuizAnswerField(event.target)) return;
  if (!["insertFromPaste", "insertFromPasteAsQuotation", "insertFromDrop"].includes(event.inputType)) return;
  event.preventDefault();
  showPasteBlockedNotice();
}, true);

document.addEventListener("keydown", (event) => {
  if (!isQuizAnswerField(event.target)) return;
  if (!(event.ctrlKey || event.metaKey) || String(event.key).toLowerCase() !== "v") return;
  event.preventDefault();
  showPasteBlockedNotice();
}, true);
