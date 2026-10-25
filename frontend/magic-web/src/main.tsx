// Must be evaluated first: other modules call polyfilled APIs such as requestIdleCallback.
import "@/utils/polyfill"
import { httpService } from "@/app/services/httpService"
import "./index.css"
import { loggerService } from "./app/services/loggerService"
// 初始化 emoji 缓存
import "@/components/base/MagicEmojiPanel/cache"
import { enableMapSet } from "immer"
// import ReactDom from "react-dom"
import { createRoot } from "react-dom/client"
import App from "./App"
import { appService } from "./services/app/AppService"
import { initializeMicroAppInstallPromptCapture } from "./services/microAppInstallPrompt"
import { DevStrictMode } from "@/utils/devStrictMode"
import { registerAppServiceWorker } from "@/workers/service-worker/register"

enableMapSet()
// Capture beforeinstallprompt before the lazy share page loads.
initializeMicroAppInstallPromptCapture()

async function initMock() {
	if (!import.meta.env.DEV || import.meta.env.MAGIC_MOCK !== "true") {
		if ("serviceWorker" in navigator) {
			const registrations = await navigator.serviceWorker.getRegistrations()
			for (const registration of registrations) {
				if (registration.active?.scriptURL?.endsWith("mockServiceWorker.js")) {
					await registration.unregister()
					console.log(
						"[mock] Unregistered mock ServiceWorker:",
						registration.active?.scriptURL,
					)
				}
			}
		}
		return
	}
}

/**
 * Start app init first so request middleware can await it,
 * but keep rendering concurrent with bootstrap work.
 */
loggerService.start()
httpService.init()
appService.init()

async function bootstrap() {
	await initMock()

	const rootElement = document.getElementById("root")
	if (!rootElement) throw new Error("Root element not found")

	const root = createRoot(rootElement)
	root.render(
		<DevStrictMode>
			<App />
		</DevStrictMode>,
	)

	postMessage({ payload: "removeLoading" }, "*")
}

void bootstrap()
registerAppServiceWorker()
