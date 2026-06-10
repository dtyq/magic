/**
 * MagicInputApi
 *
 * 向 iframe 内的 window.Magic.setInputMessage 注入输入框消息设置 API。
 * 调用后通过 postMessage 通知父窗口将指定文本填入聊天输入框。
 */

import { MagicApiLogger } from "./MagicApiLogger"
import { getParentOrigin } from "../utils/parentOrigin"

export class MagicInputApi {
	install(): void {
		if (!window.Magic) window.Magic = {}
		if (window.Magic.setInputMessage) return
		MagicApiLogger.info("MagicInputApi", "install")

		window.Magic.setInputMessage = (message: string) => {
			if (typeof message !== "string") {
				MagicApiLogger.error("MagicInputApi", "setInputMessage:invalid-argument", {
					messageType: typeof message,
				})
				return
			}
			MagicApiLogger.info("MagicInputApi", "setInputMessage", {
				message: MagicApiLogger.summarizeText(message),
			})
			window.parent.postMessage(
				{
					type: "MAGIC_SET_INPUT_MESSAGE",
					message,
					timestamp: Date.now(),
				},
				getParentOrigin(),
			)
		}
	}
}
