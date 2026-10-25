import type { LayerElement } from "../../document/types"
import type { BaseElement } from "./BaseElement"

function getChildIds(element: LayerElement): string[] {
	if (!("children" in element) || !element.children || !Array.isArray(element.children)) {
		return []
	}
	return element.children.map((child) => child.id)
}

export class CanvasDocumentIndex {
	private dirty = true
	private topologyRevision = 0
	private parentIdByElementId: Map<string, string> = new Map()
	private childIdsByElementId: Map<string, string[]> = new Map()
	private rootElementIds: string[] = []

	public markDirty(): void {
		this.dirty = true
	}

	/**
	 * Marks a parent/child structure change separately from ordinary index invalidation.
	 * Consumers can use the revision to avoid rebuilding a full render workset for geometry-only
	 * updates while still reconciling newly added, removed, or reparented nodes promptly.
	 */
	public markTopologyDirty(): void {
		this.topologyRevision += 1
		this.dirty = true
	}

	public getTopologyRevision(): number {
		return this.topologyRevision
	}

	public clear(): void {
		this.topologyRevision += 1
		this.dirty = false
		this.parentIdByElementId.clear()
		this.childIdsByElementId.clear()
		this.rootElementIds = []
	}

	public getRootElementIds(elements: Map<string, BaseElement>): string[] {
		this.ensure(elements)
		return [...this.rootElementIds]
	}

	public getParentId(elements: Map<string, BaseElement>, elementId: string): string | undefined {
		this.ensure(elements)
		return this.parentIdByElementId.get(elementId)
	}

	public hasParent(elements: Map<string, BaseElement>, elementId: string): boolean {
		this.ensure(elements)
		return this.parentIdByElementId.has(elementId)
	}

	public getChildIds(elements: Map<string, BaseElement>, elementId: string): string[] {
		this.ensure(elements)
		return [...(this.childIdsByElementId.get(elementId) ?? [])]
	}

	private ensure(elements: Map<string, BaseElement>): void {
		if (!this.dirty) return

		this.parentIdByElementId.clear()
		this.childIdsByElementId.clear()
		this.rootElementIds = []

		const assignedChildIds = new Set<string>()

		elements.forEach((element, elementId) => {
			const childIds = getChildIds(element.getData()).filter((childId) =>
				elements.has(childId),
			)
			this.childIdsByElementId.set(elementId, childIds)
		})

		elements.forEach((_, parentId) => {
			const childIds = this.childIdsByElementId.get(parentId) ?? []
			for (const childId of childIds) {
				if (assignedChildIds.has(childId)) continue
				assignedChildIds.add(childId)
				this.parentIdByElementId.set(childId, parentId)
			}
		})

		elements.forEach((_, elementId) => {
			if (!this.parentIdByElementId.has(elementId)) {
				this.rootElementIds.push(elementId)
			}
		})

		this.dirty = false
	}
}
