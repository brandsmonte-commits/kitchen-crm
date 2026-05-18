import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Гарантированный layout fix
const style = document.createElement("style");
style.textContent = `
  .app { display: flex !important; flex-direction: column !important; min-height: 100dvh !important; }
  .content { flex: 1 !important; overflow-y: auto !important; padding-bottom: 80px !important; }
  .view { padding: 18px 16px 8px !important; display: block !important; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
