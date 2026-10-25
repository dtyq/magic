import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { EventEmitter } from "../../../core/EventEmitter"
import { ElementTypeEnum, type LayerElement, type VideoElement } from "../../../document/types"
import { VideoElement as VideoElementClass } from "../../../elements/video/VideoElement"
import {
	GenerationStatus,
	type GenerateVideoRequest,
	type VideoModelItem,
} from "../../../../public/magic-types"
import { VideoDraftFinalManager } from "../VideoDraftFinalManager"
import { buildVideoDraftFinalRequest } from "../videoDraftFinalRequest"

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
vi.mock("../../../shared/placement/connectionCreatePlacement", () => ({
	collectConnectionCreateObstacleRects: vi.fn(() => []),
	resolveConnectionCreateGapForElement: vi.fn(() => 64),
}))
vi.mock("../../../shared/placement/placementEngine", () => ({
	resolveConnectedPlacement: vi.fn(() => ({ x: 500, y: 100 })),
}))

function createDraftVideo(id = "draft", videoId = "draft-video-id"): VideoElement {
	const contentId = `${id}-content`
	return {
		id,
		type: ElementTypeEnum.Video,
		x: 10,
		y: 20,
		width: 320,
		height: 180,
		contents: [
			{
				contentId,
				src: `./videos/${id}.mp4`,
				status: GenerationStatus.Completed,
				generateVideoRequest: {
					video_id: videoId,
					model_id: "seedance-model",
					generation: { draft: true, resolution: "480p" },
				},
			},
		],
		activeContentId: contentId,
		mainContentId: contentId,
	} as VideoElement
}

function createFinalRequest(source: VideoElement, videoId: string): GenerateVideoRequest {
	const request = buildVideoDraftFinalRequest(source.contents[0], videoId)
	if (!request) throw new Error("expected a valid draft final request")
	return request
}

function createExistingFinal(source: VideoElement, id = "final"): VideoElement {
	return {
		id,
		type: ElementTypeEnum.Video,
		contents: [
			{
				contentId: `${id}-content`,
				src: `./videos/${id}.mp4`,
				status: GenerationStatus.Completed,
				generateVideoRequest: createFinalRequest(source, `${id}-task`),
			},
		],
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
	} as VideoElement
}

function createCanvas(initialElements: LayerElement[], videoModelList: VideoModelItem[] = []) {
	const eventEmitter = new EventEmitter()
	const elements = new Map(initialElements.map((element) => [element.id, element]))
	const temporaryIds = new Set<string>()
	const connections = new Map<
		string,
		{ id: string; sourceElementId: string; targetElementId: string }
	>()
	let connectionSequence = 0
	const resultInstance = Object.create(VideoElementClass.prototype) as VideoElementClass
	resultInstance.generateVideo = vi.fn(async (request: GenerateVideoRequest) => {
		const resultId = Array.from(temporaryIds).find((id) => {
			const result = elements.get(id)
			return (
				result?.type === ElementTypeEnum.Video && !result.contents[0]?.generateVideoRequest
			)
		})
		const result = resultId ? elements.get(resultId) : undefined
		if (result?.type === ElementTypeEnum.Video) {
			result.contents[0] = { ...result.contents[0], generateVideoRequest: request }
		}
		return true
	})

	const canvas = {
		eventEmitter,
		t: (_key: string, fallback: string) => fallback,
		magicConfigManager: {
			config: {
				methods: videoModelList.length
					? { getVideoModelList: vi.fn(async () => videoModelList) }
					: {},
			},
		},
		elementManager: {
			getElementData: vi.fn((id: string) => elements.get(id)),
			getElementInstance: vi.fn((id: string) =>
				temporaryIds.has(id) ? resultInstance : undefined,
			),
			getNextZIndexInLevel: vi.fn(() => 2),
			createTemporaryElement: vi.fn((element: LayerElement) => {
				temporaryIds.add(element.id)
				elements.set(element.id, element)
				return { elementId: element.id, element }
			}),
			convertToPermament: vi.fn((id: string, updates: Partial<LayerElement>) => {
				const current = elements.get(id)
				if (current) elements.set(id, { ...current, ...updates } as LayerElement)
				temporaryIds.delete(id)
			}),
			hasElement: vi.fn((id: string) => elements.has(id)),
			delete: vi.fn((id: string) => {
				elements.delete(id)
				temporaryIds.delete(id)
			}),
		},
		geometryCacheManager: { getElementBounds: vi.fn(() => null) },
		connectionManager: {
			connectRuntimeElements: vi.fn(
				(options: { sourceElementId: string; targetElementId: string }) => {
					const connection = { id: `runtime-${++connectionSequence}`, ...options }
					connections.set(connection.id, connection)
					return { status: "created" as const, connectionId: connection.id }
				},
			),
			getConnections: vi.fn(() => Array.from(connections.values())),
			removeConnections: vi.fn((ids: string[]) => {
				ids.forEach((id) => connections.delete(id))
				return ids
			}),
			promoteRuntimeConnection: vi.fn((id: string) => connections.has(id)),
		},
		historyManager: {
			runTransaction: vi.fn((callback: () => unknown) => callback()),
		},
	} as unknown as Canvas

	return { canvas, elements, temporaryIds, connections, resultInstance }
}

