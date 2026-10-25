import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { HtmlPreviewFreshness } from "../HtmlPreviewFreshness"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

describe("HTML preview refresh feedback", () => {
	it("dismisses the floating notice for the current cycle", () => {
		const { rerender } = render(
			<HtmlPreviewFreshness phase="updating" hasRendered onRetry={vi.fn()} />,
		)
		expect(screen.getByRole("status")).toHaveClass("absolute", "right-3", "top-3")
		fireEvent.click(screen.getByRole("button", { name: "common.close" }))
		rerender(<HtmlPreviewFreshness phase="rendering" hasRendered onRetry={vi.fn()} />)
		expect(screen.queryByRole("status")).toBeNull()
		rerender(<HtmlPreviewFreshness phase="failed" hasRendered onRetry={vi.fn()} />)
		expect(screen.queryByRole("status")).toBeNull()
		rerender(<HtmlPreviewFreshness phase="idle" hasRendered onRetry={vi.fn()} />)
		rerender(<HtmlPreviewFreshness phase="updating" hasRendered onRetry={vi.fn()} />)
		expect(screen.getByRole("status")).toBeInTheDocument()
	})
	it("keeps the status quiet until an existing preview is updating", () => {
		const { rerender } = render(
			<HtmlPreviewFreshness phase="rendering" hasRendered={false} onRetry={vi.fn()} />,
		)
		expect(screen.queryByRole("status")).toBeNull()
		rerender(<HtmlPreviewFreshness phase="updating" hasRendered onRetry={vi.fn()} />)
		expect(screen.getByRole("status")).toHaveTextContent("htmlEditor.previewUpdating")
	})
	it("explains a slow first load and shows download progress", () => {
		const { rerender } = render(
			<HtmlPreviewFreshness phase="updating" hasRendered={false} onRetry={vi.fn()} />,
		)
		expect(screen.queryByRole("status")).toBeNull()
		rerender(
			<HtmlPreviewFreshness
				phase="updating"
				hasRendered={false}
				slow
				progress={{ loaded: 4_200_000, total: 10_000_000 }}
				onRetry={vi.fn()}
			/>,
		)
		expect(screen.getByRole("status")).toHaveTextContent("htmlEditor.previewSlowLoading")
		expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42")
		expect(screen.getByRole("status")).toHaveTextContent("42%")
		rerender(
			<HtmlPreviewFreshness
				phase="updating"
				hasRendered={false}
				slow
				progress={{ loaded: 4_200_000 }}
				onRetry={vi.fn()}
			/>,
		)
		expect(screen.queryByRole("progressbar")).toBeNull()
		expect(screen.getByRole("status")).toHaveTextContent("4.20 MB")
	})
	it("says the page is still rendering when the document was sent but not acknowledged", () => {
		render(
			<HtmlPreviewFreshness phase="rendering" hasRendered={false} slow onRetry={vi.fn()} />,
		)
		expect(screen.getByRole("status")).toHaveTextContent("htmlEditor.previewSlowRendering")
	})
	it("exposes a visible retry action after failure without requiring hover", () => {
		const retry = vi.fn()
		render(<HtmlPreviewFreshness phase="failed" hasRendered onRetry={retry} />)
		expect(screen.getByRole("status")).toHaveTextContent("htmlEditor.previewRefreshFailed")
		fireEvent.click(screen.getByRole("button", { name: "htmlEditor.previewRetry" }))
		expect(retry).toHaveBeenCalledTimes(1)
	})
	it("shows one save notice instead of separate preview updates", () => {
		const { rerender } = render(
			<HtmlPreviewFreshness phase="idle" hasRendered saveStage="saving" onRetry={vi.fn()} />,
		)
		expect(screen.getByRole("status")).toHaveTextContent("detail.fileSave.syncing")
		rerender(
			<HtmlPreviewFreshness
				phase="updating"
				hasRendered
				saveStage="saved"
				onRetry={vi.fn()}
			/>,
		)
		expect(screen.getByRole("status")).toHaveTextContent("common.saveSuccess")
		rerender(
			<HtmlPreviewFreshness phase="idle" hasRendered saveStage="saved" onRetry={vi.fn()} />,
		)
		expect(screen.getByRole("status")).toHaveTextContent("common.saveSuccess")
		rerender(
			<HtmlPreviewFreshness phase="idle" hasRendered saveStage="idle" onRetry={vi.fn()} />,
		)
		expect(screen.queryByRole("status")).toBeNull()
	})
	it("reports save success in the editor without preview refresh notices", () => {
		const { rerender } = render(
			<HtmlPreviewFreshness
				phase="updating"
				hasRendered
				previewStatusEnabled={false}
				onRetry={vi.fn()}
			/>,
		)
		expect(screen.queryByRole("status")).toBeNull()
		rerender(
			<HtmlPreviewFreshness
				phase="idle"
				hasRendered
				previewStatusEnabled={false}
				saveStage="saved"
				onRetry={vi.fn()}
			/>,
		)
		expect(screen.getByRole("status")).toHaveTextContent("common.saveSuccess")
	})
	it("lets a preview failure take over the save notice", () => {
		render(
			<HtmlPreviewFreshness phase="failed" hasRendered saveStage="saved" onRetry={vi.fn()} />,
		)
		expect(screen.getByRole("status")).toHaveTextContent("htmlEditor.previewRefreshFailed")
	})
	it("keeps save chips compact without a dismiss control", () => {
		render(
			<HtmlPreviewFreshness phase="idle" hasRendered saveStage="saving" onRetry={vi.fn()} />,
		)
		expect(screen.getByRole("status")).toHaveClass("rounded-full", "backdrop-blur-md")
		expect(screen.queryByRole("button", { name: "common.close" })).toBeNull()
	})
})
