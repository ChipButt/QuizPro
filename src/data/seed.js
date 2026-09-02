export const navItems = [
  "Dashboard",
  "Quizzes",
  "Live Quiz",
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
        questionId: "",
        startedAt: 0,
        offset: 0,
        volume: 1,
      },
    },
    media: [],
    quizzes: [],
    teams: [],
    teamRoundLocks: {},
    answers: {},
  };
}
