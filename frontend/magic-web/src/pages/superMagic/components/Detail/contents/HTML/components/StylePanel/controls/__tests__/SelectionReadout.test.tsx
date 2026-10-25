import { fireEvent, render, screen } from "@testing-library/react"
import { observer } from "mobx-react-lite"
import { describe, expect, it, vi } from "vitest"
import {
	StylePanelStoreProvider,
	useStylePanelStore,
} from "../../../../iframe-bridge/contexts/StylePanelContext"
import { SelectionReadout } from "../SelectionReadout"
import type { SelectedElementInfo } from "../../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { tag?: string; width?: string; height?: string }) => {
			if (key === "stylePanel.selectionReadout") {
				return `${options?.tag} ${options?.width} × ${options?.height}`
			}
			return key
		},
	}),
}))

const PreviewRectProbe = observer(function PreviewRectProbe() {
	const store = useStylePanelStore()
	return (
		<div data-testid="preview-rect">
			{store.previewRect
				? `${store.previewRect.top},${store.previewRect.left},${store.previewRect.width},${store.previewRect.height}`
				: "none"}
		</div>
	)
})

const selectedElement: SelectedElementInfo = {
	selector: "h2.title",
	tagName: "h2",
	textContent: "春季特惠",
	computedStyles: {
		width: "200px",
		height: "40px",
	} as SelectedElementInfo["computedStyles"],
	ancestors: [
		{
			selector: "section.hero",
			tagName: "section",
			textContent: "运营指标实验室",
			rect: { top: 10, left: 20, width: 400, height: 120 },
		},
	],
}

describe("SelectionReadout", () => {
	it("previews ancestor bounds on hover and selects on click", () => {
		const selectElement = vi.fn().mockResolvedValue(undefined)

		render(
			<StylePanelStoreProvider>
				<SelectionReadout
					selectedElement={selectedElement}
					editorRef={{ current: { selectElement } } as never}
				/>
				<PreviewRectProbe />
			</StylePanelStoreProvider>,
		)

		const ancestor = screen.getByTestId("html-editor-selection-breadcrumb-ancestor")
		fireEvent.mouseEnter(ancestor)
		expect(screen.getByTestId("preview-rect")).toHaveTextContent("10,20,400,120")

		fireEvent.click(ancestor)
		expect(selectElement).toHaveBeenCalledWith("section.hero")

		fireEvent.mouseLeave(ancestor)
		expect(screen.getByTestId("preview-rect")).toHaveTextContent("none")
	})

	it("stays on one line and keeps excerpt text on the current crumb only", () => {
		render(
			<StylePanelStoreProvider>
				<SelectionReadout selectedElement={selectedElement} />
			</StylePanelStoreProvider>,
		)

		const readout = screen.getByTestId("html-editor-selection-readout")
		const breadcrumb = screen.getByTestId("html-editor-selection-breadcrumb")
		const ancestor = screen.getByTestId("html-editor-selection-breadcrumb-ancestor")
		const current = screen.getByTestId("html-editor-selection-breadcrumb-current")
		const separator = breadcrumb.querySelector('[aria-hidden="true"]')

		expect(readout.className).toContain("whitespace-nowrap")
		expect(readout.className).toContain("overflow-hidden")
		expect(readout.className).not.toContain("flex-wrap")
		expect(breadcrumb.className).not.toContain("flex-wrap")
		expect(separator).toHaveClass("text-sm")
		expect(ancestor).not.toHaveTextContent("运营指标实验室")
		expect(current).toHaveTextContent("春季特惠")
	})
})
