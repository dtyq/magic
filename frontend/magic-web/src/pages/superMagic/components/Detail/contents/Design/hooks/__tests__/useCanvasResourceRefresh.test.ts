import { describe, expect, it } from "vitest"
import type { SuperMagicFileChangeMessage } from "@/types/chat/intermediate_message"
import {
	ElementTypeEnum,
	type CanvasDocument,
} from "@/components/CanvasDesign/runtime/document/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { buildDesignAttachmentIndex } from "../../utils/designAttachmentIndex"
import {
	buildCanvasResourceSnapshot,
	getChangedCanvasResources,
	getChangedCanvasResourcesFromFileChanges,
} from "../useCanvasResourceRefresh"

function attachment(fileId: string, path: string, updatedAt = "1"): FileItem {
	return {
		file_id: fileId,
		file_name: path.split("/").pop() || path,
		relative_file_path: path,
		updated_at: updatedAt,
		file_size: 100,
		is_directory: false,
	} as FileItem
}

function canvasWithImages(...paths: string[]): CanvasDocument {
	return {
		elements: paths.map((src, index) => ({
			id: `image-${index}`,
			type: ElementTypeEnum.Image,
			contents: [{ contentId: `image-${index}-content-1`, src }],
			activeContentId: `image-${index}-content-1`,
			mainContentId: `image-${index}-content-1`,
		})),
	} as CanvasDocument
}

function buildSnapshot(
	canvas: CanvasDocument,
	flatAttachments: FileItem[],
	attachmentsReady = true,
) {
	return buildCanvasResourceSnapshot({
		canvas,
		flatAttachments,
		attachmentsReady,
		attachmentIndex: buildDesignAttachmentIndex(flatAttachments),
		designProjectBasePath: "画布A",
	})
}

