import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../core/Canvas"
import {
	ElementTypeEnum,
	type ElementUpdatePatch,
	type ImageElement,
	type LayerElement,
	type VideoElement,
} from "../../document/types"
import { getActiveContent, updateContent } from "../../document/elementContent"
import { GenerationAttemptCoordinator } from "../GenerationAttemptCoordinator"
import { GenerationRuntimeManager } from "../GenerationRuntimeManager"

function createHarness(initialElements: LayerElement[], temporaryElementIds: string[] = []) {
	const elements = new Map(initialElements.map((element) => [element.id, element]))
	const temporaryElements = new Set(temporaryElementIds)
	const generationRuntimeManager = new GenerationRuntimeManager()
	const commitGenerationTargets = vi.fn(
		(targets: Array<{ elementId: string; persistedPatch: ElementUpdatePatch }>) => {
			for (const target of targets) {
				const element = elements.get(target.elementId)
				if (!element) throw new Error(`Element ${target.elementId} not found`)
				elements.set(target.elementId, {
					...element,
					...target.persistedPatch,
				} as LayerElement)
				temporaryElements.delete(target.elementId)
			}
		},
	)
	const batchDelete = vi.fn((elementIds: string[]) => {
		for (const elementId of elementIds) {
			elements.delete(elementId)
			temporaryElements.delete(elementId)
			generationRuntimeManager.clearElement(elementId)
		}
	})
	const canvas = {
		generationRuntimeManager,
		elementManager: {
			hasElement: (elementId: string) => elements.has(elementId),
			getElementData: (elementId: string) => elements.get(elementId),
			getTemporaryElementMetadata: (elementId: string) =>
				temporaryElements.has(elementId)
					? {
							kind: "generation-result" as const,
							historyPolicy: "exclude" as const,
							clipboardPolicy: "exclude" as const,
						}
					: null,
			commitGenerationTargets,
			batchDelete,
		},
	} as unknown as Canvas
	const coordinator = new GenerationAttemptCoordinator(canvas)

	return {
		canvas,
		coordinator,
		elements,
		temporaryElements,
		commitGenerationTargets,
		batchDelete,
	}
}

function imageElement(id: string): ImageElement {
	return {
		id,
		type: ElementTypeEnum.Image,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		zIndex: 1,
		contents: [{ contentId: `${id}-content-1` }],
		activeContentId: `${id}-content-1`,
		mainContentId: `${id}-content-1`,
	}
}

function videoElement(id: string): VideoElement {
	return {
		id,
		type: ElementTypeEnum.Video,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		zIndex: 1,
		contents: [{ contentId: `${id}-content-1` }],
		activeContentId: `${id}-content-1`,
		mainContentId: `${id}-content-1`,
	}
}

