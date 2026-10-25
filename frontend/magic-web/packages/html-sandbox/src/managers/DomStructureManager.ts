import type { CommandHistory } from "../core/CommandHistory"
import type { CommandRecord } from "../core/types"
import type { ElementSelector } from "../features/ElementSelector"
import {
	EDITOR_NODE_ID_ATTRIBUTE,
	assignEditorNodeIds,
	assignUniqueIdsToClone,
	buildDomTree,
	ensureEditableNode,
	findNodeById,
	insertAtElementIndex,
	resetEditorNodeIds,
} from "../features/domTree"
import { EditorLogger } from "../utils/EditorLogger"
import { findElement } from "../utils/ElementSelector"
import { getElementSelector } from "../utils/dom"

const DOM_COMMAND_TYPES = new Set([
	"MOVE_DOM_NODE",
	"DUPLICATE_DOM_NODE",
	"INSERT_TEXT_NODE",
	"CUT_DOM_NODE",
	"PASTE_DOM_NODE",
])

interface MovePayload {
	nodeId: string
	targetParentId: string
	targetIndex: number
	selector: string
}

interface MovePreviousState {
	nodeId: string
	parentId: string
	parentSelector: string
	index: number
	html: string
}

type DomMovePreviewPosition = "before" | "inside" | "after"

interface DomMovePreviewState {
	nodeId: string
	element: HTMLElement
	originalParent: HTMLElement
	originalParentId: string
	originalParentSelector: string
	originalIndex: number
	originalHtml: string
}

interface InsertTextPayload {
	nodeId: string
	parentId: string
	index: number
	html: string
}

interface InsertTextPreviousState {
	parentId: string
}

interface ClipboardState {
	html: string
	sourceNodeId: string
	mode: "copy" | "cut"
}

interface CutPayload {
	nodeId: string
	parentId: string
	index: number
	html: string
}

interface CutPreviousState {
	parentId: string
	index: number
	html: string
	nodeId: string
}

interface PastePayload {
	nodeId: string
	parentId: string
	index: number
	html: string
}

interface PastePreviousState {
	parentId: string
}

interface DuplicatePayload {
	sourceNodeId: string
	duplicatedNodeId: string
	parentId: string
	index: number
	html: string
}

interface DuplicatePreviousState {
	duplicatedNodeId: string
}

function resolveMovePreviewParent(preview: DomMovePreviewState): HTMLElement | null {
	if (preview.originalParent.isConnected) return preview.originalParent
	if (preview.originalParentId) {
		try {
			return findNodeById(preview.originalParentId)
		} catch {
			// Fall through to the stored selector.
		}
	}
	if (!preview.originalParentSelector) return null
	try {
		return findElement(preview.originalParentSelector)
	} catch {
		return null
	}
}

export class DomStructureManager {
	private readonly commandHistory: CommandHistory
	private readonly elementSelector: ElementSelector
	private clipboard: ClipboardState | null = null
	private domMovePreview: DomMovePreviewState | null = null

	constructor(commandHistory: CommandHistory, elementSelector: ElementSelector) {
		this.commandHistory = commandHistory
		this.elementSelector = elementSelector
	}

	getTree() {
		return {
			...buildDomTree(),
			clipboard: this.clipboard
				? { hasContent: true, mode: this.clipboard.mode }
				: { hasContent: false },
		}
	}

	selectNode(nodeId: string): void {
		const element = findNodeById(nodeId)
		this.elementSelector.selectElement(element)
	}

	hoverNode(nodeId: string): void {
		this.elementSelector.hoverElement(findNodeById(nodeId))
	}

	clearHoveredNode(): void {
		this.elementSelector.clearHoveredElement()
	}

	copyNode(nodeId: string): void {
		const element = findNodeById(nodeId)
		ensureEditableNode(element, "复制节点")
		this.clipboard = {
			html: element.outerHTML,
			sourceNodeId: nodeId,
			mode: "copy",
		}
	}