describe("useCanvasResourceRefresh snapshots", () => {
	it("silently ignores opaque asset references", () => {
		const snapshot = buildSnapshot(canvasWithImages("asset://virtual-human-asset-id"), [])

		expect(snapshot.items.size).toBe(0)
		expect(snapshot.itemsByReference.size).toBe(0)
	})

	it("uses the runtime effective Content for preview resource snapshots", () => {
		const canvas = canvasWithImages("./images/document.png")
		const image = canvas.elements?.[0]
		if (!image || image.type !== ElementTypeEnum.Image) throw new Error("image fixture missing")
		image.contents = [
			{ contentId: "image-0-content-1", src: "./images/document.png" },
			{ contentId: "image-0-content-2", src: "./images/preview.png" },
		]
		const canvasInstance = {
			getEffectiveContent: (elementId: string) =>
				elementId === image.id
					? { contentId: "image-0-content-2", src: "./images/preview.png" }
					: undefined,
		} as never
		const snapshot = buildCanvasResourceSnapshot({
			canvas,
			canvasInstance,
			flatAttachments: [
				attachment("document", "画布A/images/document.png"),
				attachment("preview", "画布A/images/preview.png"),
			],
			attachmentsReady: true,
			attachmentIndex: buildDesignAttachmentIndex([
				attachment("document", "画布A/images/document.png"),
				attachment("preview", "画布A/images/preview.png"),
			]),
			designProjectBasePath: "画布A",
		})

		expect([...snapshot.items.values()].map((item) => item.path)).toEqual([
			"./images/preview.png",
		])
	})

	it("deduplicates current-canvas aliases without crossing workspace roots", () => {
		const flatAttachments = [
			attachment("canvas-a", "画布A/images/shared.png"),
			attachment("workspace-root", "images/shared.png"),
			attachment("canvas-b", "画布B/images/shared.png"),
		]
		const snapshot = buildSnapshot(
			canvasWithImages(
				"./images/shared.png",
				"/画布A/images/shared.png",
				"/images/shared.png",
				"/画布B/images/shared.png",
				"images/shared.png",
			),
			flatAttachments,
		)

		// A 的两种明确写法合并；工作区根、画布 B 和歧义裸路径各自独立。
		expect(snapshot.items.size).toBe(4)
	})

	it("refreshes a stable logical resource when attachment metadata changes", () => {
		const canvas = canvasWithImages("./images/shared.png")
		const previous = buildSnapshot(canvas, [
			attachment("canvas-a", "画布A/images/shared.png", "1"),
		])
		const next = buildSnapshot(canvas, [attachment("canvas-a", "画布A/images/shared.png", "2")])

		expect(getChangedCanvasResources(previous, next)).toEqual([
			{ path: "./images/shared.png", mediaType: "image" },
		])
	})

	it("refreshes an exact Canvas reference when attachments become ready", () => {
		const canvas = canvasWithImages("./images/shared.png")
		const previous = buildCanvasResourceSnapshot({
			canvas,
			attachmentsReady: false,
			designProjectBasePath: "画布A",
		})
		const next = buildSnapshot(canvas, [attachment("canvas-a", "画布A/images/shared.png")])

		expect(getChangedCanvasResources(previous, next)).toEqual([
			{ path: "./images/shared.png", mediaType: "image" },
		])
	})

	it("refreshes an exact Canvas reference when a resolved attachment disappears", () => {
		const canvas = canvasWithImages("./images/shared.png")
		const previous = buildSnapshot(canvas, [attachment("canvas-a", "画布A/images/shared.png")])
		const next = buildSnapshot(canvas, [])

		expect(getChangedCanvasResources(previous, next)).toEqual([
			{ path: "./images/shared.png", mediaType: "image" },
		])
	})

	it("keeps every stored alias refreshable after identity deduplication", () => {
		const canvas = canvasWithImages("./images/shared.png", "/画布A/images/shared.png")
		const previous = buildSnapshot(canvas, [
			attachment("canvas-a", "画布A/images/shared.png", "1"),
		])
		const next = buildSnapshot(canvas, [attachment("canvas-a", "画布A/images/shared.png", "2")])

		expect(previous.items.size).toBe(1)
		expect(previous.itemsByReference.size).toBe(2)
		expect(getChangedCanvasResources(previous, next)).toEqual([
			{ path: "./images/shared.png", mediaType: "image" },
			{ path: "/画布A/images/shared.png", mediaType: "image" },
		])
	})

	it("routes file-change refreshes to the exact workspace resource", () => {
		const flatAttachments = [
			attachment("canvas-a", "画布A/images/shared.png"),
			attachment("workspace-root", "images/shared.png"),
		]
		const snapshot = buildSnapshot(
			canvasWithImages("./images/shared.png", "/images/shared.png"),
			flatAttachments,
		)
		const changes = [
			{ file: { relative_file_path: "画布A/images/shared.png" } },
		] as SuperMagicFileChangeMessage["changes"]

		expect(getChangedCanvasResourcesFromFileChanges(changes, snapshot)).toEqual([
			{ path: "./images/shared.png", mediaType: "image" },
		])
	})

	it("tracks audio attachment updates and audio directory file changes", () => {
		const canvas = {
			elements: [
				{
					id: "audio-1",
					type: ElementTypeEnum.Audio,
					contents: [{ contentId: "audio-1-content-1", src: "./audios/voice.mp3" }],
					activeContentId: "audio-1-content-1",
					mainContentId: "audio-1-content-1",
				},
			],
		} as CanvasDocument
		const previous = buildSnapshot(canvas, [
			attachment("audio-1", "画布A/audios/voice.mp3", "1"),
		])
		const next = buildSnapshot(canvas, [attachment("audio-1", "画布A/audios/voice.mp3", "2")])

		expect(getChangedCanvasResources(previous, next)).toEqual([
			{ path: "./audios/voice.mp3", mediaType: "audio" },
		])
		expect(
			getChangedCanvasResourcesFromFileChanges(
				[
					{
						file: { relative_file_path: "画布A/audios/voice.mp3" },
					},
				] as SuperMagicFileChangeMessage["changes"],
				next,
			),
		).toEqual([{ path: "./audios/voice.mp3", mediaType: "audio" }])
	})
})
