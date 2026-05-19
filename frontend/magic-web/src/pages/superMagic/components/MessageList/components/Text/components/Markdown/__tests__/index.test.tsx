import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import MarkdownComponent from "../index"
import { HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION } from "../components/HtmlCodeBlockPreview/constants"
import {
	resolveHtmlCodeBlockPreviewScale,
	resolveHtmlCodeBlockPreviewViewportHeight,
} from "../components/HtmlCodeBlockPreview/hooks/useHtmlCodeBlockPreviewScale"
import {
	resolveHtmlPreviewCanvasWidth,
	resolveHtmlPreviewIntrinsicWidthHint,
} from "../components/HtmlCodeBlockPreview/preview-width"
import {
	injectHtmlPreviewScrollbarGutterStyle,
	resolveStreamingHtmlPreviewMarkup,
} from "../components/HtmlCodeBlockPreview/preview-document"

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

const { publishMock } = vi.hoisted(() => ({
	publishMock: vi.fn(),
}))

const { useIsMobileMock } = vi.hoisted(() => ({
	useIsMobileMock: vi.fn(() => false),
}))

const { processHtmlContentMock, projectFilesStoreMock } = vi.hoisted(() => ({
	processHtmlContentMock: vi.fn(async ({ content }: { content?: string }) => ({
		processedContent: content ?? "",
		hasSlides: false,
		filePathMapping: new Map<string, string>(),
		slidesMap: new Map<string, string>(),
		originalSlidesPaths: [],
	})),
	projectFilesStoreMock: {
		workspaceFilesList: [] as Array<Record<string, unknown>>,
	},
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: {
		writeText: writeTextMock,
	},
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: useIsMobileMock,
}))

vi.mock("@/stores/projectFiles", () => ({
	default: projectFilesStoreMock,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor", () => ({
	processHtmlContent: processHtmlContentMock,
}))

function MockHtmlPreviewRenderer({
	content,
	containIframeOverscroll,
	hideVerticalScroll,
	onRenderReady,
	onContentMetrics,
}: {
	content: string
	containIframeOverscroll?: boolean
	hideVerticalScroll?: boolean
	onRenderReady?: () => void
	onContentMetrics?: (metrics: {
		contentWidth: number
		contentHeight: number
		phase?: "initial" | "settled"
		hasHorizontalOverflow?: boolean
		hasVerticalOverflow?: boolean
		verticalScrollbarWidth?: number
	}) => void
}) {
	return (
		<div
			data-testid="isolated-html-renderer"
			data-contain-iframe-overscroll={String(Boolean(containIframeOverscroll))}
			data-hide-vertical-scroll={String(Boolean(hideVerticalScroll))}
		>
			{content}
			<button onClick={onRenderReady}>ready</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 1920,
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
						contentWidth: 1920,
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
						contentWidth: 1920,
						contentHeight: 720,
						phase: "settled",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: false,
					})
				}
			>
				metrics-third
			</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 900,
						contentHeight: 640,
						phase: "settled",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: false,
					})
				}
			>
				metrics-adaptive
			</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 900,
						contentHeight: 920,
						phase: "settled",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: true,
						verticalScrollbarWidth: 12,
					})
				}
			>
				metrics-adaptive-scrollbar
			</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 300,
						contentHeight: 640,
						phase: "settled",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: false,
					})
				}
			>
				metrics-phone-narrow
			</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 414,
						contentHeight: 24,
						phase: "settled",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: false,
					})
				}
			>
				metrics-phone-short
			</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 520,
						contentHeight: 640,
						phase: "settled",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: false,
					})
				}
			>
				metrics-phone-wide
			</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 414,
						contentHeight: 920,
						phase: "settled",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: true,
						verticalScrollbarWidth: 12,
					})
				}
			>
				metrics-phone-scrollbar
			</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 414,
						contentHeight: 920,
						phase: "settled",
						hasHorizontalOverflow: false,
						hasVerticalOverflow: true,
						verticalScrollbarWidth: 0,
					})
				}
			>
				metrics-phone-scrollbar-overlay
			</button>
			<button
				onClick={() =>
					onContentMetrics?.({
						contentWidth: 3000,
						contentHeight: 720,
						phase: "settled",
						hasHorizontalOverflow: true,
						hasVerticalOverflow: false,
					})
				}
			>
				metrics-wide
			</button>
		</div>
	)
}

function MockStreamingHtmlPreviewRenderer(props: Parameters<typeof MockHtmlPreviewRenderer>[0]) {
	const { content, onRenderReady } = props

	useEffect(() => {
		if (!/(<body\b|<div\b|<main\b|<section\b|<button\b|<p\b)/i.test(content)) return
		onRenderReady?.()
	}, [content, onRenderReady])

	return <MockHtmlPreviewRenderer {...props} />
}

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer", () => ({
	default: MockHtmlPreviewRenderer,
}))

vi.mock(
	"@/pages/superMagic/components/MessageList/components/Text/components/Markdown/components/HtmlCodeBlockPreview/components/StreamingHtmlPreviewRenderer",
	() => ({
		StreamingHtmlPreviewRenderer: MockStreamingHtmlPreviewRenderer,
	}),
)

let mockPreviewAvailableWidth = 482

