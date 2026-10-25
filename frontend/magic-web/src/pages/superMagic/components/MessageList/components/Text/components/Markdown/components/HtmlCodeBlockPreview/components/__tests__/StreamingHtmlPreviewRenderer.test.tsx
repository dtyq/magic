import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { StreamingHtmlPreviewRenderer } from "../StreamingHtmlPreviewRenderer"

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils", () => ({
	rewriteHtmlWithMagicCdn: (content: string) => content,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils/full-content", () => ({
	decodeHTMLEntities: (content: string) => content,
	getFullContent: (content: string) => content,
}))

describe("StreamingHtmlPreviewRenderer", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("preserves the iframe scroll position across streaming updates", () => {
		render(
			<StreamingHtmlPreviewRenderer
				content={"<!DOCTYPE html><html><body><div>Hello</div></body></html>"}
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)

		const runtimeDocument =
			screen.getByTestId("streaming-html-preview-renderer").getAttribute("srcdoc") ?? ""

		expect(runtimeDocument).toContain("scrollRestoreFrameId")
		expect(runtimeDocument).toContain("function captureScrollPosition()")
		expect(runtimeDocument).toContain("function scheduleScrollRestore(scrollPosition)")
		expect(runtimeDocument).toContain("patchBodyContent(parsedDocument, scrollPosition)")
		expect(runtimeDocument).toContain("scheduleScrollRestore(scrollPosition);")
		expect(runtimeDocument).toContain('type: "streamingPreviewError"')
		expect(screen.getByTestId("streaming-html-preview-renderer")).toHaveAttribute(
			"allow",
			"fullscreen; pointer-lock",
		)
	})

	it("acknowledges only the content version that the iframe rendered successfully", () => {
		const onContentCommitted = vi.fn()
		const onReady = vi.fn()
		render(
			<StreamingHtmlPreviewRenderer
				content={"<!DOCTYPE html><html><body><div>Hello</div></body></html>"}
				onReady={onReady}
				onMetrics={vi.fn()}
				onContentCommitted={onContentCommitted}
			/>,
		)

		const iframe = screen.getByTestId("streaming-html-preview-renderer") as HTMLIFrameElement
		const iframeWindow = iframe.contentWindow
		expect(iframeWindow).not.toBeNull()
		const postMessageMock = vi.spyOn(iframeWindow as Window, "postMessage")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframeWindow,
					data: { type: "iframeReady" },
				}),
			)
		})

		const postedPayload = postMessageMock.mock.calls[0]?.[0] as
			| { contentVersion?: number }
			| undefined
		expect(postedPayload?.contentVersion).toBe(1)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframeWindow,
					data: { type: "renderComplete", contentVersion: 0 },
				}),
			)
		})

		expect(onReady).not.toHaveBeenCalled()
		expect(onContentCommitted).not.toHaveBeenCalled()

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframeWindow,
					data: { type: "renderComplete", contentVersion: 1 },
				}),
			)
		})

		expect(onContentCommitted).toHaveBeenCalledWith(
			"<!DOCTYPE html><html><body><div>Hello</div></body></html>",
		)
		expect(onReady).toHaveBeenCalledTimes(1)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframeWindow,
					data: { type: "pageFullyLoaded", contentVersion: 1 },
				}),
			)
		})

		expect(onContentCommitted).toHaveBeenCalledTimes(1)
		expect(onReady).toHaveBeenCalledTimes(1)
	})

	it("does not inject scroll CSS into a script string containing a closing head tag", () => {
		const content = [
			"<!DOCTYPE html><html><head>",
			"<script>var nestedDocument = '</style></head><body>';</script>",
			"</head><body><main>Report</main></body></html>",
		].join("")

		render(
			<StreamingHtmlPreviewRenderer
				content={content}
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)

		const iframe = screen.getByTestId("streaming-html-preview-renderer") as HTMLIFrameElement
		const iframeWindow = iframe.contentWindow
		expect(iframeWindow).not.toBeNull()
		const postMessageMock = vi.spyOn(iframeWindow as Window, "postMessage")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframeWindow,
					data: { type: "iframeReady" },
				}),
			)
		})

		const postedPayload = postMessageMock.mock.calls[0]?.[0] as { content?: string } | undefined
		const postedContent = postedPayload?.content ?? ""

		expect(postedContent).toContain("<head>\n<style data-streaming-preview-scroll-lock")
		expect(postedContent).toContain(
			"<script>var nestedDocument = '</style></head><body>';</script>",
		)
		expect(postedContent.match(/data-streaming-preview-scroll-lock/g)).toHaveLength(1)
	})

	it("keeps one in-flight update and replaces pending content with the latest version", () => {
		const { rerender } = render(
			<StreamingHtmlPreviewRenderer
				content="<main>one</main>"
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)
		const iframe = screen.getByTestId("streaming-html-preview-renderer") as HTMLIFrameElement
		const iframeWindow = iframe.contentWindow as Window
		const postMessageMock = vi.spyOn(iframeWindow, "postMessage")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframeWindow,
					data: { type: "iframeReady" },
				}),
			)
		})
		rerender(
			<StreamingHtmlPreviewRenderer
				content="<main>two</main>"
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)
		rerender(
			<StreamingHtmlPreviewRenderer
				content="<main>three</main>"
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)

		const getContentMessages = () =>
			postMessageMock.mock.calls
				.map(
					([payload]) =>
						payload as { type?: string; content?: string; contentVersion?: number },
				)
				.filter((payload) => payload.type === "setContent")
		expect(getContentMessages()).toHaveLength(1)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframeWindow,
					data: { type: "renderComplete", contentVersion: 1 },
				}),
			)
		})

		expect(getContentMessages()).toHaveLength(2)
		expect(getContentMessages()[1]).toMatchObject({
			content: expect.stringContaining("<main>three</main>"),
			contentVersion: 2,
		})
	})

	it("holds the latest content while inactive and catches up after resume", () => {
		const { rerender } = render(
			<StreamingHtmlPreviewRenderer
				content="<main>one</main>"
				isPreviewActive={false}
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)
		const iframe = screen.getByTestId("streaming-html-preview-renderer") as HTMLIFrameElement
		const iframeWindow = iframe.contentWindow as Window
		const postMessageMock = vi.spyOn(iframeWindow, "postMessage")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframeWindow,
					data: { type: "iframeReady" },
				}),
			)
		})
		rerender(
			<StreamingHtmlPreviewRenderer
				content="<main>latest</main>"
				isPreviewActive={false}
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)

		expect(
			postMessageMock.mock.calls.filter(
				([payload]) => (payload as { type?: string }).type === "setContent",
			),
		).toHaveLength(0)

		rerender(
			<StreamingHtmlPreviewRenderer
				content="<main>latest</main>"
				isPreviewActive
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)
		const contentMessages = postMessageMock.mock.calls
			.map(([payload]) => payload as { type?: string; content?: string })
			.filter((payload) => payload.type === "setContent")
		expect(contentMessages).toHaveLength(1)
		expect(contentMessages[0]?.content).toContain("<main>latest</main>")
	})

	it("releases a stalled in-flight version and sends the pending latest content", async () => {
		vi.useFakeTimers()
		const { rerender } = render(
			<StreamingHtmlPreviewRenderer
				content="<main>one</main>"
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)
		const iframe = screen.getByTestId("streaming-html-preview-renderer") as HTMLIFrameElement
		const iframeWindow = iframe.contentWindow as Window
		const postMessageMock = vi.spyOn(iframeWindow, "postMessage")
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					source: iframeWindow,
					data: { type: "iframeReady" },
				}),
			)
		})
		rerender(
			<StreamingHtmlPreviewRenderer
				content="<main>latest</main>"
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(800)
		})

		const contentMessages = postMessageMock.mock.calls
			.map(([payload]) => payload as { type?: string; content?: string })
			.filter((payload) => payload.type === "setContent")
		expect(contentMessages).toHaveLength(2)
		expect(contentMessages[1]?.content).toContain("<main>latest</main>")
	})
})
