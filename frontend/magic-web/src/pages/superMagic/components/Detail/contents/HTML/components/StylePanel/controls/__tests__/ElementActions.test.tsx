import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ElementActions } from "../ElementActions"

const selection = vi.hoisted(() => ({
	selector: "section.hero",
	tagName: "section",
	position: "static",
	historyIndex: 0,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children, title }: { children: ReactNode; title: string }) => (
		<span data-tooltip-title={title}>{children}</span>
	),
}))

vi.mock("../../../../iframe-bridge/contexts/StylePanelContext", () => ({
	useStylePanelStore: () => ({
		historyState: { currentIndex: selection.historyIndex },
		selectedElement: {
			selector: selection.selector,
			tagName: selection.tagName,
			computedStyles: { position: selection.position },
		},
		getSelectedSelectors: () => [selection.selector],
	}),
}))

function createTree(canHaveChildren: boolean) {
	return {
		root: {
			nodeId: "body",
			selector: "body",
			tagName: "body",
			label: "body",
			children: [
				{
					nodeId: "selected",
					selector: selection.selector,
					tagName: selection.tagName,
					label: selection.tagName,
					children: [],
					editable: true,
					canHaveChildren,
					canDelete: true,
					canMove: true,
				},
			],
			editable: false,
			canHaveChildren: true,
			canDelete: false,
			canMove: false,
		},
	}
}