	async cutNode(nodeId: string): Promise<void> {
		const element = findNodeById(nodeId)
		ensureEditableNode(element, "剪切节点")
		const parent = element.parentElement
		if (!parent) throw new Error("节点缺少父节点")
		const index = Array.from(parent.children).indexOf(element)
		const html = element.outerHTML
		this.clipboard = { html, sourceNodeId: nodeId, mode: "cut" }
		element.remove()
		this.elementSelector.clearSelection()
		this.commandHistory.push({
			commandType: "CUT_DOM_NODE",
			payload: {
				nodeId,
				parentId: parent.getAttribute(EDITOR_NODE_ID_ATTRIBUTE) || "",
				index,
				html,
			} satisfies CutPayload,
			previousState: {
				parentId: parent.getAttribute(EDITOR_NODE_ID_ATTRIBUTE) || "",
				index,
				html,
				nodeId,
			} satisfies CutPreviousState,
			timestamp: Date.now(),
			metadata: { canUndo: true, description: "剪切 DOM 节点" },
		})
	}

	async pasteNode(targetParentId: string, targetIndex?: number): Promise<void> {
		if (!this.clipboard) throw new Error("剪贴板为空")
		const parent = findNodeById(targetParentId)
		this.ensureParentNode(parent)
		const wrapper = document.createElement("div")
		wrapper.innerHTML = this.clipboard.html
		const element = wrapper.firstElementChild
		if (!(element instanceof HTMLElement)) throw new Error("剪贴板内容无效")
		assignUniqueIdsToClone(element)
		resetEditorNodeIds(element)
		const nodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		element.setAttribute(EDITOR_NODE_ID_ATTRIBUTE, nodeId)
		const index = insertAtElementIndex(parent, element, targetIndex)
		this.commandHistory.push({
			commandType: "PASTE_DOM_NODE",
			payload: {
				nodeId,
				parentId: targetParentId,
				index,
				html: element.outerHTML,
			} satisfies PastePayload,
			previousState: { parentId: targetParentId } satisfies PastePreviousState,
			timestamp: Date.now(),
			metadata: { canUndo: true, description: "粘贴 DOM 节点" },
		})
		this.elementSelector.selectElement(element)
		if (this.clipboard.mode === "cut") this.clipboard = null
	}

	async duplicateNode(nodeId: string): Promise<void> {
		const source = findNodeById(nodeId)
		ensureEditableNode(source, "复制节点")
		const parent = source.parentElement
		if (!parent) throw new Error("节点缺少父节点")

		const clone = source.cloneNode(true) as HTMLElement
		assignUniqueIdsToClone(clone)
		resetEditorNodeIds(clone)
		assignEditorNodeIds(clone)
		const duplicatedNodeId = clone.getAttribute(EDITOR_NODE_ID_ATTRIBUTE)
		if (!duplicatedNodeId) throw new Error("复制节点标识生成失败")
		const index = Array.from(parent.children).indexOf(source) + 1
		insertAtElementIndex(parent, clone, index)

		this.commandHistory.push({
			commandType: "DUPLICATE_DOM_NODE",
			payload: {
				sourceNodeId: nodeId,
				duplicatedNodeId,
				parentId: parent.getAttribute(EDITOR_NODE_ID_ATTRIBUTE) || "",
				index,
				html: clone.outerHTML,
			} satisfies DuplicatePayload,
			previousState: { duplicatedNodeId } satisfies DuplicatePreviousState,
			timestamp: Date.now(),
			metadata: { canUndo: true, description: "复制 DOM 节点" },
		})
		this.elementSelector.selectElement(clone)
	}

	scrollToNode(nodeId: string): void {
		const element = findNodeById(nodeId)
		element.scrollIntoView({ block: "nearest", inline: "nearest" })
	}

