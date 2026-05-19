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

/**
 * Start app init first so request middleware can await it,
 * but keep rendering concurrent with bootstrap work.
 */
appService.init()

async function bootstrap() {

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
