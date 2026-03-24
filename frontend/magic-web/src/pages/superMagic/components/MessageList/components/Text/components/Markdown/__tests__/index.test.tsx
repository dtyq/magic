import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import MarkdownComponent from "../index"
import { HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION } from "../components/HtmlCodeBlockPreview/constants"
import {
	resolveHtmlCodeBlockPreviewScale,
	resolveHtmlCodeBlockPreviewViewportHeight,
} from "../components/HtmlCodeBlockPreview/hooks/useHtmlCodeBlockPreviewScale"
import { resolveHtmlPreviewCanvasWidth } from "../components/HtmlCodeBlockPreview/utils"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, defaultValue?: string) => defaultValue ?? key,
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

const { writeTextMock } = vi.hoisted(() => ({
	writeTextMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: {
		writeText: writeTextMock,
	},
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer", () => ({
	default: ({
		content,
		containIframeOverscroll,
		onRenderReady,
		onContentMetrics,
	}: {
		content: string
		containIframeOverscroll?: boolean
		onRenderReady?: () => void
		onContentMetrics?: (metrics: {
			contentWidth: number
			contentHeight: number
			phase?: "initial" | "settled"
			hasHorizontalOverflow?: boolean
			hasVerticalOverflow?: boolean
		}) => void
	}) => (
		<div
			data-testid="isolated-html-renderer"
			data-contain-iframe-overscroll={String(Boolean(containIframeOverscroll))}
		>
			{content}
			<button onClick={onRenderReady}>ready</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 800,
						contentHeight: 480,
						phase: "initial",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: false,
					})
				}
			>
				metrics
			</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 960,
						contentHeight: 640,
						phase: "settled",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: false,
					})
				}
			>
				metrics-second
			</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 1200,
						contentHeight: 720,
						phase: "settled",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: false,
					})
				}
			>
				metrics-third
			</button>
		</div>
	),
}))

