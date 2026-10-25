import type { MutableRefObject, ReactNode, Ref } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RecordingDetailProvider } from "../RecordingDetailProvider"
import { RecordingDetailTranscriptPanel } from "../RecordingDetailTranscriptPanel"
import {
	FOLDER_RECORDING_DETAIL_CAPABILITIES,
	SHARE_RECORDING_DETAIL_CAPABILITIES,
} from "../../../types/recording-detail-capabilities"

const scrollToMock = vi.fn()
const scrollIntoViewMock = vi.fn()
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo")
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"scrollIntoView",
)

/** Restores an HTMLElement method after a test replaces it with a deterministic mock. */
function restoreHTMLElementMethod(
	name: "scrollTo" | "scrollIntoView",
	descriptor?: PropertyDescriptor,
) {
	if (descriptor) {
		Object.defineProperty(HTMLElement.prototype, name, descriptor)
		return
	}
	Reflect.deleteProperty(HTMLElement.prototype, name)
}

/** Creates the DOMRect subset needed for scroll-position calculations. */
function createRect(top: number, height: number): DOMRect {
	return {
		x: 0,
		y: top,
		width: 100,
		height,
		top,
		right: 100,
		bottom: top + height,
		left: 0,
		toJSON: () => ({}),
	}
}

beforeEach(() => {
	scrollToMock.mockReset()
	scrollIntoViewMock.mockReset()
	// Provide the observer contract used by Radix positioning when the search menu opens.
	vi.stubGlobal(
		"ResizeObserver",
		class ResizeObserverMock {
			observe = vi.fn()
			unobserve = vi.fn()
			disconnect = vi.fn()
		},
	)
	Object.defineProperty(HTMLElement.prototype, "scrollTo", {
		configurable: true,
		value: scrollToMock,
	})
	Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
		configurable: true,
		value: scrollIntoViewMock,
	})
})

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	restoreHTMLElementMethod("scrollTo", originalScrollTo)
	restoreHTMLElementMethod("scrollIntoView", originalScrollIntoView)
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (
			key: string,
			params?: { count?: number; visibleCount?: number; totalCount?: number },
		) => {
			const labels: Record<string, string> = {
				"detail.tabs.transcript": "Transcript",
				"detail.transcriptSegmentCountSuffix": `${params?.count ?? 0} segments`,
				"detail.transcriptVisibleCount": `${params?.visibleCount ?? 0}/${params?.totalCount ?? 0} segments`,
				"detail.emptyTranscriptFiltered": "No transcript in this filter",
				"detail.emptyTranscriptSearch": "No matching transcript",
				"detail.speakerFilterAll": "All speakers",
				"detail.speakerFilterTitle": "Filter speakers",
				"detail.openSpeakerSettings": "Speakers",
				"detail.transcriptSearchClear": "Clear transcript search",
				"detail.transcriptSearchLabel": "Search transcript",
				"detail.transcriptSearchPlaceholder": "Search transcript content",
			}
			return labels[key] ?? key
		},
	}),
}))

vi.mock("@/components/base-mobile/ScrollEdgeFade", () => ({
	ScrollEdgeFadeContainer: ({
		children,
		scrollPortRef,
		...props
	}: {
		children: ReactNode
		scrollPortRef?: Ref<HTMLDivElement | null>
		[key: string]: unknown
	}) => (
		<div
			ref={(element) => {
				if (element) {
					// Provide stable viewport metrics before the panel effect calculates the centered row position.
					Object.defineProperties(element, {
						clientHeight: { configurable: true, value: 200 },
						scrollHeight: { configurable: true, value: 500 },
						scrollTop: { configurable: true, writable: true, value: 20 },
					})
				}
				if (typeof scrollPortRef === "function") {
					scrollPortRef(element)
				} else if (scrollPortRef) {
					;(scrollPortRef as MutableRefObject<HTMLDivElement | null>).current = element
				}
			}}
			data-testid="desktop-transcript-scroll-edge-fade"
			data-props={JSON.stringify(props)}
		>
			{children}
		</div>
	),
}))

vi.mock("../RecordingDetailEmptyState", () => ({
	RecordingDetailEmptyState: () => <div data-testid="recording-detail-empty-state">empty</div>,
}))

vi.mock("../RecordingDetailRegionEmptySlot", () => ({
	RecordingDetailRegionEmptySlot: ({ children }: { children: ReactNode }) => (
		<div data-testid="recording-detail-region-empty-slot">{children}</div>
	),
}))

