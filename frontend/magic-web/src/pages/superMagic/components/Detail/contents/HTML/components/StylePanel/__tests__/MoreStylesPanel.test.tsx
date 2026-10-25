import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MoreStylesPanel } from "../MoreStylesPanel"

const selectedElementRef = vi.hoisted(() => ({
	current: null as { selector: string; tagName: string; computedStyles: object } | null,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("../../../iframe-bridge/contexts/StylePanelContext", () => ({
	useStylePanelStore: () => ({
		selectedElements: [],
		selectElement: vi.fn(),
		getMoreStylesTab: vi.fn(),
		rememberMoreStylesTab: vi.fn(),
	}),
}))

vi.mock("../hooks/useSelectedElement", () => ({
	useSelectedElement: () => ({
		selectedElement: selectedElementRef.current,
		updateStyle: vi.fn(),
		updateBatchStyles: vi.fn(),
		updateAttributes: vi.fn(),
	}),
}))

vi.mock("../MoreStylesTabs", () => ({
	MoreStylesTabs: () => <div data-testid="style-panel-more-styles-content" />,
}))

vi.mock("../controls/FontFamilySelector", () => ({
	FontFamilySelector: () => null,
}))

describe("MoreStylesPanel", () => {
	it("shows an empty state when nothing is selected", () => {
		selectedElementRef.current = null
		render(<MoreStylesPanel editorRef={{ current: null }} />)

		expect(screen.getByTestId("style-panel-more-styles-empty")).toHaveTextContent(
			"stylePanel.sidebar.moreStylesEmpty",
		)
		expect(screen.queryByTestId("style-panel-more-styles-content")).not.toBeInTheDocument()
	})

	it("renders style tabs when an element is selected", () => {
		selectedElementRef.current = {
			selector: "div.card",
			tagName: "div",
			computedStyles: { display: "block" },
		}
		render(<MoreStylesPanel editorRef={{ current: null }} />)

		expect(screen.getByTestId("style-panel-more-styles-content")).toBeInTheDocument()
		expect(screen.queryByTestId("style-panel-more-styles-empty")).not.toBeInTheDocument()
	})
})
