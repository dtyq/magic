import { describe, expect, it, vi } from "vitest"
import {
	CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE,
	CanvasElementClipboard,
} from "../clipboard/CanvasElementClipboard"
import { CanvasDesignClipboard } from "../clipboard/CanvasDesignClipboard"
import type { CanvasElementClipboardFileMetadata } from "../clipboard/CanvasElementClipboard"

describe("CanvasElementClipboard", () => {
	it("reads external audio clipboard items as audio files", async () => {
		const item = {
			types: ["audio/mpeg"],
			getType: async () => new Blob(["audio"], { type: "audio/mpeg" }),
		} as ClipboardItem

		const file = await CanvasElementClipboard.readExternalFileItem(item)

		expect(file?.name).toBe("audio.mp3")
		expect(file?.type).toBe("audio/mpeg")
	})

	it("preserves ordinary document files for message-editor fallback", () => {
		const documentFile = new File(["document"], "notes.pdf", { type: "application/pdf" })
		const event = {
			clipboardData: {
				types: ["Files"],
				files: [documentFile],
				items: [],
			},
		} as unknown as ClipboardEvent

		expect(CanvasDesignClipboard.readAllEventFilesSnapshot(event)).toEqual([documentFile])
	})

	it("ignores generation resource metadata when restoring event files", () => {
		const generationResourceMetadata: CanvasElementClipboardFileMetadata = {
			id: "generation-resource:0",
			elementId: "generation-resource:0",
			filename: "ref.png",
			mimeType: "image/png",
			fileSize: 0,
			role: "generation-resource",
			resourcePath: "source/ref.png",
			sourceRef: {
				src: "source/ref.png",
				ossUrl: "https://source.test/ref.png",
			},
		}
		const elementMetadata: CanvasElementClipboardFileMetadata = {
			id: "image-1:0",
			elementId: "image-1",
			filename: "image.png",
			mimeType: "image/png",
			fileSize: 0,
			role: "element-media",
			sourceRef: {
				src: "source/image.png",
				ossUrl: "https://source.test/image.png",
			},
		}

		const [canvasFile] = CanvasElementClipboard.createFilesFromEventFiles(
			[new File(["image"], "", { type: "image/png" })],
			[generationResourceMetadata, elementMetadata],
		)

		expect(canvasFile?.metadata).toBe(elementMetadata)
		expect(canvasFile?.file.name).toBe("image.png")
	})

	it("preserves source resolver identity and aliases in the clipboard payload", async () => {
		const metadata = CanvasElementClipboard.createGenerationResourceMetadata({
			fileId: "generation-resource:0",
			resourcePath: "./images/ref.png",
			resourceIdentity: "workspace:/画布A/images/ref.png",
			resourceAliases: ["./images/ref.png", "/画布A/images/ref.png"],
			filename: "ref.png",
			mimeType: "image/png",
			fileSize: 100,
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [
				{
					id: "image-1",
					type: "image",
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					contents: [{ contentId: "image-1-content", src: "./images/owner.png" }],
					activeContentId: "image-1-content",
					mainContentId: "image-1-content",
				},
			],
			files: [metadata],
			operation: "copy-elements",
		})
		const item = {
			types: [CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE],
			getType: async () => ({ text: async () => JSON.stringify(payload) }) as unknown as Blob,
		} as ClipboardItem

		const restored = await CanvasElementClipboard.readPayload([item])

		expect(restored?.files[0]).toEqual(
			expect.objectContaining({
				resourcePath: "./images/ref.png",
				resourceIdentity: "workspace:/画布A/images/ref.png",
				resourceAliases: ["./images/ref.png", "/画布A/images/ref.png"],
			}),
		)
	})

	it("preserves internal connections and keeps legacy payloads readable", async () => {
		const elements = [
			{
				id: "image-1",
				type: "image" as const,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				contents: [{ contentId: "image-1-content", src: "./images/image.png" }],
				activeContentId: "image-1-content",
				mainContentId: "image-1-content",
			},
			{
				id: "image-2",
				type: "image" as const,
				x: 120,
				y: 0,
				width: 100,
				height: 100,
				contents: [{ contentId: "image-2-content", src: "./images/image-2.png" }],
				activeContentId: "image-2-content",
				mainContentId: "image-2-content",
			},
		]
		const connections = [
			{ id: "connection-1", sourceElementId: "image-1", targetElementId: "image-2" },
		]
		const payload = CanvasElementClipboard.createPayload({
			elements,
			files: [],
			operation: "copy-elements",
			connections,
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({ payload, files: [] })
		const restoredBundle = await CanvasDesignClipboard.parseBundleBlob(bundle)

		expect(restoredBundle.payload.connections).toEqual(connections)

		const item = {
			types: [CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE],
			getType: async () =>
				({
					text: async () => JSON.stringify({ ...payload, connections: undefined }),
				}) as unknown as Blob,
		} as ClipboardItem
		const legacyPayload = await CanvasElementClipboard.readPayload([item])

		expect(legacyPayload?.connections).toBeUndefined()
		expect(
			CanvasElementClipboard.createPayload({
				elements: [],
				files: [],
				operation: "copy-as-png",
				connections,
			}).connections,
		).toBeUndefined()
	})

	it("preserves element media aliases in the clipboard payload", async () => {
		const element = {
			id: "image-1",
			type: "image" as const,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			contents: [{ contentId: "image-1-content", src: "./images/image.png" }],
			activeContentId: "image-1-content",
			mainContentId: "image-1-content",
		}
		const metadata = CanvasElementClipboard.createFileMetadata({
			element,
			fileId: "image-1:0",
			filename: "image.png",
			mimeType: "image/png",
			fileSize: 100,
			resourceIdentity: "workspace:/画布A/images/image.png",
			resourceAliases: ["./images/image.png", "/画布A/images/image.png"],
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [element],
			files: [metadata],
			operation: "copy-elements",
		})
		const item = {
			types: [CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE],
			getType: async () => ({ text: async () => JSON.stringify(payload) }) as unknown as Blob,
		} as ClipboardItem

		const restored = await CanvasElementClipboard.readPayload([item])

		expect(restored?.files[0]).toEqual(
			expect.objectContaining({
				role: "element-media",
				resourceIdentity: "workspace:/画布A/images/image.png",
				resourceAliases: ["./images/image.png", "/画布A/images/image.png"],
			}),
		)
	})
	it("reads the browser clipboard only once when no CanvasDesign bundle exists", async () => {
		const read = vi.fn().mockResolvedValue([])

		await expect(
			CanvasElementClipboard.parseClipboardContent(undefined, {
				read,
				readText: vi.fn().mockResolvedValue(""),
			}),
		).resolves.toEqual({ type: "empty" })

		expect(read).toHaveBeenCalledTimes(1)
	})

	it("rejects clipboard payloads with oversized or deeply nested element trees", async () => {
		const oversizedPayload = {
			source: "canvas-design-element-clipboard",
			version: 1,
			operation: "copy-elements",
			elements: Array.from({ length: 4097 }, (_, index) => ({
				id: `element-${index}`,
				type: "image",
			})),
			files: [],
		}
		const oversizedItem = {
			types: [CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE],
			getType: async () =>
				({
					text: async () => JSON.stringify(oversizedPayload),
				}) as unknown as Blob,
		} as ClipboardItem

		await expect(CanvasElementClipboard.readPayload([oversizedItem])).resolves.toBeNull()

		let deepElement: Record<string, unknown> = { id: "leaf", type: "image" }
		for (let depth = 0; depth < 64; depth += 1) {
			deepElement = { id: `node-${depth}`, type: "frame", children: [deepElement] }
		}
		const deepPayload = {
			source: "canvas-design-element-clipboard",
			version: 1,
			operation: "copy-elements",
			elements: [deepElement],
			files: [],
		}
		const deepItem = {
			types: [CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE],
			getType: async () =>
				({
					text: async () => JSON.stringify(deepPayload),
				}) as unknown as Blob,
		} as ClipboardItem

		await expect(CanvasElementClipboard.readPayload([deepItem])).resolves.toBeNull()
	})
})
