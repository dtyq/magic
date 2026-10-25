import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { RecordingSummaryContent } from "../RecordingSummaryContent"
import {
	RECORDING_DESKTOP_CONTENT_INSET_CLASS,
	RECORDING_DESKTOP_MD_CONTENT_CLASS,
} from "../recording-detail-layout"
import type { RecordingDetailFileRef } from "../../../types/recording-detail"

vi.mock("@/models/user", () => ({
	userStore: {},
}))

const magicMarkmapPropsMock = vi.hoisted(() => vi.fn())
const processHtmlContentMock = vi.hoisted(() => vi.fn())

vi.mock("@/components/base/MagicMarkmap", () => ({
	default: (props: Record<string, unknown>) => {
		magicMarkmapPropsMock(props)
		return <div data-testid="magic-markmap-mock" />
	},
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer", () => ({
	default: (props: { onRenderReady?: () => void }) => (
		<div data-testid="isolated-html-renderer-mock">
			<button
				type="button"
				data-testid="recording-metrics-render-ready"
				onClick={props.onRenderReady}
			/>
		</div>
	),
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor", () => ({
	processHtmlContent: processHtmlContentMock,
}))

vi.mock("../RecordingMarkdownContent", () => ({
	RecordingMarkdownContent: () => <div data-testid="recording-markdown-mock" />,
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

const mindmapFile: RecordingDetailFileRef = {
	type: "mindmap",
	fileName: "mindmap.md",
	file: {
		file_id: "file-mock-001",
		relative_file_path: "summary/mindmap.md",
	} as RecordingDetailFileRef["file"],
}

const summaryFile: RecordingDetailFileRef = {
	type: "summary",
	fileName: "summary.md",
	file: {
		file_id: "file-mock-002",
		relative_file_path: "summary/summary.md",
	} as RecordingDetailFileRef["file"],
}

const highlightsFile: RecordingDetailFileRef = {
	type: "highlights",
	fileName: "highlights.md",
	file: {
		file_id: "file-mock-003",
		relative_file_path: "summary/highlights.md",
	} as RecordingDetailFileRef["file"],
}

const topicsFile: RecordingDetailFileRef = {
	type: "topics",
	fileName: "topics.md",
	file: {
		file_id: "file-mock-004",
		relative_file_path: "summary/topics.md",
	} as RecordingDetailFileRef["file"],
}

const metricsFile: RecordingDetailFileRef = {
	type: "metrics",
	fileName: "metrics.html",
	file: {
		file_id: "file-mock-005",
		relative_file_path: "summary/metrics.html",
	} as RecordingDetailFileRef["file"],
}

const topicsMarkdown = `
## Topics

### 📌 demo_topic | Demo Topic | #000000

#### Key Points
[Speaker-1]
Important discussion.

#### Related Dialogue
- \`00:10-00:20\` Speaker-1: Discussed the plan
`

const topicsMarkdownWithInlineSpeakerTokens = `
## Topics

### 📌 demo_topic | Demo Topic | #000000

#### Key Points
[Speaker-1]
Important discussion.

#### Related Dialogue
- \`00:10-00:20\` Speaker-1: Speaker-1 confirmed the plan and Speaker-2 took follow-up.
`

/** Builds topics markdown with many pills to exercise horizontal overflow in tests. */
function buildManyTopicsMarkdown(count: number): string {
	const topicBlocks = Array.from({ length: count }, (_, index) => {
		const topicIndex = index + 1
		return `### 📌 topic_${topicIndex} | Topic Label ${topicIndex} | #000000

#### Key Points
Summary body ${topicIndex}.`
	})

	return `## Topics\n\n${topicBlocks.join("\n\n---\n\n")}`
}

const manyTopicsMarkdown = buildManyTopicsMarkdown(8)

describe("RecordingSummaryContent desktop markdown layout", () => {
	it("wraps default markdown summary in shared desktop content inset", () => {
		render(
			<RecordingSummaryContent
				file={highlightsFile}
				content="# Highlights\n\nBody text"
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		const markdownMock = screen.getByTestId("recording-markdown-mock")
		expect(markdownMock.parentElement).toHaveClass(
			...RECORDING_DESKTOP_MD_CONTENT_CLASS.split(" "),
		)
	})

	it("wraps only topics summary markdown inside shared inset, not outside section chrome", () => {
		render(
			<RecordingSummaryContent
				file={topicsFile}
				content={topicsMarkdown}
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		const topicsRoot = screen.getByTestId("recording-detail-topics-content")
		expect(topicsRoot).toHaveClass(...RECORDING_DESKTOP_CONTENT_INSET_CLASS.split(" "))

		const markdownMocks = screen.getAllByTestId("recording-markdown-mock")
		expect(markdownMocks).toHaveLength(1)
		expect(topicsRoot).toContainElement(markdownMocks[0] as HTMLElement)
		expect(screen.getByText("Key Points")).toBeTruthy()
		expect(screen.getByRole("button", { name: "Demo Topic" })).toBeTruthy()
	})

	it("renders inline speaker tokens inside topic dialogue body without triggering seek", () => {
		const onOpenSpeakerSettings = vi.fn()
		const onTimeClick = vi.fn()

		render(
			<RecordingSummaryContent
				file={topicsFile}
				content={topicsMarkdownWithInlineSpeakerTokens}
				attachmentList={[]}
				speakerNameMap={{ "Speaker-1": "Host", "Speaker-2": "Guest" }}
				onOpenSpeakerSettings={onOpenSpeakerSettings}
				onTimeClick={onTimeClick}
				layout="desktop"
			/>,
		)

		const timeCard = screen.getByTestId("recording-detail-topic-time-card")
		const speakerChips = screen.getAllByTestId("recording-detail-token-speaker")
		expect(speakerChips).toHaveLength(2)
		expect(speakerChips[0]).toHaveTextContent("Host")
		expect(speakerChips[1]).toHaveTextContent("Guest")
		expect(timeCard).not.toHaveTextContent("Speaker-1 confirmed")

		fireEvent.click(speakerChips[0])

		expect(onOpenSpeakerSettings).toHaveBeenCalledTimes(1)
		expect(onTimeClick).not.toHaveBeenCalled()
	})
})

describe("RecordingSummaryContent topics pill scroll", () => {
	it("uses a hidden-scrollbar horizontal scroll container for topic pills", () => {
		render(
			<RecordingSummaryContent
				file={topicsFile}
				content={topicsMarkdown}
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		const scrollContainer = screen.getByTestId("recording-detail-topics-scroll")
		expect(scrollContainer).toHaveClass("overflow-x-auto", "no-scrollbar")
		expect(scrollContainer.firstElementChild).toHaveClass("w-max", "flex-nowrap")
	})

	it("shows start and end fades when topic pills overflow and are partially scrolled", () => {
		const scrollWidthDescriptor = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"scrollWidth",
		)
		const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"clientWidth",
		)
		const scrollLeftDescriptor = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"scrollLeft",
		)

		Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
			configurable: true,
			get() {
				return 640
			},
		})
		Object.defineProperty(HTMLElement.prototype, "clientWidth", {
			configurable: true,
			get() {
				return 240
			},
		})
		Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
			configurable: true,
			get() {
				return 120
			},
			set() {
				// Allow components to update their local scroller while this test pins the observed state.
			},
		})

		render(
			<RecordingSummaryContent
				file={topicsFile}
				content={manyTopicsMarkdown}
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		expect(screen.getByTestId("recording-detail-topics-fade-start")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-topics-fade-end")).toBeInTheDocument()

		if (scrollWidthDescriptor) {
			Object.defineProperty(HTMLElement.prototype, "scrollWidth", scrollWidthDescriptor)
		} else {
			delete (HTMLElement.prototype as Partial<HTMLElement>).scrollWidth
		}
		if (clientWidthDescriptor) {
			Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor)
		} else {
			delete (HTMLElement.prototype as Partial<HTMLElement>).clientWidth
		}
		if (scrollLeftDescriptor) {
			Object.defineProperty(HTMLElement.prototype, "scrollLeft", scrollLeftDescriptor)
		} else {
			delete (HTMLElement.prototype as Partial<HTMLElement>).scrollLeft
		}
	})

	it("maps vertical wheel input to horizontal scroll on the topic pill strip", () => {
		render(
			<RecordingSummaryContent
				file={topicsFile}
				content={manyTopicsMarkdown}
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		const scrollContainer = screen.getByTestId("recording-detail-topics-scroll")
		Object.defineProperty(scrollContainer, "scrollWidth", {
			configurable: true,
			value: 640,
		})
		Object.defineProperty(scrollContainer, "clientWidth", {
			configurable: true,
			value: 240,
		})
		Object.defineProperty(scrollContainer, "scrollLeft", {
			configurable: true,
			writable: true,
			value: 0,
		})

		fireEvent.wheel(scrollContainer, { deltaY: 40, deltaX: 0 })
		expect(scrollContainer.scrollLeft).toBe(40)
	})

	it("centers the active topic pill inside only the local scroll container", () => {
		render(
			<RecordingSummaryContent
				file={topicsFile}
				content={manyTopicsMarkdown}
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)
		const scrollContainer = screen.getByTestId("recording-detail-topics-scroll")
		const targetTopic = screen.getByRole("button", { name: "Topic Label 5" })
		Object.defineProperties(scrollContainer, {
			scrollWidth: { configurable: true, value: 640 },
			clientWidth: { configurable: true, value: 240 },
			scrollLeft: { configurable: true, writable: true, value: 0 },
		})
		Object.defineProperties(targetTopic, {
			offsetLeft: { configurable: true, value: 360 },
			offsetWidth: { configurable: true, value: 80 },
		})

		fireEvent.click(targetTopic)

		expect(scrollContainer.scrollLeft).toBe(280)
	})
})

describe("RecordingSummaryContent empty state", () => {
	it("renders unified empty state with icon and emptySummary copy inside centered region", () => {
		const { container } = render(
			<RecordingSummaryContent
				file={summaryFile}
				content=""
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		const emptyState = screen.getByTestId("recording-detail-empty-noSummaryFile")
		expect(emptyState).toBeInTheDocument()
		expect(screen.getByText("detail.emptySummary")).toBeInTheDocument()
		expect(
			emptyState.closest('[data-testid="recording-detail-region-empty-slot"]'),
		).toHaveClass("min-h-full", "items-center", "justify-center")
		expect(container.querySelector(".lucide-sparkles")).toBeTruthy()
	})

	it("uses the generating copy only while summary generation is active", () => {
		render(
			<RecordingSummaryContent
				file={summaryFile}
				content=""
				isGenerating
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		expect(screen.getByText("detail.summarizingHint")).toBeInTheDocument()
		expect(screen.queryByText("detail.emptySummary")).toBeNull()
	})
})

describe("RecordingSummaryContent mindmap desktop layout", () => {
	it("uses full-height desktop canvas without toolbar bottom gap", () => {
		magicMarkmapPropsMock.mockClear()

		const { container } = render(
			<RecordingSummaryContent
				file={mindmapFile}
				content="# Root\n\n## Branch"
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		expect(screen.getByTestId("recording-detail-mindmap")).toHaveClass("h-full", "min-h-0")
		expect(container.querySelector(".absolute.inset-0")).toBeTruthy()
		expect(magicMarkmapPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				showToolBar: false,
				className: expect.stringContaining("!h-full"),
			}),
		)
	})

	it("passes speaker labels to the mindmap canvas data", () => {
		magicMarkmapPropsMock.mockClear()

		render(
			<RecordingSummaryContent
				file={mindmapFile}
				content={"# Root\n\n## Speaker-1 discussed with Speaker-2"}
				attachmentList={[]}
				speakerNameMap={{ "Speaker-1": "Host", "Speaker-2": "Guest" }}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		expect(magicMarkmapPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: "# Root\n\n## Host discussed with Guest",
			}),
		)
	})

	it("renders the desktop view switch at bottom-left", () => {
		const { container } = render(
			<RecordingSummaryContent
				file={mindmapFile}
				content="# Root"
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		const switchRoot = container.querySelector(".absolute.bottom-4.left-4")
		expect(switchRoot).toBeTruthy()
		expect(container.querySelector(".absolute.bottom-4.right-4")).toBeNull()
	})

	it("switches to markdown mode without player bottom padding on desktop", () => {
		render(
			<RecordingSummaryContent
				file={mindmapFile}
				content="# Root"
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		fireEvent.click(screen.getByLabelText("detail.showMarkdown"))
		expect(screen.getByTestId("recording-markdown-mock")).toBeTruthy()
	})

	it("reserves safe inset in desktop markdown mode so the view switch does not cover text", () => {
		const { container } = render(
			<RecordingSummaryContent
				file={mindmapFile}
				content="# Root"
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		fireEvent.click(screen.getByLabelText("detail.showMarkdown"))

		const scrollArea = container.querySelector(".overflow-y-auto")
		expect(scrollArea).toHaveClass("pb-20", "pl-28")
	})

	it("keeps desktop view switch outside markdown scroll container", () => {
		const { container } = render(
			<RecordingSummaryContent
				file={mindmapFile}
				content="# Root"
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		fireEvent.click(screen.getByLabelText("detail.showMarkdown"))

		const root = screen.getByTestId("recording-detail-mindmap")
		const scrollArea = root.querySelector(".overflow-y-auto")
		const switchRoot = container.querySelector(".absolute.bottom-4.left-4")

		expect(scrollArea).toBeTruthy()
		expect(switchRoot).toBeTruthy()
		expect(scrollArea?.contains(switchRoot ?? null)).toBe(false)
	})
})

describe("RecordingSummaryContent metrics html", () => {
	it("does not mount the metrics iframe until HTML processing finishes", async () => {
		let resolveProcess: (value: {
			processedContent: string
			filePathMapping: Map<string, string>
		}) => void = () => undefined
		processHtmlContentMock.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveProcess = resolve
				}),
		)

		render(
			<RecordingSummaryContent
				file={metricsFile}
				content="<html><body>Raw metrics</body></html>"
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		await screen.findByTestId("recording-detail-metrics-loading")
		expect(screen.queryByTestId("isolated-html-renderer-mock")).toBeNull()

		resolveProcess({
			processedContent: "<html><body>Processed metrics</body></html>",
			filePathMapping: new Map(),
		})

		await screen.findByTestId("isolated-html-renderer-mock")
	})

	it("keeps the metrics loading mask until HTML processing and iframe rendering finish", async () => {
		processHtmlContentMock.mockResolvedValue({
			processedContent: "<html><body>Processed metrics</body></html>",
			filePathMapping: new Map(),
		})

		render(
			<RecordingSummaryContent
				file={metricsFile}
				content="<html><body>Raw metrics</body></html>"
				attachmentList={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={() => undefined}
				onTimeClick={() => undefined}
				layout="desktop"
			/>,
		)

		await screen.findByTestId("recording-detail-metrics-loading")
		fireEvent.click(await screen.findByTestId("recording-metrics-render-ready"))

		await waitFor(() => {
			expect(screen.queryByTestId("recording-detail-metrics-loading")).toBeNull()
		})
	})
})
