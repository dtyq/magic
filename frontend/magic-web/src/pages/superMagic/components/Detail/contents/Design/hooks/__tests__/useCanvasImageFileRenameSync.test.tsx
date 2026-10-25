import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RefObject } from "react"
import type { CanvasDesignRef } from "@/components/CanvasDesign/public/props"
import {
	ElementTypeEnum,
	type CanvasDocument,
} from "@/components/CanvasDesign/runtime/document/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { buildDesignAttachmentIndex } from "../../utils/designAttachmentIndex"
import { useCanvasImageFileRenameSync } from "../useCanvasImageFileRenameSync"

const mocks = vi.hoisted(() => ({
	renameFile: vi.fn(),
	toastError: vi.fn(),
	waitForAttachmentsRefresh: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		renameFile: mocks.renameFile,
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: mocks.toastError,
	},
}))

vi.mock("@/pages/superMagic/services/attachmentsTopicSync", () => ({
	registerWaitForNextAttachmentsRefreshForProject: mocks.waitForAttachmentsRefresh,
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

function attachment(fileId: string, path: string): FileItem {
	return {
		file_id: fileId,
		file_name: path.split("/").pop() || path,
		relative_file_path: path,
		is_directory: false,
	} as FileItem
}

function imageCanvas(options: {
	name: string
	src: string
	referenceImages?: string[]
}): CanvasDocument {
	return {
		elements: [
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				name: options.name,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				activeContentId: "image-1-content-1",
				mainContentId: "image-1-content-1",
				contents: [
					{
						contentId: "image-1-content-1",
						src: options.src,
						...(options.referenceImages
							? {
									generateImageRequest: {
										model_id: "model-1",
										prompt: "test",
										reference_images: options.referenceImages,
									},
								}
							: {}),
					},
				],
			},
		],
	}
}

function multiContentImageCanvas(name: string): CanvasDocument {
	return {
		elements: [
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				name,
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				activeContentId: "content-2",
				mainContentId: "content-1",
				contents: [
					{ contentId: "content-1", src: "./images/older.png", status: "completed" },
					{ contentId: "content-2", src: "./images/image.png", status: "completed" },
				],
			},
		],
	}
}

function renderRenameHook(options: {
	currentCanvasData: CanvasDocument
	flatAttachments: FileItem[]
	attachmentsReady?: boolean
}) {
	const updateData = vi.fn()
	const persistCanvasData = vi.fn()
	const updateAttachments = vi.fn()
	const canvasDesignRef = {
		current: { updateData },
	} as unknown as RefObject<CanvasDesignRef | null>

	type HookProps = typeof options
	const result = renderHook(
		(props: HookProps) =>
			useCanvasImageFileRenameSync({
				canvasDesignRef,
				currentCanvasData: props.currentCanvasData,
				flatAttachments: props.flatAttachments,
				attachmentsReady: props.attachmentsReady ?? true,
				attachmentIndex: buildDesignAttachmentIndex(props.flatAttachments),
				designProjectBasePath: "画布A",
				projectId: "project-1",
				persistCanvasData,
				updateAttachments,
			}),
		{ initialProps: options },
	)

	return { ...result, updateData, persistCanvasData, updateAttachments }
}

describe("useCanvasImageFileRenameSync", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.renameFile.mockResolvedValue(undefined)
		mocks.waitForAttachmentsRefresh.mockResolvedValue(undefined)
	})

	it("blocks the backend rename when another legacy bare reference is ambiguous", async () => {
		const flatAttachments = [
			attachment("canvas-a", "画布A/images/image.png"),
			attachment("workspace-root", "images/image.png"),
		]
		const previousCanvas = imageCanvas({
			name: "image",
			src: "./images/image.png",
			referenceImages: ["images/image.png"],
		})
		const nextCanvas = imageCanvas({
			name: "Pikachu",
			src: "./images/image.png",
			referenceImages: ["images/image.png"],
		})
		const { result, persistCanvasData, updateData } = renderRenameHook({
			currentCanvasData: previousCanvas,
			flatAttachments,
		})

		act(() => {
			result.current.handleCanvasDesignDataChange(nextCanvas, {
				source: "element:change",
				elementNameChanges: [
					{
						elementId: "image-1",
						elementType: ElementTypeEnum.Image,
						oldName: "image",
						newName: "Pikachu",
						oldSrc: "./images/image.png",
						newSrc: "./images/image.png",
					},
				],
			})
		})

		await waitFor(() => {
			expect(mocks.toastError).toHaveBeenCalledWith("topicFiles.contextMenu.renameFailed")
		})
		expect(mocks.renameFile).not.toHaveBeenCalled()
		expect(persistCanvasData).not.toHaveBeenCalled()
		expect(updateData).not.toHaveBeenCalled()
	})

	it("renames and rewrites a unique historical bare-path resource", async () => {
		const flatAttachments = [attachment("canvas-a", "画布A/images/image.png")]
		const previousCanvas = imageCanvas({ name: "image", src: "images/image.png" })
		const nextCanvas = imageCanvas({ name: "Pikachu", src: "images/image.png" })
		const { result, persistCanvasData, updateData, updateAttachments } = renderRenameHook({
			currentCanvasData: previousCanvas,
			flatAttachments,
		})

		act(() => {
			result.current.handleCanvasDesignDataChange(nextCanvas, {
				source: "element:change",
				elementNameChanges: [
					{
						elementId: "image-1",
						elementType: ElementTypeEnum.Image,
						oldName: "image",
						newName: "Pikachu",
						oldSrc: "images/image.png",
						newSrc: "images/image.png",
					},
				],
			})
		})

		await waitFor(() => {
			expect(mocks.renameFile).toHaveBeenCalledWith({
				file_id: "canvas-a",
				target_name: "Pikachu.png",
			})
			expect(persistCanvasData).toHaveBeenCalledTimes(1)
		})

		const persistedCanvas = persistCanvasData.mock.calls[0]?.[0] as CanvasDocument
		expect(persistedCanvas.elements?.[0]).toEqual(
			expect.objectContaining({
				contents: [expect.objectContaining({ src: "./images/Pikachu.png" })],
			}),
		)
		expect(updateAttachments).toHaveBeenCalledTimes(1)
		expect(updateData).toHaveBeenCalledWith(persistedCanvas)
		expect(mocks.toastError).not.toHaveBeenCalled()
	})

	it("uses the active image Content when no element-name change metadata is available", async () => {
		const flatAttachments = [attachment("canvas-a", "画布A/images/image.png")]
		const previousCanvas = multiContentImageCanvas("image")
		const nextCanvas = multiContentImageCanvas("Pikachu")
		const { result, persistCanvasData } = renderRenameHook({
			currentCanvasData: previousCanvas,
			flatAttachments,
		})

		act(() => {
			result.current.handleCanvasDesignDataChange(nextCanvas)
		})

		await waitFor(() => {
			expect(mocks.renameFile).toHaveBeenCalledWith({
				file_id: "canvas-a",
				target_name: "Pikachu.png",
			})
			expect(persistCanvasData).toHaveBeenCalledTimes(1)
		})

		const persistedCanvas = persistCanvasData.mock.calls[0]?.[0] as CanvasDocument
		const persistedImage = persistedCanvas.elements?.[0]
		if (persistedImage?.type !== ElementTypeEnum.Image) {
			throw new Error("Expected an image element")
		}
		expect(persistedImage.contents).toEqual([
			expect.objectContaining({ contentId: "content-1", src: "./images/older.png" }),
			expect.objectContaining({ contentId: "content-2", src: "./images/Pikachu.png" }),
		])
	})

	it("blocks a historical bare-path rename while attachments are pending", async () => {
		const flatAttachments = [attachment("canvas-a", "画布A/images/image.png")]
		const previousCanvas = imageCanvas({ name: "image", src: "images/image.png" })
		const nextCanvas = imageCanvas({ name: "Pikachu", src: "images/image.png" })
		const { result, persistCanvasData, updateData } = renderRenameHook({
			currentCanvasData: previousCanvas,
			flatAttachments,
			attachmentsReady: false,
		})

		act(() => {
			result.current.handleCanvasDesignDataChange(nextCanvas, {
				source: "element:change",
				elementNameChanges: [
					{
						elementId: "image-1",
						elementType: ElementTypeEnum.Image,
						oldName: "image",
						newName: "Pikachu",
						oldSrc: "images/image.png",
						newSrc: "images/image.png",
					},
				],
			})
		})

		await waitFor(() => {
			expect(mocks.toastError).toHaveBeenCalledWith("topicFiles.contextMenu.renameFailed")
		})
		expect(mocks.renameFile).not.toHaveBeenCalled()
		expect(persistCanvasData).not.toHaveBeenCalled()
		expect(updateData).not.toHaveBeenCalled()
	})

	it("applies the rename to the latest canvas snapshot after attachment refresh", async () => {
		let resolveAttachmentsRefresh!: () => void
		mocks.waitForAttachmentsRefresh.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveAttachmentsRefresh = resolve
				}),
		)
		const flatAttachments = [attachment("canvas-a", "画布A/images/image.png")]
		const previousCanvas = imageCanvas({ name: "image", src: "./images/image.png" })
		const renamedCanvas = imageCanvas({ name: "Pikachu", src: "./images/image.png" })
		const { result, rerender, persistCanvasData } = renderRenameHook({
			currentCanvasData: previousCanvas,
			flatAttachments,
		})

		act(() => {
			result.current.handleCanvasDesignDataChange(renamedCanvas, {
				source: "element:change",
				elementNameChanges: [
					{
						elementId: "image-1",
						elementType: ElementTypeEnum.Image,
						oldName: "image",
						newName: "Pikachu",
						oldSrc: "./images/image.png",
						newSrc: "./images/image.png",
					},
				],
			})
		})

		await waitFor(() => {
			expect(mocks.waitForAttachmentsRefresh).toHaveBeenCalledTimes(1)
		})
		const editedDuringRefresh = JSON.parse(JSON.stringify(renamedCanvas)) as CanvasDocument
		if (!editedDuringRefresh.elements?.[0]) throw new Error("Missing image element")
		editedDuringRefresh.elements[0].x = 42
		editedDuringRefresh.elements.push({
			id: "text-added-during-refresh",
			type: ElementTypeEnum.Text,
			activeContentId: "text-added-during-refresh-content-1",
			mainContentId: "text-added-during-refresh-content-1",
			contents: [
				{
					contentId: "text-added-during-refresh-content-1",
					content: [{ children: [{ type: "text", text: "keep me" }] }],
				},
			],
			x: 10,
			y: 20,
			width: 120,
			height: 40,
		})
		act(() => {
			rerender({
				currentCanvasData: editedDuringRefresh,
				flatAttachments,
			})
		})
		act(() => {
			resolveAttachmentsRefresh()
		})

		await waitFor(() => {
			expect(persistCanvasData).toHaveBeenCalledTimes(1)
		})
		const persistedCanvas = persistCanvasData.mock.calls[0]?.[0] as CanvasDocument
		expect(persistedCanvas.elements?.[0]).toEqual(
			expect.objectContaining({
				x: 42,
				contents: [expect.objectContaining({ src: "./images/Pikachu.png" })],
			}),
		)
		expect(persistedCanvas.elements?.[1]).toEqual(
			expect.objectContaining({
				id: "text-added-during-refresh",
				contents: [
					expect.objectContaining({
						content: [{ children: [{ type: "text", text: "keep me" }] }],
					}),
				],
			}),
		)
	})
})
