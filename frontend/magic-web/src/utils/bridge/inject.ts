import { nanoid } from "nanoid"
import type { BridgeEvent, WebViewJavascriptBridge } from "./types"
import eventBus from "./eventBus"

function MagicJSBridge(callback: (bridge: WebViewJavascriptBridge) => void) {
	try {
		if (window.WebViewJavascriptBridge) {
			console.warn("WebViewJavascriptBridge已加载")
			callback(window.WebViewJavascriptBridge)
		} else {
			console.warn("WebViewJavascriptBridge未加载")
			document.addEventListener(
				"WebViewJavascriptBridgeReady",
				() => {
					callback(window.WebViewJavascriptBridge)
				},
				false,
			)
		}
	} catch (ex) {
		console.error("注册 WebViewJavascriptBridge 失败", ex)
	}
}

MagicJSBridge((bridge) => {
	bridge.init(() => {
		console.log("bridge init")
	})

	/* 注册nativeResponse，app 通过 nativeResponse 应答 JS 调起的 nativeRequest api */
	bridge.registerHandler("nativeResponse", (data) => {
		const request = JSON.parse(data)

		console.warn("接收到app消息", request)
		// responseCallback(`这里可以返回数据：${data}`);
	})

	/* 注册nativeCall，app通过该方法主动调起相关api */
	bridge.registerHandler("nativeCall", (data: string) => {
		console.warn("接收到app消息", data)
		try {
			const event: BridgeEvent = JSON.parse(data)
			console.log("解析数据: ", event)
			console.log("eventBus", eventBus)
			eventBus.emit(event.nativeConfig.appCallName, event.nativeDataResponse)
		} catch (error) {
			console.error("桥接事件 JSON 解析失败", error)
		}
		// responseCallback?.("这里可以返回数据");
	})
})

window.bridge = {
	callNative(nativeCallName, data) {
		const requestData = {
			nativeConfig: {
				nativeCallName,
				requestId: nanoid(),
				timeStamp: new Date().getTime(),
				nativeCallType: "request",
			},
			nativeRequest: data ?? {},
		}

		MagicJSBridge((bridge) => {
			if (typeof bridge === "undefined") {
				return
			}
			console.log("bridge", bridge)
			bridge.callHandler("nativeRequest", JSON.stringify(requestData))
		})
	},
}
