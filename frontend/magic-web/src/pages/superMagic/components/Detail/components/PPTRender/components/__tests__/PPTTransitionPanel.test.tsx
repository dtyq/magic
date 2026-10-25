import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import PPTTransitionPanel from "../PPTTransitionPanel"
import PPTTransitionPreview from "../PPTTransitionPreview"
import { OverlayZIndexProvider } from "@/utils/overlayZIndex"

const { animate, cancel } = vi.hoisted(() => ({ animate: vi.fn(), cancel: vi.fn() }))
const layout = vi.hoisted(() => ({ mobile: false, reducedMotion: true }))
vi.mock("../../utils/pptTransitionAnimation", () => ({ animatePPTTransition: animate }))
vi.mock("../../../../contents/HTML/IsolatedHTMLRenderer", async () => {
	const { useEffect } = await import("react")
	return {
		default: function MockIsolatedHTMLRenderer({
			content,
			onRenderReady,
		}: {
			content: string
			onRenderReady: () => void
		}) {
			useEffect(() => onRenderReady(), [content, onRenderReady])
			return <div>{content}</div>
		},
	}
})

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => layout.mobile }))
vi.mock("framer-motion", async (importOriginal) => ({
	...(await importOriginal<typeof import("framer-motion")>()),
	useReducedMotion: () => layout.reducedMotion,
}))

const base = {
	open: true,
	deckKey: "deck-a",
	activePath: "a.html",
	selectedPaths: [],
	slides: [{ path: "a.html", label: "A" }],
	config: undefined,
	busy: false,
	previewSource: {
		current: { id: "a", path: "a.html", index: 0, content: "Actual selected slide" },
	},
	onOpenChange: vi.fn(),
}

