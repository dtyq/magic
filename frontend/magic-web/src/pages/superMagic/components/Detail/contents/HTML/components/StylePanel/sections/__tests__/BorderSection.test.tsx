import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import BorderSection from "../BorderSection"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({
		children,
		...props
	}: { children: ReactNode } & InputHTMLAttributes<HTMLButtonElement>) => (
		<button {...props}>{children}</button>
	),
}))

vi.mock("@/components/shadcn-ui/switch", () => ({
	Switch: ({
		checked,
		onCheckedChange,
		...props
	}: {
		checked: boolean
		onCheckedChange: (value: boolean) => void
	}) => (
		<button
			{...props}
			role="switch"
			aria-checked={checked}
			onClick={() => onCheckedChange(!checked)}
		/>
	),
}))

vi.mock("../../controls", () => ({
	NumericDragInput: ({
		value,
		onChange,
		...props
	}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
		value: string
		onChange: (value: string) => void
	}) => (
		<input
			{...props}
			value={value}
			onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
		/>
	),
}))

function createSelectedElement(
	selector: string,
	borderWidth: string,
	borderStyle: string,
	borderColor: string,
	borderRadius: string,
) {
	return {
		selector,
		tagName: "div",
		computedStyles: {
			borderWidth,
			borderStyle,
			borderColor,
			borderRadius,
		},
	} as never
}

describe("BorderSection", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
	})

	it("syncs local controls when the selected element changes", () => {
		const { rerender } = render(
			<BorderSection
				selectedElement={createSelectedElement("#first", "2px", "solid", "#111111", "4px")}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByLabelText("stylePanel.borderWidth")).toHaveValue("2")
		expect(screen.getByLabelText("stylePanel.borderColor")).toHaveValue("#111111")
		expect(screen.getByLabelText("stylePanel.borderRadius")).toHaveValue("4")

		rerender(
			<BorderSection
				selectedElement={createSelectedElement(
					"#second",
					"5px",
					"dashed",
					"#222222",
					"8px",
				)}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByLabelText("stylePanel.borderWidth")).toHaveValue("5")
		expect(screen.getByLabelText("stylePanel.borderColor")).toHaveValue("#222222")
		expect(screen.getByLabelText("stylePanel.borderRadius")).toHaveValue("8")
	})

	it("syncs local controls when the same element receives refreshed styles", () => {
		const { rerender } = render(
			<BorderSection
				selectedElement={createSelectedElement("#target", "2px", "solid", "#111111", "4px")}
				editorRef={{ current: null }}
			/>,
		)

		rerender(
			<BorderSection
				selectedElement={createSelectedElement(
					"#target",
					"5px",
					"dashed",
					"#222222",
					"8px",
				)}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByLabelText("stylePanel.borderWidth")).toHaveValue("5")
		expect(screen.getByLabelText("stylePanel.borderColor")).toHaveValue("#222222")
		expect(screen.getByLabelText("stylePanel.borderRadius")).toHaveValue("8")
	})

	it("enables a visible default width when choosing a border style", () => {
		const onStyleChange = vi.fn()
		render(
			<BorderSection
				selectedElement={createSelectedElement("#target", "0px", "none", "#000000", "0px")}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		fireEvent.click(
			screen.getByRole("button", { name: "stylePanel.borderStyleOptions.dashed" }),
		)

		expect(onStyleChange).toHaveBeenNthCalledWith(1, "borderWidth", "1px")
		expect(onStyleChange).toHaveBeenNthCalledWith(2, "borderStyle", "dashed")
		expect(screen.getByLabelText("stylePanel.borderWidth")).toHaveValue("1")
	})

	it("toggles the border and applies the default style when enabled", () => {
		const onStyleChange = vi.fn()
		render(
			<BorderSection
				selectedElement={createSelectedElement("#target", "0px", "none", "#000000", "0px")}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		fireEvent.click(screen.getByRole("switch", { name: "stylePanel.borderEnabled" }))

		expect(onStyleChange).toHaveBeenNthCalledWith(1, "borderWidth", "1px")
		expect(onStyleChange).toHaveBeenNthCalledWith(2, "borderStyle", "solid")
		expect(screen.getByTestId("html-style-panel-border-preview").firstElementChild).toHaveStyle(
			{
				borderWidth: "1px",
			},
		)
	})

	it("applies a quick width preset and updates the preview", () => {
		const onStyleChange = vi.fn()
		render(
			<BorderSection
				selectedElement={createSelectedElement("#target", "1px", "solid", "#000000", "0px")}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "4" }))

		act(() => vi.advanceTimersByTime(300))
		expect(onStyleChange).toHaveBeenCalledWith("borderWidth", "4px")
		expect(screen.getByLabelText("stylePanel.borderWidth")).toHaveValue("4")
	})

	it("updates the preview immediately when the color changes", () => {
		render(
			<BorderSection
				selectedElement={createSelectedElement("#target", "1px", "solid", "#000000", "0px")}
				editorRef={{ current: null }}
			/>,
		)

		fireEvent.change(screen.getByLabelText("stylePanel.borderColor"), {
			target: { value: "#ff0000" },
		})

		expect(screen.getByTestId("html-style-panel-border-preview").firstElementChild).toHaveStyle(
			{
				borderColor: "rgb(255, 0, 0)",
			},
		)
	})

	it("enables a solid border when a positive width is entered", () => {
		const onStyleChange = vi.fn()
		render(
			<BorderSection
				selectedElement={createSelectedElement("#target", "0px", "none", "#000000", "0px")}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		fireEvent.change(screen.getByLabelText("stylePanel.borderWidth"), {
			target: { value: "2" },
		})

		expect(onStyleChange).toHaveBeenCalledWith("borderStyle", "solid")
		act(() => vi.advanceTimersByTime(300))
		expect(onStyleChange).toHaveBeenCalledWith("borderWidth", "2px")
	})
})