vi.mock("../RecordingSpeakerFilterControl", () => ({
	RecordingSpeakerFilterControl: ({
		onChange,
		selectedIds,
	}: {
		onChange: (speakerIds: string[]) => void
		selectedIds: string[]
	}) => (
		<button
			type="button"
			data-testid="recording-detail-open-speaker-filter"
			className="size-8 rounded-full border bg-white"
			onClick={() => onChange(selectedIds[0] ? [selectedIds[0]] : [])}
		>
			Filter speakers
		</button>
	),
}))

/** Wraps the transcript panel with owner capabilities so tests match the desktop runtime contract. */
function renderTranscriptPanel(
	currentTime: number,
	playing = true,
	onOpenSpeakerSettings = vi.fn(),
) {
	const onSegmentClick = vi.fn()
	const onSelectedSpeakerIdsChange = vi.fn()

	render(
		<RecordingDetailProvider
			capabilities={{
				canEditSpeakers: true,
				canRenameProject: true,
				canDeleteProject: true,
				canMoveProject: true,
				canExportAudio: true,
				canExportTranscript: true,
				canExportNotes: true,
				canExportSummary: true,
				canShareProject: true,
				canTriggerSummary: true,
			}}
		>
			<RecordingDetailTranscriptPanel
				searchScopeKey="recording-alpha"
				segments={[
					{
						id: "segment-1",
						start: 5,
						end: 10,
						speaker: "Speaker-1",
						text: "Earlier line",
					},
					{
						id: "segment-2",
						start: 10,
						end: 15,
						speaker: "Speaker-1",
						text: "Active line",
					},
				]}
				playing={playing}
				currentTime={currentTime}
				availableSpeakerIds={["Speaker-1"]}
				selectedSpeakerIds={["Speaker-1"]}
				speakerNameMap={{ "Speaker-1": "Speaker-1" }}
				totalSegmentsCount={2}
				onSegmentClick={onSegmentClick}
				onSelectedSpeakerIdsChange={onSelectedSpeakerIdsChange}
				onOpenSpeakerSettings={onOpenSpeakerSettings}
			/>
		</RecordingDetailProvider>,
	)

	return { onSegmentClick, onSelectedSpeakerIdsChange }
}

/** Renders one transcript panel with an explicit shell capability matrix for permission regression tests. */
function renderPanelWithCapabilities(capabilities: typeof FOLDER_RECORDING_DETAIL_CAPABILITIES) {
	render(
		<RecordingDetailProvider capabilities={capabilities}>
			<RecordingDetailTranscriptPanel
				searchScopeKey="recording-capability"
				segments={[
					{ id: "segment-capability", start: 1, speaker: "Speaker-X", text: "Line" },
				]}
				playing={false}
				currentTime={0}
				availableSpeakerIds={["Speaker-X"]}
				selectedSpeakerIds={["Speaker-X"]}
				speakerNameMap={{ "Speaker-X": "Speaker-X" }}
				totalSegmentsCount={1}
				onSegmentClick={vi.fn()}
				onSelectedSpeakerIdsChange={vi.fn()}
				onOpenSpeakerSettings={vi.fn()}
			/>
		</RecordingDetailProvider>,
	)
}