	async moveNode(nodeId: string, targetParentId: string, targetIndex: number): Promise<void> {
		const element = findNodeById(nodeId)
		const targetParent = findNodeById(targetParentId)
		ensureEditableNode(element, "移动节点")
		this.validateMoveTarget(element, targetParent)

		const parent = element.parentElement
		if (!parent) throw new Error("节点缺少父节点")
		const index = Array.from(parent.children).indexOf(element)
		const previousState: MovePreviousState = {
			nodeId,
			parentId: parent.getAttribute(EDITOR_NODE_ID_ATTRIBUTE) || "",
			parentSelector: getElementSelector(parent),
			index,
			html: element.outerHTML,
		}

		this.moveElement(element, targetParent, targetIndex)
		const finalIndex = Array.from(targetParent.children).indexOf(element)
		const payload: MovePayload = {
			nodeId,
			targetParentId,
			targetIndex: finalIndex,
			selector: getElementSelector(element),
		}

		this.commandHistory.push({
			commandType: "MOVE_DOM_NODE",
			payload,
			previousState,
			timestamp: Date.now(),
			metadata: { canUndo: true, description: "调整 DOM 层级" },
		})
		this.elementSelector.selectElement(element)
	}

	beginMovePreview(nodeId: string): void {
		if (this.domMovePreview) this.cancelMovePreview()

		const element = findNodeById(nodeId)
		ensureEditableNode(element, "移动节点")
		const parent = element.parentElement
		if (!parent) throw new Error("节点缺少父节点")

		this.domMovePreview = {
			nodeId,
			element,
			originalParent: parent,
			originalParentId: parent.getAttribute(EDITOR_NODE_ID_ATTRIBUTE) || "",
			originalParentSelector: getElementSelector(parent),
			originalIndex: Array.from(parent.children).indexOf(element),
			originalHtml: element.outerHTML,
		}
	}

	previewMove(nodeId: string, targetNodeId: string, position: DomMovePreviewPosition): boolean {
		const preview = this.domMovePreview
		if (!preview || preview.nodeId !== nodeId) throw new Error("DOM 移动预览未开始")

		const element = findNodeById(nodeId)
		const target = findNodeById(targetNodeId)
		if (element === target) return false

		const resolvedTargetParent = position === "inside" ? target : target.parentElement
		if (!resolvedTargetParent) return false
		if (resolvedTargetParent === element || element.contains(resolvedTargetParent)) return false
		try {
			this.validateMoveTarget(element, resolvedTargetParent)
		} catch {
			return false
		}

		let targetParent: HTMLElement
		let targetIndex: number
		if (position === "inside") {
			targetParent = target
			targetIndex = targetParent.children.length
		} else {
			targetParent = resolvedTargetParent
			targetIndex = Array.from(targetParent.children).indexOf(target)
			if (position === "after") targetIndex += 1
		}

		this.moveElement(element, targetParent, targetIndex)
		return true
	}

	commitMovePreview(): void {
		const preview = this.domMovePreview
		if (!preview) return

		try {
			const parent = preview.element.parentElement
			if (!parent) throw new Error("预览节点缺少父节点")
			const index = Array.from(parent.children).indexOf(preview.element)
			const originalLocation =
				parent === preview.originalParent && index === preview.originalIndex

			if (!originalLocation) {
				const parentId = parent.getAttribute(EDITOR_NODE_ID_ATTRIBUTE) || ""
				this.commandHistory.push({
					commandType: "MOVE_DOM_NODE",
					payload: {
						nodeId: preview.nodeId,
						targetParentId: parentId,
						targetIndex: index,
						selector: getElementSelector(preview.element),
					} satisfies MovePayload,
					previousState: {
						nodeId: preview.nodeId,
						parentId: preview.originalParentId,
						parentSelector: preview.originalParentSelector,
						index: preview.originalIndex,
						html: preview.originalHtml,
					} satisfies MovePreviousState,
					timestamp: Date.now(),
					metadata: { canUndo: true, description: "调整 DOM 层级" },
				})
				this.elementSelector.selectElement(preview.element)
			}
		} finally {
			this.domMovePreview = null
		}
	}