describe("VideoDraftFinalManager", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("creates a temporary result and promotes the element and connection together", async () => {
		const source = createDraftVideo()
		source.name = "AAA"
		const { canvas, elements, temporaryIds, connections } = createCanvas(
			[source],
			[
				{
					model_id: "seedance-model",
					video_generation_config: {
						generation: {
							sizes: [
								{
									label: "16:9",
									value: "1920x1080",
									width: 1920,
									height: 1080,
									resolution: "1080p",
								},
							],
						},
					},
				} as VideoModelItem,
			],
		)
		const manager = new VideoDraftFinalManager({ canvas })
		const request = createFinalRequest(source, "final-task")

		expect(
			await manager.start({
				sourceElementId: source.id,
				sourceContentId: source.contents[0].contentId,
				request,
			}),
		).toBe(true)
		const processing = manager.getState(source.id, source.contents[0].contentId)
		expect(processing).toMatchObject({ status: "processing", activeJobCount: 1 })
		const resultId = processing.resultElementId
		if (!resultId) throw new Error("expected a temporary final result")
		const result = elements.get(resultId) as VideoElement
		expect(result).toMatchObject({ name: "AAA(1080p)", width: 1920, height: 1080 })
		result.contents[0] = {
			...result.contents[0],
			src: "./videos/final.mp4",
			status: GenerationStatus.Completed,
			generateVideoRequest: request,
		}
		canvas.eventEmitter.emit({
			type: "element:updated",
			data: { elementId: resultId, data: result },
		})

		expect(temporaryIds.has(resultId)).toBe(false)
		expect(canvas.elementManager.convertToPermament).toHaveBeenCalledOnce()
		expect(canvas.connectionManager.promoteRuntimeConnection).toHaveBeenCalledWith("runtime-1")
		expect(connections.has("runtime-1")).toBe(true)
		expect(manager.getState(source.id, source.contents[0].contentId)).toMatchObject({
			status: "completed",
			activeJobCount: 0,
			resultElementId: resultId,
		})

		connections.delete("runtime-1")
		canvas.eventEmitter.emit({
			type: "connection:change",
			data: { connections: [], deletedConnectionIds: ["runtime-1"] },
		})
		expect(elements.has(resultId)).toBe(true)
		expect(manager.getState(source.id, source.contents[0].contentId).status).toBe("completed")
		manager.destroy()
	})

	it("removes both runtime resources when asynchronous generation fails", async () => {
		const source = createDraftVideo()
		const { canvas, elements, connections } = createCanvas([source])
		const manager = new VideoDraftFinalManager({ canvas })
		const request = createFinalRequest(source, "final-task")
		await manager.start({
			sourceElementId: source.id,
			sourceContentId: source.contents[0].contentId,
			request,
		})
		const resultId = manager.getState(source.id, source.contents[0].contentId).resultElementId
		if (!resultId) throw new Error("expected a temporary final result")
		const result = elements.get(resultId) as VideoElement
		result.contents[0] = {
			...result.contents[0],
			status: GenerationStatus.Failed,
			errorMessage: "backend failed",
		}
		canvas.eventEmitter.emit({
			type: "element:updated",
			data: { elementId: resultId, data: result },
		})

		expect(elements.has(resultId)).toBe(false)
		expect(connections.size).toBe(0)
		expect(manager.getState(source.id, source.contents[0].contentId)).toMatchObject({
			status: "error",
			activeJobCount: 0,
			errorMessage: "backend failed",
		})
		manager.destroy()
	})

	it("cleans up when polling reports that the submitted task no longer exists", async () => {
		const source = createDraftVideo()
		const { canvas, elements, connections } = createCanvas([source])
		const manager = new VideoDraftFinalManager({ canvas })
		await manager.start({
			sourceElementId: source.id,
			sourceContentId: source.contents[0].contentId,
			request: createFinalRequest(source, "final-task"),
		})
		const resultId = manager.getState(source.id, source.contents[0].contentId).resultElementId
		if (!resultId) throw new Error("expected a temporary final result")

		canvas.eventEmitter.emit({
			type: "element:video:generate-submit-failed",
			data: { elementId: resultId },
		})

		expect(elements.has(resultId)).toBe(false)
		expect(connections.size).toBe(0)
		expect(manager.getState(source.id, source.contents[0].contentId)).toMatchObject({
			status: "error",
			activeJobCount: 0,
		})
		manager.destroy()
	})

	it("waits for submission cleanup before handling an immediate generate-failed event", async () => {
		const source = createDraftVideo()
		const { canvas, elements, connections, resultInstance } = createCanvas([source])
		let placeholderExistedWhenEventFired = false
		resultInstance.generateVideo = vi.fn(async () => {
			const resultId = Array.from(elements.keys()).find((id) => id !== source.id)
			if (!resultId) throw new Error("expected a temporary final result")
			canvas.eventEmitter.emit({
				type: "element:video:generate-submit-failed",
				data: { elementId: resultId },
			})
			placeholderExistedWhenEventFired = elements.has(resultId)
			return true
		})
		const manager = new VideoDraftFinalManager({ canvas })

		expect(
			await manager.start({
				sourceElementId: source.id,
				sourceContentId: source.contents[0].contentId,
				request: createFinalRequest(source, "final-task"),
			}),
		).toBe(false)
		expect(placeholderExistedWhenEventFired).toBe(true)
		expect(elements.size).toBe(1)
		expect(connections.size).toBe(0)
		expect(manager.getState(source.id, source.contents[0].contentId).status).toBe("error")
		manager.destroy()
	})

	it("reports an immediate submission failure after remove-placeholder deletes the target", async () => {
		const source = createDraftVideo()
		const { canvas, elements, connections, resultInstance } = createCanvas([source])
		resultInstance.generateVideo = vi.fn(async () => {
			const resultId = Array.from(elements.keys()).find((id) => id !== source.id)
			if (!resultId) throw new Error("expected a temporary final result")
			canvas.eventEmitter.emit({
				type: "element:video:generate-submit-failed",
				data: { elementId: resultId },
			})
			elements.delete(resultId)
			canvas.eventEmitter.emit({
				type: "element:deleted",
				data: { elementId: resultId, persistence: "runtime-only" },
			})
			return false
		})
		const manager = new VideoDraftFinalManager({ canvas })

		expect(
			await manager.start({
				sourceElementId: source.id,
				sourceContentId: source.contents[0].contentId,
				request: createFinalRequest(source, "final-task"),
			}),
		).toBe(false)
		expect(elements.size).toBe(1)
		expect(connections.size).toBe(0)
		expect(manager.getState(source.id, source.contents[0].contentId).status).toBe("error")
		manager.destroy()
	})

	it("cancels the captured job when its source content disappears", async () => {
		const source = createDraftVideo()
		const { canvas, elements, connections } = createCanvas([source])
		const manager = new VideoDraftFinalManager({ canvas })
		await manager.start({
			sourceElementId: source.id,
			sourceContentId: source.contents[0].contentId,
			request: createFinalRequest(source, "final-task"),
		})
		elements.delete(source.id)
		canvas.eventEmitter.emit({
			type: "element:deleted",
			data: { elementId: source.id },
		})

		expect(elements.size).toBe(0)
		expect(connections.size).toBe(0)
		expect(manager.getState(source.id, source.contents[0].contentId).status).toBe("cancelled")
		manager.destroy()
	})

	it("cancels and removes the peer resource when the temporary target is deleted", async () => {
		const source = createDraftVideo()
		const { canvas, elements, connections } = createCanvas([source])
		const manager = new VideoDraftFinalManager({ canvas })
		await manager.start({
			sourceElementId: source.id,
			sourceContentId: source.contents[0].contentId,
			request: createFinalRequest(source, "final-task"),
		})
		const resultId = manager.getState(source.id, source.contents[0].contentId).resultElementId
		if (!resultId) throw new Error("expected a temporary final result")

		elements.delete(resultId)
		canvas.eventEmitter.emit({
			type: "element:deleted",
			data: { elementId: resultId, persistence: "runtime-only" },
		})

		expect(connections.size).toBe(0)
		expect(manager.getState(source.id, source.contents[0].contentId).status).toBe("cancelled")
		manager.destroy()
	})

	it("removes in-flight runtime resources when the canvas manager is destroyed", async () => {
		const source = createDraftVideo()
		const { canvas, elements, connections } = createCanvas([source])
		const manager = new VideoDraftFinalManager({ canvas })
		await manager.start({
			sourceElementId: source.id,
			sourceContentId: source.contents[0].contentId,
			request: createFinalRequest(source, "final-task"),
		})

		manager.destroy()

		expect(elements.size).toBe(1)
		expect(elements.has(source.id)).toBe(true)
		expect(connections.size).toBe(0)
	})

	it("revalidates that the captured source content is still completed before starting", async () => {
		const source = createDraftVideo()
		source.contents[0] = { ...source.contents[0], status: GenerationStatus.Failed }
		const { canvas } = createCanvas([source])
		const manager = new VideoDraftFinalManager({ canvas })

		expect(
			await manager.start({
				sourceElementId: source.id,
				sourceContentId: source.contents[0].contentId,
				request: createFinalRequest(source, "final-task"),
			}),
		).toBe(false)
		expect(canvas.elementManager.createTemporaryElement).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("creates a new final even when the same draft already has a persisted final", async () => {
		const source = createDraftVideo()
		const existing = createExistingFinal(source)
		const { canvas, elements, temporaryIds } = createCanvas([source, existing])
		const manager = new VideoDraftFinalManager({ canvas })

		expect(
			await manager.start({
				sourceElementId: source.id,
				sourceContentId: source.contents[0].contentId,
				request: createFinalRequest(source, "another-final-task"),
			}),
		).toBe(true)
		expect(elements.has(existing.id)).toBe(true)
		expect(temporaryIds.size).toBe(1)
		expect(manager.getState(source.id, source.contents[0].contentId)).toMatchObject({
			status: "processing",
			activeJobCount: 1,
		})
		manager.destroy()
	})

	it("allows multiple in-flight finals from the same draft and creates one node per request", async () => {
		const source = createDraftVideo()
		const { canvas, elements, connections, temporaryIds } = createCanvas([source])
		const manager = new VideoDraftFinalManager({ canvas })

		expect(
			await manager.start({
				sourceElementId: source.id,
				sourceContentId: source.contents[0].contentId,
				request: createFinalRequest(source, "final-task"),
			}),
		).toBe(true)
		const firstResultId = manager.getState(
			source.id,
			source.contents[0].contentId,
		).resultElementId
		expect(
			await manager.start({
				sourceElementId: source.id,
				sourceContentId: source.contents[0].contentId,
				request: createFinalRequest(source, "second-final-task"),
			}),
		).toBe(true)
		const state = manager.getState(source.id, source.contents[0].contentId)

		expect(state).toMatchObject({
			status: "processing",
			activeJobCount: 2,
			resultElementId: expect.any(String),
		})
		expect(state.resultElementId).not.toBe(firstResultId)
		expect(elements.size).toBe(3)
		expect(temporaryIds.size).toBe(2)
		expect(connections.size).toBe(2)
		manager.destroy()
	})

	it("settles concurrent finals independently", async () => {
		const source = createDraftVideo()
		const { canvas, elements, connections, temporaryIds } = createCanvas([source])
		const manager = new VideoDraftFinalManager({ canvas })

		await manager.start({
			sourceElementId: source.id,
			sourceContentId: source.contents[0].contentId,
			request: createFinalRequest(source, "first-final-task"),
		})
		const firstResultId = manager.getState(
			source.id,
			source.contents[0].contentId,
		).resultElementId
		await manager.start({
			sourceElementId: source.id,
			sourceContentId: source.contents[0].contentId,
			request: createFinalRequest(source, "second-final-task"),
		})
		const secondResultId = manager.getState(
			source.id,
			source.contents[0].contentId,
		).resultElementId
		if (!firstResultId || !secondResultId) throw new Error("expected two final results")

		const firstResult = elements.get(firstResultId) as VideoElement
		firstResult.contents[0] = {
			...firstResult.contents[0],
			src: "./videos/first-final.mp4",
			status: GenerationStatus.Completed,
		}
		canvas.eventEmitter.emit({
			type: "element:updated",
			data: { elementId: firstResultId, data: firstResult },
		})

		expect(elements.has(firstResultId)).toBe(true)
		expect(temporaryIds.has(firstResultId)).toBe(false)
		expect(temporaryIds.has(secondResultId)).toBe(true)
		expect(manager.getState(source.id, source.contents[0].contentId)).toMatchObject({
			status: "processing",
			activeJobCount: 1,
			resultElementId: secondResultId,
		})

		const secondResult = elements.get(secondResultId) as VideoElement
		secondResult.contents[0] = {
			...secondResult.contents[0],
			status: GenerationStatus.Failed,
			errorMessage: "second final failed",
		}
		canvas.eventEmitter.emit({
			type: "element:updated",
			data: { elementId: secondResultId, data: secondResult },
		})

		expect(elements.has(firstResultId)).toBe(true)
		expect(elements.has(secondResultId)).toBe(false)
		expect(connections.size).toBe(1)
		expect(manager.getState(source.id, source.contents[0].contentId)).toMatchObject({
			status: "error",
			activeJobCount: 0,
			errorMessage: "second final failed",
		})
		manager.destroy()
	})
})
