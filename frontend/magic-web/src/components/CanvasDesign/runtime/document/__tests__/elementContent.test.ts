import { describe, expect, it } from "vitest"
import type { ImageElement, ImageElementContent, VideoElement } from "../types"
import {
	appendContent,
	canDeleteActiveContentVersion,
	createContentId,
	deleteActiveContent,
	getActiveContent,
	getContentById,
	getContentGenerationState,
	getContentState,
	getElementContentFields,
	getMainContent,
	getPendingVideoGenerationContent,
	hasPendingVideoGenerationContent,
	isImageContentUsableDownstream,
	isContentGenerationPending,
	setMainContent,
	switchActiveContent,
	updateContent,
} from "../elementContent"

function image(contents: ImageElementContent[]): ImageElement {
	return {
		id: "image-1",
		type: "image",
		activeContentId: contents[0]?.contentId ?? null,
		mainContentId: contents[0]?.contentId ?? null,
		contents,
	}
}

describe("elementContent", () => {
	it("registers asset bindings on all media Contents", () => {
		expect(getElementContentFields("image")).toContain("visualUnderstanding")
		expect(getElementContentFields("image")).toContain("assetId")
		expect(getElementContentFields("video")).toContain("visualUnderstanding")
		expect(getElementContentFields("video")).toContain("assetId")
		expect(getElementContentFields("audio")).toContain("assetId")
		expect(getElementContentFields("text")).not.toContain("visualUnderstanding")
		expect(getElementContentFields("frame")).not.toContain("visualUnderstanding")
	})

	it("queries active, main and explicit Contents", () => {
		const element = {
			...image([
				{ contentId: "c1", src: "one.png" },
				{ contentId: "c2", src: "two.png" },
			]),
			activeContentId: "c2",
			mainContentId: "c1",
		}
		expect(getActiveContent(element)?.contentId).toBe("c2")
		expect(getMainContent(element)?.contentId).toBe("c1")
		expect(getContentById(element, "c1")?.src).toBe("one.png")
	})

	it("uses src as the downstream image availability signal", () => {
		expect(
			isImageContentUsableDownstream({
				contentId: "processing-with-src",
				src: "image.png",
				status: "processing",
			}),
		).toBe(true)
		expect(
			isImageContentUsableDownstream({
				contentId: "failed-with-src",
				src: "image.png",
				status: "failed",
			}),
		).toBe(true)
		expect(isImageContentUsableDownstream({ contentId: "without-src" })).toBe(false)
	})

	it("updates, appends, switches and sets main without mutating input", () => {
		const original = image([{ contentId: "c1", src: "one.png", status: "completed" }])
		const updated = updateContent(original, "c1", {
			assetId: "asset-1",
			crop: { x: 1, y: 2, width: 3, height: 4 },
		})
		const appended = appendContent<ImageElement>(updated, {
			contentId: "c2",
			src: "two.png",
			status: "completed",
		} satisfies ImageElementContent)
		const active = switchActiveContent(appended, "c2")
		const main = setMainContent(active, "c2")

		expect(original.contents[0]).not.toHaveProperty("crop")
		expect(original.contents[0]).not.toHaveProperty("assetId")
		expect(main.contents[0]?.assetId).toBe("asset-1")
		expect(main.activeContentId).toBe("c2")
		expect(main.mainContentId).toBe("c2")
		expect(main.contents).toHaveLength(2)
	})

	it("rejects duplicate IDs and invalid pointer changes", () => {
		const element = image([{ contentId: "c1" }])
		expect(() => appendContent(element, { contentId: "c1" })).toThrow("Duplicate content")
		expect(switchActiveContent(element, "missing")).toBe(element)
		expect(setMainContent(element, "missing")).toBe(element)
	})

	it("deletes deterministically, repairs main and preserves the last Content", () => {
		const element = {
			...image([
				{ contentId: "c1", src: "one.png", status: "completed" },
				{ contentId: "c2", src: "two.png", status: "completed" },
			]),
			activeContentId: "c2",
			mainContentId: "c2",
		}
		const deleted = deleteActiveContent(element)
		expect(deleted?.deletedContent.contentId).toBe("c2")
		expect(deleted?.element.activeContentId).toBe("c1")
		expect(deleted?.element.mainContentId).toBe("c1")
		expect(deleteActiveContent(deleted?.element ?? element)).toBeNull()
	})

	it("creates canonical Content IDs", () => {
		expect(createContentId()).toMatch(/^content-/)
	})

	it("finds a pending video Content even when another version is active", () => {
		const element: VideoElement = {
			id: "video-1",
			type: "video",
			activeContentId: "completed",
			mainContentId: "completed",
			contents: [
				{ contentId: "completed", src: "./videos/completed.mp4", status: "completed" },
				{
					contentId: "pending",
					generateVideoRequest: {
						video_id: "video-task-1",
						model_id: "video-model",
						prompt: "new version",
					},
				},
			],
		}

		expect(getPendingVideoGenerationContent(element)?.contentId).toBe("pending")
		expect(hasPendingVideoGenerationContent(element)).toBe(true)
		expect(isContentGenerationPending(element.contents[1])).toBe(true)
		expect(canDeleteActiveContentVersion(element)).toBe(true)
	})

	it("separates active and sibling generation state", () => {
		const element = image([
			{ contentId: "ready", src: "ready.png", status: "completed" },
			{ contentId: "pending", status: "processing" },
		])

		const activeReadyState = getContentGenerationState(element)
		expect(activeReadyState.activeContent?.contentId).toBe("ready")
		expect(activeReadyState.activeContentIsGenerating).toBe(false)
		expect(activeReadyState.hasSiblingGenerating).toBe(true)
		expect(activeReadyState.hasAnyGenerating).toBe(true)

		const activePendingState = getContentGenerationState({
			...element,
			activeContentId: "pending",
		})
		expect(activePendingState.activeContentIsGenerating).toBe(true)
		expect(activePendingState.hasSiblingGenerating).toBe(false)
	})

	it("treats terminated generation content as terminal and retryable", () => {
		const content: ImageElementContent = {
			contentId: "terminated",
			status: "terminated",
			generateImageRequest: {
				image_id: "image-task-1",
				model_id: "image-model",
				prompt: "create an image",
			},
		}

		expect(getContentState(content)).toBe("failed")
		expect(isContentGenerationPending(content)).toBe(false)
	})
})
