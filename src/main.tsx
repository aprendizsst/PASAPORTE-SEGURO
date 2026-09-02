import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

declare global {
  interface Window { PASSPORT_CONFIG_LOAD_ERROR?: boolean }
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode><App /></React.StrictMode>,
  );
}

// La configuración se carga antes de montar React. El parámetro variable evita
// que GitHub Pages, el navegador o un proxy conserven una copia antigua vacía.
const configScript = document.createElement("script");
const configUrl = new URL("./config.js", document.baseURI);
configUrl.searchParams.set("v", "3.2.26");
configUrl.searchParams.set("_", String(Date.now()));
configScript.src = configUrl.toString();
configScript.onload = renderApp;
configScript.onerror = () => {
  window.PASSPORT_CONFIG_LOAD_ERROR = true;
  renderApp();
};
document.head.appendChild(configScript);
