import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SlideSelectionDialog from "../SlideSelectionDialog"
import type { SlideItem } from "../../PPTRender/PPTSidebar/types"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/base", () => ({ TSIcon: () => null }))
vi.mock("../FileSlicesIcon", () => ({ default: () => null }))

const slides = ["c.html", "b.html", "a.html"].map((path, index) => ({
	id: String(index),
	path,
	loadingState: "loaded",
	content: "<html><body>Slide</body></html>",
})) as SlideItem[]

function setup() {
	const onConfirm = vi.fn()
	render(
		<SlideSelectionDialog
			open
			onOpenChange={vi.fn()}
			slides={slides}
			hiddenSlides={["b.html"]}
			onConfirm={onConfirm}
		/>,
	)
	return onConfirm
}

describe("slide export hidden page selection", () => {
	it("defaults to visible slides in deck order and shows the actual count", () => {
		const onConfirm = setup()
		fireEvent.click(screen.getByRole("button", { name: "ppt.exportSelected (2)" }))
		expect(onConfirm).toHaveBeenCalledWith(["c.html", "a.html"], "pptx", false)
	})

	it("allows explicit inclusion of hidden slides", () => {
		const onConfirm = setup()
		fireEvent.click(screen.getByLabelText("ppt.includeHiddenSlides"))
		fireEvent.click(screen.getByRole("button", { name: "ppt.exportSelected (3)" }))
		expect(onConfirm).toHaveBeenCalledWith(["c.html", "b.html", "a.html"], "pptx", true)
	})

	it("keeps source downloads eligible regardless of the hidden-page checkbox", () => {
		const onConfirm = setup()
		fireEvent.click(screen.getByLabelText("topicFiles.source"))
		fireEvent.click(screen.getByRole("button", { name: "ppt.exportSelected (3)" }))
		expect(onConfirm).toHaveBeenCalledWith(["c.html", "b.html", "a.html"], "source", false)
	})
})
