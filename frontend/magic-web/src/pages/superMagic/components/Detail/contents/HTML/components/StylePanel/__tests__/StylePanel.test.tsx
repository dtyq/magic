import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { StylePanel } from "../StylePanel"

const mockUpdateStyle = vi.fn()

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../hooks/useSelectedElement", () => ({
	useSelectedElement: function useSelectedElement() {
		return {
			selectedElement: {
				selector: "img.hero",
				tagName: "img",
				isImageElement: true,
				intrinsicWidth: 800,
				intrinsicHeight: 400,
				intrinsicAspectRatio: 2,
				computedStyles: {
					fontWeight: "400",
					fontStyle: "normal",
					textDecoration: "none",
					textAlign: "left",
					color: "#000000",
					width: "320px",
					height: "160px",
				},
			},
			updateStyle: mockUpdateStyle,
			updateBatchStyles: mockUpdateStyle,
		}
	},
}))

vi.mock("../../../iframe-bridge/contexts/StylePanelContext", () => ({
	useStylePanelStore: () => ({
		selectedElements: [],
		getSelectedSelectors: () => ["img.hero"],
	}),
}))

vi.mock("@/hooks/useShowButtonText", () => ({
	useShowButtonText: () => true,
}))

vi.mock("../sections/LayoutSection", () => ({
	default: () => <div data-testid="layout-section" />,
}))

vi.mock("../sections/BackgroundSection", () => ({
	default: () => <div data-testid="background-section" />,
}))

vi.mock("../sections/BorderSection", () => ({
	default: () => <div data-testid="border-section" />,
}))

vi.mock("../sections/ShadowSection", () => ({
	default: () => <div data-testid="shadow-section" />,
}))

vi.mock("../controls", () => ({
	/** Mock style controls to keep the test focused on which toolbar entries are rendered. */
	HistoryActions: () => <div data-testid="history-actions" />,
	FontFamilySelector: () => <div data-testid="font-family-selector" />,
	FontSizeSelector: () => <div data-testid="font-size-selector" />,
	FontSizeAdjuster: () => <div data-testid="font-size-adjuster" />,
	TextFormatTools: () => <div data-testid="text-format-tools" />,
	TextAlignTools: () => <div data-testid="text-align-tools" />,
	ColorPicker: () => <div data-testid="color-picker" />,
	ElementActions: () => <div data-testid="element-actions" />,
	SizePopover: () => <div data-testid="style-popover-stylePanel.size" />,
	StylePopoverButton: ({ title, children }: { title: string; children: ReactNode }) => (
		<div data-testid={`style-popover-${title}`}>
			<span>{title}</span>
			<div>{children}</div>
		</div>
	),
}))

describe("StylePanel", () => {
	beforeEach(() => {
		mockUpdateStyle.mockReset()
	})

	it("should render a dedicated size popover button for selected images", () => {
		render(<StylePanel editorRef={{ current: null }} />)

		expect(screen.getByTestId("style-popover-stylePanel.size")).toBeInTheDocument()
	})
})
