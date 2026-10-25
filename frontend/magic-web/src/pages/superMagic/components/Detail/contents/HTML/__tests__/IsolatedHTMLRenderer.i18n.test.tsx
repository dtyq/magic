import {
	i18nState,
	defaultProps,
	renderIsolated,
	dispatchIframeMessage,
	flushReactEffects,
	useRendererTestSetup,
	getSetContentCalls,
} from "./IsolatedHTMLRenderer.test-helpers"
import IsolatedHTMLRenderer from "../IsolatedHTMLRenderer"
import { act, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

describe("Renderer language bridge", () => {
	useRendererTestSetup()
	function changeLanguage(lang: string) {
		act(() => {
			i18nState.language = lang
			i18nState.resolvedLanguage = lang
			const [, callback] = i18nState.on.mock.calls.find(
				([event]) => event === "languageChanged",
			)!
			callback(lang)
		})
	}
	it("updates lang even without a callback subscription, preserving the document", async () => {
		renderIsolated(<IsolatedHTMLRenderer {...defaultProps} />)
		await flushReactEffects()
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const post = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(iframe, "iframeReady")
		await flushReactEffects()
		const injections = getSetContentCalls(post).length
		changeLanguage("en-US")
		expect(post).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "MAGIC_I18N_LANG_SUBSCRIBE",
				results: { lang: "en_US", source: "language_changed" },
			}),
			expect.any(String),
		)
		expect(getSetContentCalls(post)).toHaveLength(injections)
		expect(screen.getByTestId("isolated-html-content-iframe")).toBe(iframe)
	})
	it("keeps subscriptions across a deduplicated PPT visibility resume", async () => {
		const { rerender } = renderIsolated(
			<IsolatedHTMLRenderer {...defaultProps} isPptRender isVisible={false} />,
		)
		await flushReactEffects()
		const iframe = document.querySelector("iframe")
		if (!iframe) throw Error("Missing preview iframe")
		const post = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(iframe, "iframeReady")
		await flushReactEffects()
		dispatchIframeMessage(iframe, "MAGIC_I18N_LANG_SUBSCRIBE", undefined, {
			requestId: "subscription",
		})
		const injections = getSetContentCalls(post).length
		rerender(<IsolatedHTMLRenderer {...defaultProps} isPptRender isVisible />)
		await flushReactEffects()
		post.mockClear()
		changeLanguage("en-US")
		expect(post).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "MAGIC_I18N_LANG_SUBSCRIBE",
				results: { lang: "en_US", source: "language_changed" },
			}),
			expect.any(String),
		)
		expect(getSetContentCalls(post)).toHaveLength(0)
		expect(injections).toBeGreaterThan(0)
	})
})
