import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../../../../runtime/core/Canvas"
import { ElementTypeEnum, type ImageElement } from "../../../../../../runtime/document/types"
import { ImageElement as ImageElementClass } from "../../../../../../runtime/elements/image/ImageElement"
import { createAndSubmitImageGeneration } from "../createAndSubmitImageGeneration"

function createImageInstance(
	submitInitialGeneration: (request: unknown) => Promise<boolean>,
): ImageElementClass {
	const instance = Object.create(ImageElementClass.prototype) as ImageElementClass
	instance.submitInitialGeneration =
		submitInitialGeneration as ImageElementClass["submitInitialGeneration"]
	return instance
}

function createCanvas(elementInstance: ImageElementClass) {
	const elementManager = {
		createTemporaryElement: vi.fn(),
		delete: vi.fn(),
		commitGenerationTargets: vi.fn(),
		hasElement: vi.fn(() => true),
		getElementInstance: vi.fn(() => elementInstance),
	}

	return {
		canvas: {
			elementManager,
			generationRuntimeManager: { getTargetState: vi.fn(() => null) },
			generationAttemptCoordinator: {
				resolveDetachedPlaceholderFailure: vi.fn(),
			},
		} as unknown as Canvas,
		elementManager,
	}
}

const newImageElement = {
	id: "new-image",
	type: ElementTypeEnum.Image,
	x: 10,
	y: 20,
	width: 512,
	height: 512,
} as ImageElement

describe("createAndSubmitImageGeneration", () => {
	it("keeps the generated image temporary until task submission succeeds", async () => {
		const elementInstance = createImageInstance(vi.fn().mockResolvedValue(true))
		const { canvas, elementManager } = createCanvas(elementInstance)
		const onSubmitStarted = vi.fn()

		const submitted = await createAndSubmitImageGeneration({
			canvas,
			newImageElement,
			request: { model_id: "image-model", prompt: "create an image" },
			onSubmitStarted,
		})

		expect(submitted).toBe(true)
		expect(elementManager.createTemporaryElement).toHaveBeenCalledWith(newImageElement, {
			silent: true,
		})
		expect(onSubmitStarted).toHaveBeenCalledOnce()
		expect(elementManager.commitGenerationTargets).not.toHaveBeenCalled()
		expect(elementManager.delete).not.toHaveBeenCalled()
	})

	it("clears an invalid image task before preserving the empty retry element", async () => {
		const elementInstance = createImageInstance(vi.fn().mockResolvedValue(false))
		const { canvas, elementManager } = createCanvas(elementInstance)
		const onSubmitFailed = vi.fn()

		const submitted = await createAndSubmitImageGeneration({
			canvas,
			newImageElement,
			request: { model_id: "image-model", prompt: "create an image" },
			onSubmitFailed,
		})

		expect(submitted).toBe(false)
		expect(
			canvas.generationAttemptCoordinator.resolveDetachedPlaceholderFailure,
		).toHaveBeenCalledWith(newImageElement.id, "promote-empty")
		expect(elementManager.commitGenerationTargets).not.toHaveBeenCalled()
		expect(onSubmitFailed).toHaveBeenCalledOnce()
		expect(elementManager.delete).not.toHaveBeenCalled()
	})

	it("does not let an older rejected request clear a newer attempt", async () => {
		const elementInstance = createImageInstance(vi.fn().mockResolvedValue(false))
		const { canvas, elementManager } = createCanvas(elementInstance)
		vi.mocked(canvas.generationRuntimeManager.getTargetState).mockReturnValue({
			attemptId: "new-attempt",
		} as never)

		const submitted = await createAndSubmitImageGeneration({
			canvas,
			newImageElement,
			request: { model_id: "image-model", prompt: "create an image" },
		})

		expect(submitted).toBe(false)
		expect(elementManager.commitGenerationTargets).not.toHaveBeenCalled()
	})
})
