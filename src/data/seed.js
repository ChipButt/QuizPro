export const navItems = [
  "Dashboard",
  "Quizzes",
  "Media Library",
  "Live Quiz",
  "Teams",
  "Marking",
  "Results",
  "Settings",
];

function createJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function createInitialState() {
  const sessionCode = createJoinCode();
  return {
    joinCode: sessionCode,
    selectedQuizId: "",
    live: {
      quizId: "",
      sessionCode,
      sessionActive: false,
      status: "Setup",
      screen: "setup",
      teamScreen: "lobby",
      registrationOpen: false,
      roundIndex: 0,
      questionIndex: -1,
      locked: false,
      answerRevealed: false,
      revealMode: "round",
      revealedQuestions: {},
      revealedRounds: {},
      forceLockedRounds: {},
      timerActive: false,
      timerEndsAt: 0,
      timerRoundId: "",
      finalRevealCount: 0,
      elapsedSeconds: 0,
      questionSecondsRemaining: 0,
      audio: {
        playing: false,
        progress: 0,
        volume: 50,
        maxDuration: 0,
      },
    },
    media: [],
    quizzes: [],
    teams: [],
    teamRoundLocks: {},
    answers: {},
  };
}
