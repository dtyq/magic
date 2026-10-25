import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import ImageSection from "../ImageSection"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
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
			data-value={value}
			value={value}
			onChange={(event) => onValueChange(event.target.value)}
		>
			{children}
		</select>
	),
	SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
		<option value={value}>{children}</option>
	),
	SelectContent: ({ children }: { children: ReactNode }) => children,
	SelectTrigger: ({ children }: { children: ReactNode }) => children,
	SelectValue: () => null,
}))

vi.mock("../../EditorFloating", () => ({
	EditorSelectContent: ({ children }: { children: ReactNode }) => children,
}))

function createSelectedElement(objectPosition: string) {
	return {
		selector: "img.hero",
		tagName: "img",
		isImageElement: true,
		computedStyles: {
			objectFit: "cover",
			objectPosition,
		},
	} as never
}

describe("ImageSection", () => {
	it("maps the browser computed center position back to the center option", () => {
		render(
			<ImageSection
				selectedElement={createSelectedElement("50% 50%")}
				editorRef={{ current: null }}
				onStyleChange={vi.fn()}
			/>,
		)

		expect(screen.getAllByRole("combobox")[1]).toHaveAttribute("data-value", "center")
	})
})
