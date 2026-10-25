import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DesignStyleButton from "../DesignStyleButton"
import { designStyleFixture } from "./fixtures"

const { publish } = vi.hoisted(() => ({ publish: vi.fn() }))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({ t: (key: string) => key }),
	}
})

vi.mock("@/pages/superMagic/components/Detail/components/EditToolbar/ConditionalTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/utils/pubsub", () => ({
	default: { publish },
	PubSubEvents: { Set_Input_Message: "Set_Input_Message" },
}))

vi.mock("../DesignStyleDialog", () => ({
	default: ({
		open,
		onApply,
		canApply,
	}: {
		open: boolean
		onApply: (style: unknown) => void
		canApply: boolean
	}) =>
		open ? (
			<button type="button" disabled={!canApply} onClick={() => onApply(designStyleFixture)}>
				apply
			</button>
		) : null,
}))

describe("DesignStyleButton", () => {
	it("publishes one file-scoped style request", () => {
		render(
			<DesignStyleButton
				fileInfo={{
					fileId: "file-1",
					fileName: "index.html",
					filePath: "pages/index.html",
				}}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "htmlEditor.designStyle.open" }))
		fireEvent.click(screen.getByRole("button", { name: "apply" }))

		expect(publish).toHaveBeenCalledTimes(1)
		expect(publish).toHaveBeenCalledWith(
			"Set_Input_Message",
			expect.objectContaining({ type: "doc" }),
		)
	})

	it("renders button label when showButtonText is true", () => {
		render(
			<DesignStyleButton
				fileInfo={{
					fileId: "file-1",
					fileName: "index.html",
					filePath: "pages/index.html",
				}}
				showButtonText={true}
			/>,
		)

		const button = screen.getByRole("button", { name: "htmlEditor.designStyle.open" })
		expect(button).toBeInTheDocument()
		expect(button).toHaveTextContent("htmlEditor.designStyle.open")
		expect(button.className).toContain("px-3")
		expect(button.className).toContain("gap-1.5")
	})

	it("hides button label and uses compact padding when showButtonText is false", () => {
		render(
			<DesignStyleButton
				fileInfo={{
					fileId: "file-1",
					fileName: "index.html",
					filePath: "pages/index.html",
				}}
				showButtonText={false}
			/>,
		)

		const button = screen.getByRole("button", { name: "htmlEditor.designStyle.open" })
		expect(button).toBeInTheDocument()
		expect(button).not.toHaveTextContent("htmlEditor.designStyle.open")
		expect(button.className).toContain("px-1.5")
		expect(button.className).not.toContain("gap-1.5")
	})
})
