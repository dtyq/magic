import type { ReactNode } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MobileRecordingSummaryPanel } from "../components/MobileRecordingSummaryPanel"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

vi.mock("@/models/user", () => ({
	userStore: {},
}))

const scrollEdgeFadePropsMock = vi.fn()
const magicMarkmapPropsMock = vi.fn()
const isolatedHtmlRendererPropsMock = vi.fn()
const processHtmlContentMock = vi.fn()

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"detail.emptySummary": "No summary",
				"detail.emptySummaryFile":
					"Summarizing now. It will appear automatically when ready.",
				"detail.summarizingHint":
					"Summarizing now. It will appear automatically when ready.",
				"detail.tabs.summary": "Minutes",
				"detail.tabs.topics": "Topics",
				"detail.tabs.highlights": "Highlights",
				"detail.tabs.insights": "Insights",
				"detail.tabs.metrics": "Metrics",
				"detail.tabs.mindmap": "Mindmap",
				"detail.tabs.followup": "Follow-up",
				"detail.tabs.powerDynamics": "Power Dynamics",
				"detail.tabs.intent": "Intent",
			}
			return labels[key] ?? key
		},
	}),
}))

vi.mock("@/components/base-mobile/ScrollEdgeFade", () => ({
	ScrollEdgeFadeContainer: ({
		children,
		...props
	}: {
		children: ReactNode
		[key: string]: unknown
	}) => {
		scrollEdgeFadePropsMock(props)
		return <div data-testid="summary-scroll-edge-fade">{children}</div>
	},
}))

vi.mock("@/components/base/MagicMarkmap", () => ({
	default: (props: Record<string, unknown>) => {
		magicMarkmapPropsMock(props)
		return <div data-testid="mock-mindmap" />
	},
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer", () => ({
	default: (props: Record<string, unknown>) => {
		isolatedHtmlRendererPropsMock(props)
		return (
			<div data-testid="mobile-recording-metrics-html">
				<button
					type="button"
					data-testid="mobile-recording-metrics-render-ready"
					onClick={props.onRenderReady as () => void}
				/>
			</div>
		)
	},
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor", () => ({
	processHtmlContent: (...args: unknown[]) => processHtmlContentMock(...args),
}))

vi.mock("../components/MobileRecordingMarkdownContent", () => ({
	MobileRecordingMarkdownContent: ({ content }: { content: string }) => (
		<div data-testid="summary-markdown-content">{content}</div>
	),
}))

function createSummaryAttachment(overrides: Partial<AttachmentItem> = {}): AttachmentItem {
	return {
		file_id: "summary-file-id",
		file_name: "summary.md",
		filename: "summary.md",
		path: "/summary/summary.md",
		relative_file_path: "summary/summary.md",
		is_directory: false,
		children: [],
		...overrides,
	}
}

function createSummaryFileRef(type: string, fileName: string, file?: Partial<AttachmentItem>) {
	return {
		type,
		fileId: `${type}-file`,
		fileName,
		file: createSummaryAttachment({
			file_id: `${type}-file`,
			file_name: fileName,
			filename: fileName,
			path: `/summary/${fileName}`,
			relative_file_path: `summary/${fileName}`,
			file_extension: fileName.split(".").pop(),
			...file,
		}),
	}
}

