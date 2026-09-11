import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./utils/preventAnswerPaste.js";
import "./utils/keyboardAnswerFocus.js";
import "./styles.css";
import "./live.css";
import "./team-answer-state.css";
import "./github-library.css";
import "./simplified-ui.css";
import "./quiz-taker-v2.css";
import "./planuf-soft-ui.css";
import "./app-wide-theme.css";
import "./quiz-taker-v4.css";
import "./quiz-taker-v5.css";
import "./quiz-taker-v6.css";
import "./quiz-taker-anti-paste.css";
import "./quiz-taker-v7.css";
import "./quiz-taker-v8.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
