import type { Canvas } from "../Canvas"

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

		return this.canvas.nameLabelManager.canStartRename(elementId)
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
		return true
	}

	public commitRename(nextName: string): void {
		const elementId = this.renamingElementId
		if (!elementId) {
			return
		}

		const trimmedName = nextName.trim()
		const currentLabel =
			this.canvas.elementManager.getElementInstance(elementId)?.getNameLabelText() || ""

		this.cancelRename()

		if (trimmedName && trimmedName !== currentLabel) {
			this.canvas.elementManager.update(elementId, { name: trimmedName })
		}
	}

	public cancelRename(): void {
		if (!this.renamingElementId) {
			return
		}

		this.renamingElementId = null
		this.canvas.nameLabelManager.setRenamingElementId(null)
	}

	public getRenamingElementId(): string | null {
		return this.renamingElementId
	}

	public destroy(): void {
		this.cancelRename()
	}
}
