# QuizPro simplification archive

This note records the functionality removed from the visible Quizmaster navigation on 2026-09-02 so it can be restored later without having to rediscover how it worked.

## Visible Quizmaster pages after simplification

1. Dashboard
2. Quizzes
3. Live Quiz

## Functionality removed from separate navigation pages

### Media Library

Previously: `HostPages.jsx` exported `MediaLibraryPage`.

What it did:
- Stored uploaded image/audio items in `state.media`.
- Grouped media by quiz round.
- Allowed image/audio uploads separately from the question editor.

What replaced it:
- Picture files are uploaded directly inside each Picture question.
- Audio files are uploaded directly inside each Music question.
- Existing `state.media` data is not deleted, and the old `MediaLibraryPage` code remains in `HostPages.jsx` if a separate library is wanted again.

### Teams

Previously: `LiveHostPages.jsx` exported `TeamManagerPage` as a separate page.

What it did:
- Added a paid team with table number and player count.
- Generated a unique QR code and team token.
- Allowed table/player edits, QR regeneration and team removal.
- Displayed whether each team device was connected.

What replaced it:
- The same team setup and QR workflow now lives at the top of the single Live Quiz page.
- The original `TeamManagerPage` implementation remains in `LiveHostPages.jsx`.

### Marking

Previously: `HostPages.jsx` exported `MarkingPage`.

What it did:
- Listed submitted answers for manual checking.
- Allowed quizmaster score decisions.

What replaced it:
- The current question's team answers and 0 / half / correct marking controls now appear directly on the Live Quiz page.
- The original `MarkingPage` remains in `HostPages.jsx`.

### Results

Previously: `HostPages.jsx` exported `ResultsPage`.

What it did:
- Showed the full leaderboard.
- Saved completed quiz result snapshots.
- Included projection controls.

What replaced it:
- The current leaderboard is visible on the Live Quiz page and optionally on the Dashboard.
- The final-place reveal from last to first remains on the Live Quiz page.
- The old completed archive/projection UI still exists in `ResultsPage` if required later.

### Settings

Previously: `HostPages.jsx` exported `SettingsPage`.

What it did:
- Displayed join code/live status.
- Allowed registration toggle.
- Allowed venue/time editing for the selected quiz.
- Included a destructive clear-workspace button.

What replaced it:
- Team joining is now entirely QR-based from the Live Quiz page.
- Live state is controlled in the Live Quiz workflow rather than a settings screen.
- Venue/time/status fields remain in the quiz data model for compatibility but are no longer presented in the simplified builder.
- Clear workspace is intentionally not exposed in the simplified UI.

### Old Dashboard

Previously: `HostPages.jsx` exported `DashboardPage` with upcoming quizzes, live-room health, build progress and several panels.

What replaced it:
- A smaller dashboard shows prepared quiz count, live team count, current leader and the live leaderboard when a quiz is running.
- The original dashboard code remains in `HostPages.jsx`.

## Quiz builder fields hidden, not deleted

The simplified round-first builder intentionally hides these older per-question/per-quiz controls to reduce clutter:
- Quiz date, time, venue and workflow status.
- Question category and difficulty.
- Per-question time limit.
- Per-question question-type selector.
- Automatic-marking toggle.
- Separate round instructions/scoring-rules text areas.
- Accepted-answer alternatives UI.

The underlying data fields remain in saved quiz objects so older quizzes continue to load and the controls can be restored later if wanted.