describe("RecordingDetailTranscriptPanel", () => {
	it("keeps speaker editing enabled in project folders but hides it in shared folders", () => {
		renderPanelWithCapabilities(FOLDER_RECORDING_DETAIL_CAPABILITIES)
		expect(screen.getByTestId("recording-detail-open-speaker-settings")).toBeInTheDocument()

		// Re-rendering is intentionally avoided so each shell gets an isolated capability assertion.
	})

	it("does not expose the speaker editor for read-only share capabilities", () => {
		render(
			<RecordingDetailProvider capabilities={SHARE_RECORDING_DETAIL_CAPABILITIES}>
				<RecordingDetailTranscriptPanel
					searchScopeKey="recording-share-capability"
					segments={[
						{
							id: "segment-share",
							start: 1,
							speaker: "Speaker-Y",
							text: "Shared line",
						},
					]}
					playing={false}
					currentTime={0}
					availableSpeakerIds={["Speaker-Y"]}
					selectedSpeakerIds={["Speaker-Y"]}
					speakerNameMap={{ "Speaker-Y": "Speaker-Y" }}
					totalSegmentsCount={1}
					onSegmentClick={vi.fn()}
					onSelectedSpeakerIdsChange={vi.fn()}
					onOpenSpeakerSettings={vi.fn()}
				/>
			</RecordingDetailProvider>,
		)

		expect(screen.queryByTestId("recording-detail-open-speaker-settings")).toBeNull()
	})

	it("keeps segment rows on the same box model while only emphasizing the active content", () => {
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
			if (this.dataset.testid === "desktop-transcript-scroll-edge-fade") {
				return createRect(100, 200)
			}
			if (this.dataset.segmentId === "segment-2") return createRect(250, 40)
			return createRect(0, 0)
		})

		renderTranscriptPanel(10)

		const panel = screen.getByTestId("recording-detail-transcript-panel")
		const scrollPort = screen.getByTestId("desktop-transcript-scroll-edge-fade")
		const segments = screen.getAllByTestId("recording-detail-transcript-segment")
		const inactiveSegment = segments[0]
		const activeSegment = segments[1]
		const inactiveTime = screen.getByText("00:05")
		const activeTime = screen.getByText("00:10")
		const inactiveText = screen.getByText("Earlier line")
		const activeText = screen.getByText("Active line")
		const speakerChips = screen.getAllByTestId("recording-detail-transcript-speaker-chip")
		const title = screen.getByTestId("recording-detail-transcript-title")
		const count = screen.getByTestId("recording-detail-transcript-count")
		const settingsButton = screen.getByTestId("recording-detail-open-speaker-settings")
		const settingsIcon = screen.getByTestId("recording-detail-speaker-settings-icon")
		const accessory = screen.getByTestId("recording-detail-open-speaker-filter")
		const searchButton = screen.getByTestId("recording-detail-open-transcript-search")

		expect(panel).not.toHaveClass("border", "bg-card")
		expect(title).toHaveTextContent("Transcript")
		expect(count).toHaveTextContent("2 segments")
		expect(settingsButton).toHaveTextContent("Speakers")
		expect(settingsButton).toHaveClass("h-8", "px-3", "text-[12px]", "rounded-full", "gap-1.5")
		expect(settingsButton).not.toHaveClass("h-10", "px-4", "text-[14px]")
		expect(settingsIcon).toHaveClass("size-4", "shrink-0")
		expect(settingsIcon).toHaveAttribute("aria-hidden", "true")
		expect(accessory).toHaveClass("size-8", "rounded-full", "border", "bg-white")
		expect(searchButton).toHaveClass("size-8", "rounded-full", "border", "bg-white")
		expect(settingsButton.nextElementSibling).toBe(searchButton)
		expect(searchButton.nextElementSibling).toBe(accessory)
		expect(inactiveSegment).toHaveClass("rounded-xl", "px-2", "py-2.5")
		expect(activeSegment).toHaveClass("rounded-xl", "px-2", "py-2.5")
		expect(inactiveSegment).toHaveClass("px-2")
		expect(activeSegment).not.toHaveClass("bg-muted")
		expect(activeSegment).not.toHaveClass("shadow")

		expect(inactiveTime).toHaveClass("text-foreground/35")
		expect(activeTime).toHaveClass("text-foreground")
		expect(inactiveText).toHaveClass("text-foreground/65")
		expect(activeText).toHaveClass("text-foreground")
		expect(speakerChips[0]).toHaveClass("opacity-70")
		expect(speakerChips[1]).not.toHaveClass("opacity-70")
		expect(scrollToMock).toHaveBeenCalledWith({ top: 90, behavior: "smooth" })
		expect(scrollToMock.mock.contexts[0]).toBe(scrollPort)
		expect(scrollIntoViewMock).not.toHaveBeenCalled()
	})

	it("does not highlight or auto-scroll when playback is paused at a segment time", () => {
		renderTranscriptPanel(10, false)

		const [inactiveTime, pausedTime] = screen.getAllByText(/00:(05|10)/)
		const inactiveText = screen.getByText("Earlier line")
		const pausedText = screen.getByText("Active line")
		const speakerChips = screen.getAllByTestId("recording-detail-transcript-speaker-chip")

		expect(inactiveTime).toHaveClass("text-foreground")
		expect(pausedTime).toHaveClass("text-foreground")
		expect(inactiveText).toHaveClass("text-foreground")
		expect(pausedText).toHaveClass("text-foreground")
		expect(speakerChips[0]).not.toHaveClass("opacity-70")
		expect(speakerChips[1]).not.toHaveClass("opacity-70")
		expect(scrollToMock).not.toHaveBeenCalled()
		expect(scrollIntoViewMock).not.toHaveBeenCalled()
	})

	it("keeps row seek and speaker settings interactions separate", () => {
		const onOpenSpeakerSettings = vi.fn()
		const { onSegmentClick } = renderTranscriptPanel(10, true, onOpenSpeakerSettings)

		fireEvent.click(screen.getByText("Earlier line"))
		expect(onSegmentClick).toHaveBeenCalledWith(
			expect.objectContaining({ id: "segment-1", start: 5 }),
		)

		fireEvent.click(screen.getAllByTestId("recording-detail-transcript-speaker-chip")[1])
		expect(onOpenSpeakerSettings).toHaveBeenCalledTimes(1)
		expect(onSegmentClick).toHaveBeenCalledTimes(1)
	})

	it("forwards speaker filter changes through the shared filter control", () => {
		const { onSelectedSpeakerIdsChange } = renderTranscriptPanel(10)

		fireEvent.click(screen.getByTestId("recording-detail-open-speaker-filter"))

		expect(onSelectedSpeakerIdsChange).toHaveBeenCalledWith(["Speaker-1"])
	})

	it("debounces transcript filtering and keeps the query after closing the menu", () => {
		vi.useFakeTimers()
		renderTranscriptPanel(0, false)

		fireEvent.keyDown(screen.getByTestId("recording-detail-open-transcript-search"), {
			key: "Enter",
		})
		expect(screen.getByTestId("recording-detail-transcript-search-menu")).toHaveAttribute(
			"data-side",
			"right",
		)
		const input = screen.getByTestId("recording-detail-transcript-search-input")
		fireEvent.change(input, { target: { value: "earlier" } })

		expect(screen.getAllByTestId("recording-detail-transcript-segment")).toHaveLength(2)
		expect(screen.getByTestId("recording-detail-transcript-search-active")).toBeInTheDocument()

		act(() => {
			vi.advanceTimersByTime(299)
		})
		expect(screen.getAllByTestId("recording-detail-transcript-segment")).toHaveLength(2)

		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(screen.getAllByTestId("recording-detail-transcript-segment")).toHaveLength(1)
		expect(screen.getByTestId("recording-detail-transcript-count")).toHaveTextContent(
			"1/2 segments",
		)
		expect(
			screen.getByTestId("recording-detail-transcript-search-highlight"),
		).toHaveTextContent("Earlier")
		fireEvent.keyDown(input, { key: "Escape" })
		expect(screen.queryByTestId("recording-detail-transcript-search-menu")).toBeNull()
		expect(screen.getAllByTestId("recording-detail-transcript-segment")).toHaveLength(1)

		fireEvent.keyDown(screen.getByTestId("recording-detail-open-transcript-search"), {
			key: "Enter",
		})
		expect(screen.getByTestId("recording-detail-transcript-search-input")).toHaveValue(
			"earlier",
		)
		fireEvent.click(screen.getByTestId("recording-detail-transcript-search-clear"))
		expect(screen.getAllByTestId("recording-detail-transcript-segment")).toHaveLength(2)
		expect(screen.queryByTestId("recording-detail-transcript-search-active")).toBeNull()
	})

	it("shows a dedicated empty state when debounced text search has no matches", () => {
		vi.useFakeTimers()
		renderTranscriptPanel(0, false)

		fireEvent.keyDown(screen.getByTestId("recording-detail-open-transcript-search"), {
			key: "Enter",
		})
		fireEvent.change(screen.getByTestId("recording-detail-transcript-search-input"), {
			target: { value: "unmatched phrase" },
		})
		act(() => {
			vi.advanceTimersByTime(300)
		})

		expect(screen.getByTestId("recording-detail-transcript-search-empty")).toHaveTextContent(
			"No matching transcript",
		)
		expect(screen.getByTestId("recording-detail-transcript-count")).toHaveTextContent(
			"0/2 segments",
		)
	})

	it("clears search state when the recording scope changes", () => {
		const { rerender } = render(
			<RecordingDetailProvider
				capabilities={{
					canEditSpeakers: false,
					canRenameProject: false,
					canDeleteProject: false,
					canMoveProject: false,
					canExportAudio: true,
					canExportTranscript: true,
					canExportNotes: true,
					canExportSummary: true,
					canShareProject: false,
					canTriggerSummary: false,
				}}
			>
				<RecordingDetailTranscriptPanel
					searchScopeKey="recording-alpha"
					segments={[
						{
							id: "segment-alpha",
							start: 3,
							text: "Synthetic transcript",
						},
					]}
					availableSpeakerIds={[]}
					playing={false}
					currentTime={0}
					selectedSpeakerIds={[]}
					speakerNameMap={{}}
					totalSegmentsCount={1}
					onSegmentClick={vi.fn()}
					onSelectedSpeakerIdsChange={vi.fn()}
					onOpenSpeakerSettings={vi.fn()}
				/>
			</RecordingDetailProvider>,
		)

		fireEvent.keyDown(screen.getByTestId("recording-detail-open-transcript-search"), {
			key: "Enter",
		})
		fireEvent.change(screen.getByTestId("recording-detail-transcript-search-input"), {
			target: { value: "synthetic" },
		})

		rerender(
			<RecordingDetailProvider
				capabilities={{
					canEditSpeakers: false,
					canRenameProject: false,
					canDeleteProject: false,
					canMoveProject: false,
					canExportAudio: true,
					canExportTranscript: true,
					canExportNotes: true,
					canExportSummary: true,
					canShareProject: false,
					canTriggerSummary: false,
				}}
			>
				<RecordingDetailTranscriptPanel
					searchScopeKey="recording-beta"
					segments={[
						{
							id: "segment-beta",
							start: 4,
							text: "Another synthetic transcript",
						},
					]}
					availableSpeakerIds={[]}
					playing={false}
					currentTime={0}
					selectedSpeakerIds={[]}
					speakerNameMap={{}}
					totalSegmentsCount={1}
					onSegmentClick={vi.fn()}
					onSelectedSpeakerIdsChange={vi.fn()}
					onOpenSpeakerSettings={vi.fn()}
				/>
			</RecordingDetailProvider>,
		)

		expect(screen.queryByTestId("recording-detail-transcript-search-menu")).toBeNull()
		expect(screen.queryByTestId("recording-detail-transcript-search-active")).toBeNull()
		expect(screen.getByText("Another synthetic transcript")).toBeInTheDocument()
	})

	it("shows the filtered empty state when transcript exists but the selection hides every row", () => {
		render(
			<RecordingDetailProvider
				capabilities={{
					canEditSpeakers: true,
					canRenameProject: true,
					canDeleteProject: true,
					canMoveProject: true,
					canExportAudio: true,
					canExportTranscript: true,
					canExportNotes: true,
					canExportSummary: true,
					canShareProject: true,
					canTriggerSummary: true,
				}}
			>
				<RecordingDetailTranscriptPanel
					searchScopeKey="recording-filtered"
					segments={[]}
					availableSpeakerIds={["Speaker-1"]}
					playing={false}
					currentTime={0}
					selectedSpeakerIds={["Speaker-1"]}
					speakerNameMap={{ "Speaker-1": "Speaker-1" }}
					totalSegmentsCount={2}
					onSegmentClick={vi.fn()}
					onSelectedSpeakerIdsChange={vi.fn()}
					onOpenSpeakerSettings={vi.fn()}
				/>
			</RecordingDetailProvider>,
		)

		expect(screen.getByTestId("recording-detail-transcript-filter-empty")).toHaveTextContent(
			"No transcript in this filter",
		)
	})

	it("keeps speaker settings available when filtering hides every transcript row", () => {
		render(
			<RecordingDetailProvider
				capabilities={{
					canEditSpeakers: true,
					canRenameProject: true,
					canDeleteProject: true,
					canMoveProject: true,
					canExportAudio: true,
					canExportTranscript: true,
					canExportNotes: true,
					canExportSummary: true,
					canShareProject: true,
					canTriggerSummary: true,
				}}
			>
				<RecordingDetailTranscriptPanel
					searchScopeKey="recording-filtered"
					segments={[]}
					availableSpeakerIds={["Speaker-1"]}
					playing={false}
					currentTime={0}
					selectedSpeakerIds={["Speaker-1"]}
					speakerNameMap={{ "Speaker-1": "Speaker-1" }}
					totalSegmentsCount={2}
					onSegmentClick={vi.fn()}
					onSelectedSpeakerIdsChange={vi.fn()}
					onOpenSpeakerSettings={vi.fn()}
				/>
			</RecordingDetailProvider>,
		)

		expect(screen.getByTestId("recording-detail-open-speaker-settings")).not.toBeDisabled()
	})
})
