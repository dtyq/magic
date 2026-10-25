import { describe, expect, it, vi } from "vitest"
import { ElementTypeEnum, type ImageElement, type ImageElementContent } from "../../document/types"
import { GenerationStatus } from "../../../public/magic-types"
import { createTestResourceReferenceResolver } from "../../../public/__tests__/testResourceReferenceResolver"
import { EventEmitter } from "../../core/EventEmitter"
import { INVALID_GENERATED_RESOURCE_PATH_ERROR } from "../polling/generationPollingUtils"
import { ImagePollingManager } from "../polling/ImagePollingManager"

const resolveResourceReference = createTestResourceReferenceResolver({
	attachmentPathsByFileId: {
		"file-image-task-1": "/画布A/images/image-task-1.png",
		"file-image-task-2": "/画布A/images/image-task-2.png",
	},
})

function createImageElement(overrides?: Partial<ImageElementContent>): ImageElement {
	const contentId = "content-1"
	return {
		id: "image-element-1",
		type: ElementTypeEnum.Image,
		x: 0,
		y: 0,
		width: 512,
		height: 512,
		zIndex: 1,
		activeContentId: contentId,
		mainContentId: contentId,
		contents: [
			{
				contentId,
				generateImageRequest: {
					image_id: "image-task-1",
					model_id: "model-1",
					prompt: "pikachu",
				},
				...overrides,
			},
		],
	}
}