describe("MessageList Markdown HTML preview", () => {
	beforeEach(() => {
		writeTextMock.mockClear()

		class ResizeObserverMock {
			private callback: ResizeObserverCallback

			constructor(callback: ResizeObserverCallback) {
				this.callback = callback
			}

			observe(target: Element) {
				this.callback(
					[
						{
							target,
							contentRect: {
								width: 482,
								height: 560,
								x: 0,
								y: 0,
								top: 0,
								left: 0,
								right: 482,
								bottom: 560,
								toJSON: () => ({}),
							},
						} as ResizeObserverEntry,
					],
					this as unknown as ResizeObserver,
				)
			}

			unobserve() {
				return undefined
			}

			disconnect() {
				return undefined
			}
		}

		globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("calculates preview scale and viewport height for common layouts", () => {
		expect(resolveHtmlCodeBlockPreviewScale({ containerWidth: 1000, contentWidth: 800 })).toBe(
			1,
		)
		expect(
			resolveHtmlCodeBlockPreviewScale({ containerWidth: 1000, contentWidth: 1500 }),
		).toBeCloseTo(1000 / 1500, 3)
		expect(resolveHtmlCodeBlockPreviewScale({ containerWidth: 1000, contentWidth: 3000 })).toBe(
			0.5,
		)
		expect(
			resolveHtmlCodeBlockPreviewViewportHeight({
				containerWidth: 482,
				contentHeight: 805,
				previewScale: 482 / 1200,
				fitHeightWhenBounded: true,
			}),
		).toBe(Math.round(805 * (482 / 1200)))
	})

	it("renders html fenced code blocks as preview cards", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-tab-code")).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-tab-desktop")).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-scroll-area")).toBeInTheDocument()
		expect(screen.getByText(/<!DOCTYPE html>/)).toBeInTheDocument()
	})

	it("keeps non-html fenced code blocks unchanged", () => {
		render(<MarkdownComponent content={"```javascript\nconsole.log('hi')\n```"} />)

		expect(screen.queryByTestId("html-code-block-preview")).not.toBeInTheDocument()
		expect(screen.getByText("console.log('hi')")).toBeInTheDocument()
	})

	it("locks html blocks to code mode during streaming", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
				isStreaming
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.queryByTestId("html-code-block-preview-tab-desktop")).not.toBeInTheDocument()
		expect(screen.queryByLabelText("复制")).not.toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-scroll-area")).toBeInTheDocument()
	})

	it("copies the full html source from nested markdown html fences", async () => {
		const fullHtml = "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>"

		render(
			<MarkdownComponent
				content={`\`\`\`markdown\n说明文案\n\n\`\`\`html\n${fullHtml}\n\`\`\`\n\`\`\``}
			/>,
		)

		await act(async () => {
			fireEvent.click(screen.getByLabelText("复制"))
		})

		expect(writeTextMock).toHaveBeenCalledWith(fullHtml)
	})

	it("shows desktop preview, consumes iframe callbacks, and updates canvas width from metrics", async () => {
		vi.useFakeTimers()

		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><div style="width: 1920px;">Wide</div></body></html>\n```'
				}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))

		expect(screen.getByTestId("html-code-block-preview-skeleton")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toHaveAttribute(
			"data-contain-iframe-overscroll",
			"true",
		)
		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1920",
		)

		fireEvent.click(screen.getByRole("button", { name: "metrics" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"800",
		)

		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "ready" }))
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION)
		})

		expect(screen.queryByTestId("html-code-block-preview-skeleton")).not.toBeInTheDocument()
	})

	it("applies subsequent metrics updates after preview interaction", () => {
		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><div style="width: 1920px;">Wide</div></body></html>\n```'
				}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))

		fireEvent.click(screen.getByRole("button", { name: "metrics" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"800",
		)
		expect(screen.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "289px",
		})

		fireEvent.click(screen.getByRole("button", { name: "metrics-second" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"960",
		)
		expect(screen.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "321px",
		})
	})

	it("locks preview dimensions after settled metrics", () => {
		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><div style="width: 1920px;">Wide</div></body></html>\n```'
				}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))

		fireEvent.click(screen.getByRole("button", { name: "metrics" }))
		fireEvent.click(screen.getByRole("button", { name: "metrics-second" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"960",
		)
		expect(screen.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "321px",
		})

		fireEvent.click(screen.getByRole("button", { name: "metrics-third" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"960",
		)
		expect(screen.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "321px",
		})
	})

	it("keeps desktop preview mounted between mode switches", async () => {
		vi.useFakeTimers()

		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		expect(screen.getByTestId("html-code-block-preview-skeleton")).toBeInTheDocument()

		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "ready" }))
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION)
		})

		expect(screen.queryByTestId("html-code-block-preview-skeleton")).not.toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-code"))
		expect(screen.getByTestId("isolated-html-renderer")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		expect(screen.queryByTestId("html-code-block-preview-skeleton")).not.toBeInTheDocument()
	})

	it("keeps multiple html preview instances independent", () => {
		render(
			<MarkdownComponent
				content={[
					"```html",
					"<!DOCTYPE html><html><body><h1>First</h1></body></html>",
					"```",
					"",
					"```html",
					"<!DOCTYPE html><html><body><h1>Second</h1></body></html>",
					"```",
				].join("\n")}
			/>,
		)

		const previews = screen.getAllByTestId("html-code-block-preview")
		fireEvent.click(within(previews[0]).getByTestId("html-code-block-preview-tab-desktop"))

		expect(within(previews[0]).getByTestId("isolated-html-renderer")).toBeInTheDocument()
		expect(within(previews[1]).queryByTestId("isolated-html-renderer")).not.toBeInTheDocument()
	})

	it("resolves wider preview canvas widths from html layout hints", () => {
		expect(
			resolveHtmlPreviewCanvasWidth(
				'<!DOCTYPE html><html><body><div style="width: 1920px; min-width: 1920px;">Wide</div></body></html>',
			),
		).toBe(1920)
	})
})
