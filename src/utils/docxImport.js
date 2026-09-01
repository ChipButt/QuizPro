const MAMMOTH_CDN = "https://cdn.jsdelivr.net/npm/mammoth@1.9.1/mammoth.browser.min.js";

let mammothPromise;

function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (mammothPromise) return mammothPromise;

  mammothPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MAMMOTH_CDN;
    script.async = true;
    script.onload = () => {
      if (window.mammoth) resolve(window.mammoth);
      else reject(new Error("The DOCX reader loaded, but Mammoth was not available."));
    };
    script.onerror = () => reject(new Error("Could not load the DOCX reader. Check the internet connection and try again."));
    document.head.appendChild(script);
  });

  return mammothPromise;
}

function cleanLine(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[\t ]+/g, " ")
    .trim();
}

function stripQuestionPrefix(value = "") {
  return cleanLine(value)
    .replace(/^\s*(?:Q(?:uestion)?\s*[:.-]\s*)/i, "")
    .replace(/^\s*\d+\s*[.)-]\s*(?:Q(?:uestion)?\s*[:.-]\s*)?/i, "")
    .trim();
}

function parseRoundHeading(line) {
  const cleaned = cleanLine(line);

  const numbered = cleaned.match(/^round\s*(\d+)\s*(?:[-—:]+\s*)?(.*)$/i);
  if (numbered) {
    return {
      number: Number(numbered[1]),
      title: cleanLine(numbered[2]) || `Round ${numbered[1]}`,
      raw: cleaned,
    };
  }

  const unnumbered = cleaned.match(/^round\s*(?:[-—:]+\s*)?(.+)$/i);
  if (unnumbered) {
    return {
      number: null,
      title: cleanLine(unnumbered[1]) || "Round",
      raw: cleaned,
    };
  }

  if (/^tie\s*breaker$/i.test(cleaned)) {
    return { number: null, title: "Tie Breaker", raw: cleaned };
  }

  return null;
}

function roundTypeFromTitle(title = "") {
  const lower = title.toLowerCase();
  if (lower.includes("picture") || lower.includes("name the") || lower.includes("eye know")) return "Picture round";
  if (lower.includes("music") || lower.includes("song") || lower.includes("scary songs")) return "Music round";
  if (lower.includes("multiple choice")) return "Multiple choice round";
  if (lower.includes("nearest")) return "Nearest-wins question";
  if (lower.includes("numerical")) return "Numerical round";
  return "Standard question round";
}

function isAnswerLine(line) {
  return /^(?:answer|ans|a)\s*[:.-]\s*.+/i.test(cleanLine(line));
}

function answerFromLine(line) {
  return cleanLine(line).replace(/^(?:answer|ans|a)\s*[:.-]\s*/i, "").trim();
}

function shouldIgnoreLooseLine(line) {
  const cleaned = cleanLine(line);
  if (!cleaned) return true;
  if (/^(?:question\s*\d+\s*)?info\s*:/i.test(cleaned)) return true;
  if (/^adjusted answer\s*:/i.test(cleaned)) return true;
  if (/^round\s*\d+\s*[-—:]?.*answers?\)?$/i.test(cleaned)) return true;
  return false;
}

function buildQuestion(buffer, answer, number) {
  const questionText = buffer
    .map(stripQuestionPrefix)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!questionText || !answer) return null;
  return { number, text: questionText, answer };
}

export function parseQuizText(rawText, fileName = "Imported quiz.docx") {
  const lines = String(rawText ?? "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const rounds = [];
  const warnings = [];
  let currentRound = null;
  let buffer = [];

  function ensureRound() {
    if (!currentRound) {
      currentRound = {
        title: "General Questions",
        type: "Standard question round",
        questions: [],
      };
      rounds.push(currentRound);
    }
    return currentRound;
  }

  function flushLooseBuffer(context = "end of round") {
    const loose = buffer.filter((line) => !shouldIgnoreLooseLine(line));
    if (loose.length) {
      warnings.push(`Ignored ${loose.length} line${loose.length === 1 ? "" : "s"} without a labelled answer near ${context}: ${loose.slice(0, 2).join(" / ")}`);
    }
    buffer = [];
  }

  for (const line of lines) {
    const heading = parseRoundHeading(line);
    if (heading) {
      flushLooseBuffer(currentRound?.title || "the start of the document");

      // Some quiz documents contain a second heading such as "Round 5 - Name the Celebrity (Answers)".
      // Do not create a duplicate round just for an answer-sheet heading.
      if (/\(answers?\)|\banswers?$/i.test(heading.title)) {
        continue;
      }

      currentRound = {
        title: heading.title,
        type: roundTypeFromTitle(heading.title),
        questions: [],
      };
      rounds.push(currentRound);
      continue;
    }

    if (isAnswerLine(line)) {
      const round = ensureRound();
      const answer = answerFromLine(line);
      const question = buildQuestion(buffer, answer, round.questions.length + 1);
      if (question) round.questions.push(question);
      else warnings.push(`Found an answer without a usable question: ${line}`);
      buffer = [];
      continue;
    }

    if (!shouldIgnoreLooseLine(line)) buffer.push(line);
  }

  flushLooseBuffer(currentRound?.title || "the end of the document");

  const usableRounds = rounds.filter((round) => round.title || round.questions.length);
  const questionCount = usableRounds.reduce((total, round) => total + round.questions.length, 0);
  const title = fileName.replace(/\.docx$/i, "").trim() || "Imported quiz";

  return {
    title,
    rounds: usableRounds,
    questionCount,
    warnings,
  };
}

export async function importQuizDocx(file) {
  if (!file?.name?.toLowerCase().endsWith(".docx")) {
    throw new Error("Please choose a .docx Word document.");
  }

  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const parsed = parseQuizText(result.value, file.name);

  if (!parsed.rounds.length || !parsed.questionCount) {
    throw new Error("I could not find labelled question/answer pairs in this document. Questions should be followed by lines such as ‘Answer: ...’ or ‘A: ...’. ");
  }

  return parsed;
}
