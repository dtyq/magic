import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { BackgroundImageButton } from "../BackgroundImageButton"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

function createSelectedElement(tagName = "section", backgroundImage = "none") {
	return {
		selector: "section.hero",
		tagName,
		computedStyles: { backgroundImage },
	} as never
}

describe("BackgroundImageButton", () => {
	it("uses the background image icon and sets a container background image", async () => {
		const runImageAction = vi.fn().mockResolvedValue(undefined)
		const { container } = render(
			<BackgroundImageButton
				selectedElement={createSelectedElement()}
				editorRef={{ current: { runImageAction } } as never}
			/>,
		)

		expect(
			container.querySelector('[data-testid="html-style-panel-background-image-icon"]'),
		).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("html-style-panel-background-image-button"))

		await waitFor(() =>
			expect(runImageAction).toHaveBeenCalledWith({
				action: "set-element-background-image",
			}),
		)
	})

	it("labels an existing background image as replace", () => {
		render(
			<BackgroundImageButton
				selectedElement={createSelectedElement("section", 'url("hero.png")')}
				editorRef={{ current: null }}
			/>,
		)

		expect(
			screen.getByRole("button", { name: "stylePanel.replaceBackgroundImage" }),
		).toBeInTheDocument()
	})

	it("does not render for image elements", () => {
		const { container } = render(
			<BackgroundImageButton
				selectedElement={createSelectedElement("img")}
				editorRef={{ current: null }}
			/>,
		)

		expect(container).toBeEmptyDOMElement()
	})
})
