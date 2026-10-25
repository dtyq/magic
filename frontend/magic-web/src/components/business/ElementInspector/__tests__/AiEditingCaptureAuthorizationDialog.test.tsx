import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AiEditingCaptureAuthorizationDialog } from "../AiEditingCaptureAuthorizationDialog"

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({ t: (key: string) => key }),
}))

describe("AiEditingCaptureAuthorizationDialog", () => {
	it("shows the AI editing authorization guidance and resolves allow/cancel actions", () => {
		const onAllow = vi.fn()
		const onCancel = vi.fn()
		render(
			<AiEditingCaptureAuthorizationDialog
				open
				title="AI editing needs browser permission"
				description="AI editing needs access to the current page. Click Allow to continue."
				allowText="Allow"
				cancelText="Cancel"
				onAllow={onAllow}
				onCancel={onCancel}
			/>,
		)

		expect(screen.getByTestId("ai-editing-capture-authorization-dialog")).toBeInTheDocument()
		expect(screen.getByText("AI editing needs browser permission")).toBeInTheDocument()
		expect(
			screen.getByText(
				"AI editing needs access to the current page. Click Allow to continue.",
			),
		).toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "Allow" }))
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

		expect(onAllow).toHaveBeenCalledOnce()
		expect(onCancel).toHaveBeenCalledOnce()
	})
})
