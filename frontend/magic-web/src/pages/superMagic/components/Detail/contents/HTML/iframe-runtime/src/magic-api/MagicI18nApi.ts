/**
 * MagicI18nApi
 *
 * 向 iframe 内的 window.Magic.i18n 注入国际化订阅 API。
 * 初始语言从 window.__MAGIC_INITIAL_LANG__ 读取（由 full-content.ts 在运行时脚本
 * 之前注入）。后续语言变更通过 MAGIC_I18N_LANG_SUBSCRIBE 消息推送。
 */

import { MagicApiLogger } from "./MagicApiLogger"

export class MagicI18nApi {
	install(): void {
		if (!window.Magic) window.Magic = {}
		if (window.Magic.i18n) return

		type I18nCallback = (result: { lang: string; [key: string]: unknown }) => void
		const i18nSubscribers = new Set<I18nCallback>()

		// 读取 full-content.ts 注入的初始语言，兜底 "zh-CN"
		const initialLang =
			(window as unknown as { __MAGIC_INITIAL_LANG__?: string }).__MAGIC_INITIAL_LANG__ ??
			"zh-CN"

		MagicApiLogger.info("MagicI18nApi", "install", { initialLang })

		window.Magic.i18n = {
			lang: initialLang,

			subscribe: (callback) => {
				if (typeof callback !== "function") {
					MagicApiLogger.error("MagicI18nApi", "subscribe:invalid-callback", {
						callbackType: typeof callback,
					})
					return () => {}
				}
				i18nSubscribers.add(callback as I18nCallback)
				const requestId = `i18n_subscribe_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
				MagicApiLogger.info("MagicI18nApi", "subscribe", {
					requestId,
					subscriberCount: i18nSubscribers.size,
				})
				window.parent.postMessage(
					{
						type: "MAGIC_I18N_LANG_SUBSCRIBE",
						requestId,
						timestamp: Date.now(),
					},
					"*",
				)
				return () => i18nSubscribers.delete(callback as I18nCallback)
			},

			unsubscribe: (callback) => {
				if (typeof callback !== "function") return
				i18nSubscribers.delete(callback as I18nCallback)
				MagicApiLogger.info("MagicI18nApi", "unsubscribe", {
					subscriberCount: i18nSubscribers.size,
				})
			},
		}

		// 监听父窗口推送的语言变更消息
		window.addEventListener("message", (event: MessageEvent) => {
			if (!event.data || event.data.type !== "MAGIC_I18N_LANG_SUBSCRIBE") return
			if (!event.data.success) return

			const results = (event.data.results ?? {}) as { lang?: string; [key: string]: unknown }
			const nextLang = typeof results.lang === "string" ? results.lang : ""
			if (nextLang && window.Magic.i18n) {
				window.Magic.i18n.lang = nextLang
				MagicApiLogger.info("MagicI18nApi", "language:updated", {
					lang: nextLang,
					subscriberCount: i18nSubscribers.size,
				})
			}

			i18nSubscribers.forEach((subscriber) => {
				try {
					subscriber(results as { lang: string })
				} catch (error) {
					MagicApiLogger.error("MagicI18nApi", "subscriber:error", {
						error: error instanceof Error ? error.message : String(error),
					})
				}
			})
		})
	}
}