describe("MessageList Markdown HTML preview", () => {
	beforeEach(() => {
		writeTextMock.mockClear()
		publishMock.mockClear()
		processHtmlContentMock.mockClear()
		processHtmlContentMock.mockImplementation(async ({ content }: { content?: string }) => ({
			processedContent: content ?? "",
			hasSlides: false,
			filePathMapping: new Map<string, string>(),
			slidesMap: new Map<string, string>(),
			originalSlidesPaths: [],
		}))
		projectFilesStoreMock.workspaceFilesList = []
		useIsMobileMock.mockReturnValue(false)
		vi.spyOn(pubsub, "publish").mockImplementation(publishMock)
		mockPreviewAvailableWidth = 482

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
								width: mockPreviewAvailableWidth,
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
		vi.restoreAllMocks()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	function getPhonePreviewSurface() {
		return within(screen.getByTestId("html-code-block-preview-phone-surface"))
	}

	function getDesktopPreviewSurface() {
		return within(screen.getByTestId("html-code-block-preview-desktop-surface"))
	}

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
				previewScale: 482 / 1920,
				fitHeightWhenBounded: true,
			}),
		).toBe(Math.round(805 * (482 / 1920)))
	})

	it("uses a 1:1 viewport ratio for narrow preview containers", () => {
		expect(
			resolveHtmlCodeBlockPreviewViewportHeight({
				containerWidth: 320,
				previewScale: 1,
			}),
		).toBe(320)
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
		expect(screen.getByTestId("html-code-block-preview-tab-phone")).toBeInTheDocument()
		expect(screen.queryByTestId("html-code-block-scroll-area")).not.toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-phone-frame")).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-tab-phone")).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(screen.getByTestId("html-code-block-preview-fullscreen-button")).toHaveAttribute(
			"aria-label",
			"全屏",
		)
		expect(
			screen
				.getByLabelText("复制")
				.compareDocumentPosition(
					screen.getByTestId("html-code-block-preview-fullscreen-button"),
				) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		expect(screen.getByText(/<!DOCTYPE html>/)).toBeInTheDocument()
	})

	it("preprocesses html preview content with workspace files before rendering", async () => {
		projectFilesStoreMock.workspaceFilesList = [
			{
				file_id: "img-1",
				file_name: "cover.png",
				relative_file_path: "/assets/cover.png",
				type: "file",
			},
		]
		processHtmlContentMock.mockResolvedValueOnce({
			processedContent:
				'<!DOCTYPE html><html><body><img src="https://static.example.com/assets/cover.png" /></body></html>',
			hasSlides: false,
			filePathMapping: new Map([
				["https://static.example.com/assets/cover.png", "/assets/cover.png"],
			]),
			slidesMap: new Map<string, string>(),
			originalSlidesPaths: [],
		})

		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><img src="./assets/cover.png" /></body></html>\n```'
				}
			/>,
		)

		await waitFor(() => {
			expect(processHtmlContentMock).toHaveBeenCalledWith(
				expect.objectContaining({
					content:
						'<!DOCTYPE html><html><body><img src="./assets/cover.png" /></body></html>',
					attachments: projectFilesStoreMock.workspaceFilesList,
					attachmentList: projectFilesStoreMock.workspaceFilesList,
				}),
			)
		})

		await waitFor(() => {
			expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent(
				"https://static.example.com/assets/cover.png",
			)
		})
	})

	it("stops the local html preview commit queue after the task is suspended", () => {
		vi.useFakeTimers()

		const initialContent = "```html\n<!DOCTYPE html><html><body><div>step-1"
		const nextContent = "```html\n<!DOCTYPE html><html><body><div>step-1</div><div>step-2"

		const { rerender } = render(
			<MarkdownComponent content={initialContent} isStreaming isSuspended={false} />,
		)

		expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent("step-1")
		expect(screen.getByTestId("isolated-html-renderer")).not.toHaveTextContent("step-2")

		rerender(<MarkdownComponent content={nextContent} isStreaming isSuspended={false} />)
		expect(screen.getByTestId("isolated-html-renderer")).not.toHaveTextContent("step-2")

		rerender(<MarkdownComponent content={nextContent} isStreaming isSuspended />)

		act(() => {
			vi.advanceTimersByTime(200)
		})

		expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent("step-1")
		expect(screen.getByTestId("isolated-html-renderer")).not.toHaveTextContent("step-2")
	})

	it("opens the html preview in FilesViewer when clicking the fullscreen button", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		const fullscreenButton = screen.getByTestId("html-code-block-preview-fullscreen-button")

		expect(fullscreenButton).toHaveAttribute("aria-label", "全屏")

		fireEvent.click(fullscreenButton)

		expect(publishMock).toHaveBeenNthCalledWith(1, PubSubEvents.Switch_Detail_Mode, "files")
		expect(publishMock).toHaveBeenNthCalledWith(
			2,
			PubSubEvents.Open_File_Tab,
			expect.objectContaining({
				fileId: expect.stringContaining("message-html-preview-"),
				fileData: expect.objectContaining({
					file_extension: "html",
					content: expect.stringContaining("<!DOCTYPE html>"),
					display_config: expect.objectContaining({
						previewPolicy: expect.objectContaining({
							temporary: true,
							persistTab: false,
							readonly: true,
						}),
					}),
				}),
			}),
		)
	})

	it("clears fullscreen button focus after pointer interaction", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		const fullscreenButton = screen.getByTestId("html-code-block-preview-fullscreen-button")

		act(() => {
			fullscreenButton.focus()
		})
		expect(fullscreenButton).toHaveFocus()

		act(() => {
			fireEvent.mouseUp(fullscreenButton)
		})

		expect(fullscreenButton).not.toHaveFocus()
	})

	it("opens the streaming html preview in FilesViewer when clicking the fullscreen button", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
				isStreaming
			/>,
		)

		expect(
			screen.queryByTestId("html-code-block-preview-fullscreen-button"),
		).not.toBeInTheDocument()
	})

	it("renders direct preview when the message starts with a single html fence", () => {
		render(
			<MarkdownComponent
				content={
					"```html\n<!DOCTYPE html><html><body><main>OnlyHtml</main></body></html>\n```"
				}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent(/OnlyHtml/)
	})

	it("renders preview when message wraps a single html fence with surrounding markdown", () => {
		render(
			<MarkdownComponent
				content={[
					"这是一个 HTML 示例，请直接预览。",
					"",
					"```html",
					"<!DOCTYPE html><html><body><h1>Hello</h1></body></html>",
					"```",
					"",
					"尾部说明",
				].join("\n")}
			/>,
		)

		expect(screen.getByText("这是一个 HTML 示例，请直接预览。")).toBeInTheDocument()
		expect(screen.getByText("尾部说明")).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toBeInTheDocument()
	})

	it("switches between desktop and mobile preview tabs", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-phone-surface")).toBeVisible()
		expect(
			getPhonePreviewSurface().getByTestId("html-code-block-preview-phone-frame"),
		).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-tab-phone")).toHaveAttribute(
			"aria-selected",
			"true",
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		expect(screen.getByTestId("html-code-block-preview-desktop-surface")).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-desktop-surface")).toBeVisible()
		expect(screen.getByTestId("html-code-block-preview-phone-surface")).toHaveAttribute(
			"aria-hidden",
			"true",
		)
		expect(screen.getByTestId("html-code-block-preview-tab-desktop")).toHaveAttribute(
			"aria-selected",
			"true",
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-phone"))
		expect(screen.getByTestId("html-code-block-preview-phone-surface")).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-phone-surface")).toBeVisible()
		expect(screen.getByTestId("html-code-block-preview-desktop-surface")).toHaveAttribute(
			"aria-hidden",
			"true",
		)
		expect(
			getPhonePreviewSurface().getByTestId("html-code-block-preview-phone-frame"),
		).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-tab-phone")).toHaveAttribute(
			"aria-selected",
			"true",
		)
	})

	it("renders html fenced blocks without DOCTYPE as preview cards", () => {
		render(<MarkdownComponent content={"```html\n<div><p>FragmentOnly</p></div>\n```"} />)

		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent(/FragmentOnly/)
	})

	it("keeps non-html fenced code blocks unchanged", () => {
		render(<MarkdownComponent content={"```javascript\nconsole.log('hi')\n```"} />)

		expect(screen.queryByTestId("html-code-block-preview")).not.toBeInTheDocument()
		expect(screen.getByText("console.log('hi')")).toBeInTheDocument()
	})

	it("renders preview when preface text is directly followed by a single html fence", () => {
		render(<MarkdownComponent content={"说明文案\n```html\n<div>Inline</div>\n```"} />)

		expect(screen.getByText("说明文案")).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent(/Inline/)
	})

	it("auto-closes an unbalanced html fence so the preview can still render", () => {
		render(<MarkdownComponent content={"```html\n<div>Inline</div>"} />)

		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent(/Inline/)
	})
	// 重要  单个反引号包裹的 HTML 按普通 inline code 渲染
	it("renders raw html as html when the message does not contain html fences", () => {
		const { container } = render(
			<MarkdownComponent
				content={
					'<div id="raw-html-wrapper" align="center">RawTitle</div>\n\n我正在为您等待微信扫码登录结果。'
				}
			/>,
		)

		const rawHtmlWrapper = container.querySelector("#raw-html-wrapper")

		expect(screen.queryByTestId("html-code-block-preview")).not.toBeInTheDocument()
		expect(rawHtmlWrapper).toBeInTheDocument()
		expect(rawHtmlWrapper).toHaveAttribute("align", "center")
		expect(rawHtmlWrapper).toHaveTextContent("RawTitle")
		expect(screen.getByText(/我正在为您等待微信扫码登录结果/)).toBeInTheDocument()
	})

	it("keeps raw html outside html fences as plain text during streaming html fence messages", () => {
		render(
			<MarkdownComponent
				content={
					'<div style="color: rgb(255, 0, 0)">RawTitle</div>\n\n```html\n<div>Inline</div>\n```'
				}
				isStreaming
			/>,
		)

		const literalHtml = screen.getByText(/<div style="color: rgb\(255, 0, 0\)">RawTitle<\/div>/)

		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent(/Inline/)
		expect(literalHtml).toBeInTheDocument()
		expect(literalHtml).not.toHaveStyle({ color: "rgb(255, 0, 0)" })
	})

	it("treats raw script tags outside html fences as literal text", () => {
		render(
			<MarkdownComponent
				content={'<script>alert("xss")</script>\n\n这是一段普通说明文本。'}
			/>,
		)

		expect(screen.queryByTestId("html-code-block-preview")).not.toBeInTheDocument()
		expect(screen.getByText(/<script>alert\("xss"\)<\/script>/)).toBeInTheDocument()
		expect(screen.getByText(/这是一段普通说明文本/)).toBeInTheDocument()
	})

	it("does not create native img nodes for raw html with event handlers outside html fences", () => {
		const { container } = render(
			<MarkdownComponent
				content={'<img src="x" onerror="alert(\'xss\')" alt="unsafe" />\n\n后续说明文本'}
			/>,
		)

		expect(screen.queryByTestId("html-code-block-preview")).not.toBeInTheDocument()
		expect(
			screen.getByText(/<img src="x" onerror="alert\('xss'\)" alt="unsafe" \/>/),
		).toBeInTheDocument()
		expect(screen.getByText(/后续说明文本/)).toBeInTheDocument()
		expect(container.querySelector('img[alt="unsafe"]')).toBeNull()
	})

	it("does not render preview for html fences nested inside markdown fences", () => {
		render(
			<MarkdownComponent
				content={"```markdown\n说明文案\n\n```html\n<div><p>Nested</p></div>\n```\n```"}
			/>,
		)

		expect(screen.queryByTestId("html-code-block-preview")).not.toBeInTheDocument()
		expect(screen.getByText(/```html/)).toBeInTheDocument()
	})

	it("uses isolated iframe preview during streaming", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
				isStreaming
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.queryByLabelText("复制")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("html-code-block-preview-fullscreen-button"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-tab-phone")).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(screen.queryByTestId("html-code-block-preview-tab-desktop")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("html-code-block-preview-tab-desktop-placeholder"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("html-code-block-preview-copy-placeholder"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-mode-tabs")).toHaveClass("min-w-[68px]")
		expect(screen.getByTestId("isolated-html-renderer")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toHaveAttribute(
			"data-contain-iframe-overscroll",
			"false",
		)
		expect(screen.getByTestId("isolated-html-renderer")).toHaveAttribute(
			"data-hide-vertical-scroll",
			"false",
		)
		expect(screen.queryByTestId("html-code-block-streaming-preview")).not.toBeInTheDocument()
		expect(screen.queryByTestId("html-code-block-scroll-area")).not.toBeInTheDocument()
	})

	it("hides desktop preview button on mobile", () => {
		useIsMobileMock.mockReturnValue(true)

		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-tab-phone")).toBeInTheDocument()
		expect(screen.queryByTestId("html-code-block-preview-tab-desktop")).not.toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview-mode-tabs")).toHaveClass("min-w-[68px]")
	})

	it("animates preview card width when returning from code to streaming phone preview", () => {
		vi.useFakeTimers()

		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
				isStreaming
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-code"))
		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-phone"))

		expect(screen.getByTestId("html-code-block-preview-card").className).toContain(
			"transition-[width]",
		)

		act(() => {
			vi.advanceTimersByTime(240)
		})

		expect(screen.getByTestId("html-code-block-preview-card").className).not.toContain(
			"transition-[width]",
		)
	})

	it("does not animate preview card width when switching between phone and desktop", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-card").className).not.toContain(
			"transition-[width]",
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))

		expect(screen.getByTestId("html-code-block-preview-card").className).not.toContain(
			"transition-[width]",
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-phone"))

		expect(screen.getByTestId("html-code-block-preview-card").className).not.toContain(
			"transition-[width]",
		)
	})

	it("scrolls the outer message viewport to keep the expanded preview bottom visible", () => {
		vi.useFakeTimers()

		const scrollToMock = vi.fn()
		const { container } = render(
			<div data-slot="scroll-area-viewport">
				<MarkdownComponent
					content={
						"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"
					}
				/>
			</div>,
		)

		const viewportElement = container.firstChild as HTMLDivElement
		const previewCardElement = screen.getByTestId(
			"html-code-block-preview-card",
		) as HTMLDivElement
		const phoneSurfaceElement = screen.getByTestId(
			"html-code-block-preview-phone-surface",
		) as HTMLDivElement

		Object.defineProperty(viewportElement, "scrollTop", {
			value: 120,
			writable: true,
			configurable: true,
		})
		Object.defineProperty(viewportElement, "scrollTo", {
			value: scrollToMock,
			configurable: true,
		})
		Object.defineProperty(viewportElement, "getBoundingClientRect", {
			value: () =>
				({
					top: 0,
					left: 0,
					right: 482,
					bottom: 600,
					width: 482,
					height: 600,
					x: 0,
					y: 0,
					toJSON: () => ({}),
				}) as DOMRect,
			configurable: true,
		})
		Object.defineProperty(previewCardElement, "getBoundingClientRect", {
			value: () =>
				({
					top: 120,
					left: 0,
					right: 482,
					bottom: 760,
					width: 482,
					height: 640,
					x: 0,
					y: 120,
					toJSON: () => ({}),
				}) as DOMRect,
			configurable: true,
		})
		Object.defineProperty(phoneSurfaceElement, "getBoundingClientRect", {
			value: () =>
				({
					top: 120,
					left: 0,
					right: 482,
					bottom: 760,
					width: 482,
					height: 640,
					x: 0,
					y: 120,
					toJSON: () => ({}),
				}) as DOMRect,
			configurable: true,
		})

		fireEvent.click(screen.getByTestId("html-code-block-preview-toggle"))
		fireEvent.click(screen.getByTestId("html-code-block-preview-toggle"))

		act(() => {
			vi.advanceTimersByTime(240)
		})

		expect(scrollToMock).toHaveBeenCalled()
		expect(scrollToMock).toHaveBeenLastCalledWith({
			top: 296,
			behavior: "smooth",
		})
		expect(publishMock).toHaveBeenCalledWith(
			PubSubEvents.Message_Register_Programmatic_Scroll,
			expect.objectContaining({ time: 640 }),
		)
	})

	it("aligns auto-scroll to the active preview surface when switching to desktop mode", () => {
		vi.useFakeTimers()

		const scrollToMock = vi.fn()
		const { container } = render(
			<div data-slot="scroll-area-viewport">
				<MarkdownComponent
					content={
						"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"
					}
				/>
			</div>,
		)

		const viewportElement = container.firstChild as HTMLDivElement
		const previewCardElement = screen.getByTestId(
			"html-code-block-preview-card",
		) as HTMLDivElement
		const phoneSurfaceElement = screen.getByTestId(
			"html-code-block-preview-phone-surface",
		) as HTMLDivElement

		Object.defineProperty(viewportElement, "scrollTop", {
			value: 120,
			writable: true,
			configurable: true,
		})
		Object.defineProperty(viewportElement, "scrollTo", {
			value: scrollToMock,
			configurable: true,
		})
		Object.defineProperty(viewportElement, "getBoundingClientRect", {
			value: () =>
				({
					top: 0,
					left: 0,
					right: 482,
					bottom: 600,
					width: 482,
					height: 600,
					x: 0,
					y: 0,
					toJSON: () => ({}),
				}) as DOMRect,
			configurable: true,
		})
		Object.defineProperty(previewCardElement, "getBoundingClientRect", {
			value: () =>
				({
					top: 120,
					left: 0,
					right: 482,
					bottom: 880,
					width: 482,
					height: 760,
					x: 0,
					y: 120,
					toJSON: () => ({}),
				}) as DOMRect,
			configurable: true,
		})
		Object.defineProperty(phoneSurfaceElement, "getBoundingClientRect", {
			value: () =>
				({
					top: 180,
					left: 0,
					right: 482,
					bottom: 860,
					width: 482,
					height: 680,
					x: 0,
					y: 180,
					toJSON: () => ({}),
				}) as DOMRect,
			configurable: true,
		})

		scrollToMock.mockClear()

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))

		const desktopSurfaceElement = screen.getByTestId(
			"html-code-block-preview-desktop-surface",
		) as HTMLDivElement

		Object.defineProperty(desktopSurfaceElement, "getBoundingClientRect", {
			value: () =>
				({
					top: 180,
					left: 0,
					right: 482,
					bottom: 700,
					width: 482,
					height: 520,
					x: 0,
					y: 180,
					toJSON: () => ({}),
				}) as DOMRect,
			configurable: true,
		})

		act(() => {
			vi.advanceTimersByTime(120)
		})

		expect(scrollToMock).toHaveBeenCalled()
		expect(scrollToMock).toHaveBeenLastCalledWith({
			top: 236,
			behavior: "smooth",
		})
	})

	it("does not auto-scroll when the preview resizes without direct user interaction", () => {
		vi.useFakeTimers()

		class ControlledResizeObserver {
			private callback: ResizeObserverCallback
			private target: Element | null = null

			constructor(callback: ResizeObserverCallback) {
				this.callback = callback
				controlledResizeObservers.push(this)
			}

			observe(target: Element) {
				this.target = target
				this.emit()
			}

			unobserve() {
				return undefined
			}

			disconnect() {
				return undefined
			}

			emit() {
				if (!this.target) return

				this.callback(
					[
						{
							target: this.target,
							contentRect: {
								width: mockPreviewAvailableWidth,
								height: 560,
								x: 0,
								y: 0,
								top: 0,
								left: 0,
								right: mockPreviewAvailableWidth,
								bottom: 560,
								toJSON: () => ({}),
							},
						} as ResizeObserverEntry,
					],
					this as unknown as ResizeObserver,
				)
			}
		}

		const controlledResizeObservers: ControlledResizeObserver[] = []
		globalThis.ResizeObserver = ControlledResizeObserver as unknown as typeof ResizeObserver

		const scrollToMock = vi.fn()
		const { container } = render(
			<div data-slot="scroll-area-viewport">
				<MarkdownComponent
					content={
						"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"
					}
				/>
			</div>,
		)

		const viewportElement = container.firstChild as HTMLDivElement
		const previewCardElement = screen.getByTestId(
			"html-code-block-preview-card",
		) as HTMLDivElement
		const phoneSurfaceElement = screen.getByTestId(
			"html-code-block-preview-phone-surface",
		) as HTMLDivElement

		Object.defineProperty(viewportElement, "scrollTop", {
			value: 120,
			writable: true,
			configurable: true,
		})
		Object.defineProperty(viewportElement, "scrollTo", {
			value: scrollToMock,
			configurable: true,
		})
		Object.defineProperty(viewportElement, "getBoundingClientRect", {
			value: () =>
				({
					top: 0,
					left: 0,
					right: 482,
					bottom: 600,
					width: 482,
					height: 600,
					x: 0,
					y: 0,
					toJSON: () => ({}),
				}) as DOMRect,
			configurable: true,
		})
		Object.defineProperty(previewCardElement, "getBoundingClientRect", {
			value: () =>
				({
					top: 120,
					left: 0,
					right: 482,
					bottom: 880,
					width: 482,
					height: 760,
					x: 0,
					y: 120,
					toJSON: () => ({}),
				}) as DOMRect,
			configurable: true,
		})
		Object.defineProperty(phoneSurfaceElement, "getBoundingClientRect", {
			value: () =>
				({
					top: 180,
					left: 0,
					right: 482,
					bottom: 860,
					width: 482,
					height: 680,
					x: 0,
					y: 180,
					toJSON: () => ({}),
				}) as DOMRect,
			configurable: true,
		})

		scrollToMock.mockClear()

		act(() => {
			controlledResizeObservers.forEach((observer) => observer.emit())
			vi.advanceTimersByTime(600)
		})

		expect(scrollToMock).not.toHaveBeenCalled()
	})

	it("does not animate preview content opacity when html preview becomes ready", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-canvas").className).not.toContain(
			"transition-opacity",
		)
	})

	it("keeps the streaming skeleton visible until the minimum loading duration elapses", () => {
		vi.useFakeTimers()

		const { rerender } = render(
			<MarkdownComponent content={["```html", "<"].join("\n")} isStreaming />,
		)

		expect(screen.getByTestId("html-code-block-preview-skeleton")).toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "ready" }))

		expect(screen.getByTestId("html-code-block-preview-skeleton")).toBeInTheDocument()

		rerender(
			<MarkdownComponent
				content={["```html", '<div class="demo">Hello</div>'].join("\n")}
				isStreaming
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-skeleton")).toBeInTheDocument()
	})

	it("batches streaming iframe content updates to reduce per-chunk flicker", async () => {
		vi.useFakeTimers()

		const { rerender } = render(
			<MarkdownComponent
				content={["```html", "<!DOCTYPE html><html><body><div>First</div>"].join("\n")}
				isStreaming
			/>,
		)

		expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent("First")
		expect(screen.getByTestId("isolated-html-renderer")).not.toHaveTextContent("Second")

		rerender(
			<MarkdownComponent
				content={[
					"```html",
					"<!DOCTYPE html><html><body><div>First</div><div>Second</div>",
				].join("\n")}
				isStreaming
			/>,
		)

		expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent("First")
		expect(screen.getByTestId("isolated-html-renderer")).not.toHaveTextContent("Second")

		await act(async () => {
			await vi.advanceTimersByTimeAsync(120)
		})

		expect(screen.getByTestId("isolated-html-renderer")).toHaveTextContent("Second")
	})

	it("uses isolated iframe preview during streaming when external script-backed styles are required", () => {
		render(
			<MarkdownComponent
				content={[
					"```html",
					"<!DOCTYPE html>",
					"<html>",
					"<head>",
					'<script src="https://cdn.tailwindcss.com/3.4.17"></script>',
					"</head>",
					'<body><div class="w-64 bg-blue-600 text-white">Hello</div></body>',
					"</html>",
					"```",
				].join("\n")}
				isStreaming
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toHaveAttribute(
			"data-contain-iframe-overscroll",
			"false",
		)
		expect(screen.queryByTestId("html-code-block-streaming-preview")).not.toBeInTheDocument()
	})

	it("enters streaming html preview when the message has prefix and suffix markdown", () => {
		render(
			<MarkdownComponent
				content={[
					"前缀说明",
					"",
					"```html",
					"<!DOCTYPE html><html><body><h1>Hello</h1></body></html>",
					"```",
					"",
					"后缀说明",
				].join("\n")}
				isStreaming
			/>,
		)

		expect(screen.getByText("前缀说明")).toBeInTheDocument()
		expect(screen.getByText("后缀说明")).toBeInTheDocument()
		expect(screen.getByTestId("html-code-block-preview")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toBeInTheDocument()
		expect(screen.queryByTestId("html-code-block-preview-tab-desktop")).not.toBeInTheDocument()
		expect(screen.queryByTestId("html-code-block-streaming-preview")).not.toBeInTheDocument()
	})

	it("keeps earlier html previews mounted when a later html block starts streaming", () => {
		render(
			<MarkdownComponent
				content={[
					"前缀说明",
					"",
					"```html",
					"<!DOCTYPE html><html><body><h1>First</h1></body></html>",
					"```",
					"",
					"```html",
					"<!DOCTYPE html><html><body><h1>Second</h1></body></html>",
				].join("\n")}
				isStreaming
			/>,
		)

		expect(screen.getByText("前缀说明")).toBeInTheDocument()
		expect(screen.getAllByTestId("html-code-block-preview")).toHaveLength(2)
		expect(screen.getAllByTestId("isolated-html-renderer")).toHaveLength(2)
		expect(screen.getAllByTestId("isolated-html-renderer")[0]).toHaveTextContent(/First/)
		expect(screen.getAllByTestId("isolated-html-renderer")[1]).toHaveTextContent(/Second/)
	})

	it("strips inert head tags while keeping renderable streaming preview markup", () => {
		const htmlCode = [
			"<!DOCTYPE html>",
			"<html>",
			"<head>",
			'<meta charset="UTF-8">',
			'<script src="https://cdn.tailwindcss.com"></script>',
			'<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">',
			"<style>.card{padding:12px;}</style>",
			"</head>",
			'<body><div class="card">Hello</div></body>',
			"</html>",
		].join("\n")

		const previewMarkup = resolveStreamingHtmlPreviewMarkup(htmlCode)

		expect(previewMarkup).toContain("<style>.card{padding:12px;}</style>")
		expect(previewMarkup).toContain('<div class="card">Hello</div>')
		expect(previewMarkup).not.toContain("<script")
		expect(previewMarkup).not.toContain("<link")
		expect(previewMarkup).not.toContain("<meta")
	})

	it("extracts intrinsic html width hints for phone preview shrink", () => {
		expect(
			resolveHtmlPreviewIntrinsicWidthHint(
				'<div style="width: 320px"><img width="280" src="demo.png"></div>',
			),
		).toBe(320)
	})

	it("injects a stable scrollbar gutter style into preview documents", () => {
		expect(
			injectHtmlPreviewScrollbarGutterStyle(
				"<!DOCTYPE html><html><head></head><body><div>Preview</div></body></html>",
			),
		).toContain("scrollbar-gutter: stable;")
	})

	it("keeps streaming external resources out of document head", () => {
		render(
			<MarkdownComponent
				content={[
					"```html",
					"<!DOCTYPE html>",
					"<html>",
					"<head>",
					'<script src="https://cdn.tailwindcss.com"></script>',
					'<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">',
					"</head>",
					'<body><div class="fa-solid fa-star">Hello</div></body>',
					"</html>",
					"```",
				].join("\n")}
				isStreaming
			/>,
		)

		expect(
			document.head.querySelector(
				'[data-streaming-html-preview-resource="https://cdn.tailwindcss.com"]',
			),
		).not.toBeInTheDocument()
		expect(
			document.head.querySelector(
				'[data-streaming-html-preview-resource="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"]',
			),
		).not.toBeInTheDocument()
	})

	it("defaults to mobile preview after streaming completes", () => {
		const { rerender } = render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
				isStreaming
			/>,
		)

		expect(screen.getByTestId("isolated-html-renderer")).toBeInTheDocument()
		expect(screen.queryByTestId("html-code-block-streaming-preview")).not.toBeInTheDocument()

		rerender(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
				isStreaming={false}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-tab-phone")).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(screen.getByTestId("html-code-block-preview-phone-frame")).toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toBeInTheDocument()
	})

	it("does not replay preview loading after streaming completes and the html content updates", async () => {
		vi.useFakeTimers()

		const { rerender } = render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
				isStreaming
			/>,
		)

		rerender(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
				isStreaming={false}
			/>,
		)

		const phoneSurface = getPhonePreviewSurface()
		act(() => {
			fireEvent.click(phoneSurface.getByRole("button", { name: "ready" }))
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION)
		})

		expect(
			phoneSurface.queryByTestId("html-code-block-preview-skeleton"),
		).not.toBeInTheDocument()

		rerender(
			<MarkdownComponent
				content={
					"```html\n<!DOCTYPE html><html><body><h1>Hello Updated</h1><p>done</p></body></html>\n```"
				}
				isStreaming={false}
			/>,
		)

		expect(screen.queryByTestId("html-code-block-preview-skeleton")).not.toBeInTheDocument()
		expect(getPhonePreviewSurface().getByTestId("isolated-html-renderer")).toHaveTextContent(
			/Hello Updated/,
		)
	})

	it("copies the full html source from a wrapped single html fence message", async () => {
		const fullHtml = "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>"

		render(
			<MarkdownComponent
				content={`说明文案\n\n\`\`\`html\n${fullHtml}\n\`\`\`\n\n尾部说明`}
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
		const desktopSurface = getDesktopPreviewSurface()

		expect(desktopSurface.getByTestId("html-code-block-preview-skeleton")).toBeInTheDocument()
		expect(desktopSurface.getByTestId("isolated-html-renderer")).toHaveAttribute(
			"data-contain-iframe-overscroll",
			"true",
		)
		expect(desktopSurface.getByTestId("isolated-html-renderer")).toHaveAttribute(
			"data-hide-vertical-scroll",
			"true",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1920",
		)

		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics" }))

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1920",
		)

		act(() => {
			fireEvent.click(desktopSurface.getByRole("button", { name: "ready" }))
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION)
		})

		expect(
			desktopSurface.queryByTestId("html-code-block-preview-skeleton"),
		).not.toBeInTheDocument()
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
		const desktopSurface = getDesktopPreviewSurface()

		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics" }))

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1920",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "480px",
		})

		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics-second" }))

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1920",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "161px",
		})
	})

	it("updates desktop preview dimensions when settled metrics change materially", () => {
		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><div style="width: 1920px;">Wide</div></body></html>\n```'
				}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		const desktopSurface = getDesktopPreviewSurface()

		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics" }))
		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics-second" }))

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1920",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "161px",
		})

		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics-third" }))

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1920",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "181px",
		})
	})

	it("updates the desktop preview canvas width after later settled metrics narrow the content", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		const desktopSurface = getDesktopPreviewSurface()

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1200",
		)

		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics-second" }))

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1920",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"0.251",
		)

		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics-adaptive" }))

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"900",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"0.536",
		)
	})

	it("clamps ultra-wide desktop previews to the 1920 design width", () => {
		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><div style="width: 3000px;">UltraWide</div></body></html>\n```'
				}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		const desktopSurface = getDesktopPreviewSurface()
		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics-wide" }))

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1920",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"0.251",
		)
	})

	it("uses adaptive desktop scaling when content width does not exceed 1920", () => {
		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><div style="width: 900px;">Adaptive</div></body></html>\n```'
				}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		const desktopSurface = getDesktopPreviewSurface()
		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics-adaptive" }))

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"900",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"0.536",
		)
	})

	it("uses a fixed phone viewport baseline that differs from desktop preview scaling", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-tab-phone")).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"414",
		)
		expect(screen.getByTestId("isolated-html-renderer")).toHaveAttribute(
			"data-hide-vertical-scroll",
			"true",
		)
		expect(screen.getByTestId("html-code-block-preview-card").className).toContain("p-1.5")
		expect(screen.getByTestId("html-code-block-preview-card").className).not.toContain("px-0")
		expect(screen.getByTestId("html-code-block-preview-phone-frame-inner").style.width).toBe("")
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "428px",
		})

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		const desktopSurface = getDesktopPreviewSurface()

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1200",
		)
	})

	it("widens the phone preview card when runtime content width exceeds the baseline", async () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "428px",
		})

		fireEvent.click(screen.getByRole("button", { name: "metrics-phone-wide" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"520",
		)
		await waitFor(() => {
			expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
				width: "482px",
			})
		})
		expect(screen.getByTestId("html-code-block-preview-card").className).not.toContain("px-0")
		expect(screen.getByTestId("html-code-block-preview-phone-frame-inner").style.width).toBe("")
		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"0.927",
		)
		expect(screen.getByTestId("html-code-block-preview-viewport").className).not.toContain(
			"overflow-x-auto",
		)
	})

	it("widens the phone preview card to account for the vertical scrollbar gutter", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "428px",
		})

		fireEvent.click(screen.getByRole("button", { name: "metrics-phone-scrollbar" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"426",
		)
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "440px",
		})
	})

	it("does not widen the phone preview card when vertical overflow has no layout gutter", () => {
		mockPreviewAvailableWidth = 390

		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "metrics-phone-scrollbar-overlay" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"414",
		)
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "390px",
			maxWidth: "100%",
		})
		expect(screen.getByTestId("html-code-block-preview-card").style.minWidth).toBe("")
		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"0.942",
		)
	})

	it("uses host slack to compensate the phone card chrome without exceeding the host width", () => {
		mockPreviewAvailableWidth = 420

		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"414",
		)
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "420px",
			maxWidth: "100%",
		})
		expect(screen.getByTestId("html-code-block-preview-card").style.minWidth).toBe("")
	})

	it("removes the extra phone scrollbar gutter when later metrics no longer overflow vertically", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "metrics-phone-scrollbar" }))

		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "440px",
		})
		expect(screen.getByTestId("isolated-html-renderer")).toHaveAttribute(
			"data-contain-iframe-overscroll",
			"true",
		)

		fireEvent.click(screen.getByRole("button", { name: "metrics-phone-narrow" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"414",
		)
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "428px",
		})
		expect(screen.getByTestId("isolated-html-renderer")).toHaveAttribute(
			"data-contain-iframe-overscroll",
			"false",
		)
	})

	it("keeps the phone preview height at the max height before settled phone metrics are ready", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"1.000",
		)

		fireEvent.click(screen.getByRole("button", { name: "metrics-phone-narrow" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"1.000",
		)
		expect(screen.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "480px",
		})
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "428px",
		})
	})

	it("shrinks the phone preview card to the host width when the host is narrower", () => {
		mockPreviewAvailableWidth = 390

		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "390px",
			maxWidth: "100%",
		})
		expect(screen.getByTestId("html-code-block-preview-card").style.minWidth).toBe("")
		expect(screen.getByTestId("html-code-block-preview")).not.toHaveClass("overflow-x-auto")
		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"0.942",
		)
		expect(screen.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "452px",
		})
		expect(screen.getByTestId("html-code-block-preview-viewport").className).not.toContain(
			"overflow-x-auto",
		)

		fireEvent.click(screen.getByRole("button", { name: "metrics-phone-narrow" }))

		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "390px",
			maxWidth: "100%",
		})
	})

	it("shrinks the phone preview viewport height with the host width", () => {
		mockPreviewAvailableWidth = 320

		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "371px",
		})
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "320px",
		})
	})

	it("derives the phone preview viewport height from settled iframe content", async () => {
		mockPreviewAvailableWidth = 320
		vi.useFakeTimers()

		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		const phoneSurface = getPhonePreviewSurface()

		act(() => {
			fireEvent.click(phoneSurface.getByRole("button", { name: "ready" }))
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION)
		})

		fireEvent.click(phoneSurface.getByRole("button", { name: "metrics-phone-wide" }))

		expect(screen.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "371px",
		})
		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"0.580",
		)
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "320px",
		})
	})

	it("keeps the phone preview viewport height fixed even when iframe content is initially very short", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
				isStreaming
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "metrics-phone-short" }))

		expect(screen.getByTestId("html-code-block-preview-desktop")).toHaveStyle({
			height: "480px",
		})
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "428px",
		})
	})

	it("scales visible vertical scrollbar width without exceeding narrow hosts", () => {
		mockPreviewAvailableWidth = 390

		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "390px",
		})

		fireEvent.click(screen.getByRole("button", { name: "metrics-phone-scrollbar" }))

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"426",
		)
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "390px",
			maxWidth: "100%",
		})
		expect(screen.getByTestId("html-code-block-preview-card").style.minWidth).toBe("")
		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"0.915",
		)
		expect(screen.getByTestId("html-code-block-preview")).not.toHaveClass("overflow-x-auto")
		expect(screen.getByTestId("html-code-block-preview-viewport").className).not.toContain(
			"overflow-x-auto",
		)
	})

	it("keeps the phone preview iframe canvas at the minimum width for narrow intrinsic html", () => {
		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><div style="width: 200px;">Narrow Phone</div></body></html>\n```'
				}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"414",
		)
		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "428px",
		})
	})

	it("uses intrinsic width hints to expand the initial phone preview card width", async () => {
		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><div style="width: 520px;">Wide Phone</div></body></html>\n```'
				}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"520",
		)
		await waitFor(() => {
			expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
				width: "482px",
			})
		})
	})

	it("keeps the desktop preview mounted after first opening it", async () => {
		vi.useFakeTimers()

		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		const phoneSurface = getPhonePreviewSurface()
		expect(phoneSurface.getByTestId("html-code-block-preview-skeleton")).toBeInTheDocument()

		act(() => {
			fireEvent.click(phoneSurface.getByRole("button", { name: "ready" }))
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION)
		})

		expect(
			phoneSurface.queryByTestId("html-code-block-preview-skeleton"),
		).not.toBeInTheDocument()
		expect(phoneSurface.getByTestId("isolated-html-renderer")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		const desktopSurface = getDesktopPreviewSurface()
		expect(desktopSurface.getByTestId("html-code-block-preview-skeleton")).toBeInTheDocument()

		act(() => {
			fireEvent.click(desktopSurface.getByRole("button", { name: "ready" }))
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION)
		})

		expect(
			desktopSurface.queryByTestId("html-code-block-preview-skeleton"),
		).not.toBeInTheDocument()
		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1200",
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-code"))
		expect(screen.queryByTestId("isolated-html-renderer")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-phone"))
		const refreshedPhoneSurface = getPhonePreviewSurface()
		expect(
			refreshedPhoneSurface.getByTestId("html-code-block-preview-skeleton"),
		).toBeInTheDocument()

		act(() => {
			fireEvent.click(refreshedPhoneSurface.getByRole("button", { name: "ready" }))
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(HTML_CODE_BLOCK_PREVIEW_SKELETON_MIN_VISIBLE_DURATION)
		})

		expect(
			refreshedPhoneSurface.queryByTestId("html-code-block-preview-skeleton"),
		).not.toBeInTheDocument()
		expect(refreshedPhoneSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"414",
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		expect(
			getDesktopPreviewSurface().queryByTestId("html-code-block-preview-skeleton"),
		).toBeInTheDocument()
	})

	it("uses a light motion wrapper without animating the actual preview canvas transform", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-canvas").className).not.toContain(
			"transition-transform",
		)
		expect(screen.getByTestId("html-code-block-preview-canvas-motion")).toHaveStyle({
			transition: "transform 120ms ease-out, opacity 120ms ease-out",
		})

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))

		expect(
			getDesktopPreviewSurface().getByTestId("html-code-block-preview-canvas").className,
		).not.toContain("transition-transform")
		expect(
			getDesktopPreviewSurface().getByTestId("html-code-block-preview-canvas-motion"),
		).toHaveStyle({
			transition: "transform 120ms ease-out, opacity 120ms ease-out",
		})
	})

	it("does not reuse the cached phone card width when switching to desktop preview", async () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "428px",
		})

		fireEvent.click(screen.getByRole("button", { name: "metrics-phone-wide" }))

		await waitFor(() => {
			expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
				width: "482px",
			})
		})

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))

		expect(screen.getByTestId("html-code-block-preview-card").style.width).toBe("")
		expect(
			getDesktopPreviewSurface().getByTestId("html-code-block-preview-canvas"),
		).toHaveAttribute("data-preview-canvas-width", "1200")
		expect(
			getDesktopPreviewSurface().getByTestId("html-code-block-preview-canvas"),
		).toHaveAttribute("data-preview-scale", "0.402")

		fireEvent.click(
			getDesktopPreviewSurface().getByRole("button", { name: "metrics-adaptive" }),
		)

		expect(
			getDesktopPreviewSurface().getByTestId("html-code-block-preview-canvas"),
		).toHaveAttribute("data-preview-canvas-width", "900")

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-phone"))

		expect(screen.getByTestId("html-code-block-preview-card")).toHaveStyle({
			width: "482px",
		})
	})

	it("keeps the desktop preview card full width while rescaling the desktop canvas", () => {
		mockPreviewAvailableWidth = 1200

		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><div style="width: 900px;">Adaptive</div></body></html>\n```'
				}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		const desktopSurface = getDesktopPreviewSurface()

		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics-adaptive" }))

		expect(screen.getByTestId("html-code-block-preview-card").style.width).toBe("")
		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"1186",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"1.000",
		)
	})

	it("compensates the desktop canvas width when a visible vertical scrollbar would clip the right edge", () => {
		mockPreviewAvailableWidth = 520

		render(
			<MarkdownComponent
				content={
					'```html\n<!DOCTYPE html><html><body><div style="width: 900px;">Adaptive</div></body></html>\n```'
				}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		const desktopSurface = getDesktopPreviewSurface()

		fireEvent.click(desktopSurface.getByRole("button", { name: "metrics-adaptive-scrollbar" }))

		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-canvas-width",
			"912",
		)
		expect(desktopSurface.getByTestId("html-code-block-preview-canvas")).toHaveAttribute(
			"data-preview-scale",
			"0.570",
		)
		expect(screen.getByTestId("html-code-block-preview-card").style.width).toBe("")
	})

	it("reuses the desktop preview renderer after switching away and back from phone mode", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		const firstDesktopRenderer =
			getDesktopPreviewSurface().getByTestId("isolated-html-renderer")
		expect(
			getDesktopPreviewSurface().getByTestId("html-code-block-preview-canvas"),
		).toHaveAttribute("data-preview-scale", "0.402")

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-phone"))
		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))

		const secondDesktopRenderer =
			getDesktopPreviewSurface().getByTestId("isolated-html-renderer")
		expect(secondDesktopRenderer).toBe(firstDesktopRenderer)
		expect(
			getDesktopPreviewSurface().getByTestId("html-code-block-preview-canvas"),
		).toHaveAttribute("data-preview-scale", "0.402")
	})

	it("keeps independent desktop viewport height cache after switching back from phone mode", () => {
		render(
			<MarkdownComponent
				content={"```html\n<!DOCTYPE html><html><body><h1>Hello</h1></body></html>\n```"}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		fireEvent.click(
			getDesktopPreviewSurface().getByRole("button", { name: "metrics-adaptive" }),
		)

		expect(
			getDesktopPreviewSurface().getByTestId("html-code-block-preview-desktop"),
		).toHaveStyle({
			height: "343px",
		})

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-phone"))
		expect(getPhonePreviewSurface().getByTestId("html-code-block-preview-desktop")).toHaveStyle(
			{
				height: "480px",
			},
		)

		fireEvent.click(screen.getByTestId("html-code-block-preview-tab-desktop"))
		expect(
			getDesktopPreviewSurface().getByTestId("html-code-block-preview-desktop"),
		).toHaveStyle({
			height: "343px",
		})
	})

	it("renders independent previews for messages containing multiple html fenced blocks", () => {
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

		expect(screen.getAllByTestId("html-code-block-preview")).toHaveLength(2)
		expect(screen.getAllByTestId("isolated-html-renderer")).toHaveLength(2)
		expect(screen.getAllByTestId("isolated-html-renderer")[0]).toHaveTextContent(/First/)
		expect(screen.getAllByTestId("isolated-html-renderer")[1]).toHaveTextContent(/Second/)
	})

	it("resolves wider preview canvas widths from html layout hints", () => {
		expect(
			resolveHtmlPreviewCanvasWidth(
				'<!DOCTYPE html><html><body><div style="width: 1920px; min-width: 1920px;">Wide</div></body></html>',
			),
		).toBe(1920)
	})
})
