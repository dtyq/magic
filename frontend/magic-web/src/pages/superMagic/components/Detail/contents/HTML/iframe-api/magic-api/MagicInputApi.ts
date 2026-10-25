/**
 * MagicInputApi
 *
 * 向 iframe 内的 window.Magic.setInputMessage 注入输入框消息设置 API。
 * 调用后通过 postMessage 通知父窗口将指定文本填入聊天输入框。
 */

import { MagicApiLogger } from "./MagicApiLogger"
import { BaseRuntimeBridgeApiPlugin, getParentOrigin } from "@dtyq/html-sandbox"

export class MagicInputApi extends BaseRuntimeBridgeApiPlugin {
	constructor() {
		super("MagicInputApi")
	}

	install(): void {
		if (!window.Magic) window.Magic = {}
		if (window.Magic.setInputMessage) return
		this.logger.info("install")

		window.Magic.setInputMessage = (message: string) => {
			if (typeof message !== "string") {
				this.logger.error("setInputMessage:invalid-argument", {
					messageType: typeof message,
				})
				return
			}
			this.logger.info("setInputMessage", {
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
