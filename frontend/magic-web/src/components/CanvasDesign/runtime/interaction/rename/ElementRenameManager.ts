import { getActiveImageContent, isImageElementContent } from "../../document/elementContent"
import type { Canvas } from "../../core/Canvas"
import type { CanvasImageFileRename } from "../../../public/magic-types"
import { getEditableElementName, normalizeElementName } from "./renameUtils"

export interface ImageRenameOptions {
	/** 文件改名必须由调用方显式提供；省略时只修改元素名称。 */
	fileChange?: CanvasImageFileRename
}

export class ElementRenameManager {
	private renamingElementId: string | null = null

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	private canvas: Canvas

	public canRename(elementId: string | null): boolean {
		if (!elementId) return false

		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.canRename(elementData)) {
			return false
		}

		return true
	}

	public startRename(elementId: string): boolean {
		if (!this.canRename(elementId)) {
			return false
		}

		if (this.renamingElementId === elementId) {
			return true
		}

		this.cancelRename()
		this.renamingElementId = elementId
		this.canvas.nameLabelManager.setRenamingElementId(elementId)
		this.canvas.eventEmitter.emit({
			type: "element:rename-start",
			data: { elementId },
		})
		return true
	}

	/**
	 * 提交图层列表等轻量入口的元素名称修改。
	 *
	 * 这些入口不需要打开画布右侧面板，但必须复用相同的权限校验、名称归一化和
	 * ElementManager 提交路径，避免不同入口产生不同的历史与状态行为。
	 */
	public commitElementName(
		elementId: string,
		nextName: string,
		options?: { historyPolicy?: "include" | "exclude" },
	): boolean {
		const name = normalizeElementName(nextName)
		if (!name) return false

		const element = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.canRename(element)) return false

		const currentName = getEditableElementName(
			element,
			this.canvas.elementManager.getElementInstance(elementId),
		)
		if (name === currentName.trim()) return false

		return this.updateElementName(elementId, name, options)
	}

	public async commitRename(nextName: string, options?: ImageRenameOptions): Promise<void> {
		const elementId = this.renamingElementId
		const name = normalizeElementName(nextName)
		if (!elementId || !name) return
		const element = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.canRename(element)) return
		const currentName = getEditableElementName(
			element,
			this.canvas.elementManager.getElementInstance(elementId),
		)
		if (name === currentName.trim() && !options?.fileChange) {
			this.cancelRename()
			return
		}
		let affectsFile = false
		const methods = this.canvas.magicConfigManager.config?.methods?.imageRename
		if (options?.fileChange) {
			const change = options.fileChange
			if (
				!methods ||
				!element ||
				!isImageElementContent(element) ||
				element.contents.length !== 1 ||
				change.elementId !== elementId ||
				getActiveImageContent(element).contentId !== change.contentId
			) {
				throw new Error(
					this.canvas.t?.("rename.fileChanged", "文件已变化，请重新打开命名面板。") ||
						"文件已变化，请重新打开命名面板。",
				)
			}
			const error = methods.validateImageFileRenames([change])[change.fileId]
			if (error) throw new Error(error)
			this.canvas.historyManager.recordHistoryImmediate()
			await methods.renameImageFile(change)
			affectsFile = true
		}
		// 文件已改名时标题不能形成单独的撤销记录；普通元素命名继续沿用画布历史。
		this.updateElementName(
			elementId,
			name,
			affectsFile ? { historyPolicy: "exclude" } : undefined,
		)
		if (affectsFile)
			this.canvas.historyManager.applyExternalFileRename((document) => {
				const rewrite = (items: typeof document.elements): typeof document.elements =>
					items?.map((item) => {
						if (item.id === elementId) return { ...item, name }
						return "children" in item && item.children
							? { ...item, children: rewrite(item.children) }
							: item
					})
				return { ...document, elements: rewrite(document.elements) }
			})
		this.cancelRename()
	}

	private updateElementName(
		elementId: string,
		name: string,
		options?: { historyPolicy?: "include" | "exclude" },
	): boolean {
		const element = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.canRename(element)) return false

		const currentName = getEditableElementName(
			element,
			this.canvas.elementManager.getElementInstance(elementId),
		)
		if (currentName.trim() === name) return false

		if (options?.historyPolicy) {
			this.canvas.elementManager.update(
				elementId,
				{ name },
				{
					historyPolicy: options.historyPolicy,
				},
			)
		} else {
			this.canvas.elementManager.update(elementId, { name })
		}
		return true
	}

	public cancelRename(): void {
		if (!this.renamingElementId) {
			return
		}

		const elementId = this.renamingElementId
		this.renamingElementId = null
		this.canvas.nameLabelManager.setRenamingElementId(null)
		this.canvas.eventEmitter.emit({
			type: "element:rename-end",
			data: { elementId },
		})
	}

	public getRenamingElementId(): string | null {
		return this.renamingElementId
	}

	public destroy(): void {
		this.cancelRename()
	}
}
