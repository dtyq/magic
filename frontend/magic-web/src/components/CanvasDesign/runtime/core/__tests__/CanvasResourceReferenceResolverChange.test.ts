import { describe, expect, it, vi } from "vitest"
import type { MagicConfig } from "../../../public/magic-types"
import { createTestResourceReferenceResolver } from "../../../public/__tests__/testResourceReferenceResolver"
import { Canvas } from "../Canvas"
import { MagicConfigManager } from "../MagicConfigManager"
import { CanvasVisibilityManager } from "../../resources/visibility/CanvasVisibilityManager"

function config(version: string, currentCanvasWorkspacePath: string): MagicConfig {
	const resolve = createTestResourceReferenceResolver({
		currentCanvasWorkspacePath,
	})
	return {
		methods: {
			resolveResourceReference: resolve,
			resourceReferenceResolverSnapshot: {
				revision: version,
				resolve,
			},
			resourceReferenceResolverVersion: version,
		} as MagicConfig["methods"],
	} as MagicConfig
}

describe("Canvas resource reference resolver changes", () => {
	it("uses the explicit semantic version instead of resolver function identity", () => {
		const manager = new MagicConfigManager({
			canvas: {} as Canvas,
			config: config("v1", "/画布A"),
		})

		expect(manager.update(config("v1", "/画布A"))).toEqual({
			resourceReferenceResolverChanged: false,
		})
		expect(manager.update(config("v2", "/画布B"))).toEqual({
			resourceReferenceResolverChanged: true,
		})
	})

	it("reports canonical workspace paths changed inside a Design attachment revision", () => {
		const firstRevision = JSON.stringify([
			"project-1",
			"design-1",
			"画布",
			"ready",
			"画布/audios/existing.mp3\u0000file-1",
		])
		const secondRevision = JSON.stringify([
			"project-1",
			"design-1",
			"画布",
			"ready",
			["画布/audios/existing.mp3\u0000file-1", "画布/audios/new.mp3\u0000file-2"].join(
				"\u0001",
			),
		])
		const manager = new MagicConfigManager({
			canvas: {} as Canvas,
			config: config(firstRevision, "/画布"),
		})

		expect(manager.update(config(secondRevision, "/画布"))).toEqual({
			resourceReferenceResolverChanged: true,
			resourceReferenceChangedPaths: ["/画布/audios/new.mp3"],
		})
	})

	it("reindexes managers and rebinds every mounted element", () => {
		const firstElementChanged = vi.fn()
		const secondElementChanged = vi.fn()
		const imageResourceChanged = vi.fn()
		const audioResourceChanged = vi.fn()
		const presentationChanged = vi.fn()
		const visibilityChanged = vi.fn()
		const warmupChanged = vi.fn()
		const elements = new Map([
			["first", { onResourceReferenceResolverChanged: firstElementChanged }],
			["second", { onResourceReferenceResolverChanged: secondElementChanged }],
		])
		const canvas = Object.create(Canvas.prototype) as Canvas
		Object.assign(canvas, {
			audioWaveformManager: {
				handleResourceReferenceResolverChanged: vi.fn(),
			},
			imageResourceManager: {
				handleResourceReferenceResolverChanged: imageResourceChanged,
			},
			audioResourceManager: {
				handleResourceReferenceResolverChanged: audioResourceChanged,
			},
			imagePresentationScheduler: {
				handleResourceReferenceResolverChanged: presentationChanged,
			},
			visibilityManager: {
				handleResourceReferenceResolverChanged: visibilityChanged,
			},
			resourceUrlWarmupManager: {
				handleResourceReferenceResolverChanged: warmupChanged,
			},
			elementManager: {
				getAllElementIds: () => Array.from(elements.keys()),
				getElementInstance: (elementId: string) => elements.get(elementId),
			},
		})

		canvas.handleResourceReferenceResolverChanged()

		expect(imageResourceChanged).toHaveBeenCalledTimes(1)
		expect(audioResourceChanged).toHaveBeenCalledTimes(1)
		expect(presentationChanged).toHaveBeenCalledTimes(1)
		expect(visibilityChanged).toHaveBeenCalledTimes(1)
		expect(warmupChanged).toHaveBeenCalledTimes(1)
		expect(firstElementChanged).toHaveBeenCalledTimes(1)
		expect(secondElementChanged).toHaveBeenCalledTimes(1)
	})

	it("skips a resolver revision that only adds an unrelated attachment", () => {
		const elementChanged = vi.fn()
		const imageResourceChanged = vi.fn()
		const audioResourceChanged = vi.fn()
		const presentationChanged = vi.fn()
		const visibilityChanged = vi.fn()
		const warmupChanged = vi.fn()
		const canvas = Object.create(Canvas.prototype) as Canvas
		Object.assign(canvas, {
			id: "canvas-1",
			magicConfigManager: {
				config: {
					methods: {
						resolveResourceReference: createTestResourceReferenceResolver({
							currentCanvasWorkspacePath: "/画布",
						}),
					},
				},
			},
			imageResourceManager: { handleResourceReferenceResolverChanged: imageResourceChanged },
			audioResourceManager: { handleResourceReferenceResolverChanged: audioResourceChanged },
			audioWaveformManager: { handleResourceReferenceResolverChanged: vi.fn() },
			imagePresentationScheduler: {
				handleResourceReferenceResolverChanged: presentationChanged,
			},
			visibilityManager: { handleResourceReferenceResolverChanged: visibilityChanged },
			resourceUrlWarmupManager: { handleResourceReferenceResolverChanged: warmupChanged },
			elementManager: {
				getAllElementIds: () => ["audio-1"],
				getElementData: () => ({ type: "audio", src: "./audios/existing.mp3" }),
				getElementInstance: () => ({ onResourceReferenceResolverChanged: elementChanged }),
			},
		})

		canvas.handleResourceReferenceResolverChanged({
			changedWorkspacePaths: ["/画布/audios/new.mp3"],
		})

		expect(imageResourceChanged).not.toHaveBeenCalled()
		expect(audioResourceChanged).not.toHaveBeenCalled()
		expect(presentationChanged).not.toHaveBeenCalled()
		expect(visibilityChanged).not.toHaveBeenCalled()
		expect(warmupChanged).not.toHaveBeenCalled()
		expect(elementChanged).not.toHaveBeenCalled()
	})

	it("aborts old identity requests and forces a new visibility pass", () => {
		const abort = vi.fn()
		const scheduleRefresh = vi.fn()
		const lastVisibilityState = new Map([["image-1", "visible"]])
		const lastVideoVisibilityState = new Map([["video-1", "visible"]])
		const lastAudioVisibilityState = new Map([["audio-1", "visible"]])
		const lastRequestedLoadState = new Map([["image-1", {}]])
		const lastRequestedVideoLoadState = new Map([["video-1", {}]])
		const lastRequestedAudioLoadState = new Map([["audio-1", {}]])
		const lowFallbackPreviewPathByElementId = new Map([["image-1", "./images/a.png"]])
		const imageRetentionHints = new Map([["image-1", {}]])
		const manager = Object.create(CanvasVisibilityManager.prototype)
		Object.assign(manager, {
			destroyed: false,
			viewportResourceAbortControllers: new Map([["image\0old", { abort }]]),
			lastVisibilityState,
			lastVideoVisibilityState,
			lastAudioVisibilityState,
			lastRequestedLoadState,
			lastRequestedVideoLoadState,
			lastRequestedAudioLoadState,
			lowFallbackPreviewPathByElementId,
			imageRetentionHints,
			scheduleRefresh,
		})

		manager.handleResourceReferenceResolverChanged()

		expect(abort).toHaveBeenCalledTimes(1)
		expect(lastVisibilityState.size).toBe(0)
		expect(lastVideoVisibilityState.size).toBe(0)
		expect(lastAudioVisibilityState.size).toBe(0)
		expect(lastRequestedLoadState.size).toBe(0)
		expect(lastRequestedVideoLoadState.size).toBe(0)
		expect(lastRequestedAudioLoadState.size).toBe(0)
		expect(lowFallbackPreviewPathByElementId.size).toBe(0)
		expect(imageRetentionHints.size).toBe(0)
		expect(scheduleRefresh).toHaveBeenCalledWith("resource-reference-resolver-changed", true)
	})
})
