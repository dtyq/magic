import Konva from "konva"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum } from "../../../document/types"
import { exportCanvasDocument } from "../../../document/exportDocument"
import { TransformBehavior } from "../../../interaction/transform/TransformManager"
import type { AudioPlaybackSnapshot } from "../../../resources/audio/AudioPlaybackManager"
import type { AudioWaveformSnapshot } from "../../../resources/audio/AudioWaveformManager"
import { AudioElement } from "../AudioElement"
import { AUDIO_PLAYER_DESIGN, resolveAudioPlayerLayout } from "../AudioElement.layout"

const DEFAULT_PLAYBACK_SNAPSHOT: AudioPlaybackSnapshot = {
	duration: 0,
	currentTime: 0,
	paused: true,
	ended: false,
	preparing: false,
	loading: false,
	error: false,
}

const READY_PLAYBACK_SNAPSHOT: AudioPlaybackSnapshot = {
	...DEFAULT_PLAYBACK_SNAPSHOT,
	duration: 60,
}

function mockCanvasRenderingContext(): void {
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
		measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
	} as unknown as CanvasRenderingContext2D)
}

function createWaveformClipContext() {
	return {
		save: vi.fn(),
		restore: vi.fn(),
		rect: vi.fn(),
		clip: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		closePath: vi.fn(),
		stroke: vi.fn(),
	}
}

function createStageMock(scale: number): Konva.Stage {
	let draggable = false
	return {
		scaleX: () => scale,
		batchDraw: vi.fn(),
		setPointersPositions: vi.fn(),
		draggable: vi.fn((value?: boolean) => {
			if (typeof value === "boolean") draggable = value
			return draggable
		}),
		on: vi.fn(),
		off: vi.fn(),
	} as unknown as Konva.Stage
}

function createAudioElementHarness(options?: {
	width?: number
	snapshot?: AudioPlaybackSnapshot
	src?: string
	coarsePointer?: boolean
	temporary?: boolean
	empty?: boolean
	name?: string
	waveformSnapshot?: AudioWaveformSnapshot
}) {
	const src = options?.empty
		? undefined
		: options?.temporary
			? options.src
			: (options?.src ?? "./audios/voice.mp3")
	let playbackSnapshot = options?.snapshot ?? READY_PLAYBACK_SNAPSHOT
	let playbackListener: ((snapshot: AudioPlaybackSnapshot) => void) | undefined
	let waveformListener: ((snapshot: AudioWaveformSnapshot) => void) | undefined
	let effectiveContentId: string | undefined
	const viewportScaleListeners = new Set<(event?: unknown) => void>()
	const deviceChangeListeners = new Set<(event?: unknown) => void>()
	const audioReplaceStateListeners = new Set<(event: unknown) => void>()
	const contentPreviewListeners = new Set<(event: unknown) => void>()
	let replacementState: {
		elementId: string
		contentId: string | null
		source: "local-upload" | "project-file"
		phase: "uploading" | "applying"
	} | null = null
	const seek = vi.fn()
	const seekBy = vi.fn(async () => true)
	const toggle = vi.fn(async () => true)
	const release = vi.fn((_elementId: string, options?: { preserveMetadata?: boolean }) => {
		if (options?.preserveMetadata) return
		playbackSnapshot = DEFAULT_PLAYBACK_SNAPSHOT
		playbackListener?.(playbackSnapshot)
	})
	const requestImmediateAudioLoad = vi.fn()
	const setTemporary = vi.fn()
	const restoreToolCursor = vi.fn()
	const emit = vi.fn()
	const canvas = {
		getEffectiveContentId: vi.fn(() => effectiveContentId),
		getElementForContentView: vi.fn((element: AudioElementData) =>
			effectiveContentId ? { ...element, activeContentId: effectiveContentId } : element,
		),
		audioPlaybackManager: {
			getSnapshot: vi.fn(() => playbackSnapshot),
			subscribe: vi.fn(
				(_elementId: string, listener: (snapshot: AudioPlaybackSnapshot) => void) => {
					playbackListener = listener
					return vi.fn()
				},
			),
			seek,
			seekBy,
			toggle,
			pause: vi.fn(),
			release,
		},
		audioWaveformManager: {
			subscribe: vi.fn(
				(_path: string, listener: (snapshot: AudioWaveformSnapshot) => void) => {
					waveformListener = listener
					listener(
						options?.waveformSnapshot ?? {
							status: "ready",
							peaks: new Float32Array(512),
						},
					)
					return vi.fn()
				},
			),
		},
		audioResourceManager: { getFailureReason: vi.fn(() => null) },
		eventEmitter: {
			emit,
			on: vi.fn((eventType: string, listener: (event: unknown) => void) => {
				if (eventType === "canvas:devicechange") deviceChangeListeners.add(listener)
				if (
					eventType === "element:audio:replaceStateChanged" ||
					eventType === "element:media:replaceStateChanged"
				)
					audioReplaceStateListeners.add(listener)
				if (eventType === "content:previewChanged") contentPreviewListeners.add(listener)
				return () => {
					deviceChangeListeners.delete(listener)
					audioReplaceStateListeners.delete(listener)
					contentPreviewListeners.delete(listener)
				}
			}),
			off: vi.fn(),
		},
		deviceInfo: { input: { coarsePointer: options?.coarsePointer ?? false } },
		visibilityManager: {
			registerAudioElement: vi.fn(),
			unregisterAudioElement: vi.fn(),
			updateAudioElement: vi.fn(),
			requestImmediateAudioLoad,
		},
		selectionManager: {
			isSelected: vi.fn(() => false),
			getSelectionCount: vi.fn(() => 0),
			replaceSelection: vi.fn(),
		},
		hoverManager: { getHoveredElementId: vi.fn(() => null) },
		permissionManager: {
			can: vi.fn(() => true),
			canUseSelectionToolAffordance: vi.fn(() => true),
		},
		cursorManager: { setTemporary, restoreToolCursor },
		t: vi.fn((_key: string, fallback: string) => fallback),
		can: vi.fn(() => true),
		elementManager: {
			canDragElement: vi.fn(() => true),
			canListenElement: vi.fn(() => true),
			isTemporary: vi.fn(() => options?.temporary ?? false),
		},
		mediaReplaceController: {
			getReplacementState: vi.fn(() => replacementState),
		},
		runtimeScheduler: {
			requestLayerDraw: vi.fn(),
			registerViewportScaleLayout: vi.fn((_elementId: string, listener: () => void) => {
				viewportScaleListeners.add(listener)
				return () => viewportScaleListeners.delete(listener)
			}),
		},
		transformManager: {
			isTransformInteractionActive: vi.fn(() => false),
			isTransforming: vi.fn(() => false),
		},
	} as unknown as Canvas
	const element = new AudioElement(
		AudioElement.createElementData({
			id: "audio-1",
			x: 0,
			y: 0,
			src,
			name: options?.name,
		}),
		canvas,
	)
	// 构造会归一化到最新默认尺寸；会话内自定义宽度在构造后再写入。
	if (options?.width !== undefined) {
		element.update({ ...element.getData(), width: options.width })
	}

	return {
		element,
		canvas,
		seek,
		seekBy,
		toggle,
		release,
		requestImmediateAudioLoad,
		setTemporary,
		restoreToolCursor,
		emit,
		emitPlayback(snapshot: AudioPlaybackSnapshot) {
			playbackSnapshot = snapshot
			playbackListener?.(snapshot)
		},
		emitWaveform(snapshot: AudioWaveformSnapshot) {
			waveformListener?.(snapshot)
		},
		emitViewportScale() {
			viewportScaleListeners.forEach((listener) => listener())
		},
		emitDeviceChange() {
			deviceChangeListeners.forEach((listener) => listener())
		},
		emitAudioReplaceState(
			status: "idle" | "uploading" | "applying" | "error",
			source: "local-upload" | "project-file" = "local-upload",
		) {
			replacementState =
				status === "uploading" || status === "applying"
					? {
							elementId: "audio-1",
							contentId: "audio-1-content-1",
							source,
							phase: status,
						}
					: null
			audioReplaceStateListeners.forEach((listener) =>
				listener({
					data: {
						elementId: "audio-1",
						contentId: "audio-1-content-1",
						status,
						source,
						phase: status === "uploading" || status === "applying" ? status : undefined,
					},
				}),
			)
		},
		setPreviewContent(contentId?: string) {
			effectiveContentId = contentId
			contentPreviewListeners.forEach((listener) =>
				listener({ data: { elementId: "audio-1", contentId } }),
			)
		},
	}
}

