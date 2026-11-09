import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DialogHost } from "./ui/dialogs";
import "./index.css";
import "./styles/modelo-b.css";

// Aplica o tema salvo antes da primeira pintura (inclusive na tela de login).
try {
  const storedTheme = window.localStorage.getItem("daf-theme");
  document.documentElement.dataset.theme =
    storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <DialogHost />
  </React.StrictMode>,
);
