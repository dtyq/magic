import type { ReactNode } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ClickLinkSection } from "../ClickLinkSection"
import { PPTLinkContext } from "../../../../contexts/PPTLinkContext"
import type { SelectedElementInfo } from "../../types"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/shadcn-ui/select", () => ({
	Select: ({
		value,
		onValueChange,
		children,
		disabled,
	}: {
		value: string
		onValueChange: (value: string) => void
		children: ReactNode
		disabled?: boolean
	}) => (
		<select
			value={value}
			onChange={(event) => onValueChange(event.target.value)}
			disabled={disabled}
		>
			<option value="" />
			{children}
		</select>
	),
	SelectTrigger: () => null,
	SelectValue: () => null,
	SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
		<option value={value}>{children}</option>
	),
}))
vi.mock("../../../EditorFloating", () => ({
	EditorSelectContent: ({ children }: { children: ReactNode }) => children,
}))

afterEach(cleanup)

const slides = [
	{ path: "slides/cover.html" },
	{ path: "slides/section/summary.html", title: "Summary" },
]
function element(
	tagName: string,
	attributes: SelectedElementInfo["attributes"] = {},
): SelectedElementInfo {
	return { selector: "#target", tagName, attributes, computedStyles: {} } as SelectedElementInfo
}
function renderSection(
	selectedElement: SelectedElementInfo,
	onUpdate = vi.fn(async () => undefined),
) {
	return {
		onUpdate,
		...render(
			<PPTLinkContext.Provider value={{ currentSlidePath: slides[0].path, slides }}>
				<ClickLinkSection selectedElement={selectedElement} onUpdate={onUpdate} />
			</PPTLinkContext.Provider>,
		),
	}
}

describe("ClickLinkSection", () => {
	it.each(["a", "div"])(
		"only offers external opening for an external %s link",
		async (tagName) => {
			const field = tagName === "a" ? "href" : "dataMagicHref"
			const onUpdate = vi.fn(async () => undefined)
			render(
				<ClickLinkSection
					selectedElement={element(tagName, {
						[field]: "https://outside.test",
						target: "_self",
					})}
					onUpdate={onUpdate}
				/>,
			)
			expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
			expect(screen.queryByText("stylePanel.linkTarget")).not.toBeInTheDocument()
			fireEvent.blur(screen.getByPlaceholderText("stylePanel.linkUrlPlaceholder"))
			await waitFor(() =>
				expect(onUpdate).toHaveBeenCalledWith({
					[field]: "https://outside.test",
					target: "_blank",
					download: null,
				}),
			)
		},
	)

	it.each(["a", "div", "img"])(
		"configures a PPT target on %s using a stable relative file path",
		async (tagName) => {
			const { onUpdate } = renderSection(element(tagName))
			fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "slide" } })
			fireEvent.change(screen.getAllByRole("combobox")[1], {
				target: { value: slides[1].path },
			})
			await waitFor(() =>
				expect(onUpdate).toHaveBeenCalledWith({
					[tagName === "a" ? "href" : "dataMagicHref"]: "section/summary.html",
					target: null,
					download: null,
				}),
			)
		},
	)

	it.each(["a", "div"])(
		"recognizes an existing %s link and supports removing it",
		async (tagName) => {
			const field = tagName === "a" ? "href" : "dataMagicHref"
			const { onUpdate } = renderSection(
				element(tagName, { [field]: "/slides/section/summary.html" }),
			)
			expect(screen.getAllByRole("combobox")[0]).toHaveValue("slide")
			expect(screen.getAllByRole("combobox")[1]).toHaveValue(slides[1].path)
			fireEvent.click(screen.getByRole("button", { name: "stylePanel.linkRemove" }))
			await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ [field]: null }))
		},
	)

	it("supports URL editing in standalone HTML without a PPT selector", async () => {
		const onUpdate = vi.fn(async () => undefined)
		render(<ClickLinkSection selectedElement={element("div")} onUpdate={onUpdate} />)
		expect(screen.queryByText("stylePanel.linkType")).not.toBeInTheDocument()
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
		expect(screen.queryByText("stylePanel.linkTarget")).not.toBeInTheDocument()
		const input = screen.getByPlaceholderText("stylePanel.linkUrlPlaceholder")
		fireEvent.change(input, { target: { value: "detail.html" } })
		fireEvent.blur(input)
		await waitFor(() =>
			expect(onUpdate).toHaveBeenCalledWith({
				dataMagicHref: "detail.html",
				target: "_blank",
				download: null,
			}),
		)
	})

	it("shows a failure and restores the displayed URL when the editor rejects a change", async () => {
		const onUpdate = vi.fn().mockRejectedValue(new Error("save failed"))
		renderSection(element("div", { dataMagicHref: "old.html" }), onUpdate)
		const input = screen.getByPlaceholderText("stylePanel.linkUrlPlaceholder")
		fireEvent.change(input, { target: { value: "new.html" } })
		fireEvent.blur(input)
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("stylePanel.linkUpdateFailed"),
		)
		expect(screen.getByPlaceholderText("stylePanel.linkUrlPlaceholder")).toHaveValue("old.html")
	})
})
