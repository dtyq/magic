import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import type {
	HTMLEditorV2Ref,
	PPTBuildEntry,
	PPTBuildUpdate,
} from "../../../iframe-bridge/types/props"
import { PPTBuildPanel } from "../PPTBuildPanel"

const state = vi.hoisted(() => ({
	selectedElement: null as null | { selector: string },
	selectedSelectors: null as null | string[],
	history: { canUndo: false, canRedo: false },
	error: vi.fn(),
}))
vi.mock("../../../iframe-bridge/contexts/StylePanelContext", () => ({
	useStylePanelStore: () => ({
		historyState: state.history,
		getSelectedSelectors: () =>
			state.selectedSelectors ??
			(state.selectedElement ? [state.selectedElement.selector] : []),
	}),
}))
vi.mock("../../StylePanel/hooks/useSelectedElement", () => ({ useSelectedElement: () => state }))
vi.mock("@/components/base/MagicToaster/utils", () => ({ default: { error: state.error } }))
vi.mock("@/components/base/MagicTooltip", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))
vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const make = (selector: string, step: number): PPTBuildEntry => ({
	selector,
	label: selector,
	build: { step, effect: "fade" },
})
function setup(initial = [make("first", 1), make("second", 2)], onCommit?: () => Promise<boolean>) {
	let entries = initial
	let previous = entries
	const editor = {
		undo: vi.fn(async () => {
			entries = previous
		}),
		redo: vi.fn(async () => {}),
		previewPPTBuild: vi.fn(async () => {}),
		getPPTBuilds: vi.fn(async () => entries),
		setPPTBuildMarkers: vi.fn(async () => {}),
		selectElement: vi.fn(async () => {}),
		updatePPTBuilds: vi.fn(async (updates: PPTBuildUpdate[]) => {
			previous = entries
			for (const update of updates) {
				entries = entries.filter((e) => e.selector !== update.selector)
				if (update.build)
					entries.push({
						selector: update.selector,
						label: update.selector,
						build: update.build,
					})
			}
		}),
	}
	const editorRef = { current: editor as unknown as HTMLEditorV2Ref }
	const onClose = vi.fn()
	const view = render(
		<PPTBuildPanel
			editorRef={editorRef}
			contentRevision={0}
			onClose={onClose}
			onCommit={onCommit}
		/>,
	)
	return { editor, onClose, ...view }
}
beforeEach(() => {
	state.selectedElement = null
	state.selectedSelectors = null
	state.history = { canUndo: false, canRedo: false }
	state.error.mockClear()
})
afterEach(cleanup)
describe("PPT build panel", () => {
	it("persists browsing-mode changes and blocks close until saving finishes", async () => {
		let finish!: (saved: boolean) => void
		const onCommit = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					finish = resolve
				}),
		)
		const { editor } = setup(undefined, onCommit)
		await screen.findByRole("button", { name: "first ppt.build.fade" })
		fireEvent.click(screen.getAllByRole("button", { name: "ppt.build.remove" })[0])
		await waitFor(() => expect(onCommit).toHaveBeenCalledOnce())
		expect(screen.getByRole("button", { name: "ppt.build.close" })).toBeDisabled()
		finish(true)
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "first ppt.build.fade" }),
			).not.toBeInTheDocument(),
		)
		expect(editor.undo).not.toHaveBeenCalled()
	})
	it("rolls back an animation operation when persistence fails", async () => {
		const { editor } = setup(
			undefined,
			vi.fn(async () => false),
		)
		await screen.findByRole("button", { name: "first ppt.build.fade" })
		fireEvent.click(screen.getAllByRole("button", { name: "ppt.build.remove" })[0])
		await waitFor(() => expect(editor.undo).toHaveBeenCalledOnce())
		await waitFor(() => expect(state.error).toHaveBeenCalledWith("ppt.build.saveFailed"))
		expect(screen.getByRole("button", { name: "first ppt.build.fade" })).toBeInTheDocument()
	})
	it("shows ordered groups, selects the canvas element and disposes markers on close", async () => {
		const { editor, unmount, onClose } = setup()
		await screen.findByRole("button", { name: "first ppt.build.fade" })
		expect(editor.setPPTBuildMarkers).toHaveBeenCalledWith(true)
		fireEvent.click(screen.getByRole("button", { name: "first ppt.build.fade" }))
		expect(editor.selectElement).toHaveBeenCalledWith("first")
		fireEvent.click(screen.getByRole("button", { name: "ppt.build.close" }))
		expect(onClose).toHaveBeenCalledOnce()
		unmount()
		expect(editor.setPPTBuildMarkers).toHaveBeenLastCalledWith(false)
	})
	it("moves a whole step in one editor command", async () => {
		const { editor } = setup([make("a", 2), make("b", 2), make("c", 9)])
		await screen.findByRole("button", { name: "c ppt.build.fade" })
		fireEvent.click(screen.getAllByRole("button", { name: "ppt.build.moveUp" })[1])
		await waitFor(() => expect(editor.updatePPTBuilds).toHaveBeenCalledOnce())
		expect(
			editor.updatePPTBuilds.mock.calls[0][0].map((u) => [u.selector, u.build?.step]),
		).toEqual([
			["c", 1],
			["a", 2],
			["b", 2],
		])
	})
	it("adds selected elements and shows effect controls only for the selected queue item", async () => {
		state.selectedElement = { selector: "third" }
		const { editor } = setup()
		await screen.findByRole("button", { name: "first ppt.build.fade" })
		expect(screen.queryByRole("combobox", { name: "ppt.build.effect" })).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "ppt.build.addSelected" }))
		await screen.findByRole("combobox", { name: "ppt.build.effect" })
		expect(editor.updatePPTBuilds).toHaveBeenCalledWith([
			{ selector: "third", build: { step: 3, effect: "fade" } },
		])
		await waitFor(() =>
			expect(screen.getByRole("combobox", { name: "ppt.build.effect" })).not.toBeDisabled(),
		)
		fireEvent.change(screen.getByRole("combobox", { name: "ppt.build.effect" }), {
			target: { value: "appear" },
		})
		await waitFor(() =>
			expect(editor.updatePPTBuilds).toHaveBeenLastCalledWith([
				{ selector: "third", build: { step: 3, effect: "appear" } },
			]),
		)
	})
	it("keeps the old queue after failed edits and refreshes it on undo/content revisions", async () => {
		const { editor, rerender } = setup()
		await screen.findByRole("button", { name: "first ppt.build.fade" })
		editor.updatePPTBuilds.mockRejectedValueOnce(new Error("PPT_BUILD_INVALID"))
		fireEvent.click(screen.getAllByRole("button", { name: "ppt.build.remove" })[0])
		await waitFor(() => expect(state.error).toHaveBeenCalledWith("ppt.build.saveFailed"))
		expect(screen.getByRole("button", { name: "first ppt.build.fade" })).toBeInTheDocument()
		editor.getPPTBuilds.mockResolvedValueOnce([make("restored", 4)])
		rerender(
			<PPTBuildPanel
				editorRef={{ current: editor as unknown as HTMLEditorV2Ref }}
				contentRevision={1}
				onClose={() => {}}
			/>,
		)
		await screen.findByRole("button", { name: "restored ppt.build.fade" })
	})

	it("undoes and redoes through the editor and persists each result", async () => {
		const onCommit = vi.fn(async () => true)
		state.history = { canUndo: true, canRedo: true }
		const { editor } = setup(undefined, onCommit)
		await screen.findByText("first")
		fireEvent.click(screen.getByTestId("ppt-build-undo"))
		await waitFor(() => expect(editor.undo).toHaveBeenCalledTimes(1))
		await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1))
		fireEvent.click(screen.getByTestId("ppt-build-redo"))
		await waitFor(() => expect(editor.redo).toHaveBeenCalledTimes(1))
		await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2))
	})

	it("disables undo and redo when the editor has nothing to travel to", async () => {
		setup()
		await screen.findByText("first")
		expect(screen.getByTestId("ppt-build-undo")).toBeDisabled()
		expect(screen.getByTestId("ppt-build-redo")).toBeDisabled()
	})

	it("previews the canvas up to a step and exits the preview", async () => {
		const { editor } = setup()
		await screen.findByText("first")
		const buttons = screen.getAllByRole("button", { name: "ppt.build.previewStep" })
		fireEvent.click(buttons[1])
		await waitFor(() => expect(editor.previewPPTBuild).toHaveBeenLastCalledWith(2))
		fireEvent.click(screen.getByRole("button", { name: "ppt.build.stopPreview" }))
		await waitFor(() => expect(editor.previewPPTBuild).toHaveBeenLastCalledWith(null))
	})

	it("sets a whole step to play automatically", async () => {
		const { editor } = setup([make("a", 1), make("b", 1), make("c", 2)])
		await screen.findByText("a")
		const triggers = screen.getAllByRole("combobox", { name: /ppt.build.trigger/ })
		fireEvent.change(triggers[0], { target: { value: "1000" } })
		await waitFor(() =>
			expect(editor.updatePPTBuilds).toHaveBeenCalledWith([
				{ selector: "a", build: { step: 1, effect: "fade", after: 1000 } },
				{ selector: "b", build: { step: 1, effect: "fade", after: 1000 } },
			]),
		)
	})

	it("plays the steps on the canvas and stops on request", async () => {
		const { editor } = setup()
		await screen.findByText("first")
		fireEvent.click(screen.getByTestId("ppt-build-play"))
		await waitFor(() => expect(editor.previewPPTBuild).toHaveBeenCalledWith(0))
		fireEvent.click(screen.getByTestId("ppt-build-play"))
		await waitFor(() => expect(editor.previewPPTBuild).toHaveBeenLastCalledWith(null))
	})

	it("is read-only while the preview plays and only offers stopping", async () => {
		state.selectedElement = { selector: "third" }
		state.history = { canUndo: true, canRedo: true }
		const { editor } = setup()
		await screen.findByText("first")
		expect(screen.getByRole("button", { name: "ppt.build.addSelected" })).not.toBeDisabled()
		fireEvent.click(screen.getByTestId("ppt-build-play"))
		await waitFor(() => expect(editor.previewPPTBuild).toHaveBeenCalledWith(0))
		expect(screen.getByRole("button", { name: "ppt.build.addSelected" })).toBeDisabled()
		expect(screen.getByTestId("ppt-build-undo")).toBeDisabled()
		expect(screen.getByTestId("ppt-build-redo")).toBeDisabled()
		for (const button of screen.getAllByRole("button", { name: "ppt.build.remove" }))
			expect(button).toBeDisabled()
		for (const button of screen.getAllByRole("button", { name: "ppt.build.moveUp" }))
			expect(button).toBeDisabled()
		expect(screen.getByTestId("ppt-build-play")).not.toBeDisabled()
		fireEvent.click(screen.getByTestId("ppt-build-play"))
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "ppt.build.addSelected" }),
			).not.toBeDisabled(),
		)
	})

	it("adds several shift-selected elements as one step", async () => {
		state.selectedSelectors = ["x", "y", "first"]
		const { editor } = setup()
		await screen.findByText("first")
		// "first" is already in the queue, so only the two new elements are added.
		fireEvent.click(screen.getByRole("button", { name: "ppt.build.addSelectedMany" }))
		await waitFor(() =>
			expect(editor.updatePPTBuilds).toHaveBeenCalledWith([
				{ selector: "x", build: { step: 3, effect: "fade" } },
				{ selector: "y", build: { step: 3, effect: "fade" } },
			]),
		)
	})
})
