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
  return {
    joinCode: createJoinCode(),
    selectedQuizId: "",
    live: {
      status: "Setup",
      screen: "setup",
      registrationOpen: false,
      roundIndex: 0,
      questionIndex: 0,
      locked: false,
      answerRevealed: false,
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
    answers: {},
  };
}
