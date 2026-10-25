import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import OperationResultRow from "../OperationResultRow"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

describe("OperationResultRow", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("restores the item percentage from its persisted backend timing", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-10-05T02:00:30Z"))

		render(
			<OperationResultRow
				item={{
					label: "Hero image",
					kind: "text",
					status: "success",
					message: "Generating",
					started_at: "2026-10-05T10:00:00+08:00",
					expected_finished_at: "2026-10-05T10:01:30+08:00",
				}}
				loading
				progressAnchorKey="tool-1:content-1"
				onLocate={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("generation-progress")).toHaveTextContent("33%")
	})

	it("caps an unfinished item at 99 percent after its expected finish time", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-10-05T02:02:00Z"))

		render(
			<OperationResultRow
				item={{
					label: "Poster image",
					kind: "text",
					status: "success",
					message: "Generating",
					started_at: "2026-10-05T10:00:00+08:00",
					expected_finished_at: "2026-10-05T10:00:45+08:00",
				}}
				loading
				progressAnchorKey="tool-1:content-2"
				onLocate={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("generation-progress")).toHaveTextContent("99%")
	})

	it("shows a completed row while the rest of the tool is still loading", () => {
		render(
			<OperationResultRow
				item={{
					label: "Finished image",
					kind: "text",
					status: "success",
					message: "Completed",
					is_processing: false,
					started_at: "2026-10-05T10:00:00+08:00",
					expected_finished_at: "2026-10-05T10:00:45+08:00",
				}}
				loading
				progressAnchorKey="tool-1:content-3"
				onLocate={vi.fn()}
			/>,
		)

		expect(screen.queryByTestId("generation-progress")).not.toBeInTheDocument()
		expect(screen.getByText("Completed")).toBeInTheDocument()
	})
})
