import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DesignStyleDetailHeader from "../DesignStyleDetailHeader"
import { designStyleFixture } from "./fixtures"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ i18n: { language: "en" }, t: (key: string) => key }),
}))

describe("DesignStyleDetailHeader", () => {
	it("renders the detail title and description without a Radix Dialog provider", () => {
		// MagicModal uses Antd on desktop and MagicPopup on mobile, not a Radix Dialog Root.
		render(
			<DesignStyleDetailHeader
				style={designStyleFixture}
				mode="details"
				onModeChange={vi.fn()}
				onBack={vi.fn()}
			/>,
		)
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
			designStyleFixture.title,
		)
		expect(screen.getByText(designStyleFixture.description)).toHaveClass(
			"text-muted-foreground",
		)
	})

	it("keeps detail navigation and the back button ref usable", () => {
		const onModeChange = vi.fn()
		const onBack = vi.fn()
		const backButtonRef = { current: null as HTMLButtonElement | null }
		render(
			<DesignStyleDetailHeader
				style={designStyleFixture}
				mode="rules"
				onModeChange={onModeChange}
				onBack={onBack}
				backButtonRef={backButtonRef}
			/>,
		)
		expect(
			screen.getByRole("button", { name: "htmlEditor.designStyle.tokenDetails" }),
		).toHaveAttribute("aria-pressed", "true")
		fireEvent.click(screen.getByRole("button", { name: "htmlEditor.designStyle.rawMode" }))
		expect(onModeChange).toHaveBeenCalledWith("raw")
		expect(backButtonRef.current).toBe(screen.getByTestId("design-style-back"))
		fireEvent.click(screen.getByTestId("design-style-back"))
		expect(onBack).toHaveBeenCalledOnce()
	})
})
