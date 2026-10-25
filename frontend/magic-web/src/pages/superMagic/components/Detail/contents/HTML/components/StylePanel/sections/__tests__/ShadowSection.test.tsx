import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ChangeEvent, InputHTMLAttributes } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ShadowSection from "../ShadowSection"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/shadcn-ui/slider", () => ({
	Slider: ({
		value,
		onValueChange,
	}: {
		value: number[]
		onValueChange?: (value: number[]) => void
	}) => (
		<button
			type="button"
			data-testid="shadow-slider"
			data-value={value[0]}
			onClick={() => onValueChange?.([value[0] + 10])}
		/>
	),
}))

vi.mock("@/components/shadcn-ui/checkbox", () => ({
	Checkbox: ({
		checked,
		onCheckedChange,
		...props
	}: {
		checked: boolean
		onCheckedChange: (checked: boolean) => void
	} & InputHTMLAttributes<HTMLInputElement>) => (
		<input
			{...props}
			type="checkbox"
			checked={checked}
			onChange={(event) => onCheckedChange(event.target.checked)}
		/>
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

function createSelectedElement(selector: string, boxShadow: string, opacity = "1") {
	return {
		selector,
		tagName: "div",
		computedStyles: {
			boxShadow,
			opacity,
		},
	} as never
}

describe("ShadowSection", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
	})

	it("syncs shadow controls when computed styles change for the same element", () => {
		const { rerender } = render(
			<ShadowSection
				selectedElement={createSelectedElement("#target", "1px 2px 3px 4px rgb(0, 0, 0)")}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByLabelText("stylePanel.shadowOffsetX")).toHaveValue("1")
		expect(screen.getByLabelText("stylePanel.shadowOffsetY")).toHaveValue("2")
		expect(screen.getByText("3px")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "stylePanel.shadowAdvanced" }))
		expect(screen.getByLabelText("stylePanel.shadowSpread")).toHaveValue("4")

		rerender(
			<ShadowSection
				selectedElement={createSelectedElement(
					"#target",
					"5px 6px 7px 8px rgb(17, 17, 17)",
				)}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByLabelText("stylePanel.shadowOffsetX")).toHaveValue("5")
		expect(screen.getByLabelText("stylePanel.shadowOffsetY")).toHaveValue("6")
		expect(screen.getByText("7px")).toBeInTheDocument()
		expect(screen.getByLabelText("stylePanel.shadowSpread")).toHaveValue("8")
	})

	it("parses the color-first format returned by computed styles", () => {
		render(
			<ShadowSection
				selectedElement={createSelectedElement(
					"#target",
					"rgba(17, 17, 17, 0.2) 5px 6px 7px 8px",
				)}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByLabelText("stylePanel.shadowOffsetX")).toHaveValue("5")
		expect(screen.getByLabelText("stylePanel.shadowOffsetY")).toHaveValue("6")
		expect(screen.getByText("7px")).toBeInTheDocument()
	})

	it("toggles the shadow off and restores it with the switch", () => {
		const onStyleChange = vi.fn()
		render(
			<ShadowSection
				selectedElement={createSelectedElement("#target", "none")}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		const toggle = screen.getByRole("switch", { name: "stylePanel.shadowEnabled" })
		expect(toggle).toHaveAttribute("aria-checked", "false")

		fireEvent.click(toggle)
		expect(toggle).toHaveAttribute("aria-checked", "true")
		expect(onStyleChange).toHaveBeenLastCalledWith(
			"boxShadow",
			"0px 4px 6px 0px rgba(0, 0, 0, 0.1)",
		)

		fireEvent.click(toggle)
		expect(toggle).toHaveAttribute("aria-checked", "false")
		expect(onStyleChange).toHaveBeenLastCalledWith("boxShadow", "none")
	})

	it("cancels a pending shadow update when external styles are restored", () => {
		const onStyleChange = vi.fn()
		const { rerender } = render(
			<ShadowSection
				selectedElement={createSelectedElement("#target", "1px 2px 3px 4px rgb(0, 0, 0)")}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		fireEvent.change(screen.getByLabelText("stylePanel.shadowOffsetX"), {
			target: { value: "9" },
		})

		rerender(
			<ShadowSection
				selectedElement={createSelectedElement("#target", "2px 2px 3px 4px rgb(0, 0, 0)")}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		act(() => vi.advanceTimersByTime(100))

		expect(screen.getByLabelText("stylePanel.shadowOffsetX")).toHaveValue("2")
		expect(onStyleChange).not.toHaveBeenCalled()
	})

	it("keeps a pending slider change when an equivalent computed-style refresh arrives", () => {
		const onStyleChange = vi.fn()
		const initialShadow = "0px 4px 6px 0px rgb(0, 0, 0)"
		const { rerender } = render(
			<ShadowSection
				selectedElement={createSelectedElement("#target", initialShadow)}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		fireEvent.click(screen.getAllByTestId("shadow-slider")[0])
		expect(screen.getByText("16px")).toBeInTheDocument()

		rerender(
			<ShadowSection
				selectedElement={createSelectedElement("#target", initialShadow)}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		expect(screen.getByText("16px")).toBeInTheDocument()
		act(() => vi.advanceTimersByTime(100))

		expect(onStyleChange).toHaveBeenCalledWith("boxShadow", "0px 4px 16px 0px rgb(0, 0, 0)")
	})

	it("syncs opacity when computed styles change for the same element", () => {
		const { rerender } = render(
			<ShadowSection
				selectedElement={createSelectedElement("#target", "none", "0.4")}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByLabelText("stylePanel.transparency")).toHaveValue("0.40")

		rerender(
			<ShadowSection
				selectedElement={createSelectedElement("#target", "none", "0.8")}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByLabelText("stylePanel.transparency")).toHaveValue("0.80")
	})
})
