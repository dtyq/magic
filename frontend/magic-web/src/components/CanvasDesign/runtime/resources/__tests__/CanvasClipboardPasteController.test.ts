import { describe, expect, it, vi } from "vitest"
import { CanvasDesignClipboard } from "../clipboard/CanvasDesignClipboard"
import { CanvasElementClipboard } from "../clipboard/CanvasElementClipboard"
import type { CanvasFileElement } from "../../document/types"
import {
	CanvasClipboardPasteController,
	configureCanvasClipboardPasteHost,
	createCanvasClipboardPasteControllerFromMethods,
	getCanvasClipboardPasteController,
	hasCanvasClipboardMimeType,
	hasCanvasClipboardTextOrHtml,
	releaseCanvasClipboardPasteHost,
	type CanvasClipboardAsset,
	type CanvasClipboardTarget,
} from "../clipboard/CanvasClipboardPasteController"
import { CanvasClipboardAssetResolver } from "../clipboard/CanvasClipboardAssetResolver"

function createClipboardItem(blob: Blob, ...types: string[]): ClipboardItem {
	return {
		types: types,
		getType: async () => blob,
	} as unknown as ClipboardItem
}

function createPasteEvent(
	options: {
		types?: string[]
		files?: File[]
		preventDefault?: ReturnType<typeof vi.fn>
		stopPropagation?: ReturnType<typeof vi.fn>
	} = {},
): ClipboardEvent {
	return {
		clipboardData: {
			types: options.types ?? [],
			files: options.files ?? [],
			items: [],
		},
		preventDefault: options.preventDefault ?? vi.fn(),
		stopPropagation: options.stopPropagation ?? vi.fn(),
	} as unknown as ClipboardEvent
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
	return new Uint8Array(
		await new Promise<ArrayBuffer>((resolve, reject) => {
			const reader = new FileReader()
			reader.onerror = () => reject(reader.error)
			reader.onload = () => resolve(reader.result as ArrayBuffer)
			reader.readAsArrayBuffer(blob)
		}),
	)
}

async function rewriteBundleHeader(
	bundle: Blob,
	mutate: (header: Record<string, unknown>) => void,
): Promise<Blob> {
	const source = await readBlobBytes(bundle)
	const sourceHeaderLength = new DataView(source.buffer).getUint32(5)
	const sourceHeaderStart = 9
	const sourceHeaderEnd = sourceHeaderStart + sourceHeaderLength
	const header = JSON.parse(
		new TextDecoder().decode(source.slice(sourceHeaderStart, sourceHeaderEnd)),
	) as Record<string, unknown>
	mutate(header)
	const headerBytes = new TextEncoder().encode(JSON.stringify(header))
	const prefix = source.slice(0, sourceHeaderStart)
	new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength).setUint32(
		5,
		headerBytes.byteLength,
	)
	return new Blob([prefix, headerBytes, source.slice(sourceHeaderEnd)], {
		type: bundle.type,
	})
}

function createExportBundle(options: {
	filename: string
	mimeType: string
	content?: string
	resourceIdentity?: string
	resourceAliases?: string[]
	sourceRef?: { src?: string; ossUrl?: string; expiresAt?: string }
}) {
	const metadata = CanvasElementClipboard.createCanvasExportFileMetadata({
		fileId: `export:${options.filename}`,
		filename: options.filename,
		mimeType: options.mimeType,
		fileSize: options.content?.length ?? 0,
		sourceElements: [],
		resourceIdentity: options.resourceIdentity,
		resourceAliases: options.resourceAliases,
		sourceRef: options.sourceRef,
	})
	const file = new File([options.content ?? "asset"], options.filename, {
		type: options.mimeType,
	})
	const payload = CanvasElementClipboard.createPayload({
		elements: [],
		files: [metadata],
		operation: "copy-as-png",
		canvasId: "canvas-a",
	})
	return {
		metadata,
		file,
		bundle: CanvasDesignClipboard.createBundleBlob({
			payload,
			files: [{ metadata, blob: file }],
		}),
	}
}

const target: CanvasClipboardTarget = {
	control: "message-editor",
	acceptedTypes: ["image", "video", "audio"],
	sessionId: "test-session",
}

