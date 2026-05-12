import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildLockedImageSizeStyles, SizePopover } from "../SizePopover"
import type { SelectedElementInfo } from "../../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../StylePopoverButton", () => ({
	/** Keep the popover content always visible so the test can focus on size interactions. */
	StylePopoverButton: ({
		children,
		title,
		contentClassName,
	}: {
		children: React.ReactNode
		title: string
		contentClassName?: string
	}) => (
		<div data-testid={`style-popover-${title}`} data-content-class={contentClassName || ""}>
			<div>{children}</div>
		</div>
	),
}))

vi.mock("../DimensionInput", () => ({
	/** Simplify the dimension input so tests can drive value changes directly. */
	DimensionInput: ({
		label,
		value,
		onChange,
		fixedUnit,
		testIdPrefix,
	}: {
		label: string
		value: string
		onChange: (value: string) => void
		fixedUnit?: string
		testIdPrefix?: string
	}) => (
		<label>
			<span>{label}</span>
			<input
				data-testid={testIdPrefix ? `${testIdPrefix}-input` : undefined}
				data-fixed-unit={fixedUnit || ""}
				defaultValue={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	),
}))

vi.mock("@/components/shadcn-ui/switch", () => ({
	Switch: ({
		checked,
		onCheckedChange,
		...props
	}: {
		checked: boolean
		onCheckedChange: (checked: boolean) => void
	}) => (
		<input
			{...props}
			type="checkbox"
			checked={checked}
			onChange={(event) => onCheckedChange(event.target.checked)}
		/>
	),
}))

describe("SizePopover", () => {
	const mockOnStyleChange = vi.fn()
	const mockOnBatchStyleChange = vi.fn()

	const imageElement: SelectedElementInfo = {
		selector: "img.hero",
		tagName: "img",
		isImageElement: true,
		intrinsicWidth: 800,
		intrinsicHeight: 400,
		intrinsicAspectRatio: 2,
		computedStyles: {
			width: "200px",
			height: "100px",
		} as SelectedElementInfo["computedStyles"],
	}

	const normalElement: SelectedElementInfo = {
		selector: "div.card",
		tagName: "div",
		computedStyles: {
			width: "200px",
			height: "100px",
		} as SelectedElementInfo["computedStyles"],
	}

	const imageElementWithAutoHeight: SelectedElementInfo = {
		selector: "img.cover",
		tagName: "img",
		isImageElement: true,
		intrinsicWidth: 1200,
		intrinsicHeight: 600,
		intrinsicAspectRatio: 2,
		computedStyles: {
			width: "200px",
			height: "auto",
		} as SelectedElementInfo["computedStyles"],
	}

	beforeEach(() => {
		mockOnStyleChange.mockReset()
		mockOnBatchStyleChange.mockReset()
	})

	it("should batch width and height when editing a locked image dimension", () => {
		render(
			<SizePopover
				selectedElement={imageElement}
				onStyleChange={mockOnStyleChange}
				onBatchStyleChange={mockOnBatchStyleChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-style-panel-size-lock-switch"))
		mockOnBatchStyleChange.mockClear()

		fireEvent.change(screen.getByTestId("html-style-panel-size-width-input"), {
			target: { value: "240px" },
		})

		expect(mockOnBatchStyleChange).toHaveBeenCalledWith({
			width: "240px",
			height: "120px",
		})
		expect(mockOnStyleChange).not.toHaveBeenCalled()
	})

	it("should render the image ratio lock switch as disabled by default", () => {
		render(
			<SizePopover
				selectedElement={imageElement}
				onStyleChange={mockOnStyleChange}
				onBatchStyleChange={mockOnBatchStyleChange}
			/>,
		)

		expect(screen.getByTestId("html-style-panel-size-lock-switch")).not.toBeChecked()
	})

	it("should keep linked image dimensions in the edited unit", () => {
		expect(
			buildLockedImageSizeStyles({
				property: "width",
				value: "60%",
				intrinsicAspectRatio: 2,
			}),
		).toEqual({
			width: "60%",
			height: "30%",
		})
	})

	it("should not force image dimensions to px-only inputs", () => {
		render(
			<SizePopover
				selectedElement={imageElement}
				onStyleChange={mockOnStyleChange}
				onBatchStyleChange={mockOnBatchStyleChange}
			/>,
		)

		expect(screen.getByTestId("html-style-panel-size-width-input")).toHaveAttribute(
			"data-fixed-unit",
			"px",
		)
		expect(screen.getByTestId("html-style-panel-size-height-input")).toHaveAttribute(
			"data-fixed-unit",
			"px",
		)
	})

	it("should immediately normalize image dimensions when enabling the ratio lock", () => {
		render(
			<SizePopover
				selectedElement={imageElementWithAutoHeight}
				onStyleChange={mockOnStyleChange}
				onBatchStyleChange={mockOnBatchStyleChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-style-panel-size-lock-switch"))

		expect(mockOnBatchStyleChange).toHaveBeenCalledWith({
			width: "200px",
			height: "100px",
		})
	})

	it("should request a wider popover for size controls", () => {
		render(
			<SizePopover
				selectedElement={imageElement}
				onStyleChange={mockOnStyleChange}
				onBatchStyleChange={mockOnBatchStyleChange}
			/>,
		)

		expect(screen.getByTestId("style-popover-stylePanel.size")).toHaveAttribute(
			"data-content-class",
			"w-[26rem] max-w-[calc(100vw-2rem)]",
		)
	})

	it("should keep normal elements on single-dimension updates", () => {
		render(
			<SizePopover
				selectedElement={normalElement}
				onStyleChange={mockOnStyleChange}
				onBatchStyleChange={mockOnBatchStyleChange}
			/>,
		)

		fireEvent.change(screen.getByTestId("html-style-panel-size-width-input"), {
			target: { value: "240px" },
		})

		expect(mockOnStyleChange).toHaveBeenCalledWith("width", "240px")
		expect(mockOnBatchStyleChange).not.toHaveBeenCalled()
	})

	it("should fall back to single-dimension updates after unlocking image ratio", () => {
		render(
			<SizePopover
				selectedElement={imageElement}
				onStyleChange={mockOnStyleChange}
				onBatchStyleChange={mockOnBatchStyleChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-style-panel-size-lock-switch"))
		mockOnBatchStyleChange.mockClear()
		mockOnStyleChange.mockClear()
		fireEvent.click(screen.getByTestId("html-style-panel-size-lock-switch"))
		fireEvent.change(screen.getByTestId("html-style-panel-size-height-input"), {
			target: { value: "140px" },
		})

		expect(mockOnStyleChange).toHaveBeenCalledWith("height", "140px")
		expect(mockOnBatchStyleChange).not.toHaveBeenCalled()
	})
})
