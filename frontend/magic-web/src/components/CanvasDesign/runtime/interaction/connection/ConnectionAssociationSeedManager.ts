import type { Canvas } from "../../core/Canvas"
import { generateUUID } from "../../shared/ids"

export type ConnectionAssociationTargetKind = "image-generator" | "video-generator"
export type ConnectionAssociationSourceKind = "text" | "image" | "video" | "audio"

export interface ConnectionAssociationSource {
	elementId: string
	kind: ConnectionAssociationSourceKind
}

export interface ConnectionAssociationSeed {
	id: string
	targetElementId: string
	targetKind: ConnectionAssociationTargetKind
	rootElementIds: string[]
	orderedSources: ConnectionAssociationSource[]
	originRevision: string
	createdBy: "connection-menu" | "assets"
	mediaRole: "reference"
}

/**
 * Stores the one-shot bridge between connection-menu creation and the editor
 * that consumes linked text/media. Seeds are runtime state and never enter DSL
 * or history snapshots.
 */
export class ConnectionAssociationSeedManager {
	private readonly canvas: Canvas
	private readonly seeds = new Map<string, ConnectionAssociationSeed>()
	private readonly unsubscribers: Array<() => void> = []

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.setupEventListeners()
	}

	public register(seed: Omit<ConnectionAssociationSeed, "id">): string {
		this.remove(seed.targetElementId)
		const id = generateUUID()
		this.seeds.set(id, {
			...seed,
			id,
			rootElementIds: [...seed.rootElementIds],
			orderedSources: seed.orderedSources.map((source) => ({ ...source })),
		})
		return id
	}

	public peek(targetElementId: string): ConnectionAssociationSeed | null {
		for (const seed of this.seeds.values()) {
			if (seed.targetElementId !== targetElementId) continue
			return this.clone(seed)
		}
		return null
	}

	public consume(targetElementId: string, seedId: string): boolean {
		const seed = this.seeds.get(seedId)
		if (!seed || seed.targetElementId !== targetElementId) return false
		this.seeds.delete(seedId)
		return true
	}

	public remove(targetElementId: string): void {
		for (const [seedId, seed] of this.seeds) {
			if (seed.targetElementId === targetElementId) this.seeds.delete(seedId)
		}
	}

	public clear(): void {
		this.seeds.clear()
	}

	public destroy(): void {
		this.unsubscribers.forEach((unsubscribe) => unsubscribe())
		this.unsubscribers.length = 0
		this.clear()
	}

	private setupEventListeners(): void {
		this.unsubscribers.push(
			this.canvas.eventEmitter.on("element:deleted", ({ data }) => {
				this.remove(data.elementId)
			}),
			this.canvas.eventEmitter.on("element:batchdeleted", ({ data }) => {
				data.elementIds.forEach((elementId) => this.remove(elementId))
			}),
			this.canvas.eventEmitter.on("canvas:clear", () => this.clear()),
			this.canvas.eventEmitter.on("document:loaded", () => this.clear()),
			this.canvas.eventEmitter.on("document:restored", () => this.clear()),
		)
	}

	private clone(seed: ConnectionAssociationSeed): ConnectionAssociationSeed {
		return {
			...seed,
			rootElementIds: [...seed.rootElementIds],
			orderedSources: seed.orderedSources.map((source) => ({ ...source })),
		}
	}
}
