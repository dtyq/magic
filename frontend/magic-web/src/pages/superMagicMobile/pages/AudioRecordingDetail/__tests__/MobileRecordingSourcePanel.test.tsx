import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MobileRecordingSourcePanel } from "../components/MobileRecordingSourcePanel"

const scrollEdgeFadePropsMock = vi.fn()

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"detail.tabs.transcript": "Transcript",
				"detail.tabs.notes": "Notes",
				"detail.emptyTranscript":
					"Summarizing now. It will appear automatically when ready.",
				"detail.emptyNotes": "Summarizing now. It will appear automatically when ready.",
				"detail.emptySummary": "No summary",
				"detail.summarizingHint":
					"Summarizing now. It will appear automatically when ready.",
				"detail.openSpeakerSettings": "Open speaker settings",
			}
			return labels[key] ?? key
		},
	}),
}))

const speakerFilterPropsMock = vi.fn()

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingSpeakerFilterControl",
	() => ({
		RecordingSpeakerFilterControl: (props: Record<string, unknown>) => {
			speakerFilterPropsMock(props)
			return (
				<button
					type="button"
					data-testid="mobile-recording-open-speaker-filter"
					onClick={() =>
						(props.onChange as ((speakerIds: string[]) => void) | undefined)?.([
							"Speaker-1",
						])
					}
				>
					Filter speakers
				</button>
			)
		},
	}),
)

vi.mock("@/components/base-mobile/ScrollEdgeFade", () => ({
	ScrollEdgeFadeContainer: ({
		children,
		...props
	}: {
		children: ReactNode
		[key: string]: unknown
	}) => {
		scrollEdgeFadePropsMock(props)
		return <div data-testid="source-scroll-edge-fade">{children}</div>
	},
}))

vi.mock("../components/MobileRecordingMarkdownContent", () => ({
	MobileRecordingMarkdownContent: ({
		content,
		className,
	}: {
		content: string
		className?: string
	}) => (
		<div className={className} data-testid="source-markdown-content">
			{content}
		</div>
	),
}))

const emptySlotMock = vi.fn()

vi.mock(
	"@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailRegionEmptySlot",
	() => ({
		RecordingDetailRegionEmptySlot: ({ children }: { children: ReactNode }) => (
			<div data-testid="recording-detail-region-empty-slot">
				{emptySlotMock(children)}
				{children}
			</div>
		),
	}),
)