	cancelMovePreview(): void {
		const preview = this.domMovePreview
		if (!preview) return

		try {
			const originalParent = resolveMovePreviewParent(preview)
			if (!originalParent) {
				EditorLogger.warn("Cannot restore DOM move preview; original parent is gone", {
					nodeId: preview.nodeId,
					originalParentId: preview.originalParentId,
				})
				return
			}
			preview.element.remove()
			insertAtElementIndex(originalParent, preview.element, preview.originalIndex)
		} finally {
			this.domMovePreview = null
		}
	}

	private validateMoveTarget(element: HTMLElement, targetParent: HTMLElement | null): void {
		if (!targetParent) throw new Error("目标节点缺少父节点")
		this.ensureParentNode(targetParent)
		if (targetParent === element || element.contains(targetParent)) {
			throw new Error("不能将节点移动到自身或后代节点中")
		}
	}

	private moveElement(
		element: HTMLElement,
		targetParent: HTMLElement,
		targetIndex: number,
	): void {
		const currentParent = element.parentElement
		if (!currentParent) throw new Error("节点缺少父节点")
		const currentIndex = Array.from(currentParent.children).indexOf(element)
		element.remove()
		const normalizedIndex =
			currentParent === targetParent && currentIndex < targetIndex
				? targetIndex - 1
				: targetIndex
		insertAtElementIndex(targetParent, element, normalizedIndex)
	}

	async insertTextNode(parentNodeId: string, textContent: string, index?: number): Promise<void> {
		const parent = findNodeById(parentNodeId)
		this.ensureParentNode(parent)
		if (!textContent.trim()) throw new Error("文字内容不能为空")

		const element = document.createElement("p")
		element.textContent = textContent
		const nodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		element.setAttribute(EDITOR_NODE_ID_ATTRIBUTE, nodeId)
		const finalIndex = insertAtElementIndex(parent, element, index)
		const html = element.outerHTML

		this.commandHistory.push({
			commandType: "INSERT_TEXT_NODE",
			payload: {
				nodeId,
				parentId: parentNodeId,
				index: finalIndex,
				html,
			} satisfies InsertTextPayload,
			previousState: { parentId: parentNodeId } satisfies InsertTextPreviousState,
			timestamp: Date.now(),
			metadata: { canUndo: true, description: "新增文字" },
		})
		this.elementSelector.selectElement(element)
	}

	private ensureParentNode(element: HTMLElement): void {
		const tagName = element.tagName.toLowerCase()
		if (element.getAttribute("data-injected") === "true") {
			throw new Error("运行时节点不可作为父节点")
		}
		if (["img", "input", "br", "hr", "meta", "link"].includes(tagName)) {
			throw new Error("该节点不能包含子节点")
		}
	}

	canHandleCommand(commandType: string): boolean {
		return DOM_COMMAND_TYPES.has(commandType)
	}

