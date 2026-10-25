import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum } from "../../../document/types"
import type { SelectionContentSnapshot } from "../../selection/selectionContentCollector"
import {
	getConnectionAssociationTargetKind,
	registerConnectionMenuAssociationSeed,
} from "../connectionMenuAssociationSeed"

function createSnapshot(): SelectionContentSnapshot {
	return {
		rootElementIds: ["frame-1", "text-1"],
		items: [
			{
				elementId: "image-1",
				type: ElementTypeEnum.Image,
				rootElementId: "frame-1",
				ready: true,
				mainReady: false,
			},
			{
				elementId: "shape-1",
				type: ElementTypeEnum.Rectangle,
				rootElementId: "frame-1",
				ready: true,
				mainReady: false,
			},
			{
				elementId: "text-1",
				type: ElementTypeEnum.Text,
				rootElementId: "text-1",
				ready: true,
				mainReady: false,
			},
		],
		imageSequence: ["image-1"],
		videoSequence: [],
		mainVideoSequence: [],
		audioSequence: [],
		counts: { image: 1, video: 0, audio: 0, text: 1 },
		boundingRect: { x: 0, y: 0, width: 100, height: 100 },
		selectionRevision: "frame-1\u0000text-1",
		allRootsCanConnect: true,
	}
}

describe("connection menu association seed", () => {
	it("maps only generator menu items to editor targets", () => {
		expect(getConnectionAssociationTargetKind("text")).toBeNull()
		expect(getConnectionAssociationTargetKind("image-generator")).toBe("image-generator")
		expect(getConnectionAssociationTargetKind("video-generator")).toBe("video-generator")
	})

	it("registers ordered content only for the right-side menu", () => {
		const register = vi.fn(() => "seed-1")
		const canvas = {
			connectionAssociationSeedManager: { register },
		} as unknown as Canvas

		expect(
			registerConnectionMenuAssociationSeed({
				canvas,
				kind: "image-generator",
				originSide: "right",
				snapshot: createSnapshot(),
				targetElementId: "target-1",
			}),
		).toBe("seed-1")
		expect(register).toHaveBeenCalledWith({
			targetElementId: "target-1",
			targetKind: "image-generator",
			rootElementIds: ["frame-1", "text-1"],
			orderedSources: [
				{ elementId: "image-1", kind: "image" },
				{ elementId: "text-1", kind: "text" },
			],
			originRevision: "frame-1\u0000text-1",
			createdBy: "connection-menu",
			mediaRole: "reference",
		})
		expect(
			registerConnectionMenuAssociationSeed({
				canvas,
				kind: "image-generator",
				originSide: "left",
				snapshot: createSnapshot(),
				targetElementId: "target-2",
			}),
		).toBeNull()
	})
})
