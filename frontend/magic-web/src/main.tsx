import "./index.css"
// 初始化 emoji 缓存
import "@/components/base/MagicEmojiPanel/cache"
import { enableMapSet } from "immer"
// import ReactDom from "react-dom"
import { createRoot } from "react-dom/client"
import App from "./App"
import "@/utils/polyfill"
import { appService } from "./services/app/AppService"
import { getTimezone, getTimezones } from "@dtyq/timezone"
import { DevStrictMode } from "@/utils/devStrictMode"

enableMapSet()

console.log(getTimezones({ locale: "zh_CN" }), getTimezone("Asia/Shanghai"))

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
	// @ts-ignore
	const { initForVite } = await import("@magic-web/mock-kit")
	const configModules = import.meta.glob("../mock/mock.config.ts")
	await initForVite({
		modules: import.meta.glob("../mock/mock-routes/**/*.{ts,tsx}"),
		loadConfig: async () => {
			const mod = await configModules["../mock/mock.config.ts"]()
			// @ts-ignore
			return (mod as { default: import("@magic-web/mock-kit").MockConfig }).default
		},
		logPrefix: "magic-web-mock",
	})
}

/**
 * Start app init first so request middleware can await it,
 * but keep rendering concurrent with bootstrap work.
 */
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
