import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Deploy connectivity check #2: no visual or behavioral effect.
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
