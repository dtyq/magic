import { act, renderHook } from "@testing-library/react"
import { createInstance } from "i18next"
import { describe, expect, it, vi } from "vitest"
import { useIframeI18n } from "../useIframeI18n"

describe("useIframeI18n", () => {
	it("uses the current window and origin, normalizes events, and cleans up on unmount", async () => {
		const i18n = createInstance()
		await i18n.init({ lng: "zh_CN", fallbackLng: false, resources: {} })
		const first = vi.fn(),
			second = vi.fn()
		const iframeRef = {
			current: { contentWindow: { postMessage: first } } as unknown as HTMLIFrameElement,
		}
		const { result, rerender, unmount } = renderHook(
			({ targetOrigin }) => useIframeI18n({ iframeRef, i18n, targetOrigin }),
			{ initialProps: { targetOrigin: "https://first.example" } },
		)
		act(() => result.current("subscribe_ack", "request"))
		expect(first).toHaveBeenLastCalledWith(
			expect.objectContaining({
				requestId: "request",
				results: { lang: "zh_CN", source: "subscribe_ack" },
			}),
			"https://first.example",
		)
		iframeRef.current = {
			contentWindow: { postMessage: second },
		} as unknown as HTMLIFrameElement
		rerender({ targetOrigin: "https://second.example" })
		await act(async () => {
			await i18n.changeLanguage("en-US")
		})
		expect(second).toHaveBeenCalledTimes(1)
		expect(second).toHaveBeenLastCalledWith(
			expect.objectContaining({ results: { lang: "en_US", source: "language_changed" } }),
			"https://second.example",
		)
		expect(first).toHaveBeenCalledTimes(1)
		unmount()
		await i18n.changeLanguage("zh_CN")
		expect(second).toHaveBeenCalledTimes(1)
	})
	it("does not notify disabled non-iframe rendering", async () => {
		const i18n = createInstance()
		await i18n.init({ lng: "zh_CN", resources: {} })
		const postMessage = vi.fn()
		const iframeRef = {
			current: { contentWindow: { postMessage } } as unknown as HTMLIFrameElement,
		}
		const { result, unmount } = renderHook(() =>
			useIframeI18n({ iframeRef, i18n, targetOrigin: "*", enabled: false }),
		)
		act(() => result.current("subscribe_ack"))
		await act(async () => {
			await i18n.changeLanguage("en_US")
		})
		expect(postMessage).not.toHaveBeenCalled()
		unmount()
	})
})