	restoreCommand(command: CommandRecord): boolean {
		if (!this.canHandleCommand(command.commandType)) return false

		try {
			if (command.commandType === "DUPLICATE_DOM_NODE") {
				const previous = command.previousState as DuplicatePreviousState
				findNodeById(previous.duplicatedNodeId).remove()
				this.elementSelector.clearSelection()
				return true
			}
			if (command.commandType === "MOVE_DOM_NODE") {
				const previous = command.previousState as MovePreviousState
				const element = findNodeById(previous.nodeId)
				let parent: HTMLElement
				try {
					parent = findNodeById(previous.parentId)
				} catch {
					parent = findElement(previous.parentSelector)
				}
				insertAtElementIndex(parent, element, previous.index)
				this.elementSelector.selectElement(element)
				return true
			}

			if (command.commandType === "CUT_DOM_NODE") {
				const previous = command.previousState as CutPreviousState
				const parent = findNodeById(previous.parentId)
				const wrapper = document.createElement("div")
				wrapper.innerHTML = previous.html
				const element = wrapper.firstElementChild
				if (!(element instanceof HTMLElement)) return false
				resetEditorNodeIds(element)
				element.setAttribute(EDITOR_NODE_ID_ATTRIBUTE, previous.nodeId)
				insertAtElementIndex(parent, element, previous.index)
				this.elementSelector.selectElement(element)
				return true
			}

			if (command.commandType === "PASTE_DOM_NODE") {
				const payload = command.payload as PastePayload
				const element = findNodeById(payload.nodeId)
				element.remove()
				this.elementSelector.clearSelection()
				return true
			}

			const payload = command.payload as InsertTextPayload
			findNodeById(payload.nodeId).remove()
			this.elementSelector.clearSelection()
			return true
		} catch (error) {
			EditorLogger.warn("恢复 DOM 结构命令失败", error)
			return false
		}
	}

	applyCommand(command: CommandRecord): boolean {
		if (!this.canHandleCommand(command.commandType)) return false

		try {
			if (command.commandType === "DUPLICATE_DOM_NODE") {
				const payload = command.payload as DuplicatePayload
				const parent = findNodeById(payload.parentId)
				const wrapper = document.createElement("div")
				wrapper.innerHTML = payload.html
				const element = wrapper.firstElementChild
				if (!(element instanceof HTMLElement)) return false
				resetEditorNodeIds(element)
				assignEditorNodeIds(element)
				const duplicatedNodeId = element.getAttribute(EDITOR_NODE_ID_ATTRIBUTE)
				if (!duplicatedNodeId) return false
				insertAtElementIndex(parent, element, payload.index)
				;(command.payload as DuplicatePayload).duplicatedNodeId = duplicatedNodeId
				;(command.previousState as DuplicatePreviousState).duplicatedNodeId =
					duplicatedNodeId
				this.elementSelector.selectElement(element)
				return true
			}
			if (command.commandType === "MOVE_DOM_NODE") {
				const payload = command.payload as MovePayload
				const element = findNodeById(payload.nodeId)
				const parent = findNodeById(payload.targetParentId)
				element.remove()
				insertAtElementIndex(parent, element, payload.targetIndex)
				this.elementSelector.selectElement(element)
				return true
			}

			if (command.commandType === "CUT_DOM_NODE") {
				const payload = command.payload as CutPayload
				findNodeById(payload.nodeId).remove()
				this.elementSelector.clearSelection()
				return true
			}

			if (command.commandType === "PASTE_DOM_NODE") {
				const payload = command.payload as PastePayload
				const parent = findNodeById(payload.parentId)
				const wrapper = document.createElement("div")
				wrapper.innerHTML = payload.html
				const element = wrapper.firstElementChild
				if (!(element instanceof HTMLElement)) return false
				resetEditorNodeIds(element)
				element.setAttribute(EDITOR_NODE_ID_ATTRIBUTE, payload.nodeId)
				insertAtElementIndex(parent, element, payload.index)
				this.elementSelector.selectElement(element)
				return true
			}

			const payload = command.payload as InsertTextPayload
			const parent = findNodeById(payload.parentId)
			const wrapper = document.createElement("div")
			wrapper.innerHTML = payload.html
			const element = wrapper.firstElementChild
			if (!(element instanceof HTMLElement)) return false
			resetEditorNodeIds(element)
			element.setAttribute(EDITOR_NODE_ID_ATTRIBUTE, payload.nodeId)
			insertAtElementIndex(parent, element, payload.index)
			this.elementSelector.selectElement(element)
			return true
		} catch (error) {
			EditorLogger.warn("重做 DOM 结构命令失败", error)
			return false
		}
	}
}
