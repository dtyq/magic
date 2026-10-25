import { describe, expect, it, vi } from "vitest"
import { downloadActions } from "../downloadActions"
import type { UserAction } from "../../types"

function createCanvas(options?: {
	allowFileDownload?: boolean
	selectedIds?: string[]
	elements?: Array<[string, object]>
	replacingIds?: string[]
}) {
	const imageContent = (id: string, src: string) => ({
		contentId: `${id}-content`,
		src,
	})
	const media = (id: string, type: "image" | "video", src: string) => ({
		id,
		type,
		contents: [imageContent(id, src)],
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
	})
	const elements = new Map<string, object>([
		["video", media("video", "video", "videos/demo.mp4")],
		[
			"text",
			{
				id: "text",
				type: "text",
				contents: [{ contentId: "text-content", content: [] }],
				activeContentId: "text-content",
				mainContentId: "text-content",
			},
		],
		["image", media("image", "image", "images/demo.png")],
		["generating-image", media("generating-image", "image", "")],
		...(options?.elements ?? []),
	])
	const downloadFiles = vi.fn().mockResolvedValue(undefined)
	const downloadElementsAsPNG = vi.fn().mockResolvedValue(true)
	const permissionManager = {
		can: vi.fn((capability: string) => Boolean(capability)),
		canDownloadFiles: vi.fn(
			() =>
				permissionManager.can("sideEffect.download") &&
				options?.allowFileDownload !== false,
		),
	}

	return {
		canvas: {
			selectionManager: {
				getSelectedIds: () => options?.selectedIds ?? ["video", "text", "image"],
			},
			elementManager: {
				getElementData: (id: string) => elements.get(id),
			},
			imageResourceManager: {
				getResource: vi.fn().mockResolvedValue({
					imageInfo: { naturalWidth: 1200, naturalHeight: 800 },
				}),
			},
			magicConfigManager: {
				config: {
					permissions: { allowFileDownload: options?.allowFileDownload },
					methods: { downloadFiles },
				},
			},
			mediaReplaceController: {
				isReplacing: (elementId: string) =>
					options?.replacingIds?.includes(elementId) ?? false,
			},
			clipboardManager: {
				downloadElementsAsPNG,
			},
			permissionManager,
		} as never,
		downloadFiles,
		downloadElementsAsPNG,
	}
}

