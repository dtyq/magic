import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PublishScopeNoticeDialog from "./PublishScopeNoticeDialog"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("PublishScopeNoticeDialog", () => {
	it("shows the publish path and allows continuing or cancelling", () => {
		const onContinue = vi.fn()
		const onCancel = vi.fn()

		const { rerender } = render(
			<PublishScopeNoticeDialog
				open
				publishPath=".magic/skills/demo"
				outsidePaths={Array.from({ length: 11 }, (_, index) => `docs/file-${index}.md`)}
				onContinue={onContinue}
				onCancel={onCancel}
			/>,
		)

		expect(screen.getByTestId("publish-scope-notice-dialog")).toHaveTextContent(
			"publishScopeNotice.intro",
		)
		expect(screen.getByTestId("publish-scope-notice-dialog")).toHaveTextContent(
			".magic/skills/demo",
		)
		expect(screen.getByTestId("publish-scope-notice-dialog")).toHaveTextContent(
			"docs/file-0.md",
		)
		expect(screen.getByTestId("publish-scope-notice-dialog")).toHaveTextContent(
			"docs/file-9.md",
		)
		expect(screen.getByTestId("publish-scope-notice-dialog")).not.toHaveTextContent(
			"docs/file-10.md",
		)
		expect(screen.getByTestId("publish-scope-notice-dialog")).toHaveTextContent(
			"publishScopeNotice.morePaths",
		)
		expect(screen.getByRole("list")).toHaveAttribute("role", "list")
		expect(screen.getByRole("list")).toHaveClass("max-h-56", "overflow-y-auto")
		expect(screen.getAllByRole("listitem")).toHaveLength(10)

		fireEvent.click(screen.getByRole("button", { name: "publishScopeNotice.continue" }))
		expect(onContinue).toHaveBeenCalledTimes(1)

		rerender(
			<PublishScopeNoticeDialog
				open
				publishPath=".magic/skills/demo"
				outsidePaths={[]}
				onContinue={onContinue}
				onCancel={onCancel}
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: "publishScopeNotice.cancel" }))
		expect(onCancel).toHaveBeenCalledTimes(1)
	})
})
