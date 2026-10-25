import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import { DOMTreePanel } from "../DOMTreePanel"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { success: vi.fn() },
}))

async function renderMovePanel() {
	const editor = {
		getDomTree: vi.fn().mockResolvedValue({
			root: {
				nodeId: "body",
				tagName: "body",
				label: "body",
				children: ["source", "first", "latest"].map((nodeId) => ({
					nodeId,
					tagName: "section",
					label: nodeId,
					children: [],
					editable: true,
					canHaveChildren: true,
					canDelete: true,
					canMove: true,
				})),
				editable: false,
				canHaveChildren: true,
				canDelete: false,
				canMove: false,
			},
		}),
		beginDomMovePreview: vi.fn().mockResolvedValue(undefined),
		previewDomMove: vi.fn<HTMLEditorV2Ref["previewDomMove"]>().mockResolvedValue(true),
		commitDomMovePreview: vi.fn().mockResolvedValue(undefined),
		cancelDomMovePreview: vi.fn().mockResolvedValue(undefined),
	}
	const dataTransfer = {
		effectAllowed: "",
		dropEffect: "",
		setData: vi.fn(),
		setDragImage: vi.fn(),
	}

	render(<DOMTreePanel editorRef={{ current: editor as never }} visible />)
	const source = await screen.findByTestId("dom-tree-drag-handle-source")
	const rows = {
		first: screen.getByTestId("dom-tree-node-first"),
		latest: screen.getByTestId("dom-tree-node-latest"),
	}
	for (const row of Object.values(rows)) {
		vi.spyOn(row, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 32, 100, 32))
	}

	return {
		editor,
		start: () => fireEvent.dragStart(source, { dataTransfer }),
		end: () => fireEvent.dragEnd(source, { dataTransfer }),
		hover: (node: keyof typeof rows, position: "before" | "inside" | "after" = "before") => {
			const event = createEvent.dragOver(rows[node], { dataTransfer })
			// jsdom does not provide DragEvent coordinates through the event initializer.
			Object.defineProperty(event, "clientY", {
				value: { before: 34, inside: 48, after: 62 }[position],
			})
			fireEvent(rows[node], event)
		},
		drop: (node: keyof typeof rows) => fireEvent.drop(rows[node], { dataTransfer }),
	}
}

describe("DOMTreePanel move preview finalization", () => {
	it.each(["before", "inside", "after"] as const)(
		"cancels when the final %s preview rejects a previously valid target",
		async (position) => {
			const { editor, start, hover, drop, end } = await renderMovePanel()
			editor.previewDomMove.mockResolvedValueOnce(true).mockResolvedValue(false)
			start()
			hover("first", position)
			await waitFor(() =>
				expect(editor.previewDomMove).toHaveBeenCalledWith("source", "first", position),
			)

			drop("first")
			end()

			expect(await screen.findByText("stylePanel.domTree.actionFailed")).toBeVisible()
			expect(editor.previewDomMove).toHaveBeenCalledTimes(2)
			expect(editor.cancelDomMovePreview).toHaveBeenCalledTimes(1)
			expect(editor.commitDomMovePreview).not.toHaveBeenCalled()
		},
	)

	it.each([
		{ target: "first", applied: false },
		{ target: "latest", applied: false },
		{ target: "first", applied: true },
		{ target: "latest", applied: true },
	] as const)(
		"rechecks $target after an in-flight preview and finalizes only when applied=$applied",
		async ({ target, applied }) => {
			const { editor, start, hover, drop, end } = await renderMovePanel()
			let resolvePreview!: (applied: boolean) => void
			const preview = new Promise<boolean>((resolve) => {
				resolvePreview = resolve
			})
			editor.previewDomMove.mockImplementationOnce(() => preview).mockResolvedValue(applied)
			start()
			hover("first")
			await waitFor(() => expect(editor.previewDomMove).toHaveBeenCalledTimes(1))
			if (target !== "first") hover(target)
			drop(target)
			end()
			expect(editor.commitDomMovePreview).not.toHaveBeenCalled()
			expect(editor.cancelDomMovePreview).not.toHaveBeenCalled()

			resolvePreview(true)

			if (applied) {
				await waitFor(() => expect(editor.commitDomMovePreview).toHaveBeenCalledTimes(1))
				expect(editor.cancelDomMovePreview).not.toHaveBeenCalled()
			} else {
				expect(await screen.findByText("stylePanel.domTree.actionFailed")).toBeVisible()
				expect(editor.cancelDomMovePreview).toHaveBeenCalledTimes(1)
				expect(editor.commitDomMovePreview).not.toHaveBeenCalled()
			}
			expect(editor.previewDomMove.mock.calls.length).toBeGreaterThan(1)
			expect(editor.previewDomMove).toHaveBeenLastCalledWith("source", target, "before")
		},
	)

	it("retries the same rejected hover target and commits after it becomes valid", async () => {
		const { editor, start, hover, drop } = await renderMovePanel()
		editor.previewDomMove.mockResolvedValueOnce(false)
		start()
		hover("first")
		await waitFor(() =>
			expect(screen.getByTestId("dom-tree-node-first")).toHaveAttribute(
				"data-drop-invalid",
				"true",
			),
		)

		hover("first")
		await waitFor(() => expect(editor.previewDomMove).toHaveBeenCalledTimes(2))
		drop("first")

		await waitFor(() => expect(editor.commitDomMovePreview).toHaveBeenCalledTimes(1))
		expect(editor.cancelDomMovePreview).not.toHaveBeenCalled()
	})
})
