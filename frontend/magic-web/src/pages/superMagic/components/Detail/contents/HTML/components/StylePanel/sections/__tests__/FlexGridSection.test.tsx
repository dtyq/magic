import { fireEvent, render, screen } from "@testing-library/react"
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { StylePanelStoreProvider } from "../../../../iframe-bridge/contexts/StylePanelContext"
import FlexGridSection from "../FlexGridSection"

function renderWithStore(ui: ReactNode) {
	return render(<StylePanelStoreProvider>{ui}</StylePanelStoreProvider>)
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../../controls", () => ({
	LayoutConstraintHintCard: () => null,
	NumericDragInput: ({
		value,
		onChange,
		onCommit,
		...props
	}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
		value: string | number
		onChange: (value: string) => void
		onCommit?: (value: string) => void
	}) => (
		<input
			{...props}
			value={value}
			onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
			onBlur={(event) => onCommit?.(event.currentTarget.value)}
		/>
	),
}))

function createSelectedElement(rowGap = "8px", columnGap = "8px") {
	return {
		selector: ".layout",
		tagName: "div",
		computedStyles: {
			display: "flex",
			parentDisplay: "block",
			gap: "0px",
			rowGap,
			columnGap,
			flexDirection: "row",
			flexWrap: "nowrap",
		},
	} as never
}

describe("FlexGridSection", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	it("shows axis gaps with a linked state instead of the generic gap field", () => {
		renderWithStore(
			<FlexGridSection
				selectedElement={createSelectedElement()}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.queryByLabelText("stylePanel.gap")).not.toBeInTheDocument()
		expect(screen.getByLabelText("stylePanel.rowGap")).toHaveValue("8")
		expect(screen.getByLabelText("stylePanel.columnGap")).toHaveValue("8")
		expect(screen.getByTestId("layout-gap-link-toggle")).toHaveAttribute("aria-pressed", "true")
	})

	it("updates both axis gaps while linked", () => {
		const onStyleChange = vi.fn()
		renderWithStore(
			<FlexGridSection
				selectedElement={createSelectedElement()}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		fireEvent.change(screen.getByLabelText("stylePanel.rowGap"), {
			target: { value: "12" },
		})
		expect(onStyleChange).not.toHaveBeenCalled()
		fireEvent.blur(screen.getByLabelText("stylePanel.rowGap"))
		vi.advanceTimersByTime(300)

		expect(onStyleChange).toHaveBeenNthCalledWith(1, "rowGap", "12px")
		expect(onStyleChange).toHaveBeenNthCalledWith(2, "columnGap", "12px")
	})

	it("updates only the edited axis after unlinking", () => {
		const onStyleChange = vi.fn()
		renderWithStore(
			<FlexGridSection
				selectedElement={createSelectedElement()}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("layout-gap-link-toggle"))
		fireEvent.change(screen.getByLabelText("stylePanel.columnGap"), {
			target: { value: "16" },
		})
		expect(onStyleChange).not.toHaveBeenCalled()
		fireEvent.blur(screen.getByLabelText("stylePanel.columnGap"))
		vi.advanceTimersByTime(300)

		expect(onStyleChange).toHaveBeenCalledTimes(1)
		expect(onStyleChange).toHaveBeenCalledWith("columnGap", "16px")
	})
})