describe("GenerationAttemptCoordinator", () => {
	it("rejects a confirmation that targets a different Content on the same element", () => {
		const element = imageElement("image-1")
		element.contents.push({ contentId: "image-1-content-2" })
		const { canvas, coordinator, commitGenerationTargets } = createHarness([element])
		const attemptId = canvas.generationRuntimeManager.beginAttempt({
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: element.id, contentId: "image-1-content-1" }],
		})

		expect(
			coordinator.confirmAttempt(attemptId, [
				{
					elementId: element.id,
					contentId: "image-1-content-2",
					persistedPatch: { contents: element.contents },
				},
			]),
		).toBe(false)
		expect(commitGenerationTargets).not.toHaveBeenCalled()
		expect(canvas.generationRuntimeManager.getAttempt(attemptId)).not.toBeNull()
	})

	it("clears a failed existing-element attempt without mutating the element", () => {
		const element = updateContent<ImageElement>(imageElement("image-1"), "image-1-content-1", {
			src: "./images/original.png",
		})
		const { canvas, coordinator, elements, commitGenerationTargets, batchDelete } =
			createHarness([element])
		const attemptId = canvas.generationRuntimeManager.beginAttempt({
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: element.id }],
		})

		expect(coordinator.rejectAttempt(attemptId)).toEqual({
			resolution: "restored-existing",
			elementIds: [element.id],
		})
		expect(elements.get(element.id)).toEqual(element)
		expect(commitGenerationTargets).not.toHaveBeenCalled()
		expect(batchDelete).not.toHaveBeenCalled()
		expect(canvas.generationRuntimeManager.getTargetState(element.id)).toBeNull()
	})

	it.each([imageElement("image-1"), videoElement("video-1")] as const)(
		"promotes a failed %s placeholder to a task-free formal element",
		(element) => {
			const elementWithTask: ImageElement | VideoElement =
				element.type === ElementTypeEnum.Image
					? updateContent<ImageElement>(element, element.activeContentId ?? undefined, {
							status: "processing",
							generateImageRequest: { image_id: "invalid-image" },
						})
					: updateContent<VideoElement>(element, element.activeContentId ?? undefined, {
							status: "processing",
							generateVideoRequest: { video_id: "invalid-video" },
						})
			const { canvas, coordinator, elements, temporaryElements } = createHarness(
				[elementWithTask],
				[element.id],
			)
			const attemptId = canvas.generationRuntimeManager.beginAttempt({
				operation:
					element.type === ElementTypeEnum.Image ? "image-generate" : "video-generate",
				failurePolicy: "promote-empty",
				targets: [{ elementId: element.id }],
			})

			expect(coordinator.rejectAttempt(attemptId).resolution).toBe("promoted-empty")
			expect(temporaryElements.has(element.id)).toBe(false)
			const promoted = elements.get(element.id)
			if (!promoted) throw new Error("Expected promoted element")
			if (promoted.type === ElementTypeEnum.Image) {
				const promotedContent = getActiveContent(promoted)
				expect(promotedContent?.status).toBeUndefined()
				expect(promotedContent?.generateImageRequest).toBeUndefined()
				expect(promotedContent?.imageGenerationTaskMeta).toBeUndefined()
			} else {
				if (promoted.type !== ElementTypeEnum.Video)
					throw new Error("Expected media element")
				const promotedContent = getActiveContent(promoted)
				expect(promotedContent?.status).toBeUndefined()
				expect(promotedContent?.generateVideoRequest).toBeUndefined()
				expect(promotedContent?.videoGenerationResultMeta).toBeUndefined()
			}
		},
	)

	it("removes only runtime placeholders still owned by the failed batch", () => {
		const { canvas, coordinator, elements, batchDelete } = createHarness(
			[imageElement("image-1"), imageElement("image-2"), imageElement("image-3")],
			["image-1", "image-2", "image-3"],
		)
		const attemptId = canvas.generationRuntimeManager.beginAttempt({
			attemptId: "older",
			operation: "image-batch",
			failurePolicy: "remove-placeholder",
			targets: [{ elementId: "image-1" }, { elementId: "image-2" }, { elementId: "image-3" }],
		})
		canvas.generationRuntimeManager.beginAttempt({
			attemptId: "newer",
			operation: "image-generate",
			failurePolicy: "restore-existing",
			targets: [{ elementId: "image-1" }],
		})

		coordinator.rejectAttempt(attemptId)

		expect(batchDelete).toHaveBeenCalledWith(["image-2", "image-3"])
		expect(elements.has("image-1")).toBe(true)
		expect(elements.has("image-2")).toBe(false)
		expect(elements.has("image-3")).toBe(false)
		expect(canvas.generationRuntimeManager.getTargetState("image-1")?.attemptId).toBe("newer")
	})

	it("never deletes a formal element even when a remove policy is declared", () => {
		const element = imageElement("image-1")
		const { canvas, coordinator, elements, batchDelete } = createHarness([element])
		const attemptId = canvas.generationRuntimeManager.beginAttempt({
			operation: "image-high",
			failurePolicy: "remove-placeholder",
			targets: [{ elementId: element.id }],
		})

		coordinator.rejectAttempt(attemptId)

		expect(elements.has(element.id)).toBe(true)
		expect(batchDelete).not.toHaveBeenCalled()
	})

	it("is idempotent after an attempt has already been rejected", () => {
		const element = imageElement("image-1")
		const { canvas, coordinator, batchDelete } = createHarness([element], [element.id])
		const attemptId = canvas.generationRuntimeManager.beginAttempt({
			operation: "image-high",
			failurePolicy: "remove-placeholder",
			targets: [{ elementId: element.id }],
		})

		expect(coordinator.rejectAttempt(attemptId).resolution).toBe("removed-placeholder")
		expect(coordinator.rejectAttempt(attemptId)).toEqual({
			resolution: "stale",
			elementIds: [],
		})
		expect(batchDelete).toHaveBeenCalledTimes(1)
	})

	it("promotes a detached placeholder only when no newer attempt owns it", () => {
		const element = imageElement("image-1")
		const { canvas, coordinator, elements, temporaryElements } = createHarness(
			[element],
			[element.id],
		)

		expect(
			coordinator.resolveDetachedPlaceholderFailure(element.id, "promote-empty").resolution,
		).toBe("promoted-empty")
		expect(elements.has(element.id)).toBe(true)
		expect(temporaryElements.has(element.id)).toBe(false)

		temporaryElements.add(element.id)
		canvas.generationRuntimeManager.beginAttempt({
			operation: "image-generate",
			failurePolicy: "promote-empty",
			targets: [{ elementId: element.id }],
		})
		expect(coordinator.resolveDetachedPlaceholderFailure(element.id, "promote-empty")).toEqual({
			resolution: "stale",
			elementIds: [],
		})
		expect(temporaryElements.has(element.id)).toBe(true)
	})

	it("falls back to removing a placeholder when empty promotion fails", () => {
		const element = imageElement("image-1")
		const { canvas, coordinator, elements, commitGenerationTargets, batchDelete } =
			createHarness([element], [element.id])
		commitGenerationTargets.mockImplementationOnce(() => {
			throw new Error("commit failed")
		})
		const attemptId = canvas.generationRuntimeManager.beginAttempt({
			operation: "image-generate",
			failurePolicy: "promote-empty",
			targets: [{ elementId: element.id }],
		})

		expect(coordinator.rejectAttempt(attemptId).resolution).toBe("fallback-removed")
		expect(batchDelete).toHaveBeenCalledWith([element.id])
		expect(elements.has(element.id)).toBe(false)
		expect(canvas.generationRuntimeManager.getTargetState(element.id)).toBeNull()
	})

	it("does not confirm a partial or superseded target set", () => {
		const elements = [imageElement("image-1"), imageElement("image-2")]
		const { canvas, coordinator, commitGenerationTargets } = createHarness(
			elements,
			elements.map((element) => element.id),
		)
		const attemptId = canvas.generationRuntimeManager.beginAttempt({
			operation: "image-batch",
			failurePolicy: "remove-placeholder",
			targets: elements.map((element) => ({ elementId: element.id })),
		})

		expect(
			coordinator.confirmAttempt(attemptId, [
				{ elementId: "image-1", persistedPatch: { status: "processing" } },
			]),
		).toBe(false)
		expect(commitGenerationTargets).not.toHaveBeenCalled()
		expect(canvas.generationRuntimeManager.getAttempt(attemptId)).not.toBeNull()
	})

	it("confirms exactly the current target set and clears Runtime state", () => {
		const element = imageElement("image-1")
		const { canvas, coordinator, elements, commitGenerationTargets } = createHarness(
			[element],
			[element.id],
		)
		const attemptId = canvas.generationRuntimeManager.beginAttempt({
			operation: "image-generate",
			failurePolicy: "promote-empty",
			targets: [{ elementId: element.id }],
		})

		expect(
			coordinator.confirmAttempt(attemptId, [
				{
					elementId: element.id,
					persistedPatch: {
						contents: updateContent(element, element.activeContentId ?? undefined, {
							generateImageRequest: { image_id: "confirmed" },
						}).contents,
					},
				},
			]),
		).toBe(true)
		expect(commitGenerationTargets).toHaveBeenCalledOnce()
		expect(
			getActiveContent(elements.get(element.id) as ImageElement)?.generateImageRequest,
		).toEqual({ image_id: "confirmed" })
		expect(canvas.generationRuntimeManager.getTargetState(element.id)).toBeNull()
	})
})
