# QuizPro question-history checking

The existing derived history at `data/question-history.json` is generated from all quizzes and saved rounds in `data/quiz-library.json` by `scripts/build-question-history.mjs`. The main-branch GitHub Actions workflow updates it after library changes.

## New quiz-writing workflow

1. Read the smaller `data/question-history.json` instead of the full multi-megabyte quiz library.
2. Run `node scripts/check-questions.mjs --file draft-questions.json` against the history. The input file contains an array of `{ "question": "...", "answer": "..." }` objects, or an object with a `questions` array. The checker never writes to the quiz library.
3. Treat `duplicate` as a rejection. Treat `review` as requiring manual comparison of the fact being tested; err on the side of replacing the candidate.
4. Manually assess every `no-match-found` question for synonymous answers, alternative phrasings, and facts not caught by lexical similarity. This result is **not a guarantee** of novelty.
5. Check replacements against both the permanent history and all already approved questions in the current seven-round draft.
6. Save the final quiz through the existing QuizPro app. The existing library-save mechanism and history workflow handle subsequent history updates.

For one question: `node scripts/check-questions.mjs --question "What is the capital of Canada?" --answer "Ottawa"`.

The checker returns JSON with status, matching historical questions, their answers, original quiz/round occurrences, and internal draft matches. A definite exact duplicate causes exit code 2; infrastructure or invalid-input failures cause exit code 1.

## Safety and scope

This is an additive, read-only helper. It does not modify React app behaviour, authentication, QuizPro's quiz storage, or anything in the Printful store or its integration. The original library and existing automation remain authoritative. The tests run in the existing question-history workflow.

**Known limitation:** no deterministic string-based checker can reliably identify *every* rewording that tests the same fact. Human/semantic review remains necessary before a question is approved. Approved drafts are not separately persisted by this script; they must be kept in a draft file or the existing quiz workflow until finalised.
