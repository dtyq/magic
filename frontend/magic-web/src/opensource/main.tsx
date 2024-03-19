import "./index.css"
// 初始化 emoji 缓存
import "@/opensource/components/base/MagicEmojiPanel/cache"
import { enableMapSet } from "immer"
// import ReactDom from "react-dom"
import { createRoot } from "react-dom/client"
import { StrictMode } from "react"
import App from "./App"
import "@/opensource/utils/polyfill"
import { appService } from "./services/app/AppService"
import { getTimezone, getTimezones } from "@dtyq/timezone"

enableMapSet()

console.log(getTimezones({ locale: "zh_CN" }), getTimezone("Asia/Shanghai"))
/**
 * 初始化应用服务
 */
appService.init()

const root = createRoot(document.getElementById("root")!)
root.render(
	<StrictMode>
		<App />
	</StrictMode>,
)

postMessage({ payload: "removeLoading" }, "*")
