import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CustomCSSSection } from "../CustomCSSSection"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/infrastructure/editors/monaco", () => ({
	MonacoEditor: ({
		value,
		onChange,
		readOnly,
	}: {
		value: string
		onChange?: (value: string) => void
		readOnly?: boolean
	}) => (
		<textarea
			aria-label="stylePanel.customCSS.title"
			value={value}
			disabled={readOnly}
			onChange={(event) => onChange?.(event.target.value)}
		/>
	),
}))

const selectedElement = {
	selector: "div.card",
	tagName: "div",
	computedStyles: {},
} as never

describe("CustomCSSSection", () => {
	it("applies declarations for the selected element", async () => {
		const onApply = vi.fn().mockResolvedValue(undefined)
		render(<CustomCSSSection selectedElement={selectedElement} onApply={onApply} />)

		fireEvent.change(screen.getByRole("textbox"), {
			target: { value: "color: red; padding: 8px" },
		})
		fireEvent.click(screen.getByRole("button", { name: "stylePanel.customCSS.apply" }))

		await waitFor(() => {
			expect(onApply).toHaveBeenCalledWith({ color: "red", padding: "8px" })
		})
	})

	it("only shows the apply action after editing", () => {
		render(<CustomCSSSection selectedElement={selectedElement} onApply={vi.fn()} />)

		expect(
			screen.queryByRole("button", { name: "stylePanel.customCSS.apply" }),
		).not.toBeInTheDocument()
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "color: red" } })
		expect(screen.getByRole("button", { name: "stylePanel.customCSS.apply" })).toBeEnabled()
	})

	it("disables apply for invalid CSS syntax", async () => {
		render(<CustomCSSSection selectedElement={selectedElement} onApply={vi.fn()} />)

		fireEvent.change(screen.getByRole("textbox"), { target: { value: "display" } })

		expect(await screen.findByText("stylePanel.customCSS.invalidError")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "stylePanel.customCSS.apply" })).toBeDisabled()
	})

	it("removes declarations deleted from the editor", async () => {
		const onApply = vi.fn().mockResolvedValue(undefined)
		const elementWithInlineStyles = {
			...selectedElement,
			inlineStyles: { color: "red", padding: "8px" },
		}
		render(<CustomCSSSection selectedElement={elementWithInlineStyles} onApply={onApply} />)

		const input = screen.getByRole("textbox")
		fireEvent.change(input, { target: { value: "color: blue;" } })
		fireEvent.click(screen.getByRole("button", { name: "stylePanel.customCSS.apply" }))

		await waitFor(() => {
			expect(onApply).toHaveBeenCalledWith({ color: "blue", padding: "" })
		})
	})

	it("shows a validation message for selector syntax", async () => {
		render(<CustomCSSSection selectedElement={selectedElement} onApply={vi.fn()} />)

		fireEvent.change(screen.getByRole("textbox"), {
			target: { value: ".card { color: red; }" },
		})
		fireEvent.click(screen.getByRole("button", { name: "stylePanel.customCSS.apply" }))

		expect(await screen.findByText("stylePanel.customCSS.invalidError")).toBeInTheDocument()
	})
})
