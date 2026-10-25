import { useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MicroAppPreviewPages from "../MicroAppPreviewPages"
import MicroAppOpenPageMenu from "../MicroAppOpenPageMenu"
import MicroAppPreviewTabs from "../MicroAppPreviewTabs"
import { useMicroAppPreviewFiles } from "../../hooks/useMicroAppPreviewFiles"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
const home = { file_id: "home", file_name: "index.html" }
const detail = { file_id: "detail", file_name: "detail.html" }
const files = [home, detail]
function Page({ name, open }: { name: string; open: () => void }) {
	const [count, setCount] = useState(0)
	return (
		<div>
			<button onClick={() => setCount(count + 1)}>
				{name}:{count}
			</button>
			<button onClick={open}>Open page</button>
		</div>
	)
}
function Browser({ published = false }: { published?: boolean }) {
	const browser = useMicroAppPreviewFiles({
		attachmentList: files,
		defaultEntryFile: home,
		allowCloseLastTab: !published,
	})
	return (
		<>
			{(!published || browser.previewTabs.length > 1) && <MicroAppPreviewTabs {...browser} />}
			{!published && <MicroAppOpenPageMenu browser={browser} />}
			<MicroAppPreviewPages browser={browser}>
				{({ tab, onOpenFile }) => (
					<Page
						name={tab.file.file_name!}
						open={() =>
							onOpenFile({
								...detail,
								htmlNavigation: {
									filePath: "detail.html",
									search: "",
									hash: "",
									anchor: "",
									target: "_blank",
								},
							})
						}
					/>
				)}
			</MicroAppPreviewPages>
		</>
	)
}
describe("MicroApp preview pages", () => {
	it("keeps independent page state mounted across tab changes and closes only one context", () => {
		render(<Browser />)
		fireEvent.click(screen.getByText("index.html:0"))
		fireEvent.click(screen.getByText("Open page"))
		expect(screen.getAllByRole("tab")).toHaveLength(2)
		fireEvent.click(screen.getByText("detail.html:0"))
		fireEvent.click(screen.getByRole("tab", { name: "/index.html" }))
		expect(screen.getByText("index.html:1")).toBeVisible()
		expect(screen.getByText("detail.html:1")).not.toBeVisible()
		fireEvent.click(screen.getByRole("tab", { name: "/detail.html" }))
		expect(screen.getByText("detail.html:1")).toBeVisible()
		fireEvent.click(
			screen.getAllByRole("button", { name: "microAppPage.previewToolbar.closePage" })[1],
		)
		expect(screen.getByText("index.html:1")).toBeVisible()
		expect(screen.queryByText("detail.html:1")).not.toBeInTheDocument()
	})
	it("hides a published single-page bar, reveals it after open, and hides it again after close", () => {
		render(<Browser published />)
		expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
		fireEvent.click(screen.getByText("Open page"))
		const tabs = screen.getByRole("tablist")
		expect(within(tabs).getAllByRole("tab")).toHaveLength(2)
		fireEvent.click(
			screen.getAllByRole("button", { name: "microAppPage.previewToolbar.closePage" })[1],
		)
		expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
	})
	it("supports arrow-key selection and deleting a tab with focus preserved", () => {
		render(<Browser />)
		fireEvent.click(screen.getByText("Open page"))
		fireEvent.keyDown(screen.getByRole("tab", { name: "/detail.html" }), { key: "ArrowLeft" })
		const first = screen.getByRole("tab", { name: "/index.html" })
		expect(first).toHaveFocus()
		expect(first).toHaveAttribute("aria-selected", "true")
		fireEvent.keyDown(first, { key: "Delete" })
		expect(screen.getByRole("tab", { name: "/detail.html" })).toHaveFocus()
	})
	it("offers the editor HTML picker even after closing its final page", () => {
		render(<Browser />)
		fireEvent.click(
			screen.getByRole("button", { name: "microAppPage.previewToolbar.closePage" }),
		)
		expect(screen.queryByRole("tab")).not.toBeInTheDocument()
		const picker = screen.getByRole("button", { name: "microAppPage.previewToolbar.openPage" })
		expect(picker).toBeEnabled()
		fireEvent.keyDown(picker, { key: "Enter" })
		const page = screen.getByRole("menuitem", { name: "/detail.html" })
		fireEvent.click(page)
		expect(screen.getByRole("tab", { name: "/detail.html" })).toBeInTheDocument()
	})
})
