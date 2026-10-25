import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MobileRecordingSummaryPlaceholder } from "../MobileRecordingSummaryPlaceholder"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"detail.summarizingHint":
					"Summarizing now. It will appear automatically when ready.",
				"detail.notSummarized": "No summary yet",
				"detail.notSummarizedHint": "Generate a summary to preview it here",
				"detail.empty.summaryFailed": "Summary failed",
				"detail.empty.summaryFailedHint": "Please retry the summary.",
				"card.generateSummary": "Generate summary",
				"card.regenerateSummary": "Regenerate summary",
			}
			return labels[key] ?? key
		},
	}),
}))

describe("MobileRecordingSummaryPlaceholder", () => {
	it("renders pending state with a generate summary action", () => {
		const onGenerate = vi.fn()

		render(
			<MobileRecordingSummaryPlaceholder
				status="pending"
				canGenerate
				submitting={false}
				onGenerate={onGenerate}
			/>,
		)

		expect(screen.getByText("No summary yet")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Generate summary" }))
		expect(onGenerate).toHaveBeenCalledTimes(1)
	})

	it("renders failed state with regenerate summary action", () => {
		const onGenerate = vi.fn()
		render(
			<MobileRecordingSummaryPlaceholder
				status="failed"
				canGenerate
				submitting={false}
				onGenerate={onGenerate}
			/>,
		)

		expect(screen.getByText("Summary failed")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Regenerate summary" }))
		expect(onGenerate).toHaveBeenCalledTimes(1)
	})

	it("renders generating state without a summary action", () => {
		render(
			<MobileRecordingSummaryPlaceholder
				status="generating"
				canGenerate={false}
				submitting={false}
				onGenerate={vi.fn()}
			/>,
		)

		expect(
			screen.getByText("Summarizing now. It will appear automatically when ready."),
		).toBeInTheDocument()
		expect(screen.queryByRole("button")).toBeNull()
	})
})
