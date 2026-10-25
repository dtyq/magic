import {
	defaultProps,
	dispatchIframeMessage,
	envMock,
	flushReactEffects,
	getSetContentCalls,
	hookState,
	renderIsolated,
	useRendererTestSetup,
} from "./IsolatedHTMLRenderer.test-helpers"
import IsolatedHTMLRenderer from "../IsolatedHTMLRenderer"
import { act, fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

// These tests mount the real exported renderer and exercise its window listener.
// jsdom does not execute the sandbox document; browser tests own that boundary.
describe("IsolatedHTMLRenderer lifecycle", () => {
	useRendererTestSetup()

	it("keeps animation selection independent and hides edit tools while the queue is open", async () => {
		const { rerender } = renderIsolated(
			<IsolatedHTMLRenderer
				{...defaultProps}
				isPptRender
				buildPanelOpen
				isEditMode={false}
			/>,
		)
		await flushReactEffects()
		expect(hookState.editorOptions).toMatchObject({ isEditMode: false, isPPTBuildMode: true })
		expect(screen.queryByTestId("html-editor-context-panel")).not.toBeInTheDocument()
		// An existing body draft also stays intact when its tools are replaced by the queue.
		rerender(<IsolatedHTMLRenderer {...defaultProps} isPptRender buildPanelOpen isEditMode />)
		await flushReactEffects()
		expect(hookState.editorOptions).toMatchObject({ isEditMode: false, isPPTBuildMode: true })
		expect(screen.queryByTestId("html-editor-context-panel")).not.toBeInTheDocument()
		rerender(
			<IsolatedHTMLRenderer
				{...defaultProps}
				isPptRender
				buildPanelOpen={false}
				isEditMode
			/>,
		)
		await flushReactEffects()
		expect(hookState.editorOptions).toMatchObject({ isEditMode: true, isPPTBuildMode: false })
		expect(screen.getByTestId("html-editor-context-panel")).toBeInTheDocument()
	})

	it("keeps the iframe document and runtime when switching tabs away and back", async () => {
		const { rerender } = renderIsolated(
			<IsolatedHTMLRenderer {...defaultProps} isVisible isTabActive />,
		)
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		await flushReactEffects()
		dispatchIframeMessage(iframe, "iframeReady")
		await flushReactEffects()
		const initialCalls = getSetContentCalls(postMessage).length
		expect(initialCalls).toBe(1)
		rerender(<IsolatedHTMLRenderer {...defaultProps} isVisible={false} isTabActive={false} />)
		await flushReactEffects()
		rerender(<IsolatedHTMLRenderer {...defaultProps} isVisible isTabActive />)
		await flushReactEffects()
		expect(screen.getByTestId("isolated-html-content-iframe")).toBe(iframe)
		expect(getSetContentCalls(postMessage)).toHaveLength(initialCalls)
	})

	it.each([
		["preview", false, false],
		["editor", true, false],
		["PPT", false, true],
	] as const)(
		"waits for the shell and reports %s render completion once",
		async (_, isEditMode, isPptRender) => {
			const onRenderReady = vi.fn()
			renderIsolated(
				<IsolatedHTMLRenderer
					{...defaultProps}
					isEditMode={isEditMode}
					isPptRender={isPptRender}
					onRenderReady={onRenderReady}
				/>,
			)
			const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
			const postMessage = vi
				.spyOn(iframe.contentWindow as Window, "postMessage")
				.mockImplementation(vi.fn())
			await flushReactEffects()
			fireEvent.load(iframe)
			await flushReactEffects()
			expect(getSetContentCalls(postMessage)).toHaveLength(0)
			expect(hookState.editorContentInjectedValues.at(-1)).toBe(false)

			dispatchIframeMessage(iframe, "iframeReady")
			await flushReactEffects()
			const [[request, origin]] = getSetContentCalls(postMessage)
			expect(request).toMatchObject({
				type: "setContent",
				content: `<!doctype html>${defaultProps.content}`,
			})
			expect(origin).toBe(window.location.origin)
			expect(hookState.editorContentInjectedValues.at(-1)).toBe(true)
			expect(onRenderReady).not.toHaveBeenCalled()

			dispatchIframeMessage(iframe, "contentLoaded", origin as string, {
				navigationRequestId: request.navigationRequestId,
			})
			if (isEditMode) {
				expect(hookState.editorContentInjectedValues.at(-1)).toBe(false)
				act(() => vi.advanceTimersByTime(0))
				expect(hookState.editorContentInjectedValues.at(-1)).toBe(true)
			}
			expect(onRenderReady).not.toHaveBeenCalled()
			dispatchIframeMessage(iframe, "domReady")
			expect(onRenderReady).not.toHaveBeenCalled()
			dispatchIframeMessage(iframe, "renderComplete", origin as string, {
				navigationRequestId: request.navigationRequestId,
			})
			dispatchIframeMessage(iframe, "pageFullyLoaded", origin as string, {
				navigationRequestId: request.navigationRequestId,
			})
			dispatchIframeMessage(iframe, "pageLoaded")
			await flushReactEffects()
			expect(onRenderReady).toHaveBeenCalledTimes(1)
			expect(getSetContentCalls(postMessage)).toHaveLength(1)
		},
	)

	it.each([window.location.origin, "https://sandbox.example"])(
		"rejects wrong origin/source handshakes for %s",
		async (origin) => {
			envMock.mockReturnValue(`${origin}/husky.html`)
			renderIsolated(<IsolatedHTMLRenderer {...defaultProps} />)
			const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
			const postMessage = vi
				.spyOn(iframe.contentWindow as Window, "postMessage")
				.mockImplementation(vi.fn())
			await flushReactEffects()
			dispatchIframeMessage(iframe, "iframeReady", origin, {}, window)
			dispatchIframeMessage(iframe, "iframeReady", "https://wrong.example")
			dispatchIframeMessage(iframe, "pageLoaded", origin, {}, null)
			await flushReactEffects()
			expect(getSetContentCalls(postMessage)).toHaveLength(0)
			// pageLoaded is the supported fallback if the earlier ready event was lost.
			dispatchIframeMessage(iframe, "pageLoaded", origin)
			await flushReactEffects()
			expect(getSetContentCalls(postMessage)).toHaveLength(1)
			expect(getSetContentCalls(postMessage)[0][1]).toBe(origin)
		},
	)

	it("restarts the preview document and rejects completion/metrics from the previous window", async () => {
		const onRenderReady = vi.fn()
		const onContentMetrics = vi.fn()
		const props = { ...defaultProps, onRenderReady, onContentMetrics }
		const { rerender } = renderIsolated(<IsolatedHTMLRenderer {...props} />)
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(iframe, "iframeReady")
		await flushReactEffects()
		const previousRequest = getSetContentCalls(postMessage)[0][0].navigationRequestId
		dispatchIframeMessage(iframe, "renderComplete", window.location.origin, {
			navigationRequestId: previousRequest,
		})
		expect(onRenderReady).toHaveBeenCalledTimes(1)

		rerender(<IsolatedHTMLRenderer {...props} content="<html><body>updated</body></html>" />)
		await flushReactEffects()
		const nextIframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		expect(nextIframe).not.toBe(iframe)
		expect(nextIframe.contentWindow).not.toBe(iframe.contentWindow)
		const nextPostMessage = vi
			.spyOn(nextIframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		expect(getSetContentCalls(nextPostMessage)).toHaveLength(0)
		dispatchIframeMessage(nextIframe, "iframeReady")
		await flushReactEffects()
		const calls = getSetContentCalls(nextPostMessage)
		expect(calls).toHaveLength(1)
		const currentRequest = calls[0][0].navigationRequestId
		expect(currentRequest).not.toBe(previousRequest)
		expect(calls[0][0].content).toContain("updated")
		const metrics = { contentWidth: 800, contentHeight: 600, phase: "settled" }
		for (const type of ["renderComplete", "pageFullyLoaded", "contentMetrics"]) {
			dispatchIframeMessage(iframe, type, window.location.origin, {
				...metrics,
				navigationRequestId: previousRequest,
			})
		}
		expect(onRenderReady).toHaveBeenCalledTimes(1)
		expect(onContentMetrics).not.toHaveBeenCalled()
		dispatchIframeMessage(nextIframe, "contentMetrics", window.location.origin, {
			...metrics,
			navigationRequestId: currentRequest,
		})
		dispatchIframeMessage(nextIframe, "renderComplete", window.location.origin, {
			navigationRequestId: currentRequest,
		})
		expect(onContentMetrics).toHaveBeenCalledWith(expect.objectContaining(metrics))
		expect(onRenderReady).toHaveBeenCalledTimes(2)
	})

	it("retains a rendered PPT when hidden and resumes its animations without rewriting content", async () => {
		const { rerender } = renderIsolated(<IsolatedHTMLRenderer {...defaultProps} isPptRender />)
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(iframe, "iframeReady")
		await flushReactEffects()
		dispatchIframeMessage(iframe, "renderComplete")
		rerender(<IsolatedHTMLRenderer {...defaultProps} isPptRender isVisible={false} />)
		await flushReactEffects()
		expect(iframe).toBeInTheDocument()
		expect(postMessage).toHaveBeenLastCalledWith(
			{ type: "setAnimationState", paused: true },
			window.location.origin,
		)
		rerender(<IsolatedHTMLRenderer {...defaultProps} isPptRender />)
		await flushReactEffects()
		expect(screen.getByTestId("isolated-html-content-iframe")).toBe(iframe)
		expect(postMessage).toHaveBeenLastCalledWith(
			{ type: "setAnimationState", paused: false },
			window.location.origin,
		)
		expect(getSetContentCalls(postMessage)).toHaveLength(1)
	})

	it("pauses a visible PPT during transitions and resumes without replacing its iframe", async () => {
		const { rerender } = renderIsolated(
			<IsolatedHTMLRenderer {...defaultProps} isPptRender isVisible isPlaybackPaused />,
		)
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const postMessage = vi
			.spyOn(iframe.contentWindow as Window, "postMessage")
			.mockImplementation(vi.fn())
		dispatchIframeMessage(iframe, "iframeReady")
		await flushReactEffects()
		dispatchIframeMessage(iframe, "renderComplete")
		expect(postMessage).toHaveBeenLastCalledWith(
			{ type: "setAnimationState", paused: true },
			window.location.origin,
		)
		rerender(
			<IsolatedHTMLRenderer
				{...defaultProps}
				isPptRender
				isVisible
				isPlaybackPaused={false}
			/>,
		)
		await flushReactEffects()
		expect(postMessage).toHaveBeenLastCalledWith(
			{ type: "setAnimationState", paused: false },
			window.location.origin,
		)
		expect(screen.getByTestId("isolated-html-content-iframe")).toBe(iframe)
		expect(getSetContentCalls(postMessage)).toHaveLength(1)
	})

	it("reloads only its own document and removes its message listener on unmount", async () => {
		const onRefresh = vi.fn()
		pubsub.subscribe(PubSubEvents.Super_Magic_Detail_Refresh, onRefresh)
		const onRenderReady = vi.fn()
		const { unmount } = renderIsolated(
			<IsolatedHTMLRenderer {...defaultProps} onRenderReady={onRenderReady} />,
		)
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		const source = iframe.contentWindow
		try {
			act(() => dispatchIframeMessage(iframe, "MAGIC_RELOAD_REQUEST"))
			await flushReactEffects()
			expect(screen.getByTestId("isolated-html-content-iframe")).not.toBe(iframe)
			expect(onRefresh).not.toHaveBeenCalled()
			unmount()
			dispatchIframeMessage(
				iframe,
				"MAGIC_RELOAD_REQUEST",
				window.location.origin,
				{},
				source,
			)
			dispatchIframeMessage(iframe, "renderComplete", window.location.origin, {}, source)
			await flushReactEffects()
			expect(iframe).not.toBeInTheDocument()
			expect(onRefresh).not.toHaveBeenCalled()
			expect(onRenderReady).not.toHaveBeenCalled()
		} finally {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Detail_Refresh, onRefresh)
		}
	})
})
