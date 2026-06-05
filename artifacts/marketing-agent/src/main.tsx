import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Le thème initial (.dark / .light) est posé tôt par le script inline de
// index.html (anti-flash). Le ThemeProvider prend ensuite le relais.

createRoot(document.getElementById("root")!).render(<App />);