function createImageElementWithContents(
	contents: ImageElementContent[],
	activeContentId = contents[0]?.contentId ?? null,
	mainContentId = contents[0]?.contentId ?? null,
): ImageElement {
	return {
		id: "image-element-1",
		type: ElementTypeEnum.Image,
		x: 0,
		y: 0,
		width: 512,
		height: 512,
		zIndex: 1,
		contents,
		activeContentId,
		mainContentId,
	}
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

describe("ImagePollingManager", () => {
	it("writes a completed result to its Content without changing a manually selected active", async () => {
		const element = createImageElementWithContents(
			[
				{
					contentId: "v1",
					src: "./images/original.png",
					status: GenerationStatus.Completed,
				},
				{
					contentId: "v2",
					status: GenerationStatus.Processing,
					generateImageRequest: {
						image_id: "image-task-2",
						model_id: "model-1",
						prompt: "new version",
					},
				},
			],
			"v1",
			"v1",
		)
		const update = vi.fn((elementId: string, updates: Partial<ImageElement>) => {
			if (elementId === element.id) Object.assign(element, updates)
		})
		const markerManager = { handleImageContentChanged: vi.fn() }
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "user"),
			},
			magicConfigManager: {
				config: {
					methods: {
						resolveResourceReference,
						getImageGenerationResult: vi.fn().mockResolvedValue({
							image_id: "image-task-2",
							status: GenerationStatus.Completed,
							file_dir: "/画布A/images/",
							file_name: "image-task-2.png",
							file_url: "https://example.test/image-task-2.png",
							error_message: null,
						}),
					},
				},
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			markerManager,
			eventEmitter: { emit: vi.fn() },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
			shouldAutoActivateContent: () => false,
		})
		manager.start()

		await vi.waitFor(() => expect(manager.isActive()).toBe(false))
		expect(element.activeContentId).toBe("v1")
		expect(element.contents[1]).toEqual(
			expect.objectContaining({
				contentId: "v2",
				src: "./images/image-task-2.png",
				status: GenerationStatus.Completed,
			}),
		)
		expect(markerManager.handleImageContentChanged).not.toHaveBeenCalled()
	})

	it("auto-activates the completed Content", async () => {
		const element = createImageElementWithContents(
			[
				{
					contentId: "v1",
					src: "./images/original.png",
					status: GenerationStatus.Completed,
				},
				{
					contentId: "v2",
					status: GenerationStatus.Processing,
					generateImageRequest: { image_id: "image-task-2", prompt: "new version" },
				},
			],
			"v1",
			"v1",
		)
		const markerManager = { handleImageContentChanged: vi.fn() }
		const update = vi.fn((elementId: string, updates: Partial<ImageElement>) => {
			if (elementId === element.id) Object.assign(element, updates)
		})
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "user"),
			},
			magicConfigManager: {
				config: {
					methods: {
						resolveResourceReference,
						getImageGenerationResult: vi.fn().mockResolvedValue({
							image_id: "image-task-2",
							status: GenerationStatus.Completed,
							file_dir: "/画布A/images/",
							file_name: "image-task-2.png",
							file_url: null,
							error_message: null,
						}),
					},
				},
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			markerManager,
			eventEmitter: { emit: vi.fn() },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
			shouldAutoActivateContent: () => true,
		})
		manager.start()

		await vi.waitFor(() => expect(manager.isActive()).toBe(false))
		expect(element.activeContentId).toBe("v2")
	})

	it("polls every processing Content in the same image element", async () => {
		const element = createImageElementWithContents(
			[
				{
					contentId: "v1",
					src: "./images/original.png",
					status: GenerationStatus.Completed,
				},
				{
					contentId: "v2",
					status: GenerationStatus.Processing,
					generateImageRequest: { image_id: "image-task-2", prompt: "second" },
				},
				{
					contentId: "v3",
					status: GenerationStatus.Processing,
					generateImageRequest: { image_id: "image-task-3", prompt: "third" },
				},
			],
			"v1",
			"v1",
		)
		const update = vi.fn((elementId: string, updates: Partial<ImageElement>) => {
			if (elementId === element.id) Object.assign(element, updates)
		})
		const getImageGenerationResult = vi.fn(async ({ image_id }: { image_id: string }) => ({
			image_id,
			status: GenerationStatus.Completed,
			file_dir: "/画布A/images/",
			file_name: `${image_id}.png`,
			file_url: null,
			error_message: null,
		}))
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "user"),
			},
			magicConfigManager: {
				config: {
					methods: { getImageGenerationResult, resolveResourceReference },
				},
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter: { emit: vi.fn() },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
			shouldAutoActivateContent: () => false,
		})
		manager.start()

		await vi.waitFor(() => expect(manager.isActive()).toBe(false))
		expect(getImageGenerationResult).toHaveBeenCalledTimes(2)
		expect(getImageGenerationResult).toHaveBeenCalledWith({ image_id: "image-task-2" })
		expect(getImageGenerationResult).toHaveBeenCalledWith({ image_id: "image-task-3" })
		expect(
			element.contents
				.slice(1)
				.every((content) => content.status === GenerationStatus.Completed),
		).toBe(true)
	})

	it("waits for the polling interval after a result update emits element:updated", async () => {
		vi.useFakeTimers()
		const element = createImageElement({ status: GenerationStatus.Pending })
		const nextResult = createDeferred<{
			image_id: string
			status: GenerationStatus
			file_dir: null
			file_name: null
			file_url: null
			error_message: null
		}>()
		const getImageGenerationResult = vi
			.fn()
			.mockResolvedValueOnce({
				image_id: "image-task-1",
				status: GenerationStatus.Processing,
				file_dir: null,
				file_name: null,
				file_url: null,
				error_message: null,
			})
			.mockImplementation(() => nextResult.promise)
		const eventEmitter = new EventEmitter()
		const update = vi.fn((elementId: string, updates: Partial<ImageElement>) => {
			if (elementId !== element.id) return
			const previousData = { ...element }
			Object.assign(element, updates)
			eventEmitter.emit({
				type: "element:updated",
				data: { elementId, data: element, previousData },
			})
		})
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "user"),
			},
			magicConfigManager: {
				config: { methods: { getImageGenerationResult, resolveResourceReference } },
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter,
		}
		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})

		try {
			manager.start()
			await vi.advanceTimersByTimeAsync(0)
			expect(getImageGenerationResult).toHaveBeenCalledTimes(1)

			await vi.advanceTimersByTimeAsync(4_999)
			expect(getImageGenerationResult).toHaveBeenCalledTimes(1)

			await vi.advanceTimersByTimeAsync(1)
			expect(getImageGenerationResult).toHaveBeenCalledTimes(2)
		} finally {
			manager.stop()
			nextResult.resolve({
				image_id: "image-task-1",
				status: GenerationStatus.Processing,
				file_dir: null,
				file_name: null,
				file_url: null,
				error_message: null,
			})
			await Promise.resolve()
			vi.useRealTimers()
		}
	})

	it("does not persist an unchanged processing result", async () => {
		vi.useFakeTimers()
		const element = createImageElement({ status: GenerationStatus.Processing })
		const getImageGenerationResult = vi.fn().mockResolvedValue({
			image_id: "image-task-1",
			status: GenerationStatus.Processing,
			file_dir: null,
			file_name: null,
			file_url: null,
			error_message: null,
		})
		const update = vi.fn()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "user"),
			},
			magicConfigManager: {
				config: { methods: { getImageGenerationResult, resolveResourceReference } },
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter: { emit: vi.fn() },
		}
		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})

		try {
			manager.start()
			await vi.advanceTimersByTimeAsync(0)
			expect(getImageGenerationResult).toHaveBeenCalledTimes(1)
			expect(update).not.toHaveBeenCalled()
		} finally {
			manager.stop()
			vi.useRealTimers()
		}
	})

	it("does not restart an in-flight target for an unrelated element update", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const result = createDeferred<{
			image_id: string
			status: GenerationStatus
			file_dir: null
			file_name: null
			file_url: null
			error_message: null
		}>()
		const getImageGenerationResult = vi.fn(() => result.promise)
		const eventEmitter = new EventEmitter()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "user"),
			},
			magicConfigManager: {
				config: { methods: { getImageGenerationResult, resolveResourceReference } },
			},
			elementManager: { update: vi.fn() },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter,
		}
		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})

		manager.start()
		await vi.waitFor(() => expect(getImageGenerationResult).toHaveBeenCalledTimes(1))
		const previousData = { ...element }
		element.x = 120
		eventEmitter.emit({
			type: "element:updated",
			data: { elementId: element.id, data: element, previousData },
		})
		await Promise.resolve()

		expect(getImageGenerationResult).toHaveBeenCalledTimes(1)
		manager.stop()
		result.resolve({
			image_id: "image-task-1",
			status: GenerationStatus.Processing,
			file_dir: null,
			file_name: null,
			file_url: null,
			error_message: null,
		})
	})

	it("starts a newly appended Content without duplicating an in-flight Content", async () => {
		const element = createImageElementWithContents(
			[
				{
					contentId: "v1",
					src: "./images/original.png",
					status: GenerationStatus.Completed,
				},
				{
					contentId: "v2",
					status: GenerationStatus.Processing,
					generateImageRequest: { image_id: "image-task-2", prompt: "second" },
				},
			],
			"v1",
			"v1",
		)
		const secondResult = createDeferred<never>()
		const thirdResult = createDeferred<never>()
		const getImageGenerationResult = vi.fn(({ image_id }: { image_id: string }) =>
			image_id === "image-task-2" ? secondResult.promise : thirdResult.promise,
		)
		const eventEmitter = new EventEmitter()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "user"),
			},
			magicConfigManager: {
				config: { methods: { getImageGenerationResult, resolveResourceReference } },
			},
			elementManager: { update: vi.fn() },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter,
		}
		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})

		manager.start()
		await vi.waitFor(() =>
			expect(getImageGenerationResult).toHaveBeenCalledWith({ image_id: "image-task-2" }),
		)
		const previousData = { ...element, contents: [...element.contents] }
		element.contents = [
			...element.contents,
			{
				contentId: "v3",
				status: GenerationStatus.Processing,
				generateImageRequest: { image_id: "image-task-3", prompt: "third" },
			},
		]
		eventEmitter.emit({
			type: "element:updated",
			data: { elementId: element.id, data: element, previousData },
		})

		await vi.waitFor(() =>
			expect(getImageGenerationResult).toHaveBeenCalledWith({ image_id: "image-task-3" }),
		)
		expect(
			getImageGenerationResult.mock.calls.filter(
				([params]) => params.image_id === "image-task-2",
			),
		).toHaveLength(1)
		expect(
			getImageGenerationResult.mock.calls.filter(
				([params]) => params.image_id === "image-task-3",
			),
		).toHaveLength(1)

		manager.stop()
	})

	it("keeps other Contents polling when one Content request fails", async () => {
		vi.useFakeTimers()
		const element = createImageElementWithContents(
			[
				{
					contentId: "v1",
					src: "./images/original.png",
					status: GenerationStatus.Completed,
				},
				{
					contentId: "v2",
					status: GenerationStatus.Processing,
					generateImageRequest: { image_id: "image-task-2", prompt: "second" },
				},
				{
					contentId: "v3",
					status: GenerationStatus.Processing,
					generateImageRequest: { image_id: "image-task-3", prompt: "third" },
				},
			],
			"v1",
			"v1",
		)
		const nextResult = createDeferred<{
			image_id: string
			status: GenerationStatus
			file_dir: null
			file_name: null
			file_url: null
			error_message: null
		}>()
		const getImageGenerationResult = vi.fn(({ image_id }: { image_id: string }) => {
			if (image_id === "image-task-2") return Promise.reject(new Error("temporary failure"))
			return getImageGenerationResult.mock.calls.filter(
				([params]) => params.image_id === "image-task-3",
			).length === 1
				? Promise.resolve({
						image_id,
						status: GenerationStatus.Processing,
						file_dir: null,
						file_name: null,
						file_url: null,
						error_message: null,
					})
				: nextResult.promise
		})
		const onStatusUpdate = vi.fn()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "user"),
			},
			magicConfigManager: {
				config: { methods: { getImageGenerationResult, resolveResourceReference } },
			},
			elementManager: { update: vi.fn() },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter: { emit: vi.fn() },
		}
		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
			onStatusUpdate,
		})

		try {
			manager.start()
			await vi.advanceTimersByTimeAsync(0)
			expect(onStatusUpdate).toHaveBeenCalledWith("v2")
			expect(manager.isActive()).toBe(true)
			expect(getImageGenerationResult).toHaveBeenCalledWith({ image_id: "image-task-3" })

			await vi.advanceTimersByTimeAsync(5_000)
			expect(
				getImageGenerationResult.mock.calls.filter(
					([params]) => params.image_id === "image-task-3",
				),
			).toHaveLength(2)
		} finally {
			manager.stop()
			nextResult.resolve({
				image_id: "image-task-3",
				status: GenerationStatus.Processing,
				file_dir: null,
				file_name: null,
				file_url: null,
				error_message: null,
			})
			await Promise.resolve()
			vi.useRealTimers()
		}
	})

	it("recovers an Agent-produced file without calling the Design result API", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const getImageGenerationResult = vi.fn()
		const getFileInfo = vi.fn(async (path: string) => {
			if (path === "images/image-task-1.png") {
				return {
					src: "https://example.test/image-task-1.png",
					fileName: "image-task-1.png",
				}
			}
			throw new Error("not found")
		})
		const update = vi.fn((elementId: string, updates: Partial<ImageElement>) => {
			if (elementId === element.id) Object.assign(element, updates)
		})
		const primeCache = vi.fn()
		const emit = vi.fn()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "agent"),
			},
			magicConfigManager: {
				config: {
					methods: { getImageGenerationResult, getFileInfo, resolveResourceReference },
				},
			},
			elementManager: { update },
			imageResourceManager: { primeCache },
			eventEmitter: { emit },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})
		manager.start()

		await vi.waitFor(() => expect(update).toHaveBeenCalled())
		expect(getImageGenerationResult).not.toHaveBeenCalled()
		expect(update).toHaveBeenCalledWith(
			element.id,
			{
				contents: [
					expect.objectContaining({
						contentId: "content-1",
						src: "./images/image-task-1.png",
						status: GenerationStatus.Completed,
						errorMessage: undefined,
					}),
				],
			},
			{ silent: false, historyPolicy: "exclude" },
		)
		expect(primeCache).toHaveBeenCalledWith("./images/image-task-1.png", {
			src: "https://example.test/image-task-1.png",
			fileName: "image-task-1.png",
			resource_version: "generated:image-task-1.png",
		})
	})

	it("does not call or clear anything when an Agent file is not yet visible", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const getImageGenerationResult = vi.fn()
		const getFileInfo = vi.fn().mockRejectedValue(new Error("not found"))
		const update = vi.fn()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "agent"),
			},
			magicConfigManager: {
				config: {
					methods: { getImageGenerationResult, getFileInfo, resolveResourceReference },
				},
			},
			elementManager: { update, delete: vi.fn() },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter: { emit: vi.fn() },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})
		manager.start()

		await vi.waitFor(() => expect(getFileInfo).toHaveBeenCalledTimes(4))
		expect(getImageGenerationResult).not.toHaveBeenCalled()
		expect(update).not.toHaveBeenCalled()
		expect(manager.isActive()).toBe(false)
	})

	it("fails closed when Agent recovery matches current-canvas and workspace-root files", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const ambiguousResolver = createTestResourceReferenceResolver({
			attachmentPathsByFileId: {
				"file-current": "/画布A/images/image-task-1.png",
				"file-root": "/images/image-task-1.png",
			},
		})
		const getFileInfo = vi.fn(async (path: string) => {
			if (path === "images/image-task-1.png") {
				return {
					src: "https://example.test/image-task-1.png",
					fileName: "image-task-1.png",
				}
			}
			throw new Error("not found")
		})
		const update = vi.fn()
		const primeCache = vi.fn()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "agent"),
			},
			magicConfigManager: {
				config: { methods: { getFileInfo, resolveResourceReference: ambiguousResolver } },
			},
			elementManager: { update },
			imageResourceManager: { primeCache },
			eventEmitter: { emit: vi.fn() },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})
		manager.start()

		await vi.waitFor(() => expect(manager.isActive()).toBe(false))
		expect(update).not.toHaveBeenCalled()
		expect(primeCache).not.toHaveBeenCalled()
	})

	it("discards an Agent recovery result when the element switches to another image_id", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const fileInfo = createDeferred<{ src: string; fileName: string }>()
		const getFileInfo = vi.fn((path: string) => {
			if (path === "images/image-task-1.png") return fileInfo.promise
			return Promise.reject(new Error("not found"))
		})
		const update = vi.fn()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "agent"),
			},
			magicConfigManager: {
				config: { methods: { getFileInfo, resolveResourceReference } },
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter: { emit: vi.fn() },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})
		manager.start()

		await vi.waitFor(() => expect(getFileInfo).toHaveBeenCalled())
		element.contents[0].generateImageRequest = {
			...element.contents[0].generateImageRequest,
			image_id: "image-task-2",
		}
		fileInfo.resolve({
			src: "https://example.test/image-task-1.png",
			fileName: "image-task-1.png",
		})

		await vi.waitFor(() => expect(manager.isActive()).toBe(false))
		expect(update).not.toHaveBeenCalled()
	})

	it("does not overwrite a src added by Agent while file lookup is pending", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const fileInfo = createDeferred<{ src: string; fileName: string }>()
		const getFileInfo = vi.fn(() => fileInfo.promise)
		const update = vi.fn()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "agent"),
			},
			magicConfigManager: {
				config: { methods: { getFileInfo, resolveResourceReference } },
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter: { emit: vi.fn() },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})
		manager.start()

		await vi.waitFor(() => expect(getFileInfo).toHaveBeenCalled())
		element.contents[0].src = "./images/agent-final.png"
		element.contents[0].status = GenerationStatus.Completed
		fileInfo.resolve({
			src: "https://example.test/image-task-1.png",
			fileName: "image-task-1.png",
		})

		await vi.waitFor(() => expect(manager.isActive()).toBe(false))
		expect(update).not.toHaveBeenCalled()
	})

	it("invalidates an in-flight Agent recovery when polling is stopped", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const fileInfo = createDeferred<{ src: string; fileName: string }>()
		const getFileInfo = vi.fn(() => fileInfo.promise)
		const update = vi.fn()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "agent"),
			},
			magicConfigManager: {
				config: { methods: { getFileInfo, resolveResourceReference } },
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter: { emit: vi.fn() },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})
		manager.start()

		await vi.waitFor(() => expect(getFileInfo).toHaveBeenCalled())
		manager.stop()
		fileInfo.resolve({
			src: "https://example.test/image-task-1.png",
			fileName: "image-task-1.png",
		})

		await Promise.resolve()
		expect(update).not.toHaveBeenCalled()
	})

	it("restarts Agent recovery for a new image_id after an element update", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const firstFileInfo = createDeferred<{ src: string; fileName: string }>()
		const getFileInfo = vi.fn((path: string) => {
			if (path === "images/image-task-1.png") return firstFileInfo.promise
			if (path === "images/image-task-2.png") {
				return Promise.resolve({
					src: "https://example.test/image-task-2.png",
					fileName: "image-task-2.png",
				})
			}
			return Promise.reject(new Error("not found"))
		})
		const update = vi.fn((elementId: string, updates: Partial<ImageElement>) => {
			if (elementId === element.id) Object.assign(element, updates)
		})
		let elementUpdatedListener: ((event: { data: { elementId: string } }) => void) | undefined
		const eventEmitter = {
			emit: vi.fn(),
			on: vi.fn(
				(
					_event: "element:updated",
					listener: (event: { data: { elementId: string } }) => void,
				) => {
					elementUpdatedListener = listener
					return vi.fn()
				},
			),
		}
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "agent"),
			},
			magicConfigManager: {
				config: { methods: { getFileInfo, resolveResourceReference } },
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter,
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})
		manager.start()

		await vi.waitFor(() =>
			expect(getFileInfo).toHaveBeenCalledWith("images/image-task-1.png", expect.any(Object)),
		)
		element.contents[0].generateImageRequest = {
			...element.contents[0].generateImageRequest,
			image_id: "image-task-2",
		}
		elementUpdatedListener?.({ data: { elementId: element.id } })

		await vi.waitFor(() =>
			expect(update).toHaveBeenCalledWith(
				element.id,
				{
					contents: [
						expect.objectContaining({
							contentId: "content-1",
							src: "./images/image-task-2.png",
							status: GenerationStatus.Completed,
							errorMessage: undefined,
						}),
					],
				},
				{ silent: false, historyPolicy: "exclude" },
			),
		)
		firstFileInfo.resolve({
			src: "https://example.test/image-task-1.png",
			fileName: "image-task-1.png",
		})
		await Promise.resolve()

		expect(update).toHaveBeenCalledTimes(1)
	})

	it("stops an unknown generateImageRequest without querying the Design result API", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const getImageGenerationResult = vi.fn()
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "unknown"),
			},
			magicConfigManager: {
				config: { methods: { getImageGenerationResult, resolveResourceReference } },
			},
			elementManager: { update: vi.fn(), delete: vi.fn() },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter: { emit: vi.fn() },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})
		manager.start()

		await vi.waitFor(() => expect(manager.isActive()).toBe(false))
		expect(getImageGenerationResult).not.toHaveBeenCalled()
	})

	it("keeps polling frontend imageGenerationTaskMeta even without sidecar provenance", async () => {
		const element = createImageElement({
			generateImageRequest: undefined,
			imageGenerationTaskMeta: { type: "high", image_id: "high-task-1" },
			status: GenerationStatus.Processing,
		})
		const getImageGenerationResult = vi.fn().mockResolvedValue({
			image_id: "high-task-1",
			status: GenerationStatus.Completed,
			file_dir: "/画布A/images/",
			file_name: "high.png",
			file_url: "https://example.test/high.png",
			error_message: null,
		})
		const update = vi.fn((elementId: string, updates: Partial<ImageElement>) => {
			if (elementId === element.id) Object.assign(element, updates)
		})
		const canvas = {
			elementDetailsRuntimeManager: {
				getGenerateImageRequestImageIdSource: vi.fn(() => "unknown"),
			},
			magicConfigManager: {
				config: { methods: { getImageGenerationResult, resolveResourceReference } },
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter: { emit: vi.fn() },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})
		manager.start()

		await vi.waitFor(() => expect(update).toHaveBeenCalled())
		expect(getImageGenerationResult).toHaveBeenCalledWith({ image_id: "high-task-1" })
		expect(element.contents[0].src).toBe("./images/high.png")
	})

	it("primes generated image metadata and leaves loading to visibility scheduling", async () => {
		const element = createImageElement()
		const getImageGenerationResult = vi.fn().mockResolvedValue({
			image_id: "image-task-1",
			status: GenerationStatus.Completed,
			file_dir: "/images/",
			file_name: "generated.png",
			file_url: "https://example.test/generated.png",
			error_message: null,
		})
		const update = vi.fn((elementId: string, updates: Partial<ImageElement>) => {
			if (elementId === element.id) {
				Object.assign(element, updates)
			}
		})
		const primeCache = vi.fn()
		const loadResource = vi.fn()
		const emit = vi.fn()
		const canvas = {
			magicConfigManager: {
				config: {
					methods: {
						getImageGenerationResult,
						resolveResourceReference,
					},
				},
			},
			elementManager: {
				update,
			},
			imageResourceManager: {
				primeCache,
				loadResource,
			},
			eventEmitter: {
				emit,
			},
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})

		manager.start()

		await vi.waitFor(() => {
			expect(update).toHaveBeenCalled()
		})

		expect(primeCache).toHaveBeenCalledWith("/images/generated.png", {
			src: "https://example.test/generated.png",
			fileName: "generated.png",
			resource_version: "generated:generated.png",
		})
		expect(loadResource).not.toHaveBeenCalled()
		expect(emit).toHaveBeenCalledWith({
			type: "element:image:resultUpdated",
			data: { elementId: element.id },
		})
	})

	it("fails a completed result when its workspace path cannot be resolved", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const update = vi.fn((elementId: string, updates: Partial<ImageElement>) => {
			if (elementId === element.id) Object.assign(element, updates)
		})
		const canvas = {
			magicConfigManager: {
				config: {
					methods: {
						resolveResourceReference: vi.fn(() => ({
							status: "invalid",
							rawReference: "/invalid/generated.png",
							candidates: [],
						})),
						getImageGenerationResult: vi.fn().mockResolvedValue({
							image_id: "image-task-1",
							status: GenerationStatus.Completed,
							file_dir: "/invalid/",
							file_name: "generated.png",
							file_url: null,
							error_message: null,
						}),
					},
				},
			},
			elementManager: { update },
			imageResourceManager: { primeCache: vi.fn() },
			eventEmitter: { emit: vi.fn() },
		}
		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})

		manager.start()

		await vi.waitFor(() => expect(update).toHaveBeenCalled())
		expect(element.contents[0]).toEqual(
			expect.objectContaining({
				status: GenerationStatus.Failed,
				errorMessage: INVALID_GENERATED_RESOURCE_PATH_ERROR,
			}),
		)
		expect(element.contents[0].src).toBeUndefined()
	})

	it("clears a persisted image task when the backend confirms that exact task is missing", async () => {
		const element = createImageElement({ status: GenerationStatus.Processing })
		const update = vi.fn((elementId: string, updates: Partial<ImageElement>) => {
			if (elementId === element.id) Object.assign(element, updates)
		})
		const deleteElement = vi.fn()
		const emit = vi.fn()
		const canvas = {
			magicConfigManager: {
				config: {
					methods: {
						getImageGenerationResult: vi.fn().mockRejectedValue({
							code: 14000,
							message: "image-task-1 未找到",
						}),
						resolveResourceReference,
					},
				},
			},
			elementManager: { update, delete: deleteElement },
			eventEmitter: { emit },
		}

		const manager = new ImagePollingManager({
			elementId: element.id,
			canvas: canvas as never,
			getElementData: () => element,
		})

		manager.start()

		await vi.waitFor(() => expect(update).toHaveBeenCalled())
		expect(update).toHaveBeenCalledWith(
			element.id,
			{
				contents: [
					expect.objectContaining({
						contentId: "content-1",
						status: GenerationStatus.Failed,
					}),
				],
			},
			{ silent: false, historyPolicy: "exclude" },
		)
		expect(deleteElement).not.toHaveBeenCalled()
		expect(emit).toHaveBeenCalledWith({
			type: "element:image:generate-submit-failed",
			data: { elementId: element.id },
		})
	})
})
