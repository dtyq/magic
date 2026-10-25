import { describe, expect, it } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { EventEmitter, type CanvasEventMap } from "../../../core/EventEmitter"
import { ConnectionAssociationSeedManager } from "../ConnectionAssociationSeedManager"

function createManager() {
	const eventEmitter = new EventEmitter<CanvasEventMap>()
	const canvas = { eventEmitter } as unknown as Canvas
	return {
		eventEmitter,
		manager: new ConnectionAssociationSeedManager({ canvas }),
	}
}

describe("ConnectionAssociationSeedManager", () => {
	it("stores an isolated one-shot seed per target", () => {
		const { manager } = createManager()
		const seedId = manager.register({
			targetElementId: "target-1",
			targetKind: "image-generator",
			rootElementIds: ["root-1"],
			orderedSources: [{ elementId: "image-1", kind: "image" }],
			originRevision: "root-1",
			createdBy: "connection-menu",
			mediaRole: "reference",
		})
		const seed = manager.peek("target-1")

		expect(seed).toMatchObject({
			id: seedId,
			orderedSources: [{ elementId: "image-1", kind: "image" }],
		})
		seed?.orderedSources.push({ elementId: "mutated", kind: "image" })
		expect(manager.peek("target-1")?.orderedSources).toEqual([
			{ elementId: "image-1", kind: "image" },
		])
		expect(manager.consume("target-1", seedId)).toBe(true)
		expect(manager.peek("target-1")).toBeNull()
	})

	it("clears the seed when its target is deleted", () => {
		const { eventEmitter, manager } = createManager()
		manager.register({
			targetElementId: "target-1",
			targetKind: "video-generator",
			rootElementIds: ["root-1"],
			orderedSources: [{ elementId: "image-1", kind: "image" }],
			originRevision: "root-1",
			createdBy: "connection-menu",
			mediaRole: "reference",
		})

		eventEmitter.emit({ type: "element:deleted", data: { elementId: "target-1" } })

		expect(manager.peek("target-1")).toBeNull()
	})
})
