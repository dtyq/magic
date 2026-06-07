/**
 * MagicReloadApi
 *
 * 向 iframe 内的 window.Magic.reload 注入页面重载 API。
 * 调用后通过 postMessage 通知父窗口重新加载当前 HTML 内容。
 */

import { MagicApiLogger } from "./MagicApiLogger"
import { getParentOrigin } from "../utils/parentOrigin"

export class MagicReloadApi {
	install(): void {
		if (!window.Magic) window.Magic = {}
		if (window.Magic.reload) return
		MagicApiLogger.info("MagicReloadApi", "install")

		window.Magic.reload = () => {
			MagicApiLogger.info("MagicReloadApi", "reload")
			window.parent.postMessage(
				{
					type: "MAGIC_RELOAD_REQUEST",
					timestamp: Date.now(),
				},
				getParentOrigin(),
			)
		}
	}
}