describe("AudioElement", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("creates a persistent DSL element without runtime playback or upload fields", () => {
		const element = AudioElement.createElementData({
			id: "audio-1",
			x: 10,
			y: 20,
			src: "./audios/voice.mp3",
		})

		expect(element).toMatchObject({
			id: "audio-1",
			type: ElementTypeEnum.Audio,
			x: 10,
			y: 20,
			width: 1280,
			height: 720,
			contents: [{ contentId: "audio-1-content-1", src: "./audios/voice.mp3" }],
		})
		expect(element).not.toHaveProperty("status")
		expect(element).not.toHaveProperty("errorMessage")
		expect(element).not.toHaveProperty("duration")
		expect(element).not.toHaveProperty("currentTime")
		expect(element).not.toHaveProperty("paused")
		expect(element).not.toHaveProperty("name")
	})

	it("uses the active audio source filename without its extension as the default name", () => {
		const harness = createAudioElementHarness({ src: "./audios/voice.recording.mp3?version=1" })

		expect(harness.element.getRenderName()).toBe("voice.recording")
		expect(harness.element.getNameLabelText()).toBe("voice.recording")
		expect(
			createAudioElementHarness({
				name: "配音",
				src: "./audios/voice.mp3",
			}).element.getNameLabelText(),
		).toBe("配音")
		expect(createAudioElementHarness({ empty: true }).element.getRenderName()).toBe("音频")
	})

	it("isolates playback and resource state when the effective preview Content changes", () => {
		const harness = createAudioElementHarness({ src: "./audios/document.mp3" })
		harness.element.update({
			...harness.element.getData(),
			activeContentId: "audio-content-1",
			contents: [
				{ contentId: "audio-content-1", src: "./audios/document.mp3" },
				{ contentId: "audio-content-2", src: "./audios/preview.mp3" },
			],
		})

		harness.setPreviewContent("audio-content-2")

		expect(harness.release).toHaveBeenCalledWith("audio-1")
		expect(harness.canvas.visibilityManager.updateAudioElement).toHaveBeenCalledWith(
			"audio-1",
			"./audios/preview.mp3",
		)
		expect(harness.element.getRenderName()).toBe("preview")
		expect(harness.element.exportData().activeContentId).toBe("audio-content-1")

		harness.setPreviewContent()

		expect(harness.canvas.visibilityManager.updateAudioElement).toHaveBeenLastCalledWith(
			"audio-1",
			"./audios/document.mp3",
		)
		expect(harness.element.getRenderName()).toBe("document")
	})

	it("preserves playback metadata when the resource resolver is rebound", () => {
		const harness = createAudioElementHarness({ src: "./audios/voice.mp3" })

		harness.element.onResourceReferenceResolverChanged()

		expect(harness.release).toHaveBeenCalledWith("audio-1", { preserveMetadata: true })
	})

	it("declares horizontal-only resize constraints", () => {
		const element = Object.create(AudioElement.prototype) as AudioElement

		expect(element.getTransformBehavior()).toBe(TransformBehavior.APPLY_TO_SIZE)
		expect(element.supportsSizeEditing()).toBe(true)
		expect(element.getTransformConstraints()).toEqual({
			enabledAnchors: ["middle-left", "middle-right"],
			minWidth: 240,
			fixedHeight: 720,
		})
	})

	it("forces latest default dimensions when opening persisted audio", () => {
		const canvas = {
			getEffectiveContentId: vi.fn(() => undefined),
			can: vi.fn(() => true),
			audioPlaybackManager: {
				getSnapshot: vi.fn(() => ({
					duration: 0,
					currentTime: 0,
					paused: true,
					ended: false,
					preparing: false,
					loading: false,
					error: false,
				})),
				subscribe: vi.fn(() => vi.fn()),
			},
			eventEmitter: { on: vi.fn(() => vi.fn()) },
		} as unknown as Canvas
		const legacyDefault = new AudioElement(
			{
				id: "audio-default",
				type: ElementTypeEnum.Audio,
				x: 0,
				y: 0,
				width: 480,
				height: 120,
				activeContentId: "audio-default-content",
				mainContentId: "audio-default-content",
				contents: [{ contentId: "audio-default-content" }],
			},
			canvas,
		)
		const previousDefault = new AudioElement(
			{
				id: "audio-previous",
				type: ElementTypeEnum.Audio,
				x: 0,
				y: 0,
				width: 1920,
				height: 1080,
				activeContentId: "audio-previous-content",
				mainContentId: "audio-previous-content",
				contents: [{ contentId: "audio-previous-content" }],
			},
			canvas,
		)
		const customPersisted = new AudioElement(
			{
				id: "audio-custom",
				type: ElementTypeEnum.Audio,
				x: 0,
				y: 0,
				width: 640,
				height: 720,
				activeContentId: "audio-custom-content",
				mainContentId: "audio-custom-content",
				contents: [{ contentId: "audio-custom-content" }],
			},
			canvas,
		)

		expect(legacyDefault.getData()).toMatchObject({ width: 1280, height: 720 })
		expect(previousDefault.getData()).toMatchObject({ width: 1280, height: 720 })
		expect(customPersisted.getData()).toMatchObject({ width: 1280, height: 720 })

		customPersisted.update({ ...customPersisted.getData(), width: 640 })
		expect(customPersisted.getData()).toMatchObject({ width: 640, height: 720 })
	})

	it("renders a sharp-cornered card without a fullscreen button", () => {
		mockCanvasRenderingContext()
		const { element } = createAudioElementHarness()

		const group = element.render()
		const hitArea = group.findOne(".hit-area") as Konva.Rect
		const background = group.getChildren(
			(node) => node instanceof Konva.Rect && node.name() !== "hit-area",
		)[0] as Konva.Rect
		const hasFullscreenGlyph = group
			.find("Text")
			.some((node) => (node as Konva.Text).text() === "⛶")

		expect(group.size()).toEqual({ width: 1280, height: 720 })
		expect(hitArea.cornerRadius()).toBe(0)
		expect(background.cornerRadius()).toBe(0)
		expect(hasFullscreenGlyph).toBe(false)
	})

	it("renders a persistent empty placeholder without a corner add-audio action", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({ empty: true })
		const group = harness.element.render()
		const statusText = group.findOne(".audio-status-text") as Konva.Text

		expect(statusText.text()).toBe("暂无音频内容")
		expect(statusText.listening()).toBe(false)
		expect(group.findOne(".audio-status-spinner")).toBeUndefined()
		expect(group.findOne(".audio-waveform-shape")).toBeUndefined()
		expect(group.findOne(".audio-progress-track")).toBeUndefined()
		expect(group.findOne(".audio-operation-group")).toBeUndefined()
		expect(group.findOne(".decorator-corner-action-replace")).toBeUndefined()
		expect(harness.requestImmediateAudioLoad).not.toHaveBeenCalled()
	})

	it("renders a runtime-only uploading placeholder without player controls", () => {
		mockCanvasRenderingContext()
		const { element } = createAudioElementHarness({ temporary: true })
		const group = element.render()

		expect(group.findOne(".audio-status-placeholder")).toBeTruthy()
		expect((group.findOne(".audio-status-text") as Konva.Text).text()).toBe("正在上传中...")
		expect(group.findOne(".audio-waveform-shape")).toBeUndefined()
		expect(group.findOne(".audio-progress-track")).toBeUndefined()
		expect(group.findOne(".audio-operation-group")).toBeUndefined()
		expect(group.findOne(".decorator-corner-action-replace")).toBeUndefined()
	})

	it("renders an uploading placeholder while adding audio to an empty persistent node", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({ empty: true })
		const group = harness.element.render()

		expect((group.findOne(".audio-status-text") as Konva.Text).text()).toBe("暂无音频内容")

		harness.emitAudioReplaceState("uploading")
		const uploadingGroup = harness.element.getNode() as Konva.Group
		expect((uploadingGroup.findOne(".audio-status-text") as Konva.Text).text()).toBe(
			"正在上传中...",
		)
		expect(uploadingGroup.findOne(".audio-status-spinner")).toBeTruthy()
		expect(uploadingGroup.findOne(".audio-operation-group")).toBeUndefined()

		harness.emitAudioReplaceState("idle")
		const emptyGroup = harness.element.getNode() as Konva.Group
		expect((emptyGroup.findOne(".audio-status-text") as Konva.Text).text()).toBe("暂无音频内容")
	})

	it("shows the uploading placeholder while a populated node uploads a replacement", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness()
		const group = harness.element.render()

		expect(group.findOne(".audio-waveform-shape")).toBeTruthy()
		harness.emitAudioReplaceState("uploading")

		const replacingGroup = harness.element.getNode() as Konva.Group
		expect((replacingGroup.findOne(".audio-status-text") as Konva.Text).text()).toBe(
			"正在上传中...",
		)
		expect(replacingGroup.findOne(".audio-status-spinner")).toBeTruthy()
		expect(replacingGroup.findOne(".audio-waveform-shape")).toBeUndefined()
		expect(replacingGroup.findOne(".audio-operation-group")).toBeUndefined()

		harness.emitAudioReplaceState("error")
		const restoredGroup = harness.element.getNode() as Konva.Group
		expect(restoredGroup.findOne(".audio-waveform-shape")).toBeTruthy()
		expect(restoredGroup.findOne(".audio-status-placeholder")).toBeUndefined()
	})

	it("keeps the existing player visible for a project-file replacement", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness()
		const group = harness.element.render()

		expect(group.findOne(".audio-waveform-shape")).toBeTruthy()
		harness.emitAudioReplaceState("uploading", "project-file")

		const replacingGroup = harness.element.getNode() as Konva.Group
		expect(replacingGroup.findOne(".audio-waveform-shape")).toBeTruthy()
		expect(replacingGroup.findOne(".audio-status-placeholder")).toBeUndefined()
	})

	it("animates the upload spinner while the placeholder is mounted", () => {
		mockCanvasRenderingContext()
		const animationStart = vi
			.spyOn(Konva.Animation.prototype, "start")
			.mockImplementation(function () {
				return this
			})
		const animationStop = vi.spyOn(Konva.Animation.prototype, "stop")
		const { element } = createAudioElementHarness({ temporary: true })
		const group = element.render()
		const spinner = group.findOne(".audio-status-spinner") as Konva.Shape
		vi.spyOn(spinner, "getLayer").mockReturnValue({
			batchDraw: vi.fn(),
		} as unknown as Konva.Layer)

		element.onMounted()

		expect(animationStart).toHaveBeenCalledTimes(1)
		const animation = (element as unknown as { statusSpinnerAnimation?: Konva.Animation })
			.statusSpinnerAnimation
		expect(animation).toBeInstanceOf(Konva.Animation)
		const initialRotation = spinner.rotation()
		animation?.func({ time: 200, timeDiff: 16, lastTime: 184, frameRate: 60 })
		expect(spinner.rotation()).not.toBe(initialRotation)

		element.destroy()
		expect(animationStop).toHaveBeenCalled()
	})

	it("keeps formal audio in the preparing placeholder until metadata and waveform are ready", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({
			snapshot: { ...DEFAULT_PLAYBACK_SNAPSHOT, preparing: true },
			waveformSnapshot: { status: "idle", peaks: null },
		})
		const group = harness.element.render()

		expect((group.findOne(".audio-status-text") as Konva.Text).text()).toBe("正在加载音频...")
		expect(group.findOne(".audio-status-spinner")).toBeTruthy()
		expect(group.findOne(".audio-waveform-shape")).toBeUndefined()
		expect(group.findOne(".audio-operation-group")).toBeUndefined()
		expect(group.findOne(".decorator-corner-action-replace")).toBeUndefined()

		harness.emitPlayback({
			...READY_PLAYBACK_SNAPSHOT,
			preparing: false,
		})
		expect(group.findOne(".audio-status-text")).toBeTruthy()

		harness.emitWaveform({ status: "loading", peaks: null })
		expect(group.findOne(".audio-status-text")).toBeTruthy()

		harness.emitWaveform({ status: "ready", peaks: new Float32Array(512) })
		const readyGroup = harness.element.getNode() as Konva.Group
		expect(readyGroup.findOne(".audio-status-text")).toBeUndefined()
		expect(readyGroup.findOne(".audio-waveform-shape")).toBeTruthy()
		expect(readyGroup.findOne(".audio-operation-group")).toBeTruthy()
	})

	it("renders an error placeholder with retry affordance after waveform failure", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({
			waveformSnapshot: { status: "error", peaks: null },
		})
		const group = harness.element.render()

		expect((group.findOne(".audio-status-text") as Konva.Text).text()).toBe(
			"音频加载失败，点击重试",
		)
		expect(group.findOne(".audio-status-spinner")).toBeUndefined()
		expect(group.findOne(".audio-waveform-shape")).toBeUndefined()
		expect(group.findOne(".decorator-corner-action-replace")).toBeUndefined()
		;(group.findOne(".audio-status-text") as Konva.Text).fire("click", {
			cancelBubble: false,
		})
		expect(harness.requestImmediateAudioLoad).toHaveBeenCalledWith("audio-1", {
			reason: "audio-placeholder-retry",
			priority: "critical",
		})
	})

	it("keeps the ready player visible while playback buffers", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness()
		const group = harness.element.render()
		const rerender = vi.spyOn(harness.element, "rerender")

		harness.emitPlayback({
			...READY_PLAYBACK_SNAPSHOT,
			loading: true,
		})

		expect(rerender).not.toHaveBeenCalled()
		expect(group.findOne(".audio-waveform-shape")).toBeTruthy()
		expect(group.findOne(".audio-operation-group")).toBeTruthy()
	})

	it("keeps transformer bounds aligned with the card when control hit areas expand", () => {
		mockCanvasRenderingContext()
		const { element } = createAudioElementHarness()
		const group = element.render()
		vi.spyOn(group, "getStage").mockReturnValue(createStageMock(2))

		element.onMounted()

		const bounds = group.getClientRect({
			skipTransform: true,
			skipShadow: true,
			skipStroke: true,
		})

		expect(bounds).toMatchObject({ x: 0, y: 0, width: 1280, height: 720 })
	})

	it.each([0.5, 1, 2])(
		"scales control visuals together with viewport scale %s",
		(viewportScale) => {
			mockCanvasRenderingContext()
			const { element } = createAudioElementHarness()
			const group = element.render()
			vi.spyOn(group, "getStage").mockReturnValue(createStageMock(viewportScale))

			element.onMounted()

			const controlsGroup = group.findOne(".audio-controls-group") as Konva.Group
			const playButton = group.findOne(".audio-play-button") as Konva.Group
			const timeText = group.findOne(".audio-time") as Konva.Text
			const visualScaleX = viewportScale * group.scaleX() * controlsGroup.scaleX()
			const visualScaleY = viewportScale * group.scaleY() * controlsGroup.scaleY()
			const layout = resolveAudioPlayerLayout(1280, 720)

			expect(controlsGroup.scale()).toEqual({ x: 1, y: 1 })
			expect(visualScaleX).toBeCloseTo(viewportScale)
			expect(visualScaleY).toBeCloseTo(viewportScale)
			expect(playButton.width() * visualScaleX).toBeCloseTo(
				layout.operations.buttonSize * viewportScale,
			)
			expect(timeText.fontSize() * visualScaleY).toBeCloseTo(
				layout.time.fontSize * viewportScale,
			)
		},
	)

	it("does not relayout controls for a temporary node transform", () => {
		mockCanvasRenderingContext()
		const { element } = createAudioElementHarness()
		const group = element.render()
		vi.spyOn(group, "getStage").mockReturnValue(createStageMock(0.5))
		element.onMounted()

		group.scale({ x: 1.5, y: 0.75 })
		group.fire("transform")

		const controlsGroup = group.findOne(".audio-controls-group") as Konva.Group
		expect(controlsGroup.scale()).toEqual({ x: 1, y: 1 })
		expect(controlsGroup.position()).toEqual({ x: 0, y: 0 })
		expect(controlsGroup.size()).toEqual({ width: 1280, height: 720 })
	})

	it("centers the zero point with baseline bars on the left and waveform on the right", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({
			src: "./audios/voice.mp3",
			snapshot: {
				...DEFAULT_PLAYBACK_SNAPSHOT,
				duration: 10,
				currentTime: 0,
			},
		})
		const group = harness.element.render()
		harness.emitWaveform({
			status: "ready",
			peaks: new Float32Array([0.1, 0.35, 0.8, 0.2, 1, 0.5]),
		})
		const waveform = group.findOne(".audio-waveform-shape") as Konva.Shape
		const fillStyles: string[] = []
		const context = {
			...createWaveformClipContext(),
			beginPath: vi.fn(),
			roundRect: vi.fn(),
			moveTo: vi.fn(),
			lineTo: vi.fn(),
			closePath: vi.fn(),
			fillStyle: "",
			strokeStyle: "",
			lineWidth: 0,
			lineCap: "butt",
			fill: vi.fn(() => fillStyles.push(context.fillStyle)),
			stroke: vi.fn(),
		}

		waveform.sceneFunc()?.(context as never, waveform)
		const layout = resolveAudioPlayerLayout(1280, 720)

		expect(context.roundRect).toHaveBeenCalledTimes(72)
		expect(context.roundRect.mock.calls[0]?.[3]).toBeCloseTo(
			context.roundRect.mock.calls[1]?.[3],
		)
		expect(context.roundRect.mock.calls[0]?.[3]).toBeLessThan(10)
		expect(context.roundRect.mock.calls[36]?.[3]).toBeGreaterThan(24)
		expect(fillStyles).toContain("rgba(255, 255, 255, 0.30)")
		expect(fillStyles).toContain("rgba(255, 255, 255, 0.14)")
		expect(fillStyles.at(-1)).toBe("#45C8F5")
		expect(context.closePath).toHaveBeenCalledTimes(1)
		expect(context.strokeStyle).toBe("#45C8F5")
		expect(context.lineWidth).toBe(layout.waveformStyle.playheadWidth)
		expect(context.lineCap).toBe("round")
		expect(context.moveTo).toHaveBeenLastCalledWith(
			waveform.width() / 2,
			layout.waveformStyle.playheadTriangleHeight,
		)
		expect(context.lineTo).toHaveBeenLastCalledWith(waveform.width() / 2, waveform.height())
	})

	it.each([0.5, 1, 2])(
		"keeps the same waveform geometry at viewport scale %s",
		(viewportScale) => {
			mockCanvasRenderingContext()
			const { element } = createAudioElementHarness()
			const group = element.render()
			vi.spyOn(group, "getStage").mockReturnValue(createStageMock(viewportScale))
			element.onMounted()
			const waveform = group.findOne(".audio-waveform-shape") as Konva.Shape
			const context = {
				...createWaveformClipContext(),
				beginPath: vi.fn(),
				roundRect: vi.fn(),
				fillStyle: "",
				fill: vi.fn(),
			}

			waveform.sceneFunc()?.(context as never, waveform)
			const layout = resolveAudioPlayerLayout(1280, 720)

			expect(waveform.width()).toBe(layout.waveform.width)
			expect(context.roundRect).toHaveBeenCalledTimes(72)
			expect(context.roundRect.mock.calls[0]?.[2]).toBeCloseTo(layout.waveformStyle.barWidth)
		},
	)

	it("clips partially visible waveform bars instead of removing the whole edge bar", () => {
		mockCanvasRenderingContext()
		const { element } = createAudioElementHarness({
			snapshot: {
				...DEFAULT_PLAYBACK_SNAPSHOT,
				duration: 200,
				currentTime: 1,
			},
		})
		const group = element.render()
		vi.spyOn(group, "getStage").mockReturnValue(createStageMock(1))
		element.onMounted()
		const waveform = group.findOne(".audio-waveform-shape") as Konva.Shape
		const context = {
			...createWaveformClipContext(),
			beginPath: vi.fn(),
			roundRect: vi.fn(),
			moveTo: vi.fn(),
			lineTo: vi.fn(),
			closePath: vi.fn(),
			fillStyle: "",
			strokeStyle: "",
			lineWidth: 0,
			lineCap: "butt",
			fill: vi.fn(),
			stroke: vi.fn(),
		}

		waveform.sceneFunc()?.(context as never, waveform)

		const firstBarCall = context.roundRect.mock.calls[0]
		const lastBarCall = context.roundRect.mock.calls.at(-1)
		const firstBarX = Number(firstBarCall?.[0])
		const firstBarWidth = Number(firstBarCall?.[2])
		const lastBarX = Number(lastBarCall?.[0])
		const lastBarWidth = Number(lastBarCall?.[2])
		expect(context.rect).toHaveBeenCalledWith(0, 0, waveform.width(), waveform.height())
		expect(context.clip).toHaveBeenCalledTimes(1)
		expect(context.restore).toHaveBeenCalledTimes(1)
		expect(firstBarX).toBeLessThan(0)
		expect(firstBarX + firstBarWidth).toBeGreaterThan(0)
		expect(lastBarX).toBeLessThan(waveform.width())
		expect(lastBarX + lastBarWidth).toBeGreaterThan(waveform.width())
	})

	it("fills the fixed waveform layout at a small viewport scale", () => {
		mockCanvasRenderingContext()
		const { element } = createAudioElementHarness()
		const group = element.render()
		vi.spyOn(group, "getStage").mockReturnValue(createStageMock(0.25))
		element.onMounted()
		const waveform = group.findOne(".audio-waveform-shape") as Konva.Shape
		const context = {
			...createWaveformClipContext(),
			beginPath: vi.fn(),
			roundRect: vi.fn(),
			fillStyle: "",
			fill: vi.fn(),
		}

		waveform.sceneFunc()?.(context as never, waveform)

		const firstBarX = Number(context.roundRect.mock.calls[0]?.[0])
		const lastBarCall = context.roundRect.mock.calls.at(-1)
		const lastBarRight = Number(lastBarCall?.[0]) + Number(lastBarCall?.[2])
		expect(context.roundRect.mock.calls.length).toBeGreaterThan(24)
		expect(firstBarX).toBeLessThanOrEqual(16)
		expect(waveform.width() - lastBarRight).toBeLessThanOrEqual(16)
	})

	it("keeps waveform samples and visible range fixed across viewport zoom", () => {
		mockCanvasRenderingContext()
		const peaks = Float32Array.from({ length: 512 }, (_, index) => index / 511)
		const renderBarsAtScale = (viewportScale: number) => {
			const harness = createAudioElementHarness({
				src: "./audios/voice.mp3",
				snapshot: {
					...DEFAULT_PLAYBACK_SNAPSHOT,
					duration: 10,
					currentTime: 0,
				},
			})
			const group = harness.element.render()
			vi.spyOn(group, "getStage").mockReturnValue(createStageMock(viewportScale))
			harness.element.onMounted()
			harness.emitWaveform({ status: "ready", peaks })
			const waveform = group.findOne(".audio-waveform-shape") as Konva.Shape
			const context = {
				...createWaveformClipContext(),
				beginPath: vi.fn(),
				roundRect: vi.fn(),
				moveTo: vi.fn(),
				lineTo: vi.fn(),
				closePath: vi.fn(),
				fillStyle: "",
				strokeStyle: "",
				lineWidth: 0,
				lineCap: "butt",
				fill: vi.fn(),
				stroke: vi.fn(),
			}

			waveform.sceneFunc()?.(context as never, waveform)

			return context.roundRect.mock.calls.map(([x, _y, _width, height]) => ({
				relativeX: Number(x) - waveform.width() / 2,
				height: Number(height),
			}))
		}

		const compactBars = renderBarsAtScale(0.5)
		const expandedBars = renderBarsAtScale(1)
		expect(compactBars).toHaveLength(72)
		expect(expandedBars).toHaveLength(72)
		compactBars.forEach((bar, index) => {
			expect(expandedBars[index]?.relativeX).toBeCloseTo(bar.relativeX)
			expect(expandedBars[index]?.height).toBeCloseTo(bar.height)
		})
	})

	it("translates a fixed waveform sample during seeking without changing its height", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({
			src: "./audios/voice.mp3",
			snapshot: {
				...DEFAULT_PLAYBACK_SNAPSHOT,
				duration: 10,
				currentTime: 0,
			},
		})
		const group = harness.element.render()
		vi.spyOn(group, "getStage").mockReturnValue(createStageMock(1))
		harness.element.onMounted()
		harness.emitWaveform({
			status: "ready",
			peaks: Float32Array.from({ length: 512 }, (_, index) => index / 511),
		})
		const waveform = group.findOne(".audio-waveform-shape") as Konva.Shape
		const drawBars = () => {
			const context = {
				...createWaveformClipContext(),
				beginPath: vi.fn(),
				roundRect: vi.fn(),
				moveTo: vi.fn(),
				lineTo: vi.fn(),
				closePath: vi.fn(),
				fillStyle: "",
				strokeStyle: "",
				lineWidth: 0,
				lineCap: "butt",
				fill: vi.fn(),
				stroke: vi.fn(),
			}

			waveform.sceneFunc()?.(context as never, waveform)

			return context.roundRect.mock.calls.map(([x, _y, _width, height]) => ({
				relativeX: Number(x) - waveform.width() / 2,
				height: Number(height),
			}))
		}
		const initialBars = drawBars()
		const initialSample = initialBars.find((bar) => Math.abs(bar.relativeX - 4) < 0.001)

		harness.emitPlayback({
			...DEFAULT_PLAYBACK_SNAPSHOT,
			duration: 10,
			currentTime: 5,
		})
		const seekedBars = drawBars()
		const translatedSample = seekedBars.find((bar) => Math.abs(bar.relativeX + 508) < 0.001)

		expect(initialSample).toBeDefined()
		expect(translatedSample).toBeDefined()
		expect(translatedSample?.height).toBeCloseTo(initialSample?.height ?? 0)
	})

	it("moves long-audio waveform bars by about eight pixels per playback second", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({
			src: "./audios/voice.mp3",
			snapshot: {
				...DEFAULT_PLAYBACK_SNAPSHOT,
				duration: 200,
				currentTime: 0,
			},
		})
		const group = harness.element.render()
		vi.spyOn(group, "getStage").mockReturnValue(createStageMock(1))
		harness.element.onMounted()
		harness.emitWaveform({
			status: "ready",
			peaks: Float32Array.from({ length: 512 }, (_, index) => index / 511),
		})
		const waveform = group.findOne(".audio-waveform-shape") as Konva.Shape
		const drawBars = () => {
			const context = {
				...createWaveformClipContext(),
				beginPath: vi.fn(),
				roundRect: vi.fn(),
				moveTo: vi.fn(),
				lineTo: vi.fn(),
				closePath: vi.fn(),
				fillStyle: "",
				strokeStyle: "",
				lineWidth: 0,
				lineCap: "butt",
				fill: vi.fn(),
				stroke: vi.fn(),
			}

			waveform.sceneFunc()?.(context as never, waveform)

			return context.roundRect.mock.calls.map(([x, _y, _width, height]) => ({
				relativeX: Number(x) - waveform.width() / 2,
				height: Number(height),
			}))
		}
		const initialSample = drawBars().find((bar) => Math.abs(bar.relativeX - 4) < 0.001)

		harness.emitPlayback({
			...DEFAULT_PLAYBACK_SNAPSHOT,
			duration: 200,
			currentTime: 1,
		})
		const movedSample = drawBars().find((bar) => Math.abs(bar.relativeX + 4) < 0.001)

		expect(initialSample).toBeDefined()
		expect(movedSample).toBeDefined()
		expect(initialSample?.relativeX - (movedSample?.relativeX ?? 0)).toBeCloseTo(8)
		expect(movedSample?.height).toBeCloseTo(initialSample?.height ?? 0)
	})

	it("updates the waveform bar count when the displayed element width changes", () => {
		mockCanvasRenderingContext()
		const { element } = createAudioElementHarness()
		const group = element.render()
		element.onTransformResize(640, 720)
		const waveform = group.findOne(".audio-waveform-shape") as Konva.Shape
		const context = {
			...createWaveformClipContext(),
			beginPath: vi.fn(),
			roundRect: vi.fn(),
			fillStyle: "",
			fill: vi.fn(),
		}

		waveform.sceneFunc()?.(context as never, waveform)

		expect(context.roundRect).toHaveBeenCalledTimes(44)
	})

	it("updates the card and control layout during live horizontal resize", () => {
		mockCanvasRenderingContext()
		const { element } = createAudioElementHarness()
		const group = element.render()
		vi.spyOn(group, "getStage").mockReturnValue(createStageMock(1))
		element.onMounted()

		element.onTransformResize(640, 480)

		const hitArea = group.findOne(".hit-area") as Konva.Rect
		const background = group.findOne(".audio-background") as Konva.Rect
		const controlsGroup = group.findOne(".audio-controls-group") as Konva.Group
		const waveform = group.findOne(".audio-waveform-shape") as Konva.Shape
		const progressTrack = group.findOne(".audio-progress-track") as Konva.Rect
		const timeText = group.findOne(".audio-time") as Konva.Text
		const operationGroup = group.findOne(".audio-operation-group") as Konva.Group
		const layout = resolveAudioPlayerLayout(640, 720)

		expect(group.size()).toEqual({ width: 640, height: 720 })
		expect(hitArea.size()).toEqual({ width: 640, height: 720 })
		expect(background.size()).toEqual({ width: 640, height: 720 })
		expect(controlsGroup.position()).toEqual({ x: 0, y: 0 })
		expect(controlsGroup.size()).toEqual({ width: 640, height: 720 })
		expect(waveform.position()).toEqual({ x: layout.waveform.x, y: layout.waveform.y })
		expect(waveform.size()).toEqual({
			width: layout.waveform.width,
			height: layout.waveform.height,
		})
		expect(progressTrack.position()).toEqual({ x: layout.progress.x, y: layout.progress.y })
		expect(progressTrack.size()).toEqual({
			width: layout.progress.width,
			height: layout.progress.height,
		})
		expect(timeText.y()).toBe(layout.time.y)
		expect(operationGroup.position()).toEqual({
			x: layout.operations.x,
			y: layout.operations.y,
		})
		expect(720 - (operationGroup.y() + operationGroup.height())).toBeCloseTo(
			AUDIO_PLAYER_DESIGN.bottomPadding * layout.rootScale +
				AUDIO_PLAYER_DESIGN.controlStackLift * layout.operations.scale,
		)
	})

	it("keeps fixed logical controls inside the minimum-width element", () => {
		mockCanvasRenderingContext()
		const { element } = createAudioElementHarness({ width: 240 })
		const group = element.render()
		const viewportScale = 0.25
		vi.spyOn(group, "getStage").mockReturnValue(createStageMock(viewportScale))
		element.onMounted()

		const controlsGroup = group.findOne(".audio-controls-group") as Konva.Group
		const playButton = group.findOne(".audio-play-button") as Konva.Group
		const visualScale = viewportScale * controlsGroup.scaleX()
		const layout = resolveAudioPlayerLayout(240, 720)
		const controlsRight =
			(controlsGroup.x() + controlsGroup.width() * controlsGroup.scaleX()) * viewportScale

		expect(controlsGroup.scale()).toEqual({ x: 1, y: 1 })
		expect(visualScale).toBeCloseTo(viewportScale)
		expect(playButton.width() * visualScale).toBeCloseTo(
			layout.operations.buttonSize * viewportScale,
		)
		expect(controlsRight).toBeLessThanOrEqual(240 * viewportScale)
	})

	it("uses a reduced progress hit height in compact touch interaction", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({ width: 240, coarsePointer: true })
		const group = harness.element.render()
		const controlsGroup = group.findOne(".audio-controls-group") as Konva.Group
		const playButton = group.findOne(".audio-play-button") as Konva.Group
		const playHit = group.findOne(".audio-play-button-hit") as Konva.Rect
		const progressTrack = group.findOne(".audio-progress-track") as Konva.Rect
		const progressHit = group.findOne(".audio-progress-hit") as Konva.Rect
		const progressThumbHit = group.findOne(".audio-progress-thumb-hit") as Konva.Circle
		const layout = resolveAudioPlayerLayout(240, 720)
		vi.spyOn(playHit, "getAbsoluteScale").mockReturnValue({ x: 0.5, y: 0.5 })
		vi.spyOn(progressHit, "getAbsoluteScale").mockReturnValue({ x: 0.5, y: 0.5 })
		vi.spyOn(progressThumbHit, "getAbsoluteScale").mockReturnValue({ x: 0.5, y: 0.5 })

		harness.emitViewportScale()

		expect(controlsGroup.scale()).toEqual({ x: 1, y: 1 })
		expect(playButton.size()).toEqual({
			width: layout.operations.buttonSize,
			height: layout.operations.buttonSize,
		})
		const expandedPlayHitWidth = layout.operations.buttonSize + layout.operations.gap
		expect(playHit.size()).toEqual({ width: expandedPlayHitWidth, height: 88 })
		expect(playHit.position()).toEqual({
			x: -(expandedPlayHitWidth - layout.operations.buttonSize) / 2,
			y: -(88 - layout.operations.buttonSize) / 2,
		})
		expect(progressTrack.size()).toEqual({
			width: layout.progress.width,
			height: layout.progress.height,
		})
		expect(progressHit.size()).toEqual({
			width: layout.progressHit.width + layout.progressThumbRadius * 2,
			height: 48,
		})
		expect(progressHit.position()).toEqual({
			x: layout.progressHit.x - layout.progressThumbRadius,
			y: layout.progressHit.y - (48 - layout.progressHit.height) / 2,
		})
		expect(progressThumbHit.radius()).toBe(44)
		expect(progressHit.listening()).toBe(true)

		harness.emitDeviceChange()
		expect(playHit.size()).toEqual({ width: expandedPlayHitWidth, height: 88 })
	})

	it("disables controls when the card is too small on screen", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness()
		const group = harness.element.render()
		const scale = vi.spyOn(group, "getAbsoluteScale").mockReturnValue({ x: 0.1, y: 0.1 })

		harness.element.onMounted()
		harness.emitViewportScale()

		const controlHits = group.find(".audio-control-hit")
		expect(controlHits.length).toBeGreaterThan(0)
		expect(controlHits.every((node) => node.listening())).toBe(false)

		scale.mockReturnValue({ x: 0.5, y: 0.5 })
		harness.emitViewportScale()
		expect(controlHits.every((node) => node.listening())).toBe(true)
	})

	it("lets compact progress tracks click to seek while reserving continuous scrub for the thumb", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness()
		const group = harness.element.render()
		vi.spyOn(group, "getAbsoluteScale").mockReturnValue({ x: 0.15, y: 0.15 })
		const controlsGroup = group.findOne(".audio-controls-group") as Konva.Group
		const progressTrack = group.findOne(".audio-progress-track") as Konva.Rect
		const progressHit = group.findOne(".audio-progress-hit") as Konva.Rect
		const progressThumbHit = group.findOne(".audio-progress-thumb-hit") as Konva.Circle
		const stageMock = createStageMock(0.15)
		vi.spyOn(controlsGroup, "getStage").mockReturnValue(stageMock)
		vi.spyOn(controlsGroup, "getRelativePointerPosition").mockReturnValue({
			x: progressTrack.x() + progressTrack.width() / 2,
			y: progressTrack.y(),
		})
		harness.element.onMounted()

		const trackStopPropagation = vi.fn()
		progressHit.fire("mousedown", {
			evt: { stopPropagation: trackStopPropagation, preventDefault: vi.fn() },
		})
		expect(trackStopPropagation).not.toHaveBeenCalled()
		expect(harness.seek).not.toHaveBeenCalled()

		progressHit.fire("click", {
			evt: { stopPropagation: vi.fn(), preventDefault: vi.fn() },
		})
		expect(harness.seek).toHaveBeenCalledWith("audio-1", 0.5)
		harness.seek.mockClear()

		const thumbStopPropagation = vi.fn()
		progressThumbHit.fire("mousedown", {
			evt: { stopPropagation: thumbStopPropagation, preventDefault: vi.fn() },
		})
		expect(thumbStopPropagation).toHaveBeenCalled()
		expect(harness.setTemporary).toHaveBeenCalledWith("grabbing")
		expect(harness.seek).not.toHaveBeenCalled()

		const moveHandler = stageMock.on.mock.calls.find(([events]) =>
			String(events).includes("mousemove.audioScrub"),
		)?.[1] as (() => void) | undefined
		moveHandler?.()
		expect(harness.seek).not.toHaveBeenCalled()
	})

	it("seeks using control-local pointer coordinates with fixed control layout", () => {
		mockCanvasRenderingContext()
		const { element, seek, setTemporary } = createAudioElementHarness()
		const group = element.render()
		vi.spyOn(group, "getStage").mockReturnValue(createStageMock(0.5))
		element.onMounted()

		const controlsGroup = group.findOne(".audio-controls-group") as Konva.Group
		const stageMock = createStageMock(0.5)
		vi.spyOn(controlsGroup, "getStage").mockReturnValue(stageMock)
		const progressTrack = group.findOne(".audio-progress-track") as Konva.Rect
		const progressHit = group.findOne(".audio-progress-hit") as Konva.Rect
		const progressThumb = group.findOne(".audio-progress-thumb") as Konva.Circle
		vi.spyOn(controlsGroup, "getRelativePointerPosition").mockReturnValue({
			x: progressTrack.x() + progressTrack.width() / 2,
			y: progressTrack.y(),
		})

		expect(progressThumb.x()).toBe(progressTrack.x())
		progressHit.fire("mouseenter")
		expect(progressThumb.fill()).toBe("#FFFFFF")
		expect(progressThumb.scale()).toEqual({ x: 1.15, y: 1.15 })
		progressHit.fire("mousedown", {
			evt: { stopPropagation: vi.fn(), preventDefault: vi.fn() },
		})
		expect(progressThumb.fill()).toBe("#FFFFFF")
		expect(progressThumb.scale()).toEqual({ x: 1.25, y: 1.25 })
		expect(progressThumb.x()).toBeCloseTo(progressTrack.x() + progressTrack.width() / 2)
		expect(setTemporary).toHaveBeenCalledWith("grabbing")
		const stage = stageMock as unknown as { on: ReturnType<typeof vi.fn> }
		const finishHandler = stage.on.mock.calls.find(([events]) =>
			String(events).includes("mouseup.audioScrub"),
		)?.[1] as (() => void) | undefined
		finishHandler?.()
		expect(progressThumb.scale()).toEqual({ x: 1, y: 1 })

		expect(seek).toHaveBeenCalledTimes(1)
		expect(seek.mock.calls[0]?.[0]).toBe("audio-1")
		expect(seek.mock.calls[0]?.[1]).toBeCloseTo(0.5)
	})

	it("previews waveform movement while scrubbing and seeks only after release", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({
			src: "./audios/voice.mp3",
			snapshot: {
				...DEFAULT_PLAYBACK_SNAPSHOT,
				duration: 10,
				currentTime: 0,
				paused: false,
			},
		})
		const group = harness.element.render()
		vi.spyOn(group, "getStage").mockReturnValue(createStageMock(1))
		harness.element.onMounted()
		harness.emitWaveform({
			status: "ready",
			peaks: Float32Array.from({ length: 512 }, (_, index) => index / 511),
		})

		const controlsGroup = group.findOne(".audio-controls-group") as Konva.Group
		const waveform = group.findOne(".audio-waveform-shape") as Konva.Shape
		const progressTrack = group.findOne(".audio-progress-track") as Konva.Rect
		const progressHit = group.findOne(".audio-progress-hit") as Konva.Rect
		const stageMock = createStageMock(1)
		vi.spyOn(controlsGroup, "getStage").mockReturnValue(stageMock)
		vi.spyOn(controlsGroup, "getRelativePointerPosition").mockReturnValue({
			x: progressTrack.x() + progressTrack.width() / 2,
			y: progressTrack.y(),
		})

		const drawCenterBarHeight = () => {
			const context = {
				...createWaveformClipContext(),
				beginPath: vi.fn(),
				roundRect: vi.fn(),
				moveTo: vi.fn(),
				lineTo: vi.fn(),
				closePath: vi.fn(),
				fillStyle: "",
				strokeStyle: "",
				lineWidth: 0,
				lineCap: "butt",
				fill: vi.fn(),
				stroke: vi.fn(),
			}
			waveform.sceneFunc()?.(context as never, waveform)
			const centerX = waveform.width() / 2
			const centerBar = context.roundRect.mock.calls.reduce<
				(typeof context.roundRect.mock.calls)[number] | undefined
			>((closest, candidate) => {
				if (!closest) return candidate
				const candidateCenter = Number(candidate[0]) + Number(candidate[2]) / 2
				const closestCenter = Number(closest[0]) + Number(closest[2]) / 2
				return Math.abs(candidateCenter - centerX) < Math.abs(closestCenter - centerX)
					? candidate
					: closest
			}, undefined)
			return Number(centerBar?.[3] ?? 0)
		}

		const initialCenterBarHeight = drawCenterBarHeight()
		progressHit.fire("mousedown", {
			evt: { stopPropagation: vi.fn(), preventDefault: vi.fn() },
		})

		expect(harness.seek).not.toHaveBeenCalled()
		expect(drawCenterBarHeight()).toBeGreaterThan(initialCenterBarHeight)

		const finishHandler = stageMock.on.mock.calls.find(([events]) =>
			String(events).includes("mouseup.audioScrub"),
		)?.[1] as (() => void) | undefined
		finishHandler?.()

		expect(harness.seek).toHaveBeenCalledTimes(1)
		expect(harness.seek).toHaveBeenCalledWith("audio-1", 0.5)
	})

	it("cancels touch scrubbing without committing the preview position", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({
			snapshot: {
				...DEFAULT_PLAYBACK_SNAPSHOT,
				duration: 60,
				currentTime: 12,
			},
		})
		const group = harness.element.render()
		const controlsGroup = group.findOne(".audio-controls-group") as Konva.Group
		const progressTrack = group.findOne(".audio-progress-track") as Konva.Rect
		const progressThumbHit = group.findOne(".audio-progress-thumb-hit") as Konva.Circle
		const stageMock = createStageMock(1)
		vi.spyOn(controlsGroup, "getStage").mockReturnValue(stageMock)
		vi.spyOn(controlsGroup, "getRelativePointerPosition").mockReturnValue({
			x: progressTrack.x() + progressTrack.width() * 0.8,
			y: progressTrack.y(),
		})
		harness.element.onMounted()

		progressThumbHit.fire("touchstart", {
			evt: { stopPropagation: vi.fn(), preventDefault: vi.fn() },
		})
		expect(harness.seek).not.toHaveBeenCalled()
		const timeText = group.findOne(".audio-time") as Konva.Text
		expect(timeText.text()).toBe("0:48 / 1:00")

		const cancelHandler = stageMock.on.mock.calls.find(([events]) =>
			String(events).includes("touchcancel.audioScrub"),
		)?.[1] as (() => void) | undefined
		cancelHandler?.()

		expect(harness.seek).not.toHaveBeenCalled()
		expect(timeText.text()).toBe("0:12 / 1:00")
	})

	it("finishes scrubbing when the pointer is released outside the stage", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness({
			snapshot: {
				...DEFAULT_PLAYBACK_SNAPSHOT,
				duration: 60,
				currentTime: 0,
			},
		})
		const group = harness.element.render()
		const controlsGroup = group.findOne(".audio-controls-group") as Konva.Group
		const progressTrack = group.findOne(".audio-progress-track") as Konva.Rect
		const progressThumbHit = group.findOne(".audio-progress-thumb-hit") as Konva.Circle
		const stageMock = createStageMock(1)
		vi.spyOn(controlsGroup, "getStage").mockReturnValue(stageMock)
		vi.spyOn(controlsGroup, "getRelativePointerPosition").mockReturnValue({
			x: progressTrack.x() + progressTrack.width() * 0.6,
			y: progressTrack.y(),
		})
		harness.element.onMounted()

		progressThumbHit.fire("mousedown", {
			evt: { stopPropagation: vi.fn(), preventDefault: vi.fn() },
		})
		window.dispatchEvent(new Event("pointerup"))

		expect(stageMock.setPointersPositions).not.toHaveBeenCalled()
		expect(harness.seek).toHaveBeenCalledTimes(1)
		expect(harness.seek).toHaveBeenCalledWith("audio-1", 0.6)
	})

	it("switches from the player to the error placeholder after playback failure", () => {
		mockCanvasRenderingContext()
		const { element, emitPlayback } = createAudioElementHarness()
		const group = element.render()

		emitPlayback({
			duration: 120,
			currentTime: 60,
			paused: false,
			ended: false,
			preparing: false,
			loading: false,
			error: false,
		})

		const playTriangle = group.findOne(".audio-play-triangle") as Konva.Line
		const pauseBars = group.findOne(".audio-pause-bars") as Konva.Group
		const progressTrack = group.findOne(".audio-progress-track") as Konva.Rect
		const progressFill = group.findOne(".audio-progress-fill") as Konva.Rect
		const progressThumb = group.findOne(".audio-progress-thumb") as Konva.Circle
		const timeText = group.findOne(".audio-time") as Konva.Text
		expect(playTriangle.visible()).toBe(false)
		expect(pauseBars.visible()).toBe(true)
		expect(progressFill.width()).toBeCloseTo(progressTrack.width() / 2)
		expect(progressThumb.x()).toBeCloseTo(progressTrack.x() + progressTrack.width() / 2)
		expect(progressThumb.y()).toBeCloseTo(progressTrack.y() + progressTrack.height() / 2)
		expect(timeText.text()).toBe("1:00 / 2:00")

		emitPlayback({
			duration: 120,
			currentTime: 60,
			paused: true,
			ended: false,
			preparing: false,
			loading: false,
			error: true,
		})
		const errorGroup = element.getNode() as Konva.Group
		expect(errorGroup.findOne(".audio-error")).toBeUndefined()
		expect((errorGroup.findOne(".audio-status-text") as Konva.Text).text()).toBe(
			"音频加载失败，点击重试",
		)
	})

	it("uses double-triangle seek icons with enabled, hover, active and disabled states", () => {
		mockCanvasRenderingContext()
		const { element, emitPlayback, restoreToolCursor, seekBy, setTemporary } =
			createAudioElementHarness({
				src: "./audios/a.mp3",
				snapshot: {
					duration: 60,
					currentTime: 0,
					paused: true,
					ended: false,
					preparing: false,
					loading: false,
					error: false,
				},
			})
		const group = element.render()
		const backHit = group.findOne(".audio-back-button-hit") as Konva.Rect
		const forwardHit = group.findOne(".audio-forward-button-hit") as Konva.Rect
		const backBackground = group.findOne(".audio-back-button-background") as Konva.Circle
		const forwardBackground = group.findOne(".audio-forward-button-background") as Konva.Circle
		const backIcon = group.findOne(".audio-back-button-icon") as Konva.Group
		const forwardIcon = group.findOne(".audio-forward-button-icon") as Konva.Group

		expect(backIcon.find("Line")).toHaveLength(2)
		expect(forwardIcon.find("Line")).toHaveLength(2)
		expect(backIcon.find("Text")).toHaveLength(0)
		expect(forwardIcon.find("Text")).toHaveLength(0)
		expect(backBackground.fill()).toBe("rgba(255, 255, 255, 0)")
		expect(backIcon.opacity()).toBe(0.24)
		expect(forwardBackground.fill()).toBe("rgba(255, 255, 255, 0)")
		expect(forwardIcon.opacity()).toBe(0.64)

		setTemporary.mockClear()
		backHit.fire("mouseenter")
		backHit.fire("click", { evt: { stopPropagation: vi.fn() } })
		expect(setTemporary).toHaveBeenCalledWith("not-allowed")
		expect(seekBy).not.toHaveBeenCalled()
		backHit.fire("mouseleave")

		forwardHit.fire("mouseenter")
		expect(setTemporary).toHaveBeenCalledWith("pointer")
		expect(forwardBackground.fill()).toBe("rgba(255, 255, 255, 0.10)")
		expect(forwardIcon.opacity()).toBe(0.88)
		forwardHit.fire("mousedown", { evt: { stopPropagation: vi.fn() } })
		expect(forwardBackground.fill()).toBe("rgba(255, 255, 255, 0.18)")
		expect(forwardIcon.opacity()).toBe(1)
		forwardHit.fire("mouseup", { evt: { stopPropagation: vi.fn() } })
		expect(forwardBackground.fill()).toBe("rgba(255, 255, 255, 0.10)")
		forwardHit.fire("click", { evt: { stopPropagation: vi.fn() } })
		expect(seekBy).toHaveBeenCalledWith("audio-1", "./audios/a.mp3", 5)
		forwardHit.fire("mouseleave")

		emitPlayback({
			duration: 60,
			currentTime: 30,
			paused: true,
			ended: false,
			preparing: false,
			loading: true,
			error: false,
		})
		expect(backBackground.fill()).toBe("rgba(255, 255, 255, 0)")
		expect(forwardBackground.fill()).toBe("rgba(255, 255, 255, 0)")

		emitPlayback({
			duration: 60,
			currentTime: 60,
			paused: true,
			ended: true,
			preparing: false,
			loading: false,
			error: false,
		})
		expect(backBackground.fill()).toBe("rgba(255, 255, 255, 0)")
		expect(backIcon.opacity()).toBe(0.64)
		expect(forwardBackground.fill()).toBe("rgba(255, 255, 255, 0)")
		expect(forwardIcon.opacity()).toBe(0.24)

		seekBy.mockClear()
		setTemporary.mockClear()
		forwardHit.fire("mouseenter")
		forwardHit.fire("tap", { evt: { stopPropagation: vi.fn() } })
		expect(seekBy).not.toHaveBeenCalled()
		expect(setTemporary).toHaveBeenCalledWith("not-allowed")
		expect(restoreToolCursor).toHaveBeenCalled()
	})

	it("provides pointer, hover, active and touch feedback without double activation", () => {
		mockCanvasRenderingContext()
		const { element, restoreToolCursor, setTemporary, toggle } = createAudioElementHarness({
			src: "./audios/a.mp3",
		})
		const group = element.render()
		const playButton = group.findOne(".audio-play-button") as Konva.Group
		const playHit = group.findOne(".audio-play-button-hit") as Konva.Rect
		const backHit = group.findOne(".audio-back-button-hit") as Konva.Rect
		const forwardHit = group.findOne(".audio-forward-button-hit") as Konva.Rect
		const visual = playButton
			.getChildren()
			.find((node) => node instanceof Konva.Group) as Konva.Group
		const layout = resolveAudioPlayerLayout(1280, 720)

		expect(playHit.size()).toEqual({
			width: layout.operations.buttonSize,
			height: layout.operations.buttonSize,
		})
		expect(playHit.listening()).toBe(true)
		expect(backHit.size()).toEqual({
			width: layout.operations.buttonSize,
			height: layout.operations.buttonSize,
		})
		expect(forwardHit.size()).toEqual({
			width: layout.operations.buttonSize,
			height: layout.operations.buttonSize,
		})
		playHit.fire("mouseenter")
		expect(setTemporary).toHaveBeenCalledWith("pointer")
		playHit.fire("mousedown", { evt: { stopPropagation: vi.fn() } })
		expect(visual.scaleX()).toBeCloseTo(0.94)
		playHit.fire("mouseup", { evt: { stopPropagation: vi.fn() } })
		expect(visual.scaleX()).toBe(1)

		playHit.fire("touchstart", {
			evt: { stopPropagation: vi.fn(), preventDefault: vi.fn() },
		})
		expect(visual.scaleX()).toBeCloseTo(0.94)
		playHit.fire("touchcancel", { evt: { stopPropagation: vi.fn() } })
		expect(visual.scaleX()).toBe(1)
		playHit.fire("tap", { evt: { stopPropagation: vi.fn() } })
		playHit.fire("click", { evt: { stopPropagation: vi.fn() } })
		expect(toggle).toHaveBeenCalledTimes(1)

		playHit.fire("mouseleave")
		expect(restoreToolCursor).toHaveBeenCalled()
	})

	it("does not render the corner replace action because the toolbar owns it", () => {
		mockCanvasRenderingContext()
		const harness = createAudioElementHarness()
		const group = harness.element.render()

		expect(group.findOne(".decorator-corner-actions")).toBeUndefined()
		expect(group.findOne(".decorator-corner-action-replace")).toBeUndefined()
	})

	it("exports only base fields and src from the formal audio DSL", () => {
		const [exported] = exportCanvasDocument([
			{
				id: "audio-1",
				type: ElementTypeEnum.Audio,
				x: 10,
				y: 20,
				width: 480,
				height: 120,
				activeContentId: "audio-1-content-1",
				mainContentId: "audio-1-content-1",
				contents: [{ contentId: "audio-1-content-1", src: "./audios/voice.mp3" }],
				duration: 12,
				paused: false,
			} as never,
		]).elements

		expect(exported).toMatchObject({
			id: "audio-1",
			type: ElementTypeEnum.Audio,
			contents: [{ contentId: "audio-1-content-1", src: "./audios/voice.mp3" }],
		})
		expect(exported).not.toHaveProperty("status")
		expect(exported).not.toHaveProperty("errorMessage")
		expect(exported).not.toHaveProperty("duration")
		expect(exported).not.toHaveProperty("paused")
	})

	it("exports an empty audio Content without inventing runtime or generation fields", () => {
		const emptyAudio = AudioElement.createElementData({
			id: "audio-empty",
			x: 10,
			y: 20,
		})
		const [exported] = exportCanvasDocument([emptyAudio]).elements

		expect(exported).toMatchObject({
			id: "audio-empty",
			type: ElementTypeEnum.Audio,
			activeContentId: "audio-empty-content-1",
			mainContentId: "audio-empty-content-1",
			contents: [{ contentId: "audio-empty-content-1" }],
		})
		expect(exported.contents[0]).not.toHaveProperty("src")
		expect(exported.contents[0]).not.toHaveProperty("status")
	})

	it("does not create an audio node until visibility admits the mounted element", () => {
		const unregisterPlayback = vi.fn()
		const unregisterFailure = vi.fn()
		const unregisterReplaceState = vi.fn()
		const unregisterPreview = vi.fn()
		const registerAudioElement = vi.fn()
		const unregisterAudioElement = vi.fn()
		const createElement = vi.spyOn(document, "createElement")
		const canvas = {
			getEffectiveContentId: vi.fn(() => undefined),
			can: vi.fn(() => true),
			audioPlaybackManager: {
				getSnapshot: vi.fn(() => ({
					duration: 0,
					currentTime: 0,
					paused: true,
					ended: false,
					preparing: false,
					loading: false,
					error: false,
				})),
				subscribe: vi.fn(() => unregisterPlayback),
			},
			eventEmitter: {
				on: vi.fn((eventType: string) =>
					eventType === "resource:audio:load-failed"
						? unregisterFailure
						: eventType === "content:previewChanged"
							? unregisterPreview
							: unregisterReplaceState,
				),
			},
			visibilityManager: {
				registerAudioElement,
				unregisterAudioElement,
			},
		} as unknown as Canvas
		const element = new AudioElement(
			AudioElement.createElementData({
				id: "audio-1",
				x: 0,
				y: 0,
				src: "./audios/voice.mp3",
			}),
			canvas,
		)

		expect(createElement).not.toHaveBeenCalledWith("audio")
		element.onMounted()
		expect(registerAudioElement).toHaveBeenCalledWith("audio-1", "./audios/voice.mp3")
		expect(createElement).not.toHaveBeenCalledWith("audio")

		element.destroy()
		expect(unregisterAudioElement).toHaveBeenCalledWith("audio-1")
		expect(unregisterPlayback).toHaveBeenCalledTimes(1)
		expect(unregisterFailure).toHaveBeenCalledTimes(1)
		expect(unregisterReplaceState).toHaveBeenCalledTimes(1)
		expect(unregisterPreview).toHaveBeenCalledTimes(1)
	})
})