describe("ElementActions", () => {
	beforeEach(() => {
		selection.selector = "section.hero"
		selection.tagName = "section"
		selection.position = "static"
		selection.historyIndex = 0
	})

	it("shows text and image insertion controls for an editable node", async () => {
		const getDomTree = vi.fn().mockResolvedValue(createTree(true))

		render(<ElementActions editorRef={{ current: { getDomTree } } as never} />)

		expect(await screen.findByTestId("html-style-panel-add-element-button")).toBeInTheDocument()
		expect(
			await screen.findByTestId("html-style-panel-add-image-element-button"),
		).toBeInTheDocument()
		expect(
			screen.queryByTestId("html-style-panel-replace-image-button"),
		).not.toBeInTheDocument()
	})

	it("applies the motion wrapper to each visible action item", async () => {
		const getDomTree = vi.fn().mockResolvedValue(createTree(true))
		const itemMotion = vi.fn((children: ReactNode) => (
			<span data-testid="element-action-motion">{children}</span>
		))

		render(
			<ElementActions
				editorRef={{ current: { getDomTree } } as never}
				itemMotion={itemMotion}
			/>,
		)

		await screen.findByTestId("html-style-panel-add-element-button")
		expect(screen.getAllByTestId("element-action-motion")).toHaveLength(6)
		expect(
			screen
				.getByTestId("html-style-panel-add-element-button")
				.closest('[data-testid="element-action-motion"]'),
		).toBeInTheDocument()
		expect(
			screen
				.getByTestId("html-style-panel-delete-button")
				.closest('[data-testid="element-action-motion"]'),
		).toBeInTheDocument()
	})

	it("keeps structural actions visible while refreshing after a style history change", async () => {
		let resolveRefresh: ((tree: ReturnType<typeof createTree>) => void) | undefined
		const pendingRefresh = new Promise<ReturnType<typeof createTree>>((resolve) => {
			resolveRefresh = resolve
		})
		const getDomTree = vi
			.fn()
			.mockResolvedValueOnce(createTree(true))
			.mockReturnValueOnce(pendingRefresh)
		const editorRef = { current: { getDomTree } } as never
		const { rerender } = render(<ElementActions editorRef={editorRef} />)

		expect(await screen.findByTestId("html-style-panel-add-element-button")).toBeInTheDocument()

		selection.historyIndex = 1
		rerender(<ElementActions editorRef={editorRef} disabled />)

		expect(getDomTree).toHaveBeenCalledTimes(2)
		expect(screen.getByTestId("html-style-panel-add-element-button")).toBeInTheDocument()

		await act(async () => {
			resolveRefresh?.(createTree(true))
		})
	})

	it("keeps sibling insertion controls when the node cannot contain children", async () => {
		selection.selector = "span.label"
		selection.tagName = "span"
		const getDomTree = vi.fn().mockResolvedValue(createTree(false))

		render(<ElementActions editorRef={{ current: { getDomTree } } as never} />)

		await waitFor(() => expect(getDomTree).toHaveBeenCalled())
		expect(screen.getByTestId("html-style-panel-add-element-button")).toBeInTheDocument()
		expect(screen.getByTestId("html-style-panel-add-image-element-button")).toBeInTheDocument()
		expect(
			screen.queryByTestId("html-style-panel-replace-image-button"),
		).not.toBeInTheDocument()
	})

	it("shows replace image only for an image node", async () => {
		selection.selector = "img.hero"
		selection.tagName = "img"
		const getDomTree = vi.fn().mockResolvedValue(createTree(false))

		render(<ElementActions editorRef={{ current: { getDomTree } } as never} />)

		expect(screen.getByTestId("html-style-panel-replace-image-button")).toBeInTheDocument()
		await waitFor(() => expect(getDomTree).toHaveBeenCalled())
		expect(screen.getByTestId("html-style-panel-add-element-button")).toBeInTheDocument()
	})

	it("opens an in-page dialog instead of the browser prompt for text insertion", async () => {
		const getDomTree = vi.fn().mockResolvedValue(createTree(true))
		const insertTextNode = vi.fn().mockResolvedValue(undefined)
		const promptSpy = vi.spyOn(window, "prompt")

		render(<ElementActions editorRef={{ current: { getDomTree, insertTextNode } } as never} />)

		fireEvent.click(await screen.findByTestId("html-style-panel-add-element-button"))
		expect(await screen.findByTestId("html-style-panel-add-element-menu")).toBeInTheDocument()
		fireEvent.click(await screen.findByTestId("html-style-panel-add-element-inside-item"))

		expect(await screen.findByTestId("html-style-panel-add-text-dialog")).toBeInTheDocument()
		expect(promptSpy).not.toHaveBeenCalled()
		const input = screen.getByTestId("html-style-panel-add-text-input")
		const confirmButton = screen.getByTestId("html-style-panel-add-text-confirm-button")
		expect(screen.getByTestId("html-style-panel-add-text-cancel-button")).toBeInTheDocument()
		expect(confirmButton).toBeDisabled()

		fireEvent.change(input, { target: { value: "New content" } })
		expect(confirmButton).toBeEnabled()
		fireEvent.click(confirmButton)

		await waitFor(() => expect(insertTextNode).toHaveBeenCalledWith("selected", "New content"))
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		promptSpy.mockRestore()
	})

	it("closes the text dialog without inserting when cancelled", async () => {
		const getDomTree = vi.fn().mockResolvedValue(createTree(true))
		const insertTextNode = vi.fn().mockResolvedValue(undefined)

		render(<ElementActions editorRef={{ current: { getDomTree, insertTextNode } } as never} />)

		fireEvent.click(await screen.findByTestId("html-style-panel-add-element-button"))
		fireEvent.click(await screen.findByText("stylePanel.domTree.insertInside"))
		fireEvent.click(
			await screen.findByRole("button", {
				name: "stylePanel.domTree.addTextDialog.cancel",
			}),
		)

		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		expect(insertTextNode).not.toHaveBeenCalled()
	})

	it("inserts text before the selected node when that placement is chosen", async () => {
		const getDomTree = vi.fn().mockResolvedValue({
			root: {
				...createTree(true).root,
				children: [
					{
						nodeId: "first",
						selector: "section.first",
						tagName: "section",
						label: "section.first",
						children: [],
						editable: true,
						canHaveChildren: true,
						canDelete: true,
						canMove: true,
					},
					createTree(true).root.children[0],
				],
			},
		})
		const insertTextNode = vi.fn().mockResolvedValue(undefined)

		render(<ElementActions editorRef={{ current: { getDomTree, insertTextNode } } as never} />)

		fireEvent.click(await screen.findByTestId("html-style-panel-add-element-button"))
		fireEvent.click(await screen.findByText("stylePanel.domTree.insertBefore"))
		const input = await screen.findByRole("textbox", {
			name: "stylePanel.domTree.addTextDialog.inputLabel",
		})
		fireEvent.change(input, { target: { value: "Before content" } })
		fireEvent.click(
			screen.getByRole("button", {
				name: "stylePanel.domTree.addTextDialog.confirm",
			}),
		)

		await waitFor(() =>
			expect(insertTextNode).toHaveBeenCalledWith("body", "Before content", 1),
		)
	})

	it("moves the selected node within its parent like the DOM tree", async () => {
		const getDomTree = vi.fn().mockResolvedValue({
			root: {
				nodeId: "body",
				selector: "body",
				tagName: "body",
				label: "body",
				children: [
					{
						nodeId: "first",
						selector: "section.first",
						tagName: "section",
						label: "section.first",
						children: [],
						editable: true,
						canHaveChildren: true,
						canDelete: true,
						canMove: true,
					},
					{
						nodeId: "selected",
						selector: selection.selector,
						tagName: selection.tagName,
						label: selection.tagName,
						children: [],
						editable: true,
						canHaveChildren: true,
						canDelete: true,
						canMove: true,
					},
					{
						nodeId: "last",
						selector: "section.last",
						tagName: "section",
						label: "section.last",
						children: [],
						editable: true,
						canHaveChildren: true,
						canDelete: true,
						canMove: true,
					},
				],
				editable: false,
				canHaveChildren: true,
				canDelete: false,
				canMove: false,
			},
		})
		const moveDomNode = vi.fn().mockResolvedValue(undefined)

		render(<ElementActions editorRef={{ current: { getDomTree, moveDomNode } } as never} />)

		const moveUp = await screen.findByTestId("html-style-panel-move-up-button")
		const moveDown = screen.getByTestId("html-style-panel-move-down-button")
		expect(moveUp).toBeEnabled()
		expect(moveDown).toBeEnabled()

		fireEvent.click(moveUp)
		await waitFor(() => expect(moveDomNode).toHaveBeenCalledWith("selected", "body", 0))

		fireEvent.click(moveDown)
		await waitFor(() => expect(moveDomNode).toHaveBeenCalledWith("selected", "body", 3))
	})

	it("keeps moving down available when the selector changes after moving", async () => {
		const createSibling = (nodeId: string, selector: string) => ({
			nodeId,
			selector,
			tagName: "section",
			label: selector,
			children: [],
			editable: true,
			canHaveChildren: true,
			canDelete: true,
			canMove: true,
		})
		const createTreeWithChildren = (children: ReturnType<typeof createSibling>[]) => ({
			root: {
				nodeId: "body",
				selector: "body",
				tagName: "body",
				label: "body",
				children,
				editable: false,
				canHaveChildren: true,
				canDelete: false,
				canMove: false,
			},
		})
		const initialTree = createTreeWithChildren([
			createSibling("first", "section:nth-of-type(1)"),
			createSibling("selected", selection.selector),
			createSibling("third", "section:nth-of-type(3)"),
			createSibling("last", "section:nth-of-type(4)"),
		])
		const movedTree = createTreeWithChildren([
			createSibling("first", "section:nth-of-type(1)"),
			createSibling("third", "section:nth-of-type(2)"),
			createSibling("selected", "section:nth-of-type(3)"),
			createSibling("last", "section:nth-of-type(4)"),
		])
		const getDomTree = vi
			.fn()
			.mockResolvedValueOnce(initialTree)
			.mockResolvedValueOnce(initialTree)
			.mockResolvedValueOnce(movedTree)
		const moveDomNode = vi.fn().mockResolvedValue(undefined)

		render(<ElementActions editorRef={{ current: { getDomTree, moveDomNode } } as never} />)

		const moveDown = await screen.findByTestId("html-style-panel-move-down-button")
		expect(moveDown).toBeEnabled()

		fireEvent.click(moveDown)
		await waitFor(() => expect(moveDomNode).toHaveBeenCalledWith("selected", "body", 3))
		expect(moveDown).toBeEnabled()
	})

	it.each(["absolute", "fixed"])(
		"hides DOM-order actions for an element using position: %s",
		async (position) => {
			selection.position = position
			const getDomTree = vi.fn().mockResolvedValue({
				root: {
					...createTree(true).root,
					children: [
						{
							...createTree(true).root.children[0],
							nodeId: "first",
							selector: ".first",
						},
						createTree(true).root.children[0],
						{ ...createTree(true).root.children[0], nodeId: "last", selector: ".last" },
					],
				},
			})
			const moveDomNode = vi.fn().mockResolvedValue(undefined)

			render(<ElementActions editorRef={{ current: { getDomTree, moveDomNode } } as never} />)

			await waitFor(() => expect(getDomTree).toHaveBeenCalled())
			expect(screen.queryByTestId("html-style-panel-move-up-button")).not.toBeInTheDocument()
			expect(
				screen.queryByTestId("html-style-panel-move-down-button"),
			).not.toBeInTheDocument()
			expect(moveDomNode).not.toHaveBeenCalled()
		},
	)
})
