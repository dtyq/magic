import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"
import { Toaster } from "@/components/ui/sonner"

const rootElement = document.getElementById("root")
if (!rootElement) throw new Error("Root element not found")
const root = createRoot(rootElement)
root.render(
	<StrictMode>
		<Toaster />
		<App />,
	</StrictMode>,
)
