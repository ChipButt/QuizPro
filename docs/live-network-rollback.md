# QuizPro live multiplayer safety and rollback

Known working baseline (before iPhone focus and planned cross-network relay):
`4b10b97c504189f2310a3464d739f0242b8a895f`

Production currently uses PeerJS/WebRTC. A Cloudflare relay must not replace it until
live cross-network join, answer submission, host progression, reconnect, image,
leaderboard, end-of-quiz, and mobile keyboard tests pass.

**Instant emergency rollback** (from an authenticated GitHub checkout):
`git revert <change-commit>` on main, then confirm GitHub Pages publish.
For an exact-baseline restoration use `git reset --hard 4b10b97c504189f2310a3464d739f0242b8a895f` only with an explicit force-push approval because this discards subsequent work.
Do not change quiz-library.json or overwrite any live answers as part of rollback.

Only enable a new transport behind a feature flag, defaulting to the currently
deployed PeerJS path. Preserve the team QR code format and tokens.