describe("MobileRecordingSourcePanel", () => {
	it("hides the notes tab when the shared notes file is unavailable", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent="[00:05] Mock transcript"
				notesContent="Mock notes"
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
				showNotesTab={false}
			/>,
		)

		expect(screen.queryByText("Notes")).not.toBeInTheDocument()
		expect(screen.getByText("Transcript")).toBeInTheDocument()
	})

	it("keeps the source tab header at the speaker-filter height", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent="[00:05] Mock transcript"
				notesContent="Mock notes"
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1", "Speaker-2"]}
				selectedSpeakerIds={["Speaker-1", "Speaker-2"]}
				speakerNameMap={{ "Speaker-1": "Speaker-1", "Speaker-2": "Speaker-2" }}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		const sourceHeader = screen.getByText("Transcript").closest(".sticky")
		expect(sourceHeader).toHaveClass("min-h-[68px]")
	})

	it("wraps transcript content with the shared scroll shadow container", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent="[00:05] Mock transcript"
				notesContent="Mock notes"
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				isGenerating
				speakerNameMap={{}}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("source-scroll-edge-fade")).toBeInTheDocument()
		expect(scrollEdgeFadePropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				fadeColor: "mobile-background",
				contentDeps: ["transcript", 1, true],
				scrollClassName: "px-4",
			}),
		)
		expect(screen.getByTestId("mobile-recording-transcript-item")).toBeInTheDocument()
	})

	it("uses compact vertical spacing for mobile transcript copy", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent="[00:05] Mock transcript"
				notesContent="Mock notes"
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={[]}
				selectedSpeakerIds={[]}
				speakerNameMap={{}}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		const transcriptItem = screen.getByTestId("mobile-recording-transcript-item")
		const transcriptList = transcriptItem.parentElement
		const transcriptText = screen.getByText("Mock transcript")

		// Keep the regression focused on the visual rhythm that was tightened for mobile.
		expect(transcriptList).toHaveClass("flex", "flex-col", "gap-3")
		expect(transcriptText).toHaveClass("text-[16px]", "leading-6")
	})

	it("keeps the same scroll container when switching to notes", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent="[00:05] Mock transcript"
				notesContent="Mock notes"
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				isGenerating
				speakerNameMap={{}}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByText("Notes"))

		expect(screen.getByTestId("source-scroll-edge-fade")).toBeInTheDocument()
		expect(scrollEdgeFadePropsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({
				contentDeps: ["notes", 1, true],
			}),
		)
		expect(screen.getByTestId("source-markdown-content")).toHaveTextContent("Mock notes")
	})

	it("adds horizontal inset to notes markdown so it aligns with transcript rows", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent="[00:05] Mock transcript"
				notesContent="Mock notes"
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				isGenerating
				speakerNameMap={{}}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByText("Notes"))

		expect(screen.getByTestId("source-markdown-content")).toHaveClass("px-3")
	})

	it("renders the speaker action outside the transcript row button container", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent="[00:05] Speaker-1: Mock transcript"
				notesContent="Mock notes"
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				speakerNameMap={{ "Speaker-1": "Speaker-1" }}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		const transcriptItem = screen.getByTestId("mobile-recording-transcript-item")
		const speakerButton = screen.getByRole("button", { name: "Open speaker settings" })

		expect(transcriptItem.tagName).not.toBe("BUTTON")
		expect(speakerButton.closest("button")).toBe(speakerButton)
	})

	it("keeps the transcript row box model stable while only emphasizing the active content", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent={
					"[00:05] Speaker-1: Earlier line\n[00:10] Speaker-1: Active line"
				}
				notesContent="Mock notes"
				playing={true}
				currentTime={10}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				speakerNameMap={{ "Speaker-1": "Speaker-1" }}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		const transcriptItems = screen.getAllByTestId("mobile-recording-transcript-item")
		const inactiveItem = transcriptItems[0]
		const activeItem = transcriptItems[1]
		const inactiveTime = screen.getByText("00:05")
		const activeTime = screen.getByText("00:10")
		const inactiveText = screen.getByText("Earlier line")
		const activeText = screen.getByText("Active line")
		const [inactiveSpeakerChip, activeSpeakerChip] = screen.getAllByRole("button", {
			name: "Open speaker settings",
		})

		expect(inactiveItem).toHaveClass("rounded-xl", "px-3", "py-2")
		expect(activeItem).toHaveClass("rounded-xl", "px-3", "py-2")
		expect(activeItem).not.toHaveClass("bg-card/80")
		expect(activeItem).not.toHaveClass("shadow-[0_4px_16px_rgba(0,0,0,0.04)]")

		expect(inactiveTime).toHaveClass("text-foreground/35")
		expect(activeTime).toHaveClass("text-foreground")
		expect(inactiveText).toHaveClass("text-foreground/65")
		expect(activeText).toHaveClass("text-foreground")
		expect(inactiveSpeakerChip).toHaveClass("opacity-70")
		expect(activeSpeakerChip).not.toHaveClass("opacity-70")
	})

	it("does not highlight the matched transcript segment when audio is paused", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent={
					"[00:05] Speaker-1: Earlier line\n[00:10] Speaker-1: Active line"
				}
				notesContent="Mock notes"
				playing={false}
				currentTime={10}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				speakerNameMap={{ "Speaker-1": "Speaker-1" }}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		const inactiveTime = screen.getByText("00:05")
		const pausedTime = screen.getByText("00:10")
		const inactiveText = screen.getByText("Earlier line")
		const pausedText = screen.getByText("Active line")
		const [inactiveSpeakerChip, pausedSpeakerChip] = screen.getAllByRole("button", {
			name: "Open speaker settings",
		})

		expect(inactiveTime).toHaveClass("text-foreground")
		expect(pausedTime).toHaveClass("text-foreground")
		expect(inactiveText).toHaveClass("text-foreground")
		expect(pausedText).toHaveClass("text-foreground")
		expect(inactiveSpeakerChip).not.toHaveClass("opacity-70")
		expect(pausedSpeakerChip).not.toHaveClass("opacity-70")
	})

	it("centers the transcript empty state inside the shared empty slot", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent=""
				notesContent="Mock notes"
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				isGenerating
				speakerNameMap={{}}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		expect(
			screen.getByText("Summarizing now. It will appear automatically when ready."),
		).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-region-empty-slot")).toContainElement(
			screen.getByText("Summarizing now. It will appear automatically when ready."),
		)
	})

	it("centers the notes empty state inside the shared empty slot", () => {
		render(
			<MobileRecordingSourcePanel
				transcriptContent="[00:05] Mock transcript"
				notesContent=""
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				isGenerating
				speakerNameMap={{}}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByText("Notes"))

		expect(
			screen.getByText("Summarizing now. It will appear automatically when ready."),
		).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-region-empty-slot")).toContainElement(
			screen.getByText("Summarizing now. It will appear automatically when ready."),
		)
	})

	it("uses the same full-height wrapper for transcript and notes empty states", () => {
		const { rerender } = render(
			<MobileRecordingSourcePanel
				transcriptContent=""
				notesContent=""
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				speakerNameMap={{}}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		const transcriptEmptyWrapper = screen.getByTestId(
			"recording-detail-region-empty-slot",
		).parentElement
		expect(transcriptEmptyWrapper).toHaveClass("flex", "min-h-full", "flex-col", "flex-1")

		rerender(
			<MobileRecordingSourcePanel
				transcriptContent="[00:05] Mock transcript"
				notesContent=""
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				speakerNameMap={{}}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByText("Notes"))

		const notesEmptyWrapper = screen.getByTestId(
			"recording-detail-region-empty-slot",
		).parentElement
		expect(notesEmptyWrapper).toHaveClass("flex", "min-h-full", "flex-col", "flex-1")
		expect(notesEmptyWrapper?.className).toBe(transcriptEmptyWrapper?.className)
	})

	it("shows the speaker filter only on the transcript tab and forwards selection changes", () => {
		const onSelectedSpeakerIdsChange = vi.fn()

		render(
			<MobileRecordingSourcePanel
				transcriptContent="[00:05] Speaker-1: Mock transcript"
				notesContent="Mock notes"
				playing={false}
				currentTime={0}
				scrollPaddingBottom={64}
				availableSpeakerIds={["Speaker-1", "Speaker-2"]}
				selectedSpeakerIds={["Speaker-1", "Speaker-2"]}
				speakerNameMap={{ "Speaker-1": "Speaker-1", "Speaker-2": "Speaker-2" }}
				onSelectedSpeakerIdsChange={onSelectedSpeakerIdsChange}
				onOpenSpeakerSettings={vi.fn()}
				onSeek={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mobile-recording-open-speaker-filter")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("mobile-recording-open-speaker-filter"))
		expect(onSelectedSpeakerIdsChange).toHaveBeenCalledWith(["Speaker-1"])

		fireEvent.click(screen.getByText("Notes"))
		expect(screen.queryByTestId("mobile-recording-open-speaker-filter")).toBeNull()
	})
})
