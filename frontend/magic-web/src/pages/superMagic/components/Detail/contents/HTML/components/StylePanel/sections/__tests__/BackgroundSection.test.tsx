import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import BackgroundSection from "../BackgroundSection"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init() {
			// noop
		},
	},
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

vi.mock("@/components/shadcn-ui/select", () => ({
	Select: ({
		value,
		onValueChange,
		children,
	}: {
		value: string
		onValueChange: (value: string) => void
		children: ReactNode
	}) => (
		<select
			data-testid="html-style-panel-background-type-trigger"
			data-value={value}
			value={value}
			onChange={(event) => onValueChange(event.target.value)}
		>
			{children}
		</select>
	),
	SelectItem: ({ value, children, ...props }: { value: string; children: ReactNode }) => (
		<option value={value} {...props}>
			{children}
		</option>
	),
	SelectContent: ({ children }: { children: ReactNode }) => children,
	SelectTrigger: ({ children }: { children: ReactNode }) => children,
	SelectValue: () => null,
}))

vi.mock("../../EditorFloating", () => ({
	EditorSelectContent: ({ children }: { children: ReactNode }) => children,
}))

function createSelectedElement(
	backgroundColor = "#ffffff",
	backgroundImage = "none",
	tagName = "div",
) {
	return {
		selector: "div.hero",
		tagName,
		computedStyles: {
			backgroundColor,
			backgroundImage,
		},
	} as never
}

describe("BackgroundSection", () => {
	afterEach(() => {
		cleanup()
	})

	it("detects a transparent fill as no background", () => {
		render(
			<BackgroundSection
				selectedElement={createSelectedElement("rgba(0, 0, 0, 0)", "none")}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByTestId("html-style-panel-background-type-trigger")).toHaveAttribute(
			"data-value",
			"none",
		)
		expect(
			screen.queryByTestId("html-style-panel-background-color-picker"),
		).not.toBeInTheDocument()
	})

	it("includes a no background option and clears fill styles when selected", () => {
		const onStyleChange = vi.fn()
		render(
			<BackgroundSection
				selectedElement={createSelectedElement("#3b82f6", "none")}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		expect(
			screen.getByTestId("html-style-panel-background-type-option-none"),
		).toHaveTextContent("stylePanel.noBackground")

		fireEvent.change(screen.getByTestId("html-style-panel-background-type-trigger"), {
			target: { value: "none" },
		})

		expect(onStyleChange).toHaveBeenNthCalledWith(1, "backgroundColor", "transparent")
		expect(onStyleChange).toHaveBeenNthCalledWith(2, "backgroundImage", "none")
		expect(screen.getByTestId("html-style-panel-background-type-trigger")).toHaveAttribute(
			"data-value",
			"none",
		)
	})

	it("keeps an image type when a transparent fill has a background url", () => {
		render(
			<BackgroundSection
				selectedElement={createSelectedElement(
					"transparent",
					"url('https://example.com/bg.png')",
				)}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByTestId("html-style-panel-background-type-trigger")).toHaveAttribute(
			"data-value",
			"image",
		)
	})

	it("keeps a gradient type when a transparent fill has a linear gradient", () => {
		render(
			<BackgroundSection
				selectedElement={createSelectedElement(
					"rgba(0, 0, 0, 0)",
					"linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)",
				)}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByTestId("html-style-panel-background-type-trigger")).toHaveAttribute(
			"data-value",
			"linear-gradient",
		)
	})

	it("does not treat an unrecognized gradient as no background", () => {
		render(
			<BackgroundSection
				selectedElement={createSelectedElement(
					"transparent",
					"linear-gradient(to right, #ffffff, #000000)",
				)}
				editorRef={{ current: null }}
			/>,
		)

		expect(screen.getByTestId("html-style-panel-background-type-trigger")).toHaveAttribute(
			"data-value",
			"solid",
		)
	})

	it("clears fill styles when switching from a gradient to no background", () => {
		const onStyleChange = vi.fn()
		render(
			<BackgroundSection
				selectedElement={createSelectedElement(
					"transparent",
					"linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)",
				)}
				editorRef={{ current: null }}
				onStyleChange={onStyleChange}
			/>,
		)

		fireEvent.change(screen.getByTestId("html-style-panel-background-type-trigger"), {
			target: { value: "none" },
		})

		expect(onStyleChange).toHaveBeenNthCalledWith(1, "backgroundColor", "transparent")
		expect(onStyleChange).toHaveBeenNthCalledWith(2, "backgroundImage", "none")
	})
})
