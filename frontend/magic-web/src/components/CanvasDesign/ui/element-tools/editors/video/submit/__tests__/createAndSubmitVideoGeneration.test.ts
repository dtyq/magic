import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../../../../runtime/core/Canvas"
import { ElementTypeEnum, type VideoElement } from "../../../../../../runtime/document/types"
import { VideoElement as VideoElementClass } from "../../../../../../runtime/elements/video/VideoElement"
import { createAndSubmitVideoGeneration } from "../createAndSubmitVideoGeneration"

function createVideoInstance(
	generateVideo: (request: unknown) => Promise<boolean>,
): VideoElementClass {
	const instance = Object.create(VideoElementClass.prototype) as VideoElementClass
	instance.generateVideo = generateVideo as VideoElementClass["generateVideo"]
	return instance
}

function createCanvas(getElementInstance: (elementId: string) => VideoElementClass) {
	const elementManager = {
		createTemporaryElement: vi.fn(),
		delete: vi.fn(),
		commitGenerationTargets: vi.fn(),
		hasElement: vi.fn(() => true),
		findParentIdForElement: vi.fn(() => undefined),
		getNextZIndexInLevel: vi.fn(() => 2),
		getElementInstance: vi.fn(getElementInstance),
	}

	return {
		canvas: {
			elementManager,
			mediaEditRecoveryManager: { saveDraft: vi.fn() },
			generationRuntimeManager: { getTargetState: vi.fn(() => null) },
			generationAttemptCoordinator: {
				resolveDetachedPlaceholderFailure: vi.fn(),
			},
			selectionManager: { select: vi.fn() },
		} as unknown as Canvas,
		elementManager,
	}
}

const sourceVideoElement = {
	id: "source-video",
	type: ElementTypeEnum.Video,
	x: 10,
	y: 20,
	width: 320,
	height: 180,
} as VideoElement

describe("createAndSubmitVideoGeneration", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it("keeps the new element temporary until the backend accepts the task", async () => {
		const newElementInstance = createVideoInstance(vi.fn().mockResolvedValue(true))
		const { canvas, elementManager } = createCanvas((elementId) =>
			elementId === sourceVideoElement.id ? createVideoInstance(vi.fn()) : newElementInstance,
		)

		const submitted = await createAndSubmitVideoGeneration({
			canvas,
			sourceVideoElement,
			request: { model_id: "video-model", prompt: "make a video" },
		})

		expect(submitted).toBe(true)
		expect(elementManager.createTemporaryElement).toHaveBeenCalledWith(
			expect.objectContaining({ type: ElementTypeEnum.Video }),
			{ silent: true },
		)
		expect(elementManager.commitGenerationTargets).not.toHaveBeenCalled()
		expect(elementManager.delete).not.toHaveBeenCalled()
	})

	it("promotes a task-free retry editor when task submission is rejected", async () => {
		const newElementInstance = createVideoInstance(vi.fn().mockResolvedValue(false))
		const { canvas, elementManager } = createCanvas((elementId) =>
			elementId === sourceVideoElement.id ? createVideoInstance(vi.fn()) : newElementInstance,
		)

		const submitted = await createAndSubmitVideoGeneration({
			canvas,
			sourceVideoElement,
			request: { model_id: "video-model", prompt: "make a video" },
		})

		expect(submitted).toBe(false)
		expect(
			canvas.generationAttemptCoordinator.resolveDetachedPlaceholderFailure,
		).toHaveBeenCalledWith(expect.any(String), "promote-empty")
		expect(elementManager.commitGenerationTargets).not.toHaveBeenCalled()
		expect(elementManager.delete).not.toHaveBeenCalled()
	})

	it("does not let an older rejected request clear a newer attempt", async () => {
		const newElementInstance = createVideoInstance(vi.fn().mockResolvedValue(false))
		const { canvas, elementManager } = createCanvas((elementId) =>
			elementId === sourceVideoElement.id ? createVideoInstance(vi.fn()) : newElementInstance,
		)
		vi.mocked(canvas.generationRuntimeManager.getTargetState).mockReturnValue({
			attemptId: "new-attempt",
		} as never)

		const submitted = await createAndSubmitVideoGeneration({
			canvas,
			sourceVideoElement,
			request: { model_id: "video-model", prompt: "make a video" },
		})

		expect(submitted).toBe(false)
		expect(elementManager.commitGenerationTargets).not.toHaveBeenCalled()
	})
})