describe("CanvasClipboardPasteController", () => {
	it("extracts only active media content from nested elements", async () => {
		const image = {
			id: "image-1",
			type: "image" as const,
			contents: [
				{ contentId: "old", src: "old.png", status: "completed" as const },
				{ contentId: "active", src: "active.png", status: "completed" as const },
			],
			activeContentId: "active",
			mainContentId: "active",
		} as unknown as CanvasFileElement
		const metadata = CanvasElementClipboard.createFileMetadata({
			element: image as unknown as CanvasFileElement,
			fileId: "image-1:0",
			filename: "active.png",
			mimeType: "image/png",
			fileSize: 6,
			resourceIdentity: "workspace:/images/active.png",
			sourceRef: { src: "active.png", ossUrl: "https://example.test/active.png" },
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [
				{
					id: "frame",
					type: "frame",
					children: [image],
					contents: [],
					activeContentId: null,
					mainContentId: null,
				},
			],
			files: [metadata],
			operation: "copy-elements",
			canvasId: "canvas-a",
		})
		const file = new File(["active"], "active.png", { type: "image/png" })
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload,
			files: [{ metadata, blob: file }],
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
		})

		const result = await controller.paste(undefined, target)
		expect(result.accepted).toHaveLength(1)
		expect(result.accepted[0]).toEqual(
			expect.objectContaining({
				fileName: "active.png",
				sourceElementId: "image-1",
				contentId: "active",
				sourceCanvasId: "canvas-a",
			}),
		)
	})

	it("recursively extracts mixed image, video, and audio media", async () => {
		const createMediaElement = (id: string, type: "image" | "video" | "audio") =>
			({
				id,
				type,
				contents: [{ contentId: `${id}-active`, src: `${id}.asset`, status: "completed" }],
				activeContentId: `${id}-active`,
				mainContentId: `${id}-active`,
			}) as unknown as CanvasFileElement
		const image = createMediaElement("nested-image", "image")
		const video = createMediaElement("nested-video", "video")
		const audio = createMediaElement("nested-audio", "audio")
		const media = [
			{ element: image, filename: "nested.png", mimeType: "image/png" },
			{ element: video, filename: "nested.mp4", mimeType: "video/mp4" },
			{ element: audio, filename: "nested.mp3", mimeType: "audio/mpeg" },
		].map(({ element, filename, mimeType }, index) => {
			const metadata = CanvasElementClipboard.createFileMetadata({
				element,
				fileId: `nested:${index}`,
				filename,
				mimeType,
				fileSize: 1,
			})
			return {
				metadata,
				file: new File(["x"], filename, { type: mimeType }),
			}
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [
				{
					id: "frame-mixed",
					type: "frame",
					children: [
						image,
						{
							id: "group",
							type: "group",
							children: [video, audio],
							contents: [],
							activeContentId: null,
							mainContentId: null,
						},
					],
					contents: [],
					activeContentId: null,
					mainContentId: null,
				},
			],
			files: media.map(({ metadata }) => metadata),
			operation: "copy-elements",
			canvasId: "canvas-mixed",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload,
			files: media.map(({ metadata, file }) => ({ metadata, blob: file })),
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
		})

		const result = await controller.paste(undefined, target)

		expect(result.accepted.map((asset) => asset.type)).toEqual(["image", "video", "audio"])
		expect(result.accepted.map((asset) => asset.sourceElementId)).toEqual([
			"nested-image",
			"nested-video",
			"nested-audio",
		])
	})

	it("does not fall back to generation-resource blobs as attachments", async () => {
		const metadata = CanvasElementClipboard.createGenerationResourceMetadata({
			fileId: "generation-resource:0",
			resourcePath: "images/hidden.png",
			resourceIdentity: "workspace:/images/hidden.png",
			resourceAliases: ["./images/hidden.png"],
			filename: "hidden.png",
			mimeType: "image/png",
			fileSize: 6,
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [],
			files: [metadata],
			operation: "copy-elements",
			canvasId: "canvas-a",
		})
		const hiddenFile = new File(["hidden"], "hidden.png", { type: "image/png" })
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload,
			files: [{ metadata, blob: hiddenFile }],
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
		})

		const result = await controller.paste(undefined, target)

		expect(result.accepted).toHaveLength(0)
		expect(result.failed).toEqual([])
	})

	it("requires an explicit active content id", async () => {
		const image = {
			id: "image-without-active",
			type: "image" as const,
			contents: [{ contentId: "content-1", src: "image.png", status: "completed" as const }],
			activeContentId: null,
			mainContentId: "content-1",
		} as unknown as CanvasFileElement
		const metadata = CanvasElementClipboard.createFileMetadata({
			element: image as unknown as CanvasFileElement,
			fileId: "image-without-active:0",
			filename: "image.png",
			mimeType: "image/png",
			fileSize: 5,
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [image],
			files: [metadata],
			operation: "copy-elements",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload,
			files: [{ metadata, blob: new File(["image"], "image.png", { type: "image/png" }) }],
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
		})

		const result = await controller.paste(undefined, target)

		expect(result.accepted).toHaveLength(0)
	})

	it("materializes active media even when optional file metadata is unavailable", async () => {
		const image = {
			id: "image-without-metadata",
			type: "image" as const,
			contents: [
				{
					contentId: "active",
					src: "./images/without-metadata.png",
					status: "completed" as const,
				},
			],
			activeContentId: "active",
			mainContentId: "active",
		} as unknown as CanvasFileElement
		const payload = CanvasElementClipboard.createPayload({
			elements: [image],
			files: [],
			operation: "copy-elements",
			canvasId: "canvas-a",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({ payload, files: [] })
		const materialize = vi.fn(
			async (input: { fileName: string; mimeType: string }) =>
				new File(["image"], "", { type: input.mimeType }),
		)
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
			materialize,
		})

		const result = await controller.paste(undefined, target)

		expect(materialize).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceCanvasId: "canvas-a",
				sourcePath: "./images/without-metadata.png",
				fileName: "without-metadata.png",
			}),
		)
		expect(result.accepted[0]?.file?.name).toBe("without-metadata.png")
	})

	it("ignores malformed active content instead of throwing", async () => {
		const image = {
			id: "malformed-image",
			type: "image" as const,
			contents: [{ contentId: "active", src: 42, status: 123 }],
			activeContentId: "active",
			mainContentId: "active",
		} as unknown as CanvasFileElement
		const metadata = CanvasElementClipboard.createFileMetadata({
			element: image as unknown as CanvasFileElement,
			fileId: "malformed-image:0",
			filename: "malformed.png",
			mimeType: "image/png",
			fileSize: 1,
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [image],
			files: [metadata],
			operation: "copy-elements",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload,
			files: [{ metadata, blob: new File(["x"], "malformed.png", { type: "image/png" }) }],
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
		})

		await expect(controller.paste(undefined, target)).resolves.toEqual(
			expect.objectContaining({ accepted: [], failed: [] }),
		)
	})

	it("treats copy-as-png as a normal image file", async () => {
		const metadata = CanvasElementClipboard.createCanvasExportFileMetadata({
			fileId: "canvas-png:1",
			filename: "export.png",
			mimeType: "image/png",
			fileSize: 3,
			sourceElements: [],
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [],
			files: [metadata],
			operation: "copy-as-png",
			canvasId: "canvas-a",
		})
		const file = new File(["png"], "export.png", { type: "image/png" })
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload,
			files: [{ metadata, blob: file }],
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
		})

		const result = await controller.paste(undefined, target)
		expect(result.accepted[0]?.origin).toBe("canvas-export")
		expect(result.accepted[0]?.file?.name).toBe("export.png")
	})

	it("handles an empty private bundle without creating attachments", async () => {
		const payload = CanvasElementClipboard.createPayload({
			elements: [],
			files: [],
			operation: "copy-elements",
			canvasId: "canvas-a",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({ payload, files: [] })
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
		})

		const result = await controller.paste(undefined, target)

		expect(result.handled).toBe(true)
		expect(result.accepted).toEqual([])
		expect(result.failed).toEqual([])
	})

	it("rejects malformed bundle magic and invalid file ranges", async () => {
		const exported = createExportBundle({ filename: "range.png", mimeType: "image/png" })
		const malformedMagic = await readBlobBytes(exported.bundle)
		malformedMagic[0] = 0
		await expect(
			CanvasDesignClipboard.parseBundleBlob(
				new Blob([malformedMagic], { type: exported.bundle.type }),
			),
		).rejects.toThrow("magic mismatch")

		const second = createExportBundle({ filename: "range-2.png", mimeType: "image/png" })
		const payload = CanvasElementClipboard.createPayload({
			elements: [],
			files: [exported.metadata, second.metadata],
			operation: "copy-as-png",
		})
		const validBundle = CanvasDesignClipboard.createBundleBlob({
			payload,
			files: [
				{ metadata: exported.metadata, blob: exported.file },
				{ metadata: second.metadata, blob: second.file },
			],
		})
		const overlappingBundle = await rewriteBundleHeader(validBundle, (header) => {
			const files = header.files as Array<Record<string, unknown>>
			files[1].byteOffset = 0
		})

		await expect(CanvasDesignClipboard.parseBundleBlob(overlappingBundle)).rejects.toThrow(
			"Invalid CanvasDesign clipboard bundle file range",
		)
	})

	it("rejects bundle files whose header metadata does not match the payload", async () => {
		const exported = createExportBundle({ filename: "metadata.png", mimeType: "image/png" })
		const mismatchedBundle = await rewriteBundleHeader(exported.bundle, (header) => {
			const files = header.files as Array<Record<string, unknown>>
			files[0].role = "generation-resource"
		})

		await expect(CanvasDesignClipboard.parseBundleBlob(mismatchedBundle)).rejects.toThrow(
			"Invalid CanvasDesign clipboard bundle file metadata",
		)
	})

	it("rejects oversized bundles before reading their bytes", async () => {
		const arrayBuffer = vi.fn(async () => new ArrayBuffer(0))
		const oversizedBlob = { size: 200 * 1024 * 1024 + 1, arrayBuffer } as unknown as Blob

		await expect(CanvasDesignClipboard.parseBundleBlob(oversizedBlob)).rejects.toThrow(
			"exceeds size limit",
		)
		expect(arrayBuffer).not.toHaveBeenCalled()
	})

	it("rejects bundle ranges whose declared file size does not match the payload", async () => {
		const exported = createExportBundle({ filename: "size.png", mimeType: "image/png" })
		const mismatchedBundle = await rewriteBundleHeader(exported.bundle, (header) => {
			const files = header.files as Array<Record<string, unknown>>
			files[0].fileSize = 999
			const payload = header.payload as Record<string, unknown>
			const payloadFiles = payload.files as Array<Record<string, unknown>>
			payloadFiles[0].fileSize = 999
		})

		await expect(CanvasDesignClipboard.parseBundleBlob(mismatchedBundle)).rejects.toThrow(
			"Invalid CanvasDesign clipboard bundle file range",
		)
	})

	it("materializes a remote asset once for concurrent pastes", async () => {
		const materialize = vi.fn(
			async (input: { fileName: string; mimeType: string }) =>
				new File(["image"], input.fileName, { type: input.mimeType }),
		)
		const metadata = CanvasElementClipboard.createCanvasExportFileMetadata({
			fileId: "export",
			filename: "same.png",
			mimeType: "image/png",
			fileSize: 0,
			sourceElements: [],
			sourceRef: { src: "same.png", ossUrl: "https://example.test/same.png" },
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [],
			files: [metadata],
			operation: "copy-as-png",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({ payload, files: [] })
		const read = vi.fn(async () => [
			createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
		])
		const controller = new CanvasClipboardPasteController({ read, materialize })
		const [first, second] = await Promise.all([
			controller.paste(undefined, target),
			controller.paste(undefined, target),
		])
		expect(read).toHaveBeenCalledTimes(2)
		expect(materialize).toHaveBeenCalledTimes(1)
		expect(first.accepted[0]?.file?.name).toBe("same.png")
		expect(second.accepted[0]?.file?.name).toBe("same.png")
	})

	it("reads Clipboard API once for the same paste event", async () => {
		const exported = createExportBundle({ filename: "once.png", mimeType: "image/png" })
		const read = vi.fn(async () => [
			createClipboardItem(
				exported.bundle,
				"web application/x-canvas-design-clipboard-bundle",
			),
		])
		const event = createPasteEvent({
			types: ["web application/x-canvas-design-clipboard-bundle"],
		})
		const controller = new CanvasClipboardPasteController({ read })

		await Promise.all([controller.paste(event, target), controller.paste(event, target)])

		expect(read).toHaveBeenCalledTimes(1)
	})

	it("detects private MIME exposed only on ClipboardEvent.items", async () => {
		const read = vi.fn(async () => [])
		const preventDefault = vi.fn()
		const stopPropagation = vi.fn()
		const event = {
			clipboardData: {
				types: [],
				files: [],
				items: [
					{
						kind: "string",
						type: "web application/x-canvas-design-clipboard-bundle",
						getAsFile: () => null,
					},
				],
			},
			preventDefault,
			stopPropagation,
		} as unknown as ClipboardEvent

		expect(hasCanvasClipboardMimeType(event)).toBe(true)
		const controller = new CanvasClipboardPasteController({ read })
		const result = await controller.paste(event, target)

		expect(result.handled).toBe(true)
		expect(read).toHaveBeenCalledTimes(1)
		expect(preventDefault).toHaveBeenCalledTimes(1)
		expect(stopPropagation).toHaveBeenCalledTimes(1)
	})

	it("reads a bundle when ClipboardItem exposes a case-variant MIME", async () => {
		const exported = createExportBundle({ filename: "case.png", mimeType: "image/png" })
		const caseVariantMime = "WEB APPLICATION/X-CANVAS-DESIGN-CLIPBOARD-BUNDLE"
		const read = vi.fn(async () => [createClipboardItem(exported.bundle, caseVariantMime)])
		const controller = new CanvasClipboardPasteController({ read })
		const event = createPasteEvent({ types: [caseVariantMime] })

		expect(hasCanvasClipboardMimeType(event)).toBe(true)
		const result = await controller.paste(event, target)

		expect(result.accepted[0]?.fileName).toBe("case.png")
		expect(read).toHaveBeenCalledTimes(1)
	})

	it("detects case-variant text MIME so controls preserve native text paste", () => {
		expect(hasCanvasClipboardTextOrHtml(["TEXT/PLAIN"])).toBe(true)
		expect(hasCanvasClipboardTextOrHtml(["Text/Html"])).toBe(true)
		expect(hasCanvasClipboardTextOrHtml(["Files"])).toBe(false)
	})

	it("claims a handled event across competing editor controllers", async () => {
		const exported = createExportBundle({ filename: "shared.png", mimeType: "image/png" })
		const event = createPasteEvent({
			types: ["web application/x-canvas-design-clipboard-bundle"],
		})
		const firstAssets: string[] = []
		const secondAssets: string[] = []
		const firstController = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(
					exported.bundle,
					"web application/x-canvas-design-clipboard-bundle",
				),
			],
		})
		const secondController = new CanvasClipboardPasteController({
			read: async () => {
				throw new Error("must not read a claimed event")
			},
		})

		const [first, second] = await Promise.all([
			firstController.paste(event, target, {
				onAsset: (asset) => {
					firstAssets.push(asset.fileName)
				},
			}),
			secondController.paste(event, target, {
				onAsset: (asset) => {
					secondAssets.push(asset.fileName)
				},
			}),
		])

		expect(first.accepted).toHaveLength(1)
		expect(firstAssets).toEqual(["shared.png"])
		expect(second.handled).toBe(true)
		expect(second.accepted).toBe(first.accepted)
		expect(secondAssets).toEqual([])
	})

	it("keeps separately configured hosts isolated across mount and unmount", () => {
		const methodsA = { clipboard: { read: vi.fn(async () => []) } }
		const methodsB = { clipboard: { read: vi.fn(async () => []) } }
		const controllerA = configureCanvasClipboardPasteHost(methodsA)
		const controllerB = configureCanvasClipboardPasteHost(methodsB)

		expect(getCanvasClipboardPasteController(methodsA)).toBe(controllerA)
		expect(getCanvasClipboardPasteController(methodsB)).toBe(controllerB)

		releaseCanvasClipboardPasteHost(controllerB)
		expect(getCanvasClipboardPasteController(methodsA)).toBe(controllerA)
		releaseCanvasClipboardPasteHost(controllerA)
	})

	it("does not fetch remote references without host materialization", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch")
		const resolver = new CanvasClipboardAssetResolver()

		await expect(
			resolver.materializeAsset({
				sourceRef: { ossUrl: "https://untrusted.example/asset.png" },
				fileName: "asset.png",
				mimeType: "image/png",
			}),
		).resolves.toBeNull()
		expect(fetchSpy).not.toHaveBeenCalled()
		fetchSpy.mockRestore()
	})

	it("handles external media returned only by Clipboard API", async () => {
		const preventDefault = vi.fn()
		const stopPropagation = vi.fn()
		const event = createPasteEvent({
			preventDefault,
			stopPropagation,
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(new Blob(["image"], { type: "image/png" }), "image/png"),
			],
		})

		const result = await controller.paste(event, target)

		expect(result.accepted[0]?.fileName).toBe("image.png")
		expect(preventDefault).toHaveBeenCalledTimes(1)
		expect(stopPropagation).toHaveBeenCalledTimes(1)
	})

	it("does not prevent default for an unavailable unknown clipboard", async () => {
		const preventDefault = vi.fn()
		const stopPropagation = vi.fn()
		const event = createPasteEvent({ preventDefault, stopPropagation })
		const controller = new CanvasClipboardPasteController({
			read: async () => null as unknown as ClipboardItem[],
		})

		const result = await controller.paste(event, target)

		expect(result).toEqual({ handled: false, accepted: [], skipped: [], failed: [] })
		expect(preventDefault).not.toHaveBeenCalled()
		expect(stopPropagation).not.toHaveBeenCalled()
	})

	it("normalizes generic media MIME from the filename", async () => {
		const metadata = CanvasElementClipboard.createCanvasExportFileMetadata({
			fileId: "export:generic",
			filename: "from-canvas.png",
			mimeType: "application/octet-stream",
			fileSize: 5,
			sourceElements: [],
		})
		const sourceFile = new File(["image"], "from-canvas.png", {
			type: "application/octet-stream",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload: CanvasElementClipboard.createPayload({
				elements: [],
				files: [metadata],
				operation: "copy-as-png",
			}),
			files: [{ metadata, blob: sourceFile }],
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
		})

		const result = await controller.paste(undefined, {
			...target,
			acceptedTypes: ["image"],
		})

		expect(result.accepted[0]?.file?.type).toBe("image/png")
	})

	it("falls back to synchronous files when a private bundle is unreadable", async () => {
		const preventDefault = vi.fn()
		const fallback = new File(["fallback"], "fallback.png", { type: "image/png" })
		const event = createPasteEvent({
			types: ["web application/x-canvas-design-clipboard-bundle", "image/png"],
			files: [fallback],
			preventDefault,
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				{
					types: ["web application/x-canvas-design-clipboard-bundle"],
					getType: async () => {
						throw new Error("corrupt bundle")
					},
				} as unknown as ClipboardItem,
			],
		})

		const result = await controller.paste(event, target)

		expect(preventDefault).toHaveBeenCalledTimes(1)
		expect(result.accepted[0]?.fileName).toBe("fallback.png")
		expect(result.failed).toEqual([])
	})

	it("prefers a hidden private bundle over native files for MessageEditor", async () => {
		const element = {
			id: "image-hidden-mime",
			type: "image",
			contents: [{ contentId: "active", src: "./images/source.png", status: "completed" }],
			activeContentId: "active",
			mainContentId: "active",
		} as unknown as CanvasFileElement
		const file = new File(["image"], "source.png", { type: "image/png" })
		const metadata = CanvasElementClipboard.createFileMetadata({
			element,
			fileId: "source-file",
			filename: file.name,
			mimeType: file.type,
			fileSize: file.size,
			sourceProjectId: "project-a",
			sourceFileId: "source-file",
			projectPath: "/images/source.png",
			resourceIdentity: "workspace:/project-a/images/source.png",
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [element],
			files: [metadata],
			operation: "copy-elements",
			canvasId: "canvas-a",
			projectId: "project-a",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload,
			// Element copy keeps the bytes on the synchronous native file channel;
			// the private bundle only carries metadata in this browser path.
			files: [],
		})
		const preventDefault = vi.fn()
		const stopPropagation = vi.fn()
		const event = createPasteEvent({
			types: ["Files"],
			files: [file],
			preventDefault,
			stopPropagation,
		})
		const resolveReference = vi.fn(async () => ({
			kind: "project" as const,
			path: "/images/source.png",
			projectPath: "/images/source.png",
			fileId: "source-file",
			resourceIdentity: "workspace:/project-a/images/source.png",
			fileName: file.name,
		}))
		const onAsset = vi.fn()
		const onExternalFile = vi.fn()
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
			resolveReference,
		})

		const result = await controller.paste(
			event,
			{
				...target,
				projectId: "project-a",
				preferPrivateBundleWithNativeFallback: true,
			},
			{ onAsset, onExternalFile },
		)

		expect(result.accepted).toHaveLength(1)
		expect(result.accepted[0]).toMatchObject({
			fileName: "source.png",
			reference: expect.objectContaining({ kind: "project", fileId: "source-file" }),
		})
		expect(resolveReference).toHaveBeenCalledTimes(1)
		expect(onAsset).toHaveBeenCalledTimes(1)
		expect(onExternalFile).not.toHaveBeenCalled()
		expect(preventDefault).toHaveBeenCalledTimes(1)
		expect(stopPropagation).toHaveBeenCalledTimes(1)
	})

	it("uses native files when the hidden private bundle cannot be read", async () => {
		const fallback = new File(["fallback"], "fallback.png", { type: "image/png" })
		const event = createPasteEvent({ types: ["Files"], files: [fallback] })
		;(event.clipboardData as unknown as { getData: (type: string) => string }).getData = (
			type,
		) => (type === "text/plain" ? "before" : type === "text/html" ? "<b>before</b>" : "")
		const onExternalFile = vi.fn()
		const controller = new CanvasClipboardPasteController({
			read: async () => {
				throw new Error("clipboard permission denied")
			},
		})

		const result = await controller.paste(
			event,
			{
				...target,
				preferPrivateBundleWithNativeFallback: true,
			},
			{ onExternalFile },
		)

		expect(result.accepted).toHaveLength(1)
		expect(result.accepted[0]).toMatchObject({
			origin: "external-file",
			fileName: "fallback.png",
			file: fallback,
		})
		expect(onExternalFile).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: "fallback.png" }),
			{ text: "before", html: "<b>before</b>" },
		)
	})

	it("does not downgrade private clipboard media to external attachments when the bundle is corrupt", async () => {
		const privateItem = {
			types: ["web application/x-canvas-design-clipboard-bundle", "image/png"],
			getType: async (type: string) => {
				if (type === "image/png") return new Blob(["hidden"], { type })
				throw new Error("corrupt bundle")
			},
		} as unknown as ClipboardItem
		const event = createPasteEvent({
			types: ["web application/x-canvas-design-clipboard-bundle", "image/png"],
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [privateItem],
		})

		const result = await controller.paste(event, target)

		expect(result.accepted).toHaveLength(0)
		expect(result.failed.map((item) => item.reason)).toContain("corrupt bundle")
		expect(privateItem.getType).toBeDefined()
	})

	it("filters duplicate identities, unsupported types, and limits before materialization", async () => {
		const imageA = createExportBundle({
			filename: "a.png",
			mimeType: "image/png",
			resourceIdentity: "workspace:/images/shared.png",
			resourceAliases: ["./images/shared.png"],
		})
		const imageB = createExportBundle({
			filename: "b.png",
			mimeType: "image/png",
			resourceIdentity: "workspace:/images/shared.png",
			resourceAliases: ["/images/shared.png"],
		})
		const videoMetadata = CanvasElementClipboard.createCanvasExportFileMetadata({
			fileId: "video-export",
			filename: "clip.mp4",
			mimeType: "video/mp4",
			fileSize: 0,
			sourceElements: [],
		})
		const video = {
			metadata: videoMetadata,
			file: new File(["video"], "clip.mp4", { type: "video/mp4" }),
		}
		const payload = CanvasElementClipboard.createPayload({
			elements: [],
			files: [imageA.metadata, imageB.metadata, video.metadata],
			operation: "copy-as-png",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload,
			files: [],
		})
		const materialize = vi.fn(
			async (input: { fileName: string; mimeType: string }) =>
				new File(["materialized"], input.fileName, { type: input.mimeType }),
		)
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
			materialize,
		})

		const result = await controller.paste(undefined, {
			...target,
			acceptedTypes: ["image"],
			maxCount: 1,
			maxCountByType: { image: 1 },
		})

		expect(result.accepted).toHaveLength(1)
		expect(result.skipped.map((item) => item.reason)).toEqual(["duplicate", "type-limit"])
		expect(materialize).toHaveBeenCalledTimes(1)
	})

	it("does not deduplicate distinct unnamed resources by filename alone", async () => {
		const firstMetadata = CanvasElementClipboard.createCanvasExportFileMetadata({
			fileId: "export:first",
			filename: "canvas.png",
			mimeType: "image/png",
			fileSize: 5,
			sourceElements: [],
		})
		const secondMetadata = CanvasElementClipboard.createCanvasExportFileMetadata({
			fileId: "export:second",
			filename: "canvas.png",
			mimeType: "image/png",
			fileSize: 6,
			sourceElements: [],
		})
		const firstFile = new File(["first"], "canvas.png", { type: "image/png" })
		const secondFile = new File(["second"], "canvas.png", { type: "image/png" })
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload: CanvasElementClipboard.createPayload({
				elements: [],
				files: [firstMetadata, secondMetadata],
				operation: "copy-as-png",
			}),
			files: [
				{ metadata: firstMetadata, blob: firstFile },
				{ metadata: secondMetadata, blob: secondFile },
			],
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
		})

		const result = await controller.paste(undefined, {
			...target,
			acceptedTypes: ["image"],
		})

		expect(result.accepted.map((asset) => asset.fileName)).toEqual(["canvas.png", "canvas.png"])
		expect(result.skipped).toEqual([])
	})

	it("allows a later inline duplicate when the first source cannot be materialized", async () => {
		const first = createExportBundle({
			filename: "missing.png",
			mimeType: "image/png",
			resourceIdentity: "workspace:/images/fallback.png",
		})
		const fallback = createExportBundle({
			filename: "fallback.png",
			mimeType: "image/png",
			resourceIdentity: "workspace:/images/fallback.png",
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [],
			files: [first.metadata, fallback.metadata],
			operation: "copy-as-png",
			canvasId: "canvas-a",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload,
			files: [{ metadata: fallback.metadata, blob: fallback.file }],
		})
		const materialize = vi.fn(async () => null)
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
			materialize,
		})

		const result = await controller.paste(undefined, target)

		expect(result.accepted.map((asset) => asset.fileName)).toEqual(["fallback.png"])
		expect(result.failed).toEqual([
			{ reason: "resource-materialize-failed", fileName: "missing.png" },
		])
		expect(materialize).toHaveBeenCalledTimes(1)
	})

	it("does not read Clipboard API for ordinary text or HTML", async () => {
		const read = vi.fn(async () => [])
		const event = createPasteEvent({ types: ["text/plain", "text/html"] })
		const controller = new CanvasClipboardPasteController({ read })

		const result = await controller.paste(event, target)

		expect(result.handled).toBe(false)
		expect(read).not.toHaveBeenCalled()
	})

	it("reports failed materialization without leaking source URLs", async () => {
		const exported = createExportBundle({
			filename: "remote.png",
			mimeType: "image/png",
			content: "",
			sourceRef: { src: "./images/remote.png", ossUrl: "https://example.test/remote.png" },
		})
		const payload = CanvasElementClipboard.createPayload({
			elements: [],
			files: [exported.metadata],
			operation: "copy-as-png",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({ payload, files: [] })
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
			materialize: async () => null,
		})

		const result = await controller.paste(undefined, target)

		expect(result.accepted).toHaveLength(0)
		expect(result.failed[0]).toEqual({
			reason: "resource-materialize-failed",
			fileName: "remote.png",
		})
	})

	it("rejects a materialized file whose MIME family differs from metadata", async () => {
		const exported = createExportBundle({ filename: "expected.png", mimeType: "image/png" })
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload: CanvasElementClipboard.createPayload({
				elements: [],
				files: [exported.metadata],
				operation: "copy-as-png",
				canvasId: "canvas-a",
			}),
			files: [],
		})
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
			materialize: async (input) =>
				new File(["video"], input.fileName.replace(".png", ".mp4"), {
					type: "video/mp4",
				}),
		})

		const result = await controller.paste(undefined, target)

		expect(result.accepted).toEqual([])
		expect(result.failed).toEqual([
			{ reason: "resource-materialize-failed", fileName: "expected.png" },
		])
	})

	it("reuses a project reference for repeated paste without applying the count limit", async () => {
		const image = {
			id: "image-repeat",
			type: "image" as const,
			contents: [{ contentId: "active", src: "./images/repeat.png", status: "completed" }],
			activeContentId: "active",
			mainContentId: "active",
		} as unknown as CanvasFileElement
		const identity = "workspace:/canvas-a/images/repeat.png"
		const metadata = CanvasElementClipboard.createFileMetadata({
			element: image,
			fileId: "file-repeat",
			filename: "repeat.png",
			mimeType: "image/png",
			fileSize: 5,
			resourceIdentity: identity,
			sourceFileId: "file-repeat",
			projectPath: "/canvas-a/images/repeat.png",
			sourceProjectId: "project-a",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload: CanvasElementClipboard.createPayload({
				elements: [image as unknown as CanvasFileElement],
				files: [metadata],
				operation: "copy-elements",
				canvasId: "canvas-a",
				projectId: "project-a",
			}),
			files: [],
		})
		const resolveReference = vi.fn(async () => ({
			kind: "project" as const,
			path: "/canvas-a/images/repeat.png",
			projectPath: "/canvas-a/images/repeat.png",
			fileId: "file-repeat",
			resourceIdentity: identity,
			fileName: "repeat.png",
		}))
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
			],
			resolveReference,
		})
		const pasted: CanvasClipboardAsset[] = []
		const pasteTarget: CanvasClipboardTarget = {
			control: "message-editor",
			acceptedTypes: ["image"],
			projectId: "project-a",
			hasProjectContext: true,
			maxCount: 0,
			existingResourceKeys: [identity, "file-repeat"],
			sessionId: "repeat-test",
		}

		const first = await controller.paste(undefined, pasteTarget, {
			onAsset: (asset) => {
				pasted.push(asset)
			},
		})
		const second = await controller.paste(undefined, pasteTarget, {
			onAsset: (asset) => {
				pasted.push(asset)
			},
		})

		expect(first.accepted).toHaveLength(1)
		expect(second.accepted).toHaveLength(1)
		expect(pasted).toHaveLength(2)
		expect(resolveReference).toHaveBeenCalledTimes(1)
	})

	it("adapts nested controller input to the host reference resolver", async () => {
		const identity = "workspace:/canvas-a/images/reused.png"
		const image = {
			id: "image-adapter",
			type: "image" as const,
			name: "reused",
			activeContentId: "content-adapter",
			contents: [{ contentId: "content-adapter", src: "./images/reused.png" }],
		}
		const metadata = CanvasElementClipboard.createFileMetadata({
			element: image as unknown as CanvasFileElement,
			fileId: "file-adapter",
			filename: "reused.png",
			mimeType: "image/png",
			fileSize: 0,
			resourceIdentity: identity,
			sourceFileId: "file-adapter",
			projectPath: "/canvas-a/images/reused.png",
			sourceProjectId: "project-a",
		})
		const bundle = CanvasDesignClipboard.createBundleBlob({
			payload: CanvasElementClipboard.createPayload({
				elements: [image as unknown as CanvasFileElement],
				files: [metadata],
				operation: "copy-elements",
				canvasId: "canvas-a",
				projectId: "project-a",
			}),
			files: [],
		})
		const hostResolver = vi.fn(async (input) => ({
			kind: "current-canvas" as const,
			path: "./images/reused.png",
			resourceIdentity: input.resourceIdentity ?? identity,
			fileName: input.fileName ?? "reused.png",
		}))
		const controller = createCanvasClipboardPasteControllerFromMethods({
			clipboard: {
				read: async () => [
					createClipboardItem(bundle, "web application/x-canvas-design-clipboard-bundle"),
				],
			},
			resolveCanvasClipboardReference: hostResolver,
		})

		const result = await controller.paste(undefined, {
			control: "image-editor",
			acceptedTypes: ["image"],
			projectId: "project-a",
			canvasId: "canvas-a",
			sessionId: "adapter-test",
		})

		expect(result.accepted).toHaveLength(1)
		expect(result.accepted[0]?.reference?.path).toBe("./images/reused.png")
		expect(hostResolver).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceCanvasId: "canvas-a",
				sourceProjectId: "project-a",
				sourceFileId: "file-adapter",
				resourceIdentity: identity,
				targetProjectId: "project-a",
				targetCanvasId: "canvas-a",
				target: "canvas-editor",
			}),
		)
	})

	it("accepts a MessageEditor project-file mention in an image editor", async () => {
		const metadata = btoa(
			encodeURIComponent(
				JSON.stringify({
					mentions: [
						{
							attrs: {
								type: "project_file",
								data: {
									file_id: "message-file",
									project_id: "project-a",
									file_path: "/CanvasA/images/message.png",
									file_name: "message.png",
								},
							},
						},
					],
				}),
			),
		)
		const event = {
			clipboardData: {
				types: ["text/html", "text/x-magic-message-mentions"],
				files: [],
				items: [],
				getData: (type: string) =>
					type === "text/html" ? `<div data-magic-clipboard="${metadata}"></div>` : "",
			},
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ClipboardEvent
		const resolver = vi.fn(async () => ({
			kind: "current-canvas" as const,
			path: "./images/message.png",
			resourceIdentity: "message-file",
			fileName: "message.png",
		}))
		const materialize = vi.fn(async () => null)
		const controller = new CanvasClipboardPasteController({
			resolveReference: resolver,
			materialize,
		})

		const result = await controller.paste(event, {
			control: "image-editor",
			acceptedTypes: ["image"],
			projectId: "project-a",
			canvasId: "canvas-a",
			sessionId: "message-reference-test",
		})

		expect(result.accepted).toHaveLength(1)
		expect(result.accepted[0]?.reference?.path).toBe("./images/message.png")
		expect(materialize).not.toHaveBeenCalled()
		expect(event.preventDefault).toHaveBeenCalled()
	})

	it("preserves mixed MessageEditor text and media order in rich-text mode", async () => {
		const metadata = btoa(
			encodeURIComponent(
				JSON.stringify({
					richText: JSON.stringify({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{ type: "text", text: "before " },
									{
										type: "mention",
										attrs: {
											type: "project_file",
											data: {
												file_id: "mixed-image",
												project_id: "project-a",
												file_path: "images/mixed.png",
												file_name: "mixed.png",
											},
										},
									},
									{ type: "text", text: " after" },
								],
							},
						],
					}),
				}),
			),
		)
		const event = {
			clipboardData: {
				types: ["text/html", "text/x-magic-message-rich-text"],
				files: [],
				items: [],
				getData: (type: string) =>
					type === "text/html" ? `<div data-magic-clipboard="${metadata}"></div>` : "",
			},
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ClipboardEvent
		const onMessageParts = vi.fn()
		const controller = new CanvasClipboardPasteController({
			resolveReference: vi.fn(async () => ({
				kind: "current-canvas" as const,
				path: "./images/mixed.png",
				resourceIdentity: "mixed-image",
				fileName: "mixed.png",
			})),
		})

		const result = await controller.paste(
			event,
			{
				control: "image-editor",
				acceptedTypes: ["image"],
				messagePasteMode: "rich-text-with-media",
				sessionId: "mixed-message-test",
			},
			{ onMessageParts },
		)

		expect(result.handled).toBe(true)
		expect(result.accepted).toHaveLength(1)
		expect(onMessageParts).toHaveBeenCalledTimes(1)
		expect(onMessageParts.mock.calls[0][0].map((part: { kind: string }) => part.kind)).toEqual([
			"text",
			"asset",
			"text",
		])
		expect(event.preventDefault).toHaveBeenCalledTimes(1)
	})

	it("invokes onMessageParts before host reference resolve finishes", async () => {
		const metadata = btoa(
			encodeURIComponent(
				JSON.stringify({
					richText: JSON.stringify({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{ type: "text", text: "hi " },
									{
										type: "mention",
										attrs: {
											type: "project_file",
											data: {
												file_id: "early-image",
												file_path: "images/early.png",
												file_name: "early.png",
											},
										},
									},
								],
							},
						],
					}),
				}),
			),
		)
		const event = {
			clipboardData: {
				types: ["text/html"],
				files: [],
				items: [],
				getData: (type: string) =>
					type === "text/html" ? `<div data-magic-clipboard="${metadata}"></div>` : "",
			},
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ClipboardEvent

		let releaseResolve!: (value: {
			kind: "current-canvas"
			path: string
			resourceIdentity: string
			fileName: string
		}) => void
		const resolveReference = vi.fn(
			() =>
				new Promise<{
					kind: "current-canvas"
					path: string
					resourceIdentity: string
					fileName: string
				}>((resolve) => {
					releaseResolve = resolve
				}),
		)
		const onMessageParts = vi.fn(
			async (parts: Array<{ kind: string; asset?: { reference?: unknown } }>) => {
				const assetPart = parts.find((part) => part.kind === "asset")
				expect(assetPart?.asset?.reference).toBeUndefined()
			},
		)
		const onMessageAssetResolved = vi.fn()
		const controller = new CanvasClipboardPasteController({ resolveReference })

		const pastePromise = controller.paste(
			event,
			{
				control: "image-editor",
				acceptedTypes: ["image"],
				messagePasteMode: "rich-text-with-media",
				sessionId: "early-message-test",
			},
			{ onMessageParts, onMessageAssetResolved },
		)

		await vi.waitFor(() => expect(onMessageParts).toHaveBeenCalledTimes(1))
		expect(onMessageAssetResolved).not.toHaveBeenCalled()

		releaseResolve({
			kind: "current-canvas",
			path: "./images/early.png",
			resourceIdentity: "early-image",
			fileName: "early.png",
		})
		await pastePromise

		expect(onMessageAssetResolved).toHaveBeenCalledTimes(1)
		expect(onMessageAssetResolved.mock.calls[0][1]).toMatchObject({
			reference: expect.objectContaining({ path: "./images/early.png" }),
		})
	})

	it("does not claim malformed MessageEditor metadata", async () => {
		const event = {
			clipboardData: {
				types: ["text/html", "text/x-magic-message-rich-text"],
				files: [],
				items: [],
				getData: (type: string) =>
					type === "text/html"
						? '<div data-magic-clipboard="not-valid-base64"></div>'
						: "{not-json",
			},
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ClipboardEvent
		const controller = new CanvasClipboardPasteController()

		const result = await controller.paste(event, {
			control: "image-editor",
			acceptedTypes: ["image"],
			messagePasteMode: "rich-text-with-media",
			sessionId: "malformed-message-test",
		})

		expect(result.handled).toBe(false)
		expect(event.preventDefault).not.toHaveBeenCalled()
		expect(event.stopPropagation).not.toHaveBeenCalled()
	})

	it("preserves text when a MessageEditor mention is unsupported by the target", async () => {
		const metadata = btoa(
			encodeURIComponent(
				JSON.stringify({
					richText: JSON.stringify({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{ type: "text", text: "before " },
									{
										type: "mention",
										attrs: {
											type: "project_file",
											data: {
												file_id: "unsupported-video",
												file_path: "videos/unsupported.mp4",
												file_name: "unsupported.mp4",
											},
										},
									},
									{ type: "text", text: " after" },
								],
							},
						],
					}),
				}),
			),
		)
		const event = {
			clipboardData: {
				types: ["text/html"],
				files: [],
				items: [],
				getData: (type: string) =>
					type === "text/html" ? `<div data-magic-clipboard="${metadata}"></div>` : "",
			},
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ClipboardEvent
		const onMessageParts = vi.fn()
		const resolveReference = vi.fn()
		const controller = new CanvasClipboardPasteController({ resolveReference })

		const result = await controller.paste(
			event,
			{
				control: "image-editor",
				acceptedTypes: ["image"],
				messagePasteMode: "rich-text-with-media",
				sessionId: "unsupported-message-test",
			},
			{ onMessageParts },
		)

		expect(result.handled).toBe(true)
		expect(result.accepted).toHaveLength(0)
		expect(result.skipped).toEqual([
			{ reason: "unsupported-type", fileName: "unsupported.mp4" },
		])
		expect(resolveReference).not.toHaveBeenCalled()
		expect(
			onMessageParts.mock.calls[0][0]
				.filter((part: { kind: string }) => part.kind === "text")
				.map((part: { text: string }) => part.text)
				.join(""),
		).toBe("before @unsupported.mp4 after")
	})

	it("reuses resource resolution while preserving repeated mention occurrences", async () => {
		const metadata = btoa(
			encodeURIComponent(
				JSON.stringify({
					richText: JSON.stringify({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{
										type: "mention",
										attrs: {
											type: "project_file",
											data: {
												file_id: "repeated-image",
												file_path: "images/repeated.png",
												file_name: "repeated.png",
											},
										},
									},
									{
										type: "mention",
										attrs: {
											type: "project_file",
											data: {
												file_id: "repeated-image",
												file_path: "images/repeated.png",
												file_name: "repeated.png",
											},
										},
									},
								],
							},
						],
					}),
				}),
			),
		)
		const event = {
			clipboardData: {
				types: ["text/html"],
				files: [],
				items: [],
				getData: (type: string) =>
					type === "text/html" ? `<div data-magic-clipboard="${metadata}"></div>` : "",
			},
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ClipboardEvent
		const onMessageParts = vi.fn()
		const resolveReference = vi.fn(async () => ({
			kind: "current-canvas" as const,
			path: "./images/repeated.png",
			resourceIdentity: "repeated-image",
			fileName: "repeated.png",
		}))
		const controller = new CanvasClipboardPasteController({ resolveReference })

		const result = await controller.paste(
			event,
			{
				control: "image-editor",
				acceptedTypes: ["image"],
				messagePasteMode: "rich-text-with-media",
				sessionId: "repeated-message-test",
			},
			{ onMessageParts },
		)

		expect(resolveReference).toHaveBeenCalledTimes(1)
		expect(result.accepted).toHaveLength(2)
		expect(
			onMessageParts.mock.calls[0][0].filter(
				(part: { kind: string }) => part.kind === "asset",
			),
		).toHaveLength(2)
	})

	it("does not reread the system clipboard for a valid MessageEditor MIME payload", async () => {
		const event = {
			clipboardData: {
				types: ["text/x-magic-message-mentions"],
				files: [],
				items: [],
				getData: (type: string) =>
					type === "text/x-magic-message-mentions"
						? JSON.stringify([
								{
									attrs: {
										type: "project_file",
										data: {
											file_id: "mime-only-image",
											file_path: "images/mime-only.png",
											file_name: "mime-only.png",
										},
									},
								},
							])
						: "",
			},
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ClipboardEvent
		const read = vi.fn(async () => [])
		const controller = new CanvasClipboardPasteController({
			read,
			resolveReference: vi.fn(async () => ({
				kind: "current-canvas" as const,
				path: "./images/mime-only.png",
				resourceIdentity: "mime-only-image",
				fileName: "mime-only.png",
			})),
		})

		const result = await controller.paste(event, {
			control: "image-editor",
			acceptedTypes: ["image"],
			messagePasteMode: "rich-text-with-media",
			sessionId: "mime-only-message-test",
		})

		expect(result.accepted).toHaveLength(1)
		expect(read).not.toHaveBeenCalled()
	})

	it("falls back to native media when custom clipboard MIME is unsupported", () => {
		class MockClipboardItem {
			static supports(type: string) {
				return type === "image/png"
			}

			types: string[]

			constructor(items: Record<string, Blob>) {
				this.types = Object.keys(items)
			}
		}

		vi.stubGlobal("ClipboardItem", MockClipboardItem)
		try {
			const item = CanvasDesignClipboard.createBundleItem({
				bundleBlob: new Blob(["bundle"]),
				native: { mimeType: "image/png", blob: new Blob(["image"], { type: "image/png" }) },
			})
			expect(item.types).toEqual(["image/png"])
		} finally {
			vi.unstubAllGlobals()
		}
	})

	it("runs onSettled when the paste session becomes stale", async () => {
		const exported = createExportBundle({ filename: "stale.png", mimeType: "image/png" })
		const controller = new CanvasClipboardPasteController({
			read: async () => [
				createClipboardItem(
					exported.bundle,
					"web application/x-canvas-design-clipboard-bundle",
				),
			],
		})
		let isCurrent = true
		const onComplete = vi.fn()
		const onSettled = vi.fn()

		const result = await controller.paste(
			undefined,
			{
				control: "image-editor",
				acceptedTypes: ["image"],
				sessionId: "stale-session",
			},
			{
				onAsset: () => {
					isCurrent = false
				},
				onComplete,
				onSettled,
				isSessionCurrent: () => isCurrent,
			},
		)

		expect(result.accepted).toHaveLength(0)
		expect(onComplete).not.toHaveBeenCalled()
		expect(onSettled).toHaveBeenCalledWith(result)
	})

	it("allows a repeated message-reference paste through count limits when keys already exist", async () => {
		const metadata = btoa(
			encodeURIComponent(
				JSON.stringify({
					richText: JSON.stringify({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{
										type: "mention",
										attrs: {
											type: "project_file",
											data: {
												file_id: "file-repeat",
												file_path: "images/repeat.png",
												file_name: "repeat.png",
											},
										},
									},
								],
							},
						],
					}),
				}),
			),
		)
		const event = {
			clipboardData: {
				types: ["text/html"],
				files: [],
				items: [],
				getData: (type: string) =>
					type === "text/html" ? `<div data-magic-clipboard="${metadata}"></div>` : "",
			},
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ClipboardEvent
		const resolveReference = vi.fn(async () => ({
			kind: "current-canvas" as const,
			path: "./images/repeat.png",
			resourceIdentity: "workspace:/canvas-a/images/repeat.png",
			fileName: "repeat.png",
			fileId: "file-repeat",
		}))
		const controller = new CanvasClipboardPasteController({ resolveReference })
		const onMessageParts = vi.fn()

		const result = await controller.paste(
			event,
			{
				control: "image-editor",
				acceptedTypes: ["image"],
				messagePasteMode: "rich-text-with-media",
				maxCount: 0,
				existingResourceKeys: ["file-repeat", "workspace:/canvas-a/images/repeat.png"],
				sessionId: "existing-message-keys",
			},
			{ onMessageParts },
		)

		expect(result.accepted).toHaveLength(1)
		expect(result.skipped).toEqual([])
		expect(onMessageParts).toHaveBeenCalledTimes(1)
		expect(resolveReference).toHaveBeenCalledTimes(1)
	})

	it("removes failed message assets from accepted after resolve fails", async () => {
		const metadata = btoa(
			encodeURIComponent(
				JSON.stringify({
					richText: JSON.stringify({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{
										type: "mention",
										attrs: {
											type: "project_file",
											data: {
												file_id: "missing-image",
												file_path: "images/missing.png",
												file_name: "missing.png",
											},
										},
									},
								],
							},
						],
					}),
				}),
			),
		)
		const event = {
			clipboardData: {
				types: ["text/html"],
				files: [],
				items: [],
				getData: (type: string) =>
					type === "text/html" ? `<div data-magic-clipboard="${metadata}"></div>` : "",
			},
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ClipboardEvent
		const controller = new CanvasClipboardPasteController({
			resolveReference: vi.fn(async () => null),
			materialize: vi.fn(async () => null),
		})

		const result = await controller.paste(
			event,
			{
				control: "image-editor",
				acceptedTypes: ["image"],
				messagePasteMode: "rich-text-with-media",
				sessionId: "failed-accepted-cleanup",
			},
			{ onMessageParts: vi.fn(), onMessageAssetResolved: vi.fn() },
		)

		expect(result.accepted).toEqual([])
		expect(result.failed).toEqual([
			{ reason: "resource-materialize-failed", fileName: "missing.png" },
		])
	})

	it("removes failed message assets from accepted in the legacy onAsset path", async () => {
		const metadata = btoa(
			encodeURIComponent(
				JSON.stringify({
					richText: JSON.stringify({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{
										type: "mention",
										attrs: {
											type: "project_file",
											data: {
												file_id: "missing-legacy",
												file_path: "images/missing-legacy.png",
												file_name: "missing-legacy.png",
											},
										},
									},
								],
							},
						],
					}),
				}),
			),
		)
		const event = {
			clipboardData: {
				types: ["text/html"],
				files: [],
				items: [],
				getData: (type: string) =>
					type === "text/html" ? `<div data-magic-clipboard="${metadata}"></div>` : "",
			},
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ClipboardEvent
		const onAsset = vi.fn()
		const controller = new CanvasClipboardPasteController({
			resolveReference: vi.fn(async () => null),
			materialize: vi.fn(async () => null),
		})

		const result = await controller.paste(
			event,
			{
				control: "image-editor",
				acceptedTypes: ["image"],
				messagePasteMode: "rich-text-with-media",
				sessionId: "failed-accepted-cleanup-legacy",
			},
			{ onAsset },
		)

		expect(result.accepted).toEqual([])
		expect(result.failed).toEqual([
			{ reason: "resource-materialize-failed", fileName: "missing-legacy.png" },
		])
		expect(onAsset).not.toHaveBeenCalled()
	})
})