describe("MobileRecordingSummaryPanel", () => {
	/** Reset shared spies so each summary-panel assertion only observes its own render cycle. */
	function resetSharedMocks() {
		scrollEdgeFadePropsMock.mockClear()
		magicMarkmapPropsMock.mockClear()
		isolatedHtmlRendererPropsMock.mockClear()
		processHtmlContentMock.mockReset()
		processHtmlContentMock.mockResolvedValue({
			processedContent: "<html><body>Metrics body</body></html>",
			hasSlides: false,
			filePathMapping: new Map([
				["summary/metrics.css", "https://example.invalid/metrics.css"],
			]),
			slidesMap: new Map(),
			originalSlidesPaths: [],
		})
	}

	it("keeps the summary tab header aligned with the source tab header height", () => {
		resetSharedMocks()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[
					createSummaryFileRef("summary", "summary.md"),
					createSummaryFileRef("topics", "topics.md"),
				]}
				summaryContent={{
					summary: "Summary body",
					topics: "Topics body",
				}}
				attachmentList={[]}
				scrollPaddingBottom={72}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onTimeClick={vi.fn()}
			/>,
		)

		const summaryHeader = screen
			.getByTestId("mobile-recording-summary-tab-summary")
			.closest(".sticky")
		expect(summaryHeader).toHaveClass("min-h-[68px]")
	})

	it("wraps summary markdown with the shared scroll shadow container", () => {
		resetSharedMocks()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[
					createSummaryFileRef("summary", "summary.md"),
					createSummaryFileRef("highlights", "highlights.md"),
				]}
				summaryContent={{
					summary: "Summary body",
					highlights: "Highlights body",
				}}
				scrollPaddingBottom={72}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onTimeClick={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("summary-scroll-edge-fade")).toBeInTheDocument()
		expect(scrollEdgeFadePropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				fadeColor: "mobile-background",
				contentDeps: ["summary", 2, true],
				scrollClassName: "px-4",
			}),
		)
		expect(screen.getByTestId("summary-markdown-content")).toHaveTextContent("Summary body")
	})

	it("recomputes the scroll container when the active summary tab changes", () => {
		resetSharedMocks()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[
					createSummaryFileRef("summary", "summary.md"),
					createSummaryFileRef("highlights", "highlights.md"),
				]}
				summaryContent={{
					summary: "Summary body",
					highlights: "Highlights body",
				}}
				scrollPaddingBottom={72}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onTimeClick={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-recording-summary-tab-highlights"))

		expect(scrollEdgeFadePropsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({
				contentDeps: ["highlights", 2, true],
			}),
		)
		expect(screen.getByTestId("summary-markdown-content")).toHaveTextContent("Highlights body")
	})

	it("renders translated labels for each supported summary tab type", () => {
		resetSharedMocks()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[
					createSummaryFileRef("summary", "summary.md"),
					createSummaryFileRef("topics", "topics.md"),
					createSummaryFileRef("highlights", "highlights.md"),
					createSummaryFileRef("insights", "insights.md"),
					createSummaryFileRef("metrics", "metrics.html"),
					createSummaryFileRef("mindmap", "mindmap.md"),
					createSummaryFileRef("followup", "followup.md"),
					createSummaryFileRef("power_dynamics", "power.md"),
					createSummaryFileRef("intent", "intent.md"),
				]}
				summaryContent={{
					summary: "Summary body",
					topics: "## Topics",
					highlights: "Highlights body",
					insights: "Insights body",
					metrics: "<html><body>Metrics body</body></html>",
					mindmap: "# Root",
					followup: "Follow-up body",
					power_dynamics: "Power body",
					intent: "Intent body",
				}}
				attachmentList={[]}
				scrollPaddingBottom={72}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onTimeClick={vi.fn()}
			/>,
		)

		expect(screen.getByText("Minutes")).toBeInTheDocument()
		expect(screen.getByText("Topics")).toBeInTheDocument()
		expect(screen.getByText("Highlights")).toBeInTheDocument()
		expect(screen.getByText("Insights")).toBeInTheDocument()
		expect(screen.getByText("Metrics")).toBeInTheDocument()
		expect(screen.getByText("Mindmap")).toBeInTheDocument()
		expect(screen.getByText("Follow-up")).toBeInTheDocument()
		expect(screen.getByText("Power Dynamics")).toBeInTheDocument()
		expect(screen.getByText("Intent")).toBeInTheDocument()
	})

	it("renders inline speaker tokens inside topic dialogue body without triggering seek", () => {
		resetSharedMocks()
		const onOpenSpeakerSettings = vi.fn()
		const onTimeClick = vi.fn()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[createSummaryFileRef("topics", "topics.md")]}
				summaryContent={{
					topics: `## Topics

### 📌 demo_topic | Demo Topic | #000000

#### Key Points
[Speaker-1]
Important discussion.

#### Related Dialogue
- \`00:10-00:20\` Speaker-1: Speaker-1 confirmed the plan and Speaker-2 took follow-up.`,
				}}
				attachmentList={[]}
				scrollPaddingBottom={72}
				speakerNameMap={{ "Speaker-1": "Host", "Speaker-2": "Guest" }}
				onOpenSpeakerSettings={onOpenSpeakerSettings}
				onTimeClick={onTimeClick}
			/>,
		)

		const timeCard = screen.getByTestId("mobile-recording-topic-time-card")
		const speakerChips = screen.getAllByTestId("recording-detail-token-speaker")
		expect(speakerChips).toHaveLength(2)
		expect(speakerChips[0]).toHaveTextContent("Host")
		expect(speakerChips[1]).toHaveTextContent("Guest")
		expect(timeCard).not.toHaveTextContent("Speaker-1 confirmed")

		fireEvent.click(speakerChips[0])

		expect(onOpenSpeakerSettings).toHaveBeenCalledTimes(1)
		expect(onTimeClick).not.toHaveBeenCalled()
	})

	it("renders the empty summary state when no summary files are available", () => {
		resetSharedMocks()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[]}
				summaryContent={{}}
				attachmentList={[]}
				scrollPaddingBottom={72}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onTimeClick={vi.fn()}
			/>,
		)

		expect(screen.getByText("No summary")).toBeInTheDocument()
		expect(screen.queryByTestId("summary-scroll-edge-fade")).toBeNull()
	})

	it("centers the generating copy when a configured summary file is still empty", () => {
		resetSharedMocks()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[createSummaryFileRef("summary", "summary.md")]}
				summaryContent={{ summary: "" }}
				isGenerating
				attachmentList={[]}
				scrollPaddingBottom={72}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onTimeClick={vi.fn()}
			/>,
		)

		const message = screen.getByText(
			"Summarizing now. It will appear automatically when ready.",
		)
		expect(message).toHaveClass("flex-1", "items-center", "justify-center")
	})

	it("falls back to the completed empty-summary copy when generation is inactive", () => {
		resetSharedMocks()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[createSummaryFileRef("summary", "summary.md")]}
				summaryContent={{ summary: "" }}
				attachmentList={[]}
				scrollPaddingBottom={72}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onTimeClick={vi.fn()}
			/>,
		)

		expect(screen.getByText("No summary")).toBeInTheDocument()
	})

	it("overrides the mindmap canvas to use a solid mobile background", () => {
		resetSharedMocks()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[createSummaryFileRef("mindmap", "mindmap.md")]}
				summaryContent={{ mindmap: "# Root\n## Child" }}
				attachmentList={[]}
				scrollPaddingBottom={72}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onTimeClick={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mock-mindmap")).toBeInTheDocument()
		expect(magicMarkmapPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				className:
					"h-full min-h-[520px] bg-[#f7f7f8] [&_svg]:bg-[#f7f7f8] [&_svg]:[background-image:none]",
			}),
		)
	})

	it("passes speaker labels to the mobile mindmap canvas data", () => {
		resetSharedMocks()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[createSummaryFileRef("mindmap", "mindmap.md")]}
				summaryContent={{ mindmap: "# Root\n\n## Speaker-1 discussed with Speaker-2" }}
				attachmentList={[]}
				scrollPaddingBottom={72}
				speakerNameMap={{ "Speaker-1": "Host", "Speaker-2": "Guest" }}
				onOpenSpeakerSettings={vi.fn()}
				onTimeClick={vi.fn()}
			/>,
		)

		expect(magicMarkmapPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: "# Root\n\n## Host discussed with Guest",
			}),
		)
	})

	it("renders metrics summaries through the shared HTML renderer pipeline", async () => {
		resetSharedMocks()

		render(
			<MobileRecordingSummaryPanel
				summaryFiles={[
					createSummaryFileRef("metrics", "metrics.html", {
						file_id: "metrics-file",
						file_name: "metrics.html",
						filename: "metrics.html",
						path: "/summary/metrics.html",
						relative_file_path: "summary/metrics.html",
						file_extension: "html",
					}),
				]}
				summaryContent={{ metrics: "<html><body>Metrics body</body></html>" }}
				attachmentList={[
					createSummaryAttachment({
						file_id: "metrics-file",
						file_name: "metrics.html",
						filename: "metrics.html",
						path: "/summary/metrics.html",
						relative_file_path: "summary/metrics.html",
						file_extension: "html",
					}),
				]}
				scrollPaddingBottom={72}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onTimeClick={vi.fn()}
			/>,
		)

		await screen.findByTestId("mobile-recording-metrics-html")
		expect(screen.getByTestId("mobile-recording-metrics-loading")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("mobile-recording-metrics-render-ready"))
		await waitFor(() => {
			expect(screen.queryByTestId("mobile-recording-metrics-loading")).toBeNull()
		})

		expect(processHtmlContentMock).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "<html><body>Metrics body</body></html>",
				fileId: "metrics-file",
				fileName: "metrics.html",
				attachmentList: expect.any(Array),
			}),
		)
		expect(isolatedHtmlRendererPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "<html><body>Metrics body</body></html>",
				fileId: "metrics-file",
				className: expect.stringContaining("flex-1"),
				iframeClassName: expect.stringContaining("h-full"),
				filePathMapping: expect.any(Map),
			}),
		)
	})
})
