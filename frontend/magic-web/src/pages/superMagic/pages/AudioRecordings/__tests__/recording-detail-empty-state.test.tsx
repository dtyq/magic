import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import {
	RecordingDetailEmptyState,
	RecordingDetailChatSkeleton,
	RecordingDetailPageSkeleton,
} from "../components/recording-detail/RecordingDetailEmptyState"
import {
	RECORDING_DETAIL_SUMMARY_MIN_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH,
	RECORDING_DETAIL_WORKBENCH_MIN_WIDTH,
} from "../components/recording-detail/recording-detail-layout"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"detail.summarizing": "Summarizing",
			}
			return labels[key] ?? key
		},
	}),
}))

describe("RecordingDetailEmptyState", () => {
	it("renders transcript empty variant", () => {
		render(<RecordingDetailEmptyState variant="noTranscript" compact />)
		expect(screen.getByTestId("recording-detail-empty-noTranscript")).toBeInTheDocument()
		expect(screen.getByText("detail.emptyTranscript")).toBeInTheDocument()
	})

	it("renders summary pending variant", () => {
		render(<RecordingDetailEmptyState variant="summaryPending" />)
		expect(screen.getByTestId("recording-detail-empty-summaryPending")).toBeInTheDocument()
	})

	it("renders summary generating variant with spinning loader icon", () => {
		const { container } = render(<RecordingDetailEmptyState variant="summaryGenerating" />)
		expect(screen.getByTestId("recording-detail-empty-summaryGenerating")).toBeInTheDocument()
		expect(screen.getByText("Summarizing")).toBeInTheDocument()
		expect(container.querySelector(".animate-spin")).toBeInTheDocument()
	})

	it("renders summary tab file empty variant with sparkles icon and emptySummary copy", () => {
		const { container } = render(<RecordingDetailEmptyState variant="noSummaryFile" compact />)
		expect(screen.getByTestId("recording-detail-empty-noSummaryFile")).toBeInTheDocument()
		expect(screen.getByText("detail.emptySummary")).toBeInTheDocument()
		expect(container.querySelector(".lucide-sparkles")).toBeTruthy()
	})

	it("renders page skeleton with shimmer blocks and fade-in transition", () => {
		const { container } = render(<RecordingDetailPageSkeleton />)
		const skeleton = screen.getByTestId("recording-detail-page-skeleton")
		const scrollContainer = screen.getByTestId("recording-detail-page-skeleton-scroll")

		expect(scrollContainer).toHaveClass("overflow-x-auto", "overflow-y-hidden")
		expect(skeleton).toHaveStyle({
			minWidth: `${RECORDING_DETAIL_WORKBENCH_MIN_WIDTH}px`,
			gridTemplateColumns: `minmax(${RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH}px, ${RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH}px) minmax(${RECORDING_DETAIL_SUMMARY_MIN_WIDTH}px, 1fr)`,
		})
		expect(skeleton).toHaveClass("pt-4")
		expect(skeleton).toHaveClass("animate-in", "fade-in")
		expect(skeleton).toHaveAttribute("aria-busy", "true")
		expect(container.querySelector(".animate-pulse")).toBeNull()
		expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
	})

	it("renders left column skeleton aligned with the borderless player and transcript layout", () => {
		render(<RecordingDetailPageSkeleton />)

		expect(screen.getByTestId("recording-detail-player-skeleton")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-transcript-skeleton")).toBeInTheDocument()
		expect(
			screen.getByTestId("recording-detail-transcript-skeleton").querySelector(".border-b"),
		).toBeNull()
	})

	it("renders the conversation rail skeleton with topic and composer placeholders", () => {
		const { container } = render(<RecordingDetailChatSkeleton />)

		expect(screen.getByTestId("recording-detail-chat-skeleton")).toBeInTheDocument()
		const header = screen.getByTestId("recording-detail-chat-header-skeleton")
		const composer = screen.getByTestId("recording-detail-chat-composer-skeleton")
		expect(header).toBeInTheDocument()
		expect(header).not.toHaveClass("border-b")
		const messages = screen.getAllByTestId("recording-detail-chat-message-skeleton")
		expect(messages).toHaveLength(4)
		expect(messages[0].querySelector(".w-\\[78\\%\\]")).toBeInTheDocument()
		expect(messages[1].querySelector(".w-\\[88\\%\\]")).toBeInTheDocument()
		expect(screen.getAllByTestId("recording-detail-chat-avatar-skeleton")).toHaveLength(4)
		expect(composer).toHaveClass("border")
		expect(screen.getByTestId("recording-detail-chat-input-skeleton")).toHaveClass("h-8")
		expect(screen.getByTestId("recording-detail-chat-send-skeleton")).toHaveClass("size-8")
		expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(6)
	})
})
