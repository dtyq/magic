import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ResearchComposerOptions from "../components/ResearchComposerOptions"
import { DEFAULT_RESEARCH_OPTIONS } from "../services/researchOptions"

const mocks = vi.hoisted(() => ({ isMobile: true }))

vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => mocks.isMobile }))
vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))
// The real drawer needs vaul's portal and overlay stack; only its open/close contract matters here.
vi.mock("@/components/shadcn-composed/action-drawer", () => ({
	ActionDrawer: ({
		open,
		title,
		children,
	}: {
		open: boolean
		title?: ReactNode
		children?: ReactNode
	}) =>
		open ? (
			<div role="dialog" aria-label={String(title)}>
				{children}
			</div>
		) : null,
	ActionGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
	ActionItem: ({ label, onClick }: { label: ReactNode; onClick?: () => void }) => (
		<button type="button" onClick={onClick}>
			{label}
		</button>
	),
}))

function renderOptions(onChange = vi.fn()) {
	render(<ResearchComposerOptions value={DEFAULT_RESEARCH_OPTIONS} onChange={onChange} />)
	return onChange
}

describe("ResearchComposerOptions on phones", () => {
	beforeEach(() => {
		mocks.isMobile = true
	})

	it("opens the choices in a bottom sheet instead of a dropdown", () => {
		renderOptions()
		expect(screen.queryByRole("dialog")).toBeNull()
		fireEvent.click(screen.getByRole("button", { name: /options\.method/ }))
		const sheet = screen.getByRole("dialog")
		expect(sheet).toBeTruthy()
		expect(sheet.textContent).toContain("studyType.userResearch")
		// A dropdown would render a Radix menu; phones must not.
		expect(screen.queryByRole("menu")).toBeNull()
	})

	it("applies the picked option and closes the sheet", () => {
		const onChange = renderOptions()
		fireEvent.click(screen.getByRole("button", { name: /options\.method/ }))
		fireEvent.click(screen.getByText("studyType.conceptTest"))
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({ method: "concept_test", customMethod: undefined }),
		)
		expect(screen.queryByRole("dialog")).toBeNull()
	})

	it("takes a custom number from the input inside the sheet", () => {
		const onChange = renderOptions()
		fireEvent.click(screen.getByRole("button", { name: /options\.panel/ }))
		fireEvent.click(screen.getByText("options.custom"))
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "7" } })
		fireEvent.click(screen.getByText("options.customApply"))
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ panelSize: 7 }))
		expect(screen.queryByRole("dialog")).toBeNull()
	})
})
