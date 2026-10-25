import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum } from "../../../document/types"
import { MediaReplaceController } from "../MediaReplaceController"

describe("MediaReplaceController", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("routes a local video replacement with the captured Content", async () => {
		const states: string[] = []
		const sources: string[] = []
		const pauseForReplacement = vi.fn()
		const replaceMediaElement = vi.fn(async (options: { onUploadComplete?: () => void }) => {
			options.onUploadComplete?.()
			return true
		})
		vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined)
		const container = document.createElement("div")
		const canvas = {
			container,
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			t: vi.fn((_key: string, fallback: string) => fallback),
			eventEmitter: {
				on: vi.fn(() => vi.fn()),
				emit: vi.fn(
					(event: {
						type: string
						data: {
							elementId: string
							mediaType?: string
							status?: string
							source?: string
							contentId?: string | null
							phase?: string
						}
					}) => {
						if (
							event.type === "element:media:replaceStateChanged" &&
							event.data.status
						) {
							states.push(event.data.status)
							if (event.data.source) sources.push(event.data.source)
						}
					},
				),
			},
			elementManager: {
				getElementInstance: vi.fn(() => ({ pauseForReplacement })),
				getElementData: vi.fn(() => ({
					id: "video-1",
					type: ElementTypeEnum.Video,
					activeContentId: "video-content-1",
					mainContentId: "video-content-1",
					contents: [{ contentId: "video-content-1", src: "/videos/old.mp4" }],
				})),
			},
			canvasFileUploadManager: {
				replaceMediaElement,
				replaceMediaElementFromProject: vi.fn(),
			},
		} as unknown as Canvas
		const controller = new MediaReplaceController({ canvas })

		controller.openLocalFilePicker({
			elementId: "video-1",
			mediaType: ElementTypeEnum.Video,
			contentId: "video-content-1",
		})

		const input = container.querySelector("input") as HTMLInputElement
		expect(input.accept).toContain("video/*")
		expect(input.dataset.contentId).toBe("video-content-1")
		Object.defineProperty(input, "files", {
			configurable: true,
			value: [new File(["video"], "clip.mp4", { type: "video/mp4" })],
		})
		input.dispatchEvent(new Event("change"))
		await Promise.resolve()
		await Promise.resolve()

		expect(replaceMediaElement).toHaveBeenCalledWith({
			elementId: "video-1",
			mediaType: ElementTypeEnum.Video,
			contentId: "video-content-1",
			file: expect.any(File),
			onUploadComplete: expect.any(Function),
		})
		expect(states).toEqual(["uploading", "applying", "idle"])
		expect(sources).toEqual(["local-upload", "local-upload", "local-upload"])
		expect(pauseForReplacement).toHaveBeenCalledTimes(1)

		controller.destroy()
		expect(container.querySelector("input")).toBeNull()
	})

	it("routes a project image through the same replacement lifecycle", async () => {
		const replaceMediaElementFromProject = vi.fn(() => true)
		const canvas = {
			container: document.createElement("div"),
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			t: vi.fn((_key: string, fallback: string) => fallback),
			eventEmitter: { on: vi.fn(() => vi.fn()), emit: vi.fn() },
			elementManager: {
				getElementData: vi.fn(() => ({
					id: "image-1",
					type: ElementTypeEnum.Image,
					activeContentId: "image-content-2",
					mainContentId: "image-content-2",
					contents: [{ contentId: "image-content-2", src: "/images/old.webp" }],
				})),
			},
			canvasFileUploadManager: {
				replaceMediaElement: vi.fn(),
				replaceMediaElementFromProject,
			},
		} as unknown as Canvas
		const controller = new MediaReplaceController({ canvas })

		await expect(
			controller.replaceWithProjectFile({
				elementId: "image-1",
				mediaType: ElementTypeEnum.Image,
				contentId: "image-content-2",
				path: "/images/project.webp",
			}),
		).resolves.toBe(true)

		expect(replaceMediaElementFromProject).toHaveBeenCalledWith({
			elementId: "image-1",
			mediaType: ElementTypeEnum.Image,
			contentId: "image-content-2",
			path: "/images/project.webp",
		})
	})

	it("drops a local file selected after the captured target was removed", async () => {
		let elementData: Record<string, unknown> | null = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "content-1",
			mainContentId: "content-1",
			contents: [{ contentId: "content-1", src: "/images/old.png" }],
		}
		const replaceMediaElement = vi.fn()
		vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined)
		const container = document.createElement("div")
		const canvas = {
			container,
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			t: vi.fn((_key: string, fallback: string) => fallback),
			eventEmitter: { on: vi.fn(() => vi.fn()), emit: vi.fn() },
			elementManager: { getElementData: vi.fn(() => elementData) },
			canvasFileUploadManager: {
				replaceMediaElement,
				replaceMediaElementFromProject: vi.fn(),
			},
		} as unknown as Canvas
		const controller = new MediaReplaceController({ canvas })

		controller.openLocalFilePicker({
			elementId: "image-1",
			mediaType: ElementTypeEnum.Image,
			contentId: "content-1",
		})
		elementData = null

		const input = container.querySelector("input") as HTMLInputElement
		Object.defineProperty(input, "files", {
			configurable: true,
			value: [new File(["image"], "replacement.png", { type: "image/png" })],
		})
		input.dispatchEvent(new Event("change"))
		await Promise.resolve()

		expect(replaceMediaElement).not.toHaveBeenCalled()
		expect(controller.getReplacementState()).toBeNull()
		controller.destroy()
	})

	it("keeps the legacy audio element replacement state in sync", async () => {
		const states: string[] = []
		const sources: string[] = []
		const pause = vi.fn()
		const canvas = {
			container: document.createElement("div"),
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			t: vi.fn((_key: string, fallback: string) => fallback),
			eventEmitter: {
				on: vi.fn(() => vi.fn()),
				emit: vi.fn(
					(event: { type: string; data: { status?: string; source?: string } }) => {
						if (
							event.type === "element:audio:replaceStateChanged" &&
							event.data.status
						) {
							states.push(event.data.status)
							if (event.data.source) sources.push(event.data.source)
						}
					},
				),
			},
			canvasFileUploadManager: {
				replaceMediaElement: vi.fn(),
				replaceMediaElementFromProject: vi.fn(() => true),
			},
			audioPlaybackManager: { pause },
			elementManager: {
				getElementData: vi.fn(() => ({
					id: "audio-1",
					type: ElementTypeEnum.Audio,
					activeContentId: "audio-content-1",
					mainContentId: "audio-content-1",
					contents: [{ contentId: "audio-content-1", src: "/audios/old.mp3" }],
				})),
			},
		} as unknown as Canvas
		const controller = new MediaReplaceController({ canvas })

		await controller.replaceWithProjectFile({
			elementId: "audio-1",
			mediaType: ElementTypeEnum.Audio,
			contentId: "audio-content-1",
			path: "/audios/project.mp3",
		})

		expect(states).toEqual(["applying", "idle"])
		expect(sources).toEqual(["project-file", "project-file"])
		expect(pause).toHaveBeenCalledWith("audio-1")
	})

	it("keeps state across selection changes and cancels silently when the target is deleted", async () => {
		const handlers = new Map<string, (event: { data: any }) => void>()
		let resolveReplacement!: (success: boolean) => void
		const replacementPromise = new Promise<boolean>((resolve) => {
			resolveReplacement = resolve
		})
		const emit = vi.fn()
		const canvas = {
			container: document.createElement("div"),
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			t: vi.fn((_key: string, fallback: string) => fallback),
			eventEmitter: {
				on: vi.fn((event: string, handler: (event: { data: any }) => void) => {
					handlers.set(event, handler)
					return vi.fn()
				}),
				emit,
			},
			elementManager: {
				getElementData: vi.fn(() => ({
					id: "image-1",
					type: ElementTypeEnum.Image,
					activeContentId: "content-1",
					mainContentId: "content-1",
					contents: [{ contentId: "content-1", src: "/images/old.png" }],
				})),
			},
			canvasFileUploadManager: {
				replaceMediaElement: vi.fn(),
				replaceMediaElementFromProject: vi.fn(() => replacementPromise),
			},
		} as unknown as Canvas
		const controller = new MediaReplaceController({ canvas })

		const resultPromise = controller.replaceWithProjectFile({
			elementId: "image-1",
			mediaType: ElementTypeEnum.Image,
			contentId: "content-1",
			path: "/images/new.png",
		})

		expect(controller.getReplacementState("image-1")).toMatchObject({
			elementId: "image-1",
			contentId: "content-1",
			source: "project-file",
			phase: "applying",
		})
		expect(controller.isReplacing("image-1", "content-1")).toBe(true)
		await expect(
			controller.replaceWithProjectFile({
				elementId: "image-2",
				mediaType: ElementTypeEnum.Image,
				contentId: "content-2",
				path: "/images/other.png",
			}),
		).resolves.toBe(false)

		handlers.get("element:deleted")?.({ data: { elementId: "image-1" } })
		expect(controller.getReplacementState()).toBeNull()
		resolveReplacement(true)
		await expect(resultPromise).resolves.toBe(false)
		expect(emit).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "element:image:replaceStateChanged",
				data: expect.objectContaining({ status: "idle" }),
			}),
		)
	})

	it("clears state immediately when the captured Content is removed", async () => {
		const handlers = new Map<string, (event: { data: any }) => void>()
		let resolveReplacement!: (success: boolean) => void
		const replacementPromise = new Promise<boolean>((resolve) => {
			resolveReplacement = resolve
		})
		let contents = [{ contentId: "content-1", src: "/images/old.png" }]
		const emit = vi.fn()
		const canvas = {
			container: document.createElement("div"),
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			t: vi.fn((_key: string, fallback: string) => fallback),
			eventEmitter: {
				on: vi.fn((event: string, handler: (event: { data: any }) => void) => {
					handlers.set(event, handler)
					return vi.fn()
				}),
				emit,
			},
			elementManager: {
				getElementData: vi.fn(() => ({
					id: "image-1",
					type: ElementTypeEnum.Image,
					activeContentId: contents[0]?.contentId ?? null,
					mainContentId: contents[0]?.contentId ?? null,
					contents,
				})),
			},
			canvasFileUploadManager: {
				replaceMediaElement: vi.fn(),
				replaceMediaElementFromProject: vi.fn(() => replacementPromise),
			},
		} as unknown as Canvas
		const controller = new MediaReplaceController({ canvas })

		const resultPromise = controller.replaceWithProjectFile({
			elementId: "image-1",
			mediaType: ElementTypeEnum.Image,
			contentId: "content-1",
			path: "/images/new.png",
		})
		expect(controller.isReplacing("image-1", "content-1")).toBe(true)

		contents = []
		handlers.get("element:change")?.({ data: { elementIds: ["image-1"] } })

		expect(controller.getReplacementState()).toBeNull()
		expect(emit).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "element:image:replaceStateChanged",
				data: expect.objectContaining({ status: "idle", contentId: "content-1" }),
			}),
		)

		resolveReplacement(true)
		await expect(resultPromise).resolves.toBe(false)
	})
})