describe("PPTTransitionPanel", () => {
	const originalScrollIntoView = Object.getOwnPropertyDescriptor(
		HTMLElement.prototype,
		"scrollIntoView",
	)
	beforeAll(() => {
		// jsdom has no layout scrolling; Radix focuses the opened scope option with it.
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: vi.fn(),
		})
	})
	afterAll(() => {
		if (originalScrollIntoView)
			Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView)
		else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
	})
	beforeEach(() => {
		layout.mobile = false
		layout.reducedMotion = true
	})

	it("stays in its parent layout and restores entry focus after Escape", () => {
		const onOpenChange = vi.fn()
		const view = (open: boolean) => (
			<div>
				<button>open panel</button>
				<PPTTransitionPanel
					{...base}
					open={open}
					onOpenChange={onOpenChange}
					onSave={vi.fn()}
				/>
			</div>
		)
		const { container, rerender } = render(view(false))
		const opener = screen.getByRole("button", { name: "open panel" })
		opener.focus()
		rerender(view(true))
		const panel = screen.getByRole("complementary", { name: "ppt.transitions.title" })
		expect(container).toContainElement(panel)
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeInTheDocument()
		expect(within(panel).getByRole("button", { name: "ppt.transitions.close" })).toHaveFocus()
		fireEvent.keyDown(panel, { key: "Escape" })
		expect(onOpenChange).toHaveBeenCalledWith(false)
		rerender(view(false))
		expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
		expect(opener).toHaveFocus()
	})

	it("uses a bounded inline bottom section on mobile", () => {
		layout.mobile = true
		const { container } = render(<PPTTransitionPanel {...base} onSave={vi.fn()} />)
		const panel = screen.getByRole("complementary", { name: "ppt.transitions.title" })
		expect(container).toContainElement(panel)
		expect(panel).toHaveClass("h-[45%]", "max-h-[360px]", "w-full", "border-t")
		expect(panel).not.toHaveAttribute("aria-modal")
	})

	it.each([false, true])(
		"keeps scope options outside the scroller in the preview tree (mobile=%s)",
		(mobile) => {
			layout.mobile = mobile
			const onOpenChange = vi.fn()
			render(
				<OverlayZIndexProvider value={1010}>
					<PPTTransitionPanel {...base} onOpenChange={onOpenChange} onSave={vi.fn()} />
				</OverlayZIndexProvider>,
			)
			const panel = screen.getByRole("complementary")
			const trigger = screen.getByRole("combobox", { name: "ppt.transitions.scope" })
			fireEvent.keyDown(trigger, { key: "ArrowDown" })
			const options = screen.getByRole("listbox", { hidden: true })
			expect(panel).toContainElement(options)
			expect(options.closest('[data-slot="scroll-area-viewport"]')).toBeNull()
			expect(options.style.zIndex).toBe("1020")
			fireEvent.keyDown(options, { key: "Escape" })
			expect(screen.queryByRole("listbox", { hidden: true })).not.toBeInTheDocument()
			expect(onOpenChange).not.toHaveBeenCalled()
			fireEvent.keyDown(trigger, { key: "ArrowDown" })
			fireEvent.keyDown(
				within(screen.getByRole("listbox", { hidden: true })).getByRole("option", {
					name: "ppt.transitions.all",
					hidden: true,
				}),
				{ key: "Enter" },
			)
			expect(screen.queryByRole("listbox", { hidden: true })).not.toBeInTheDocument()
			expect(trigger).toHaveTextContent("ppt.transitions.all")
		},
	)

	it("uses shared animation only for explicit preview requests", () => {
		animate.mockReset()
		cancel.mockReset()
		animate.mockReturnValue({ cancel, finished: new Promise(() => undefined) })
		const transition = { effect: "fade" as const, duration_ms: 400 }
		const { rerender, unmount } = render(
			<PPTTransitionPreview
				source={base.previewSource}
				transition={transition}
				run={0}
				reducedMotion={false}
			/>,
		)
		expect(animate).not.toHaveBeenCalled()
		rerender(
			<PPTTransitionPreview
				source={base.previewSource}
				transition={transition}
				run={1}
				reducedMotion={false}
			/>,
		)
		expect(animate).toHaveBeenCalledTimes(1)
		rerender(
			<PPTTransitionPreview
				source={base.previewSource}
				transition={transition}
				run={1}
				reducedMotion
			/>,
		)
		expect(cancel).toHaveBeenCalledTimes(1)
		rerender(
			<PPTTransitionPreview
				source={base.previewSource}
				transition={transition}
				run={1}
				reducedMotion={false}
			/>,
		)
		expect(animate).toHaveBeenCalledTimes(1)
		unmount()
		render(
			<PPTTransitionPreview
				source={base.previewSource}
				transition={transition}
				run={1}
				reducedMotion={false}
			/>,
		)
		expect(animate).toHaveBeenCalledTimes(1)
	})

	it("allows duration input to be cleared before entering a new valid value", async () => {
		const onSave = vi.fn().mockResolvedValue(true)
		render(<PPTTransitionPanel {...base} onSave={onSave} />)
		fireEvent.click(screen.getByRole("button", { name: "ppt.transitions.fade" }))
		const duration = screen.getByLabelText("ppt.transitions.duration")
		fireEvent.change(duration, { target: { value: "" } })
		expect(duration).toHaveValue(null)
		fireEvent.change(duration, { target: { value: "0.75" } })
		fireEvent.blur(duration)
		fireEvent.click(screen.getByRole("button", { name: "ppt.transitions.save" }))
		await waitFor(() =>
			expect(onSave).toHaveBeenCalledWith(
				expect.objectContaining({
					transition: expect.objectContaining({ duration_ms: 750 }),
				}),
			),
		)
	})
	it("previews the current selected page's settings when it is not the first batch target", () => {
		layout.reducedMotion = false
		animate.mockReset()
		animate.mockReturnValue({ cancel, finished: new Promise(() => undefined) })
		const currentTransition = { effect: "fade", duration_ms: 400, easing: "linear" }
		render(
			<PPTTransitionPanel
				{...base}
				initialScope="selected"
				selectedPaths={["b.html", "a.html"]}
				slides={[...base.slides, { path: "b.html", label: "Other slide" }]}
				config={{ slides: { "a.html": currentTransition, "b.html": { effect: "none" } } }}
				onSave={vi.fn()}
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: "ppt.transitions.preview" }))
		expect(animate).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			expect.any(HTMLElement),
			currentTransition,
		)
	})
	it("disables preview until the selected page is available without blocking configuration", () => {
		render(<PPTTransitionPanel {...base} previewSource={undefined} onSave={vi.fn()} />)
		expect(screen.getByRole("button", { name: "ppt.transitions.preview" })).toBeDisabled()
		expect(screen.getByRole("button", { name: "ppt.transitions.fade" })).toBeEnabled()
	})
	it("previews a draft without saving and strips parameters when choosing none", async () => {
		const onSave = vi.fn().mockResolvedValue(true)
		render(<PPTTransitionPanel {...base} onSave={onSave} />)
		fireEvent.click(screen.getByRole("button", { name: "ppt.transitions.push" }))
		expect(screen.getByLabelText("ppt.transitions.duration")).toHaveValue(0.45)
		fireEvent.click(screen.getByRole("button", { name: "ppt.transitions.preview" }))
		expect(onSave).not.toHaveBeenCalled()
		expect(screen.getByText("ppt.transitions.previewCurrent")).toBeInTheDocument()
		expect(screen.getByText("ppt.transitions.reducedMotion")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "ppt.transitions.none" }))
		expect(screen.queryByLabelText("ppt.transitions.duration")).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "ppt.transitions.save" }))
		await waitFor(() =>
			expect(onSave).toHaveBeenCalledWith(
				expect.objectContaining({ transition: { effect: "none" } }),
			),
		)
	})
	it("keeps failed edits in the close confirmation and lets the user cancel", async () => {
		const onOpenChange = vi.fn()
		render(
			<PPTTransitionPanel
				{...base}
				onOpenChange={onOpenChange}
				onSave={vi.fn().mockResolvedValue(false)}
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: "ppt.transitions.fade" }))
		fireEvent.click(screen.getByRole("button", { name: "ppt.transitions.close" }))
		const confirm = screen.getByRole("alertdialog")
		fireEvent.click(within(confirm).getByRole("button", { name: "ppt.transitions.save" }))
		await waitFor(() =>
			expect(
				within(confirm).getByRole("button", { name: "ppt.transitions.save" }),
			).toBeEnabled(),
		)
		expect(screen.getByRole("alertdialog")).toBeInTheDocument()
		expect(onOpenChange).not.toHaveBeenCalled()
		fireEvent.click(within(confirm).getByRole("button", { name: "common.cancel" }))
		await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
		expect(screen.getByRole("button", { name: "ppt.transitions.fade" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
	})
})
