import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./state/auth";
import "./index.css";

// Dev-only: /?demo=1 seeds realistic demo data (no-op in production builds).
if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search);
  if (params.has("demo")) {
    void import("./local/seed").then(({ seedDemoData }) =>
      seedDemoData(params.get("demo") === "reset").then((seeded) => {
        if (seeded) {
          const url = new URL(window.location.href);
          url.search = "";
          window.history.replaceState(null, "", url.toString());
        }
      })
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
