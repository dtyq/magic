import { describe, expect, it } from "vitest"
import type { ConnectionAssociationSeed } from "../../../../runtime/interaction/connection/ConnectionAssociationSeedManager"
import type { LinkedEditorMediaItem } from "../linkedEditorInputs"
import { resolveInitialLinkedEditorAssociation } from "../resolveInitialLinkedEditorAssociation"

function createSeed(overrides: Partial<ConnectionAssociationSeed> = {}): ConnectionAssociationSeed {
	return {
		id: "seed-1",
		targetElementId: "target-1",
		targetKind: "image-generator",
		rootElementIds: ["root-1"],
		orderedSources: [
			{ elementId: "text-2", kind: "text" },
			{ elementId: "image-2", kind: "image" },
			{ elementId: "image-1", kind: "image" },
			{ elementId: "text-1", kind: "text" },
		],
		originRevision: "root-1",
		createdBy: "connection-menu",
		mediaRole: "reference",
		...overrides,
	}
}

function mediaItem(
	connectionId: string,
	sourceElementId: string,
	kind: LinkedEditorMediaItem["kind"],
): LinkedEditorMediaItem {
	return {
		connectionId,
		sourceElementId,
		kind,
		path: `/${sourceElementId}`,
		fileName: sourceElementId,
		status: "inactive",
		selected: false,
	}
}

describe("resolveInitialLinkedEditorAssociation", () => {
	it("selects text and the first N supported media in document order", () => {
		const result = resolveInitialLinkedEditorAssociation({
			seed: createSeed(),
			targetKind: "image",
			mediaPolicyStatus: "ready",
			connectedSourceElementIds: ["text-2", "image-2", "image-1", "text-1"],
			textConnections: [
				{ connectionId: "text-1-connection", sourceElementId: "text-1", text: "one" },
				{ connectionId: "text-2-connection", sourceElementId: "text-2", text: "two" },
			],
			mediaItems: [
				mediaItem("image-1-connection", "image-1", "image"),
				mediaItem("image-2-connection", "image-2", "image"),
			],
			mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 1 },
		})

		expect(result).toEqual({
			status: "ready",
			selectedTextConnectionIds: ["text-2-connection", "text-1-connection"],
			selectedMediaConnectionIds: ["image-2-connection"],
		})
	})

	it("uses only ordinary reference kinds supported by the video mode", () => {
		const result = resolveInitialLinkedEditorAssociation({
			seed: createSeed({
				targetKind: "video-generator",
				orderedSources: [
					{ elementId: "image-1", kind: "image" },
					{ elementId: "video-1", kind: "video" },
					{ elementId: "audio-1", kind: "audio" },
				],
			}),
			targetKind: "video",
			mediaPolicyStatus: "ready",
			connectedSourceElementIds: ["image-1", "video-1", "audio-1"],
			textConnections: [],
			mediaItems: [
				mediaItem("image-connection", "image-1", "image"),
				mediaItem("video-connection", "video-1", "video"),
				mediaItem("audio-connection", "audio-1", "audio"),
			],
			mediaPolicy: {
				supportedKinds: ["image", "video", "audio"],
				maxTotalCount: 2,
			},
		})

		expect(result).toEqual({
			status: "ready",
			selectedTextConnectionIds: [],
			selectedMediaConnectionIds: ["image-connection", "video-connection"],
		})
	})

	it("does not return media that was already selected", () => {
		const selected = {
			...mediaItem("image-1-connection", "image-1", "image"),
			selected: true,
			status: "active" as const,
		}
		const result = resolveInitialLinkedEditorAssociation({
			seed: createSeed({
				orderedSources: [
					{ elementId: "image-1", kind: "image" },
					{ elementId: "image-2", kind: "image" },
				],
			}),
			targetKind: "image",
			mediaPolicyStatus: "ready",
			connectedSourceElementIds: ["image-1", "image-2"],
			textConnections: [],
			mediaItems: [selected, mediaItem("image-2-connection", "image-2", "image")],
			mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 1 },
		})

		expect(result).toEqual({
			status: "ready",
			selectedTextConnectionIds: [],
			selectedMediaConnectionIds: [],
		})
	})

	it("ignores a seed created for a different editor kind", () => {
		expect(
			resolveInitialLinkedEditorAssociation({
				seed: createSeed({ targetKind: "video-generator" }),
				targetKind: "image",
				mediaPolicyStatus: "ready",
				connectedSourceElementIds: ["text-2", "image-2", "image-1", "text-1"],
				textConnections: [
					{ connectionId: "text-1", sourceElementId: "text-1", text: "text" },
				],
				mediaItems: [mediaItem("image-1", "image-1", "image")],
				mediaPolicy: { supportedKinds: ["image"] },
			}),
		).toEqual({
			status: "ready",
			selectedTextConnectionIds: [],
			selectedMediaConnectionIds: [],
		})
	})

	it("keeps the seed pending while a media policy is still loading", () => {
		const result = resolveInitialLinkedEditorAssociation({
			seed: createSeed(),
			targetKind: "image",
			mediaPolicyStatus: "loading",
			connectedSourceElementIds: ["text-2", "image-2", "image-1", "text-1"],
			textConnections: [],
			mediaItems: [mediaItem("image-1-connection", "image-1", "image")],
			mediaPolicy: { supportedKinds: [] },
		})

		expect(result).toEqual({ status: "pending", reason: "media-policy" })
	})

	it("does not wait for the media policy when the seed contains only text", () => {
		const result = resolveInitialLinkedEditorAssociation({
			seed: createSeed({
				orderedSources: [{ elementId: "text-1", kind: "text" }],
			}),
			targetKind: "image",
			mediaPolicyStatus: "loading",
			connectedSourceElementIds: ["text-1"],
			textConnections: [
				{ connectionId: "text-connection", sourceElementId: "text-1", text: "prompt" },
			],
			mediaItems: [],
			mediaPolicy: { supportedKinds: [] },
		})

		expect(result).toEqual({
			status: "ready",
			selectedTextConnectionIds: ["text-connection"],
			selectedMediaConnectionIds: [],
		})
	})

	it("keeps the seed pending until all connected sources are resolved", () => {
		const result = resolveInitialLinkedEditorAssociation({
			seed: createSeed(),
			targetKind: "image",
			mediaPolicyStatus: "ready",
			connectedSourceElementIds: ["text-2"],
			textConnections: [],
			mediaItems: [],
		})

		expect(result).toEqual({ status: "pending", reason: "source-inputs" })
	})

	it("allows a ready policy with no supported media to finish with an empty plan", () => {
		const result = resolveInitialLinkedEditorAssociation({
			seed: createSeed(),
			targetKind: "image",
			mediaPolicyStatus: "ready",
			connectedSourceElementIds: ["text-2", "image-2", "image-1", "text-1"],
			textConnections: [],
			mediaItems: [mediaItem("image-1-connection", "image-1", "image")],
			mediaPolicy: { supportedKinds: [] },
		})

		expect(result).toMatchObject({
			status: "ready",
			selectedMediaConnectionIds: [],
		})
	})
})
