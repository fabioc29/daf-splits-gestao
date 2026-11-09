import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DialogHost } from "./ui/dialogs";
import { NativeUiHost } from "./ui/NativeUiHost";
import "./index.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <DialogHost />
    <NativeUiHost />
  </React.StrictMode>,
);
