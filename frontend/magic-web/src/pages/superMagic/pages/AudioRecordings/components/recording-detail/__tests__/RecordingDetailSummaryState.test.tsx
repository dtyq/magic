import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RecordingDetailSummaryState } from "../RecordingDetailSummaryState"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"card.generateSummary": "Generate summary",
				"card.regenerateSummary": "Regenerate summary",
				"detail.notSummarized": "No summary yet",
				"detail.notSummarizedHint": "Generate a summary to preview it here",
				"detail.summarizingHint":
					"Summarizing now. It will appear automatically when ready.",
				"detail.empty.summaryFailed": "Summary failed",
				"detail.empty.summaryFailedHint": "Please retry the summary.",
			}
			return labels[key] ?? key
		},
	}),
}))

describe("RecordingDetailSummaryState", () => {
	it("renders prototype-aligned pending state with an inline generate action", () => {
		const onGenerateSummary = vi.fn()

		render(
			<RecordingDetailSummaryState status="pending" onGenerateSummary={onGenerateSummary} />,
		)

		expect(screen.getByTestId("recording-detail-summary-state-pending")).toBeInTheDocument()
		expect(screen.getByText("No summary yet")).toBeInTheDocument()
		const button = screen.getByRole("button", { name: "Generate summary" })
		expect(button).toHaveClass("rounded-full", "bg-foreground")
		fireEvent.click(button)
		expect(onGenerateSummary).toHaveBeenCalledTimes(1)
	})

	it("renders generating state without a summary action", () => {
		render(<RecordingDetailSummaryState status="generating" onGenerateSummary={vi.fn()} />)

		expect(screen.getByTestId("recording-detail-summary-state-generating")).toBeInTheDocument()
		expect(
			screen.getByText("Summarizing now. It will appear automatically when ready."),
		).toBeInTheDocument()
		expect(screen.queryByText("Summarizing")).toBeNull()
		expect(screen.queryByRole("button")).toBeNull()
	})

	it("renders failed state with regenerate action", () => {
		const onGenerateSummary = vi.fn()
		render(
			<RecordingDetailSummaryState status="failed" onGenerateSummary={onGenerateSummary} />,
		)

		expect(screen.getByTestId("recording-detail-summary-state-failed")).toBeInTheDocument()
		expect(screen.getByText("Summary failed")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Regenerate summary" }))
		expect(onGenerateSummary).toHaveBeenCalledTimes(1)
	})
})
