import { createRoot } from "react-dom/client"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import "./styles.css"
import { App } from "./App"

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <Analytics />
    <SpeedInsights />
  </>
)
