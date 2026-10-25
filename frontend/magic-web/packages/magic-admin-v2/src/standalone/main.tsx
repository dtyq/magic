import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "@magic-admin-v2/standalone/App"
import "@magic-admin-v2/styles/globals.css"
import "@magic-admin-v2/styles/embedded.css"

ensureStandaloneBasePath()

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
)

function ensureStandaloneBasePath() {
	if (window.location.pathname !== "/") return
	window.history.replaceState(null, "", "/admin-v2/")
}