describe("Canvas download actions", () => {
	it("downloads a single selected text element as PNG", async () => {
		const { canvas, downloadElementsAsPNG } = createCanvas({ selectedIds: ["text"] })
		const action = downloadActions.find((item) => item.id === "download.text") as
			UserAction<"download.text"> | undefined

		expect(action?.canExecute(canvas)).toBe(true)
		await action?.execute(canvas)
		expect(downloadElementsAsPNG).toHaveBeenCalledWith(["text"])
	})

	it("ignores the text download action for multi selections", async () => {
		const { canvas, downloadElementsAsPNG } = createCanvas({
			selectedIds: ["video", "text", "image"],
		})
		const action = downloadActions.find((item) => item.id === "download.text") as
			UserAction<"download.text"> | undefined

		expect(action?.canExecute(canvas)).toBe(false)
		await action?.execute(canvas)
		expect(downloadElementsAsPNG).not.toHaveBeenCalled()
	})

	it("downloads selected media in selection order and ignores non-media elements", async () => {
		const { canvas, downloadFiles } = createCanvas()
		const action = downloadActions.find((item) => item.id === "download.image") as
			UserAction<"download.image"> | undefined

		expect(action?.canExecute(canvas)).toBe(true)
		await action?.execute(canvas, { downloadMode: "normal" })

		expect(downloadFiles).toHaveBeenCalledWith(
			[expect.objectContaining({ id: "video" }), expect.objectContaining({ id: "image" })],
			false,
			false,
			{
				downloadMode: "normal",
				sourceDimensionsByElementId: {
					image: { width: 1200, height: 800 },
				},
			},
		)
	})

	it("downloads media descendants from the selected frame in document order", async () => {
		const framedImage = {
			id: "framed-image",
			type: "image",
			contents: [{ contentId: "framed-image-content", src: "images/framed.png" }],
			activeContentId: "framed-image-content",
			mainContentId: "framed-image-content",
		}
		const framedVideo = {
			id: "framed-video",
			type: "video",
			contents: [{ contentId: "framed-video-content", src: "videos/framed.mp4" }],
			activeContentId: "framed-video-content",
			mainContentId: "framed-video-content",
		}
		const outsideAudio = {
			id: "outside-audio",
			type: "audio",
			contents: [{ contentId: "outside-audio-content", src: "audios/outside.mp3" }],
			activeContentId: "outside-audio-content",
			mainContentId: "outside-audio-content",
		}
		const frame = {
			id: "frame",
			type: "frame",
			contents: [{ contentId: "frame-content" }],
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			children: [
				{
					id: "group",
					type: "group",
					contents: [{ contentId: "group-content" }],
					activeContentId: "group-content",
					mainContentId: "group-content",
					children: [framedImage],
				},
				framedVideo,
			],
		}
		const { canvas, downloadFiles } = createCanvas({
			selectedIds: ["frame"],
			elements: [
				["frame", frame],
				["outside-audio", outsideAudio],
			],
		})
		const action = downloadActions.find((item) => item.id === "download.frame") as
			UserAction<"download.frame"> | undefined

		expect(action?.canExecute(canvas)).toBe(true)
		await action?.execute(canvas, { downloadMode: "default" })

		expect(downloadFiles).toHaveBeenCalledWith(
			[
				expect.objectContaining({ id: "framed-image" }),
				expect.objectContaining({ id: "framed-video" }),
			],
			false,
			false,
			{
				downloadMode: "default",
				sourceDimensionsByElementId: {
					"framed-image": { width: 1200, height: 800 },
				},
			},
		)
	})

	it("blocks both menu visibility and execution when download permission is denied", async () => {
		const { canvas, downloadFiles } = createCanvas({ allowFileDownload: false })
		const action = downloadActions.find((item) => item.id === "download.image") as
			UserAction<"download.image"> | undefined

		expect(action?.canExecute(canvas)).toBe(false)
		await action?.execute(canvas, { downloadMode: "default" })
		expect(downloadFiles).not.toHaveBeenCalled()
	})

	it("blocks download when the Canvas side effect capability is denied", async () => {
		const { canvas, downloadFiles } = createCanvas()
		;(
			canvas as unknown as { permissionManager: { can: ReturnType<typeof vi.fn> } }
		).permissionManager.can = vi.fn(() => false)
		const action = downloadActions.find((item) => item.id === "download.image") as
			UserAction<"download.image"> | undefined

		expect(action?.canExecute(canvas)).toBe(false)
		await action?.execute(canvas, { downloadMode: "default" })
		expect(downloadFiles).not.toHaveBeenCalled()
	})

	it("passes unresolved selected media to the host so it can block the whole batch", async () => {
		const { canvas, downloadFiles } = createCanvas({
			selectedIds: ["image", "generating-image"],
		})
		const action = downloadActions.find((item) => item.id === "download.image") as
			UserAction<"download.image"> | undefined

		expect(action?.canExecute(canvas)).toBe(true)
		await action?.execute(canvas, { downloadMode: "default" })

		expect(downloadFiles).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					id: "image",
					contents: [expect.objectContaining({ src: "images/demo.png" })],
				}),
				expect.objectContaining({
					id: "generating-image",
					contents: [expect.objectContaining({ src: "" })],
				}),
			],
			false,
			false,
			expect.objectContaining({ downloadMode: "default" }),
		)
	})

	it("hides the download action when all selected media sources are unavailable", async () => {
		const { canvas, downloadFiles } = createCanvas({ selectedIds: ["generating-image"] })
		const action = downloadActions.find((item) => item.id === "download.image") as
			UserAction<"download.image"> | undefined

		expect(action?.canExecute(canvas)).toBe(false)
		await action?.execute(canvas, { downloadMode: "default" })
		expect(downloadFiles).not.toHaveBeenCalled()
	})

	it("blocks selected media download while replacement is uploading", async () => {
		const { canvas, downloadFiles } = createCanvas({
			selectedIds: ["image"],
			replacingIds: ["image"],
		})
		const action = downloadActions.find((item) => item.id === "download.image") as
			UserAction<"download.image"> | undefined

		expect(action?.canExecute(canvas)).toBe(false)
		await action?.execute(canvas, { downloadMode: "default" })
		const noWatermarkAction = downloadActions.find(
			(item) => item.id === "download.image-no-watermark",
		) as UserAction<"download.image-no-watermark"> | undefined
		expect(noWatermarkAction?.canExecute(canvas)).toBe(false)
		await noWatermarkAction?.execute(canvas)
		expect(downloadFiles).not.toHaveBeenCalled()
	})

	it("blocks frame download when a nested media element is replacing", async () => {
		const framedImage = {
			id: "framed-image",
			type: "image",
			contents: [{ contentId: "framed-image-content", src: "images/framed.png" }],
			activeContentId: "framed-image-content",
			mainContentId: "framed-image-content",
		}
		const frame = {
			id: "frame",
			type: "frame",
			contents: [{ contentId: "frame-content" }],
			activeContentId: "frame-content",
			mainContentId: "frame-content",
			children: [framedImage],
		}
		const { canvas, downloadFiles } = createCanvas({
			selectedIds: ["frame"],
			elements: [["frame", frame]],
			replacingIds: ["framed-image"],
		})
		const action = downloadActions.find((item) => item.id === "download.frame") as
			UserAction<"download.frame"> | undefined

		expect(action?.canExecute(canvas)).toBe(false)
		await action?.execute(canvas, { downloadMode: "default" })
		expect(downloadFiles).not.toHaveBeenCalled()
	})
})
