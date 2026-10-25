import Konva from "konva"
import type {
	AudioElement as AudioElementData,
	AudioElementContent,
	LayerElement,
} from "../../document/types"
import { ElementTypeEnum } from "../../document/types"
import {
	deleteActiveContent as deleteContentFromData,
	getContentById,
} from "../../document/elementContent"
import type { Canvas } from "../../core/Canvas"
import type { CanvasConsumerVisibility } from "../../resources/visibility/CanvasVisibilityManager"
import {
	BaseElement,
	type ElementTransformConstraints,
	type TransformContext,
} from "../core/BaseElement"
import { TransformBehavior } from "../../interaction/transform/TransformManager"
import type { AudioPlaybackSnapshot } from "../../resources/audio/AudioPlaybackManager"
import type { AudioWaveformSnapshot } from "../../resources/audio/AudioWaveformManager"
import {
	areCanvasHostResourceReferencesSame,
	getCanvasResourceFileName,
} from "../../shared/path/canvasResourcePath"
import { RenderUtils } from "../../shared/render/RenderUtils"
import { AUDIO_CONFIG } from "./AudioElement.config"
import {
	AUDIO_PLAYER_DESIGN,
	resolveAudioPlayerLayout,
	resolveAudioStatusPlaceholderLayout,
	type AudioPlayerLayout,
} from "./AudioElement.layout"
import {
	resolveAudioControlInteractionPolicy,
	type AudioControlAction,
	type AudioElementControlInteractionPolicy,
	type AudioControlInteractionMode,
} from "./AudioElement.interaction"
import {
	moveControlHitsToTop,
	syncControlHitCircle,
	syncControlHitRect,
} from "../../interaction/element-control/ControlHitTarget"

const NODE_NAMES = {
	background: "audio-background",
	statusPlaceholder: "audio-status-placeholder",
	statusSpinner: "audio-status-spinner",
	statusText: "audio-status-text",
	player: "audio-player-group",
	controls: "audio-controls-group",
	waveform: "audio-waveform-shape",
	progressGroup: "audio-progress-group",
	progressTrack: "audio-progress-track",
	progressFill: "audio-progress-fill",
	progressThumb: "audio-progress-thumb",
	progressThumbHit: "audio-progress-thumb-hit",
	progressHit: "audio-progress-hit",
	time: "audio-time",
	operationGroup: "audio-operation-group",
	backButton: "audio-back-button",
	backButtonIcon: "audio-back-button-icon",
	playButton: "audio-play-button",
	playButtonHit: "audio-play-button-hit",
	playTriangle: "audio-play-triangle",
	pauseBars: "audio-pause-bars",
	forwardButton: "audio-forward-button",
	forwardButtonIcon: "audio-forward-button-icon",
	error: "audio-error",
	controlHit: "audio-control-hit",
} as const

const INTERACTION_COLORS = {
	button: "rgba(255, 255, 255, 0)",
	buttonHover: "rgba(255, 255, 255, 0.10)",
	buttonActive: "rgba(255, 255, 255, 0.18)",
	buttonDisabled: "rgba(255, 255, 255, 0)",
	playButton: "#FFFFFF",
	playButtonHover: "#F0F0F0",
	playButtonActive: "#D9D9D9",
	progressTrackHover: "rgba(255, 255, 255, 0.28)",
	waveformPlayed: "rgba(255, 255, 255, 0.30)",
	waveformUnplayed: "rgba(255, 255, 255, 0.14)",
	waveformFallback: "rgba(255, 255, 255, 0.18)",
	waveformPlayhead: "#45C8F5",
} as const

const WAVEFORM_LAYOUT = {
	minBarCount: 24,
	maxBarCount: 128,
	minTimelineBarCount: 64,
	timelineSecondsPerBar: 2,
	barHeightRatio: 0.96,
	sampleRadius: 2,
	normalizationLowPercentile: 0.2,
	normalizationHighPercentile: 0.95,
	minNormalizationRange: 0.05,
	amplitudeFloor: 0.03,
	amplitudePower: 1.5,
} as const

const AUDIO_STATUS_SPINNER_PERIOD_MS = 800

type InteractiveState = "idle" | "hover" | "active"
type AudioRenderState = "empty" | "uploading" | "preparing" | "ready" | "error"
type AudioStatusPlaceholderState = Exclude<AudioRenderState, "ready">

interface AudioControlHitBounds {
	x: number
	y: number
	width: number
	height: number
	expandX?: boolean
	maxWidth?: number
}

function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"
	const wholeSeconds = Math.floor(seconds)
	const minutes = Math.floor(wholeSeconds / 60)
	const remainingSeconds = wholeSeconds % 60
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

/** 打开 / 构造时始终使用当前默认尺寸，忽略旧 DSL 持久化宽高。 */
function normalizeAudioDimensionsOnLoad(data: AudioElementData): AudioElementData {
	return {
		...data,
		width: AUDIO_CONFIG.DEFAULT_WIDTH,
		height: AUDIO_CONFIG.DEFAULT_HEIGHT,
	}
}

/**
 * 会话内更新：高度始终固定为默认；宽度保留用户拖拽结果。
 * 若宿主再次推入已知旧默认宽，则一并升级。
 */
function normalizeAudioDimensionsOnUpdate(data: AudioElementData): AudioElementData {
	const isStaleDefaultWidth =
		data.width === AUDIO_CONFIG.LEGACY_DEFAULT_WIDTH ||
		data.width === AUDIO_CONFIG.PREVIOUS_DEFAULT_WIDTH
	return {
		...data,
		width: isStaleDefaultWidth ? AUDIO_CONFIG.DEFAULT_WIDTH : data.width,
		height: AUDIO_CONFIG.DEFAULT_HEIGHT,
	}
}

function clampProgress(progress: number): number {
	return Math.max(0, Math.min(1, progress))
}

function resolveWaveformBarCount(waveformLayoutWidth: number, barPitch: number): number {
	const safeBarPitch = Math.max(0.0001, barPitch)
	const evenBarCount = Math.floor(waveformLayoutWidth / safeBarPitch / 2) * 2
	return Math.max(
		WAVEFORM_LAYOUT.minBarCount,
		Math.min(WAVEFORM_LAYOUT.maxBarCount, evenBarCount),
	)
}

function resolveWaveformTimelineBarCount(duration: number): number {
	if (!Number.isFinite(duration) || duration <= 0) return WAVEFORM_LAYOUT.minTimelineBarCount
	return Math.max(
		WAVEFORM_LAYOUT.minTimelineBarCount,
		Math.ceil(duration / WAVEFORM_LAYOUT.timelineSecondsPerBar),
	)
}

function resolveWaveformNormalization(peaks: Float32Array | null): {
	low: number
	range: number
} {
	if (!peaks?.length) return { low: 0, range: 1 }
	const sortedPeaks = Array.from(peaks).sort((a, b) => a - b)
	const lowPercentileIndex = Math.min(
		sortedPeaks.length - 1,
		Math.floor(sortedPeaks.length * WAVEFORM_LAYOUT.normalizationLowPercentile),
	)
	const highPercentileIndex = Math.min(
		sortedPeaks.length - 1,
		Math.floor(sortedPeaks.length * WAVEFORM_LAYOUT.normalizationHighPercentile),
	)
	const low = sortedPeaks[lowPercentileIndex] ?? 0
	const high = sortedPeaks[highPercentileIndex] ?? 1
	return {
		low,
		range: Math.max(WAVEFORM_LAYOUT.minNormalizationRange, high - low),
	}
}

/** 上传型音频卡片元素；播放、波形、替换和错误状态仅存在于运行时。 */
export class AudioElement extends BaseElement<AudioElementData> {
	private playbackSnapshot: AudioPlaybackSnapshot
	private waveformSnapshot: AudioWaveformSnapshot = { status: "idle", peaks: null }
	private waveformBarCount = WAVEFORM_LAYOUT.minBarCount
	private waveformNormalization = { low: 0, range: 1 }
	private playerLayout: AudioPlayerLayout = resolveAudioPlayerLayout(
		AUDIO_CONFIG.DEFAULT_WIDTH,
		AUDIO_CONFIG.DEFAULT_HEIGHT,
	)
	private playbackUnsubscribe: () => void
	private waveformUnsubscribe: () => void = () => undefined
	private resourceFailureUnsubscribe: () => void
	private mediaReplaceStateUnsubscribe: () => void
	private contentPreviewUnsubscribe: () => void = () => undefined
	private effectiveContentSrc?: string
	private resourceError = false
	private interactionEventUnsubscribers: Array<() => void> = []
	private lastTouchActionAt = 0
	private lastProgressTouchActionAt = 0
	private controlInteractionMode: AudioControlInteractionMode = "full"
	private controlsEnabled = true
	private readonly elementControlInteractionPolicy: AudioElementControlInteractionPolicy = {
		canInteract: () =>
			this.controlsEnabled &&
			(this.canvas.permissionManager?.can?.("interaction.playback") ?? true) &&
			(this.canvas.permissionManager?.canUseSelectionToolAffordance?.() ?? true),
	}
	private pendingScrubProgress: number | null = null
	private scrubStage?: Konva.Stage
	private scrubWindowCleanup?: () => void
	private scrubNodeWasDraggable = false
	private scrubStageWasDraggable = false
	private backButtonStateSync?: () => void
	private forwardButtonStateSync?: () => void
	private renderedState?: AudioRenderState
	private retryingPreparation = false
	private statusSpinnerAnimation?: Konva.Animation
	private consumerVisibility: CanvasConsumerVisibility = "visible"
	private consumerVisibilityUnsubscribe?: () => void

	constructor(data: AudioElementData, canvas: Canvas) {
		const normalizedData = normalizeAudioDimensionsOnLoad(data)
		super(normalizedData, canvas)
		this.playbackSnapshot = canvas.audioPlaybackManager.getSnapshot(normalizedData.id)
		this.playbackUnsubscribe = canvas.audioPlaybackManager.subscribe(
			normalizedData.id,
			(snapshot) => {
				this.playbackSnapshot = snapshot
				if (!snapshot.error && snapshot.duration > 0) this.resourceError = false
				this.syncRenderState()
			},
		)
		this.effectiveContentSrc = this.getAudioSrc()
		this.subscribeWaveform(this.effectiveContentSrc)
		this.contentPreviewUnsubscribe = canvas.eventEmitter.on(
			"content:previewChanged",
			({ data: eventData }) => {
				if (eventData.elementId && eventData.elementId !== normalizedData.id) return
				if (this.syncEffectiveContentSource(this.getAudioSrc())) {
					this.syncRenderState()
				}
			},
		)
		this.resourceFailureUnsubscribe = canvas.eventEmitter.on(
			"resource:audio:load-failed",
			({ data: eventData }) => {
				if (
					!this.getAudioSrc() ||
					!areCanvasHostResourceReferencesSame(
						this.canvas,
						this.getAudioSrc()!,
						eventData.path,
					)
				) {
					return
				}
				this.retryingPreparation = false
				this.resourceError = true
				this.syncRenderState()
			},
		)
		this.mediaReplaceStateUnsubscribe = canvas.eventEmitter.on(
			"element:media:replaceStateChanged",
			({ data: eventData }) => {
				if (eventData.elementId !== normalizedData.id) return
				this.syncRenderState()
			},
		)
	}

	public static getDefaultConfig() {
		return {
			width: AUDIO_CONFIG.DEFAULT_WIDTH,
			height: AUDIO_CONFIG.DEFAULT_HEIGHT,
			interactionConfig: { aspectRatioLocked: false },
		}
	}

	public static createElementData(options: {
		id: string
		x: number
		y: number
		zIndex?: number
		src?: string
		name?: string
		width?: number
	}): AudioElementData {
		const data: AudioElementData = {
			id: options.id,
			type: ElementTypeEnum.Audio,
			x: options.x,
			y: options.y,
			width: options.width ?? AUDIO_CONFIG.DEFAULT_WIDTH,
			height: AUDIO_CONFIG.DEFAULT_HEIGHT,
			zIndex: options.zIndex ?? 0,
			activeContentId: `${options.id}-content-1`,
			mainContentId: `${options.id}-content-1`,
			contents: [{ contentId: `${options.id}-content-1`, src: options.src }],
			interactionConfig: { aspectRatioLocked: false },
		}
		if (options.name !== undefined) data.name = options.name
		return data
	}

	public getRenderName(): string {
		const fileName = getCanvasResourceFileName(this.getAudioSrc())
		const baseName = fileName.replace(/\.[^/.]+$/, "")
		return baseName || this.getText("audio.defaultName", "音频")
	}

	public switchActiveContent(contentId: string): boolean {
		if (!this.canvas.permissionManager.can("document.write")) return false
		if (!getContentById(this.data, contentId)) return false
		if (this.data.activeContentId === contentId) return true
		this.canvas.elementManager.update(
			this.data.id,
			{ activeContentId: contentId },
			{ silent: false },
		)
		return true
	}

	public setMainContent(contentId: string): boolean {
		if (!this.canvas.permissionManager.can("document.write")) return false
		const target = getContentById(this.data, contentId)
		if (!target?.src) return false
		if (this.data.mainContentId === contentId) return true
		this.canvas.elementManager.update(
			this.data.id,
			{ mainContentId: contentId },
			{ silent: false },
		)
		return true
	}

	public deleteActiveContent(): boolean {
		if (!this.canvas.permissionManager.can("document.delete")) return false
		const result = deleteContentFromData(this.data, (content) => Boolean(content.src))
		if (!result) return false
		this.canvas.generationRuntimeManager?.clearTarget(
			this.data.id,
			result.deletedContent.contentId,
		)
		this.canvas.elementManager.update(
			this.data.id,
			{
				contents: result.element.contents,
				activeContentId: result.element.activeContentId,
				mainContentId: result.element.mainContentId,
			},
			{ silent: false },
		)
		return true
	}

	private getAudioContent(data: AudioElementData = this.data): AudioElementContent | undefined {
		return this.getActiveContent<AudioElementContent>(data)
	}

	private getAudioSrc(data: AudioElementData = this.data): string | undefined {
		return this.getAudioContent(data)?.src
	}

	/**
	 * Content 预览只改变会话内的 effective Content。音频播放、波形和资源错误均为
	 * 元素级运行时状态，切换到不同资源时必须一起重绑，避免短暂沿用上一版本状态。
	 */
	private syncEffectiveContentSource(nextSrc: string | undefined): boolean {
		if (this.effectiveContentSrc === nextSrc) return false
		this.effectiveContentSrc = nextSrc
		this.canvas.audioPlaybackManager.release(this.data.id)
		this.playbackSnapshot = this.canvas.audioPlaybackManager.getSnapshot(this.data.id)
		this.resourceError = false
		this.retryingPreparation = false
		this.subscribeWaveform(nextSrc)
		if (nextSrc) {
			this.canvas.visibilityManager.updateAudioElement(this.data.id, nextSrc)
		} else {
			this.canvas.visibilityManager.unregisterAudioElement(this.data.id)
		}
		return true
	}

	public render(): Konva.Group {
		const width = Math.max(
			this.data.width ?? AUDIO_CONFIG.DEFAULT_WIDTH,
			AUDIO_CONFIG.MIN_WIDTH,
		)
		const height = AUDIO_CONFIG.DEFAULT_HEIGHT
		const group = new Konva.Group({ width, height })

		RenderUtils.createHitNode(group, width, height, {
			cornerRadius: AUDIO_CONFIG.CORNER_RADIUS,
		})
		group.add(
			new Konva.Rect({
				width,
				height,
				fill: AUDIO_CONFIG.BACKGROUND,
				stroke: AUDIO_CONFIG.BORDER,
				strokeWidth: 1,
				cornerRadius: AUDIO_CONFIG.CORNER_RADIUS,
				listening: false,
				name: NODE_NAMES.background,
			}),
		)
		const renderState = this.resolveRenderState()
		this.renderedState = renderState
		if (renderState !== "ready") {
			this.renderStatusPlaceholder(group, renderState)
			this.finalizeNode(group)
			this.syncRenderLayout(width, height)
			return group
		}

		const playerGroup = new Konva.Group({
			name: `${NODE_NAMES.player} ${NODE_NAMES.controls}`,
		})
		group.add(playerGroup)
		this.renderWaveform(playerGroup)
		this.renderProgress(playerGroup)
		this.renderOperations(playerGroup)
		playerGroup.add(
			new Konva.Text({
				x: 0,
				y: 0,
				width: 0,
				text: "",
				fontSize: this.playerLayout.error.fontSize,
				fill: AUDIO_CONFIG.ERROR,
				name: NODE_NAMES.error,
				ellipsis: true,
				wrap: "none",
				listening: false,
			}),
		)
		this.finalizeNode(group)
		this.syncRenderLayout(width, height)
		this.syncPlaybackNodes()
		this.syncWaveformNodes()
		return group
	}

	private isUploadingPlaceholder(): boolean {
		const activeContentId = this.getAudioContent()?.contentId ?? null
		const replacementState = this.canvas.mediaReplaceController?.getReplacementState?.(
			this.data.id,
		)
		return (
			(replacementState?.source === "local-upload" &&
				replacementState.phase === "uploading" &&
				replacementState.contentId === activeContentId) ||
			(!this.getAudioSrc() && this.canvas.elementManager.isTemporary(this.data.id))
		)
	}

	private resolveRenderState(): AudioRenderState {
		if (this.isUploadingPlaceholder()) return "uploading"
		if (!this.getAudioSrc()) return "empty"
		if (
			this.resourceError ||
			this.playbackSnapshot.error ||
			this.waveformSnapshot.status === "error"
		) {
			return this.retryingPreparation ? "preparing" : "error"
		}

		const metadataReady = !this.playbackSnapshot.preparing && this.playbackSnapshot.duration > 0
		return metadataReady && this.waveformSnapshot.status === "ready" ? "ready" : "preparing"
	}

	private renderStatusPlaceholder(group: Konva.Group, state: AudioStatusPlaceholderState): void {
		const showSpinner = state === "uploading" || state === "preparing"
		const placeholder = new Konva.Group({
			name: NODE_NAMES.statusPlaceholder,
			listening: state === "error",
		})
		if (showSpinner) {
			placeholder.add(
				new Konva.Shape({
					name: NODE_NAMES.statusSpinner,
					listening: false,
					rotation: -90,
					sceneFunc(context, shape) {
						const radius = shape.getAttr("audioStatusSpinnerRadius") as
							number | undefined
						const strokeWidth = shape.getAttr("audioStatusSpinnerStrokeWidth") as
							number | undefined
						if (!radius || !strokeWidth) return

						context.beginPath()
						context.arc(0, 0, radius, 0, Math.PI * 2)
						context.strokeStyle = "rgba(255, 255, 255, 0.24)"
						context.lineWidth = strokeWidth
						context.stroke()

						context.beginPath()
						context.arc(0, 0, radius, 0, Math.PI * 0.65)
						context.strokeStyle = AUDIO_CONFIG.PROGRESS
						context.lineWidth = strokeWidth
						context.lineCap = "round"
						context.stroke()
					},
				}),
			)
		}

		const text = new Konva.Text({
			name: NODE_NAMES.statusText,
			text:
				state === "empty"
					? this.getText("audio.empty", "暂无音频内容")
					: state === "uploading"
						? this.getText("audio.uploading", "正在上传中...")
						: state === "preparing"
							? this.getText("audio.loading", "正在加载音频...")
							: this.getAudioLoadErrorText(),
			align: "center",
			fill: state === "error" ? AUDIO_CONFIG.ERROR : AUDIO_CONFIG.SECONDARY_TEXT,
			listening: state === "error",
		})
		if (state === "error") {
			text.on("mouseenter", () => this.canvas.cursorManager?.setTemporary("pointer"))
			text.on("mouseleave", () => this.canvas.cursorManager?.restoreToolCursor())
			text.on("click tap", (event) => {
				event.cancelBubble = true
				this.retryPreparation()
			})
		}
		placeholder.add(text)
		group.add(placeholder)
	}

	private syncRenderState(): void {
		const nextState = this.resolveRenderState()
		if (!this.renderedState || !this.node) return
		if (nextState !== this.renderedState) {
			this.rerenderWhenTransformIdle()
			return
		}
		if (nextState === "ready") {
			this.syncPlaybackNodes()
			this.syncWaveformNodes()
		}
	}

	private retryPreparation(): void {
		if (!this.getAudioSrc() || this.retryingPreparation) return
		this.retryingPreparation = true
		this.resourceError = false
		this.syncRenderState()
		this.canvas.visibilityManager.requestImmediateAudioLoad(this.data.id, {
			reason: "audio-placeholder-retry",
			priority: "critical",
		})
	}

	private getAudioLoadErrorText(): string {
		const src = this.getAudioSrc()
		const failureReason = src ? this.canvas.audioResourceManager.getFailureReason(src) : null
		return failureReason === "not-found"
			? this.getText("audio.fileMissing", "音频文件不存在")
			: this.getText("audio.loadFailed", "音频加载失败，点击重试")
	}

	public override onMounted(): void {
		super.onMounted()
		if (this.node instanceof Konva.Group) {
			this.syncRenderLayout(this.node.width(), this.node.height())
			this.syncInteractionHitTargets()
		}
		const hasStatusSpinner =
			this.node instanceof Konva.Group && !!this.node.findOne(`.${NODE_NAMES.statusSpinner}`)
		if (hasStatusSpinner && !this.consumerVisibilityUnsubscribe) {
			if (this.canvas.visibilityManager?.registerConsumerVisibility) {
				this.consumerVisibilityUnsubscribe =
					this.canvas.visibilityManager.registerConsumerVisibility(
						this.data.id,
						(state) => {
							this.consumerVisibility = state
							if (state === "far") {
								this.stopStatusSpinnerAnimation()
							} else {
								this.startStatusSpinnerAnimation()
							}
						},
					)
			}
		}
		const src = this.getAudioSrc()
		if (src) {
			this.canvas.visibilityManager.registerAudioElement(this.data.id, src)
		}
		this.startStatusSpinnerAnimation()
	}

	public update(newData: AudioElementData): boolean {
		const normalizedData = normalizeAudioDimensionsOnUpdate(newData)
		const previousData = this.data
		const previousContent = this.getAudioContent(previousData)
		this.data = normalizedData
		const nextContent = this.getAudioContent(normalizedData)
		const resourceChanged = previousContent?.src !== nextContent?.src
		const needsRerender =
			resourceChanged ||
			previousData.width !== normalizedData.width ||
			previousData.height !== normalizedData.height

		if (resourceChanged) {
			this.syncEffectiveContentSource(nextContent?.src)
		}

		if (!needsRerender && this.node) {
			this.updateBaseProps(this.node, normalizedData)
		}
		return needsRerender
	}

	public override getTransformBehavior(): TransformBehavior {
		return TransformBehavior.APPLY_TO_SIZE
	}

	public override getTransformConstraints(): ElementTransformConstraints {
		return {
			enabledAnchors: ["middle-left", "middle-right"],
			minWidth: AUDIO_CONFIG.MIN_WIDTH,
			fixedHeight: AUDIO_CONFIG.DEFAULT_HEIGHT,
		}
	}

	/**
	 * Transformer 边界只应使用音频卡片本身的尺寸。
	 *
	 * 播放器内部的透明交互区域会在小缩放或触屏环境下扩大，不能让这些
	 * 非视觉节点影响 Transformer 的边界。
	 */
	protected override setupCustomBoundingRect(node: Konva.Group): void {
		if (!(node instanceof Konva.Group)) return

		node.getClientRect = (config?: Parameters<Konva.Node["getClientRect"]>[0]) => {
			const hitRect = node.findOne(".hit-area") as Konva.Rect | undefined
			if (hitRect) {
				return hitRect.getClientRect(config)
			}

			const width = node.width()
			const height = node.height()
			const scaleX = node.scaleX()
			const scaleY = node.scaleY()
			const position = config?.relativeTo ? node.getPosition() : node.getAbsolutePosition()

			return {
				x: position.x,
				y: position.y,
				width: width * scaleX,
				height: height * scaleY,
			}
		}
	}

	public override applyTransform(
		updates: Partial<LayerElement>,
		context: TransformContext,
	): Partial<LayerElement> {
		if ((context.isRealtime && context.isScaling) || !context.isRealtime) {
			const width =
				(updates.width ?? this.data.width ?? AUDIO_CONFIG.DEFAULT_WIDTH) *
				(updates.scaleX ?? 1)
			return {
				x: updates.x,
				y: updates.y,
				width: Math.max(AUDIO_CONFIG.MIN_WIDTH, Math.round(width)),
				height: AUDIO_CONFIG.DEFAULT_HEIGHT,
				scaleX: 1,
				scaleY: 1,
			}
		}
		return { x: updates.x, y: updates.y }
	}

	public override onTransformResize(width: number, _height: number): void {
		this.syncRenderLayout(Math.max(AUDIO_CONFIG.MIN_WIDTH, width), AUDIO_CONFIG.DEFAULT_HEIGHT)
	}

	public playPreview(): void {
		if (!this.canvas.permissionManager.can("interaction.playback")) return
		const src = this.getAudioSrc()
		if (!src) return
		void this.canvas.audioPlaybackManager.toggle(this.data.id, src).then((success) => {
			if (!success) {
				this.resourceError = true
				this.rerenderWhenTransformIdle()
			}
		})
	}

	public pausePreview(): void {
		this.canvas.audioPlaybackManager.pause(this.data.id)
	}

	public override onResourceReferenceResolverChanged(): void {
		// Resolver revision 变化只代表资源 URL/附件快照需要重新绑定；播放进度属于元素运行态，
		// 释放底层 HTMLAudioElement 时必须保留 metadata，待新会话创建后恢复 currentTime。
		this.canvas.audioPlaybackManager.release(this.data.id, { preserveMetadata: true })
		this.resourceError = false
		this.retryingPreparation = false
		this.subscribeWaveform(this.getAudioSrc())
	}

	public override destroy(): void {
		this.finishScrub()
		this.canvas.visibilityManager.unregisterAudioElement(this.data.id)
		this.consumerVisibilityUnsubscribe?.()
		this.consumerVisibilityUnsubscribe = undefined
		this.playbackUnsubscribe()
		this.waveformUnsubscribe()
		this.resourceFailureUnsubscribe()
		this.mediaReplaceStateUnsubscribe()
		this.contentPreviewUnsubscribe()
		this.backButtonStateSync = undefined
		this.forwardButtonStateSync = undefined
		if (this.node) this.cleanupNodeListeners(this.node)
		super.destroy()
	}

	protected override setupNodeListeners(node: Konva.Node): void {
		super.setupNodeListeners(node)
		if (!(node instanceof Konva.Group)) return

		const syncHitTargets = () => this.syncInteractionHitTargets()
		this.interactionEventUnsubscribers.push(
			this.canvas.runtimeScheduler.registerViewportScaleLayout(this.data.id, syncHitTargets),
			this.canvas.eventEmitter.on("canvas:devicechange", syncHitTargets),
		)
	}

	protected override cleanupNodeListeners(node: Konva.Node): void {
		this.stopStatusSpinnerAnimation()
		this.interactionEventUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.interactionEventUnsubscribers = []
		super.cleanupNodeListeners(node)
	}

	private startStatusSpinnerAnimation(): void {
		this.stopStatusSpinnerAnimation()
		if (this.consumerVisibility === "far") return
		if (!(this.node instanceof Konva.Group)) return
		const spinner = this.node.findOne(`.${NODE_NAMES.statusSpinner}`) as Konva.Shape | undefined
		const layer = spinner?.getLayer()
		if (!spinner || !layer) return

		this.statusSpinnerAnimation = new Konva.Animation((frame) => {
			const progress =
				(frame.time % AUDIO_STATUS_SPINNER_PERIOD_MS) / AUDIO_STATUS_SPINNER_PERIOD_MS
			spinner.rotation(-90 + progress * 360)
		}, layer)
		this.statusSpinnerAnimation.start()
	}

	private stopStatusSpinnerAnimation(): void {
		this.statusSpinnerAnimation?.stop()
		this.statusSpinnerAnimation = undefined
	}

	private renderWaveform(group: Konva.Group): void {
		const waveform = new Konva.Shape({
			x: 0,
			y: 0,
			width: 0,
			height: this.playerLayout.waveform.height,
			listening: false,
			name: NODE_NAMES.waveform,
			sceneFunc: (context, shape) => {
				const width = shape.width()
				const height = shape.height()
				if (width <= 0 || height <= 0) return
				const barCount = this.waveformBarCount
				const waveformStyle = this.playerLayout.waveformStyle
				const barWidth = waveformStyle.barWidth
				const minimumBarGap = Math.max(1, barWidth * 0.25)
				const fittedBarPitch =
					barCount > 1
						? Math.max(barWidth + minimumBarGap, (width - barWidth) / (barCount - 1))
						: 0
				const barPitch = Math.min(waveformStyle.barPitch, fittedBarPitch)
				const progress = this.resolveDisplayedProgress()
				const peaks = this.waveformSnapshot.peaks
				const hasRealPeaks = this.waveformSnapshot.status === "ready" && !!peaks?.length
				// Timeline indices own stable amplitudes; playback progress only translates
				// those fixed bars beneath the centered playhead.
				const timelineBarCount = resolveWaveformTimelineBarCount(
					this.playbackSnapshot.duration,
				)
				const playheadBarPosition = progress * timelineBarCount
				const visibleHalfSpan = width / barPitch / 2
				const firstTimelineIndex = Math.floor(playheadBarPosition - visibleHalfSpan) - 1
				const lastTimelineIndex = Math.ceil(playheadBarPosition + visibleHalfSpan) + 1
				context.save()
				context.beginPath()
				context.rect(0, 0, width, height)
				context.clip()
				for (
					let timelineIndex = firstTimelineIndex;
					timelineIndex <= lastTimelineIndex;
					timelineIndex += 1
				) {
					const barOffset = timelineIndex + 0.5 - playheadBarPosition
					const x = width / 2 + barOffset * barPitch - barWidth / 2
					if (x + barWidth <= 0 || x >= width) continue
					const sourceProgress = (timelineIndex + 0.5) / timelineBarCount
					const hasPeakAtPosition =
						hasRealPeaks && timelineIndex >= 0 && timelineIndex < timelineBarCount
					let amplitude = 0.025
					if (hasPeakAtPosition && peaks?.length) {
						const maxPeakIndex = peaks.length - 1
						const centerPeakIndex = Math.round(sourceProgress * maxPeakIndex)
						const peakStartIndex = Math.max(
							0,
							centerPeakIndex - WAVEFORM_LAYOUT.sampleRadius,
						)
						const peakEndIndex = Math.min(
							maxPeakIndex,
							centerPeakIndex + WAVEFORM_LAYOUT.sampleRadius,
						)
						let sumSquares = 0
						let peakCount = 0
						for (
							let peakIndex = peakStartIndex;
							peakIndex <= peakEndIndex;
							peakIndex += 1
						) {
							const peak = peaks[peakIndex] ?? 0
							sumSquares += peak * peak
							peakCount += 1
						}
						if (peakCount > 0) {
							const intervalRms = Math.sqrt(sumSquares / peakCount)
							const normalizedAmplitude = clampProgress(
								(intervalRms - this.waveformNormalization.low) /
									this.waveformNormalization.range,
							)
							amplitude =
								WAVEFORM_LAYOUT.amplitudeFloor +
								(1 - WAVEFORM_LAYOUT.amplitudeFloor) *
									Math.pow(normalizedAmplitude, WAVEFORM_LAYOUT.amplitudePower)
						}
					}
					const barHeight = Math.max(
						waveformStyle.minBarHeight,
						amplitude * height * WAVEFORM_LAYOUT.barHeightRatio,
					)
					const y = (height - barHeight) / 2
					const played = timelineIndex + 0.5 <= playheadBarPosition
					context.beginPath()
					context.roundRect(x, y, barWidth, barHeight, barWidth / 2)
					context.fillStyle = hasRealPeaks
						? played
							? INTERACTION_COLORS.waveformPlayed
							: INTERACTION_COLORS.waveformUnplayed
						: INTERACTION_COLORS.waveformFallback
					context.fill()
				}
				context.restore()
				if (this.playbackSnapshot.duration > 0) {
					const markerHalfWidth = waveformStyle.playheadTriangleWidth / 2
					const markerX = width / 2
					context.beginPath()
					context.moveTo(markerX - markerHalfWidth, 0)
					context.lineTo(markerX + markerHalfWidth, 0)
					context.lineTo(markerX, waveformStyle.playheadTriangleHeight)
					context.closePath()
					context.fillStyle = INTERACTION_COLORS.waveformPlayhead
					context.fill()
					context.beginPath()
					context.moveTo(markerX, waveformStyle.playheadTriangleHeight)
					context.lineTo(markerX, height)
					context.strokeStyle = INTERACTION_COLORS.waveformPlayhead
					context.lineWidth = waveformStyle.playheadWidth
					context.lineCap = "round"
					context.stroke()
				}
			},
		})
		group.add(waveform)
	}

	private renderProgress(group: Konva.Group): void {
		const progressGroup = new Konva.Group({ name: NODE_NAMES.progressGroup })
		const track = new Konva.Rect({
			x: 0,
			y: 0,
			width: 0,
			height: this.playerLayout.progress.height,
			fill: AUDIO_CONFIG.TRACK,
			cornerRadius: this.playerLayout.progress.height / 2,
			name: NODE_NAMES.progressTrack,
			listening: false,
		})
		const fill = new Konva.Rect({
			x: 0,
			y: 0,
			width: 0,
			height: this.playerLayout.progress.height,
			fill: AUDIO_CONFIG.PROGRESS,
			cornerRadius: this.playerLayout.progress.height / 2,
			name: NODE_NAMES.progressFill,
			listening: false,
		})
		const thumb = new Konva.Circle({
			x: 0,
			y: 0,
			radius: this.playerLayout.progressThumbRadius,
			fill: AUDIO_CONFIG.PROGRESS,
			name: NODE_NAMES.progressThumb,
			listening: false,
		})
		const hit = new Konva.Rect({
			x: 0,
			y: 0,
			width: 0,
			height: this.playerLayout.progressHit.height,
			fill: "rgba(0, 0, 0, 0.001)",
			name: `${NODE_NAMES.progressHit} ${NODE_NAMES.controlHit}`,
		})
		this.setInteractionHitBaseBounds(hit, {
			x: 0,
			y: 0,
			width: 0,
			height: this.playerLayout.progressHit.height,
			expandX: false,
		})
		const thumbHit = new Konva.Circle({
			x: 0,
			y: 0,
			radius: this.playerLayout.progressThumbRadius,
			fill: "rgba(0, 0, 0, 0.001)",
			name: `${NODE_NAMES.progressThumbHit} ${NODE_NAMES.controlHit}`,
		})
		this.setInteractionCircleHitBaseRadius(thumbHit, this.playerLayout.progressThumbRadius)
		progressGroup.add(
			track,
			fill,
			thumb,
			new Konva.Text({
				x: 0,
				y: 0,
				width: 0,
				text: "0:00 / 0:00",
				fontSize: this.playerLayout.time.fontSize,
				fill: AUDIO_CONFIG.SECONDARY_TEXT,
				name: NODE_NAMES.time,
				listening: false,
			}),
			hit,
			thumbHit,
		)

		const handlePointerEnter = () => {
			if (!this.canUseControls({ type: "seek-progress" })) return
			this.setProgressInteractionState("hover")
			this.canvas.cursorManager?.setTemporary("pointer")
		}
		const handlePointerLeave = () => {
			if (this.scrubStage) return
			this.setProgressInteractionState("idle")
			this.canvas.cursorManager?.restoreToolCursor()
		}
		hit.on("mouseenter", handlePointerEnter)
		hit.on("mouseleave", handlePointerLeave)
		hit.on("mousedown touchstart", (event) => {
			if (this.controlInteractionMode === "full") {
				this.beginScrub(event, group, track)
			}
		})
		hit.on("click", (event) => {
			if (
				this.controlInteractionMode !== "compact" ||
				Date.now() - this.lastProgressTouchActionAt < 500
			) {
				return
			}
			this.seekProgressAtPointer(event, group, track)
		})
		hit.on("tap", (event) => {
			if (this.controlInteractionMode !== "compact") return
			this.lastProgressTouchActionAt = Date.now()
			this.seekProgressAtPointer(event, group, track)
		})

		thumbHit.on("mouseenter", handlePointerEnter)
		thumbHit.on("mouseleave", handlePointerLeave)
		thumbHit.on("mousedown touchstart", (event) => this.beginScrub(event, group, track))
		group.add(progressGroup)
	}

	private renderOperations(group: Konva.Group): void {
		const operationGroup = new Konva.Group({ name: NODE_NAMES.operationGroup })
		const backButton = this.createSeekButton({
			name: NODE_NAMES.backButton,
			iconName: NODE_NAMES.backButtonIcon,
			direction: "backward",
			action: { type: "seek-backward" },
			isEnabled: () => this.canSeekBackward(),
			onActivate: () => this.seekBy(-5),
		})
		const playButton = this.createPlayButton()
		const forwardButton = this.createSeekButton({
			name: NODE_NAMES.forwardButton,
			iconName: NODE_NAMES.forwardButtonIcon,
			direction: "forward",
			action: { type: "seek-forward" },
			isEnabled: () => this.canSeekForward(),
			onActivate: () => this.seekBy(5),
		})
		this.backButtonStateSync = backButton.syncState
		this.forwardButtonStateSync = forwardButton.syncState
		operationGroup.add(backButton.button, playButton, forwardButton.button)
		group.add(operationGroup)
	}

	private createPlayButton(): Konva.Group {
		const size = AUDIO_PLAYER_DESIGN.operationButtonSize
		const button = new Konva.Group({ width: size, height: size, name: NODE_NAMES.playButton })
		const hit = new Konva.Rect({
			width: size,
			height: size,
			fill: "rgba(0, 0, 0, 0.001)",
			name: `${NODE_NAMES.playButtonHit} ${NODE_NAMES.controlHit}`,
		})
		this.setInteractionHitBaseBounds(hit, {
			x: 0,
			y: 0,
			width: size,
			height: size,
			maxWidth: size + AUDIO_PLAYER_DESIGN.operationGap,
		})
		const visual = new Konva.Group({ x: size / 2, y: size / 2, listening: false })
		const background = new Konva.Circle({
			radius: size / 2,
			fill: INTERACTION_COLORS.playButton,
			listening: false,
		})
		const playTriangle = new Konva.Line({
			name: NODE_NAMES.playTriangle,
			points: [-4, -9, -4, 9, 10, 0],
			closed: true,
			fill: "#171717",
			listening: false,
		})
		const pauseBars = new Konva.Group({ name: NODE_NAMES.pauseBars, listening: false })
		pauseBars.add(
			new Konva.Rect({ x: -7, y: -9, width: 5, height: 18, fill: "#171717" }),
			new Konva.Rect({ x: 2, y: -9, width: 5, height: 18, fill: "#171717" }),
		)
		visual.add(background, playTriangle, pauseBars)
		button.add(hit, visual)
		this.bindInteractiveButton({
			button,
			hit,
			visual,
			background,
			idleFill: INTERACTION_COLORS.playButton,
			hoverFill: INTERACTION_COLORS.playButtonHover,
			activeFill: INTERACTION_COLORS.playButtonActive,
			action: { type: "toggle-playback" },
			onActivate: () => this.playPreview(),
		})
		return button
	}

	private createSeekButton(options: {
		name: string
		iconName: string
		direction: "backward" | "forward"
		action: AudioControlAction
		isEnabled: () => boolean
		onActivate: () => void
	}): { button: Konva.Group; syncState: () => void } {
		const size = AUDIO_PLAYER_DESIGN.operationButtonSize
		const button = new Konva.Group({ width: size, height: size, name: options.name })
		const hit = new Konva.Rect({
			width: size,
			height: size,
			fill: "rgba(0, 0, 0, 0.001)",
			name: `${options.name}-hit ${NODE_NAMES.controlHit}`,
		})
		this.setInteractionHitBaseBounds(hit, {
			x: 0,
			y: 0,
			width: size,
			height: size,
			maxWidth: size + AUDIO_PLAYER_DESIGN.operationGap,
		})
		const visual = new Konva.Group({ x: size / 2, y: size / 2, listening: false })
		const background = new Konva.Circle({
			radius: size / 2,
			fill: INTERACTION_COLORS.button,
			listening: false,
			name: `${options.name}-background`,
		})
		const icon = new Konva.Group({ name: options.iconName, listening: false })
		const iconTriangles =
			options.direction === "backward"
				? [
						[-10, 0, -2, -8, -2, 8],
						[-1, 0, 7, -8, 7, 8],
					]
				: [
						[-7, -8, 1, 0, -7, 8],
						[2, -8, 10, 0, 2, 8],
					]
		icon.add(
			...iconTriangles.map(
				(points) =>
					new Konva.Line({
						points,
						closed: true,
						fill: AUDIO_CONFIG.PRIMARY_TEXT,
						listening: false,
					}),
			),
		)
		visual.add(background, icon)
		button.add(hit, visual)
		const syncState = this.bindInteractiveButton({
			button,
			hit,
			visual,
			background,
			content: icon,
			idleFill: INTERACTION_COLORS.button,
			hoverFill: INTERACTION_COLORS.buttonHover,
			activeFill: INTERACTION_COLORS.buttonActive,
			disabledFill: INTERACTION_COLORS.buttonDisabled,
			contentIdleOpacity: 0.64,
			contentHoverOpacity: 0.88,
			contentActiveOpacity: 1,
			action: options.action,
			disabledContentOpacity: 0.24,
			disabledButtonOpacity: 1,
			disabledCursor: "not-allowed",
			isEnabled: options.isEnabled,
			onActivate: options.onActivate,
		})
		return { button, syncState }
	}

	private bindInteractiveButton(options: {
		button: Konva.Group
		hit: Konva.Rect
		visual: Konva.Group
		background: Konva.Shape
		content?: Konva.Node
		idleFill: string
		hoverFill: string
		activeFill: string
		action: AudioControlAction
		disabledFill?: string
		contentIdleOpacity?: number
		contentHoverOpacity?: number
		contentActiveOpacity?: number
		disabledContentOpacity?: number
		disabledButtonOpacity?: number
		disabledCursor?: "not-allowed"
		onActivate: () => void
		isEnabled?: () => boolean
	}): () => void {
		const isEnabled = () =>
			this.canUseControls(options.action) && (options.isEnabled?.() ?? true)
		let pointerInside = false
		const setState = (state: InteractiveState) => {
			const enabled = isEnabled()
			options.background.fill(
				!enabled
					? (options.disabledFill ?? options.idleFill)
					: state === "active"
						? options.activeFill
						: state === "hover"
							? options.hoverFill
							: options.idleFill,
			)
			options.visual.scale({
				x: state === "active" && enabled ? 0.94 : 1,
				y: state === "active" && enabled ? 0.94 : 1,
			})
			options.content?.opacity(
				!enabled
					? (options.disabledContentOpacity ?? 1)
					: state === "active"
						? (options.contentActiveOpacity ?? 1)
						: state === "hover"
							? (options.contentHoverOpacity ?? 1)
							: (options.contentIdleOpacity ?? 1),
			)
			options.button.opacity(enabled ? 1 : (options.disabledButtonOpacity ?? 0.55))
			options.button.getLayer()?.batchDraw()
		}
		const syncState = () => {
			const enabled = isEnabled()
			setState(pointerInside && enabled ? "hover" : "idle")
			if (!pointerInside) return
			if (enabled) {
				this.canvas.cursorManager?.setTemporary("pointer")
			} else if (options.disabledCursor) {
				this.canvas.cursorManager?.setTemporary(options.disabledCursor)
			} else {
				this.canvas.cursorManager?.restoreToolCursor()
			}
		}
		const stopEvent = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
			event.cancelBubble = true
			event.evt?.stopPropagation()
		}
		options.hit.on("mouseenter", () => {
			pointerInside = true
			syncState()
		})
		options.hit.on("mouseleave", () => {
			pointerInside = false
			setState("idle")
			this.canvas.cursorManager?.restoreToolCursor()
		})
		options.hit.on("mousedown", (event) => {
			stopEvent(event)
			if (isEnabled()) setState("active")
		})
		options.hit.on("mouseup", (event) => {
			stopEvent(event)
			setState(pointerInside && isEnabled() ? "hover" : "idle")
		})
		options.hit.on("touchstart", (event) => {
			stopEvent(event)
			event.evt?.preventDefault()
			if (isEnabled()) setState("active")
		})
		options.hit.on("touchend touchcancel", (event) => {
			stopEvent(event)
			setState("idle")
		})
		options.hit.on("click", (event) => {
			stopEvent(event)
			if (!isEnabled() || Date.now() - this.lastTouchActionAt < 500) return
			options.onActivate()
		})
		options.hit.on("tap", (event) => {
			stopEvent(event)
			if (!isEnabled()) return
			this.lastTouchActionAt = Date.now()
			options.onActivate()
		})
		syncState()
		return syncState
	}

	private beginScrub(
		event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
		playerGroup: Konva.Group,
		track: Konva.Rect,
	): void {
		event.cancelBubble = true
		event.evt?.stopPropagation()
		event.evt?.preventDefault()
		if (!this.canUseControls({ type: "scrub-progress" })) return
		const stage = playerGroup.getStage()
		if (!stage) return
		this.finishScrub()
		this.scrubStage = stage
		this.scrubNodeWasDraggable = this.node?.draggable() ?? false
		this.scrubStageWasDraggable = stage.draggable()
		this.node?.draggable(false)
		stage.draggable(false)
		this.setProgressInteractionState("active")
		this.canvas.cursorManager?.setTemporary("grabbing")

		const update = () => this.queueScrubFromPointer(playerGroup, track)
		const finish = () => {
			if (!this.scrubStage) return
			update()
			this.finishScrub()
		}
		const cancel = () => {
			if (!this.scrubStage) return
			this.cancelScrub()
		}
		stage.on("mousemove.audioScrub touchmove.audioScrub", update)
		stage.on("mouseup.audioScrub touchend.audioScrub", finish)
		stage.on("touchcancel.audioScrub", cancel)
		this.bindScrubWindowListeners(stage, playerGroup, track)
		update()
	}

	private seekProgressAtPointer(
		event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
		playerGroup: Konva.Group,
		track: Konva.Rect,
	): void {
		event.cancelBubble = true
		event.evt?.stopPropagation()
		event.evt?.preventDefault()
		if (!this.canUseControls({ type: "seek-progress" })) return
		const pointer = playerGroup.getRelativePointerPosition()
		if (!pointer || track.width() <= 0) return
		const progress = clampProgress((pointer.x - track.x()) / track.width())
		this.syncProgressNodes(progress)
		this.syncTimeNode()
		this.canvas.audioPlaybackManager.seek(this.data.id, progress)
	}

	private queueScrubFromPointer(playerGroup: Konva.Group, track: Konva.Rect): void {
		const pointer = playerGroup.getRelativePointerPosition()
		if (!pointer || track.width() <= 0) return
		this.pendingScrubProgress = clampProgress((pointer.x - track.x()) / track.width())
		this.syncProgressNodes(this.pendingScrubProgress)
		this.syncTimeNode()
	}

	private flushScrubProgress(): void {
		const progress = this.pendingScrubProgress
		this.pendingScrubProgress = null
		if (
			progress === null ||
			!(this.canvas.permissionManager?.can?.("interaction.playback") ?? true)
		)
			return
		this.canvas.audioPlaybackManager.seek(this.data.id, progress)
	}

	private finishScrub(): void {
		this.flushScrubProgress()
		this.cleanupScrubInteraction()
	}

	private cancelScrub(): void {
		this.pendingScrubProgress = null
		this.syncProgressNodes(this.resolveDisplayedProgress())
		this.syncTimeNode()
		this.syncWaveformNodes()
		this.cleanupScrubInteraction()
	}

	private cleanupScrubInteraction(): void {
		const hadActiveScrub = !!this.scrubStage
		this.scrubWindowCleanup?.()
		this.scrubWindowCleanup = undefined
		if (this.scrubStage) {
			this.scrubStage.off(".audioScrub")
			this.scrubStage.draggable(this.scrubStageWasDraggable)
		}
		if (hadActiveScrub) this.node?.draggable(this.scrubNodeWasDraggable)
		this.scrubStage = undefined
		this.canvas.cursorManager?.restoreToolCursor()
		this.setProgressInteractionState("idle")
	}

	private bindScrubWindowListeners(
		stage: Konva.Stage,
		playerGroup: Konva.Group,
		track: Konva.Rect,
	): void {
		if (typeof window === "undefined") return

		const handleMove = (event: Event) => {
			if (this.scrubStage !== stage) return
			stage.setPointersPositions(event)
			this.queueScrubFromPointer(playerGroup, track)
		}
		const handleFinish = () => {
			if (this.scrubStage !== stage) return
			this.finishScrub()
		}
		const handleCancel = () => {
			if (this.scrubStage !== stage) return
			this.cancelScrub()
		}
		const capture = true
		window.addEventListener("mousemove", handleMove, capture)
		window.addEventListener("touchmove", handleMove, capture)
		window.addEventListener("pointermove", handleMove, capture)
		window.addEventListener("mouseup", handleFinish, capture)
		window.addEventListener("touchend", handleFinish, capture)
		window.addEventListener("pointerup", handleFinish, capture)
		window.addEventListener("touchcancel", handleCancel, capture)
		window.addEventListener("pointercancel", handleCancel, capture)
		this.scrubWindowCleanup = () => {
			window.removeEventListener("mousemove", handleMove, capture)
			window.removeEventListener("touchmove", handleMove, capture)
			window.removeEventListener("pointermove", handleMove, capture)
			window.removeEventListener("mouseup", handleFinish, capture)
			window.removeEventListener("touchend", handleFinish, capture)
			window.removeEventListener("pointerup", handleFinish, capture)
			window.removeEventListener("touchcancel", handleCancel, capture)
			window.removeEventListener("pointercancel", handleCancel, capture)
		}
	}

	private seekBy(deltaSeconds: number): void {
		const src = this.getAudioSrc()
		if (!src) return
		if (deltaSeconds < 0 && !this.canSeekBackward()) return
		if (deltaSeconds > 0 && !this.canSeekForward()) return
		void this.canvas.audioPlaybackManager.seekBy(this.data.id, src, deltaSeconds)
	}

	private canSeekBackward(): boolean {
		const { currentTime, duration, error, loading } = this.playbackSnapshot
		return (
			!!this.getAudioSrc() &&
			!error &&
			!loading &&
			Number.isFinite(duration) &&
			duration > 0 &&
			Number.isFinite(currentTime) &&
			currentTime > 0.05
		)
	}

	private canSeekForward(): boolean {
		const { currentTime, duration, error, loading } = this.playbackSnapshot
		return (
			!!this.getAudioSrc() &&
			!error &&
			!loading &&
			Number.isFinite(duration) &&
			duration > 0 &&
			Number.isFinite(currentTime) &&
			currentTime < duration - 0.05
		)
	}

	private syncRenderLayout(width: number, height: number): void {
		if (!(this.node instanceof Konva.Group)) return
		const group = this.node
		group.size({ width, height })
		const hitArea = group.findOne(".hit-area") as Konva.Rect | undefined
		hitArea?.size({ width, height })
		hitArea?.cornerRadius(AUDIO_CONFIG.CORNER_RADIUS)
		const background = group.findOne(`.${NODE_NAMES.background}`) as Konva.Rect | undefined
		background?.size({ width, height })
		background?.cornerRadius(AUDIO_CONFIG.CORNER_RADIUS)
		this.syncStatusPlaceholderLayout(width, height)

		const playerGroup = group.findOne(`.${NODE_NAMES.player}`) as Konva.Group | undefined
		if (!playerGroup) return
		const layout = resolveAudioPlayerLayout(width, height)
		this.playerLayout = layout
		// The player is laid out entirely in element coordinates. Viewport zoom now
		// scales the whole card uniformly, so waveform density and visible range only
		// change when the audio element itself is resized.
		this.waveformBarCount = resolveWaveformBarCount(
			layout.waveform.width,
			layout.waveformStyle.barPitch,
		)
		playerGroup.scale({ x: 1, y: 1 })
		playerGroup.position({ x: 0, y: 0 })
		playerGroup.size({ width, height })

		const waveform = playerGroup.findOne(`.${NODE_NAMES.waveform}`) as Konva.Shape | undefined
		waveform?.setAttrs(layout.waveform)
		const progressTrack = playerGroup.findOne(`.${NODE_NAMES.progressTrack}`) as
			Konva.Rect | undefined
		const progressFill = playerGroup.findOne(`.${NODE_NAMES.progressFill}`) as
			Konva.Rect | undefined
		const progressThumb = playerGroup.findOne(`.${NODE_NAMES.progressThumb}`) as
			Konva.Circle | undefined
		const progressThumbHit = playerGroup.findOne(`.${NODE_NAMES.progressThumbHit}`) as
			Konva.Circle | undefined
		const progressHit = playerGroup.findOne(`.${NODE_NAMES.progressHit}`) as
			Konva.Rect | undefined
		const timeText = playerGroup.findOne(`.${NODE_NAMES.time}`) as Konva.Text | undefined
		const errorText = playerGroup.findOne(`.${NODE_NAMES.error}`) as Konva.Text | undefined
		progressTrack?.setAttrs({
			...layout.progress,
			cornerRadius: layout.progress.height / 2,
		})
		progressFill?.setAttrs({
			x: layout.progress.x,
			y: layout.progress.y,
			height: layout.progress.height,
			cornerRadius: layout.progress.height / 2,
		})
		progressThumb?.setAttrs({
			y: layout.progress.y + layout.progress.height / 2,
			radius: layout.progressThumbRadius,
		})
		if (progressThumbHit) {
			progressThumbHit.y(layout.progress.y + layout.progress.height / 2)
			this.setInteractionCircleHitBaseRadius(progressThumbHit, layout.progressThumbRadius)
		}
		if (progressHit) {
			this.setInteractionHitBaseBounds(progressHit, {
				x: layout.progressHit.x - layout.progressThumbRadius,
				y: layout.progressHit.y,
				width: layout.progressHit.width + layout.progressThumbRadius * 2,
				height: layout.progressHit.height,
				expandX: false,
			})
		}
		timeText?.setAttrs(layout.time)
		errorText?.setAttrs(layout.error)
		const progress = this.resolveDisplayedProgress()
		this.syncProgressNodes(progress)

		const operationGroup = playerGroup.findOne(`.${NODE_NAMES.operationGroup}`) as
			Konva.Group | undefined
		operationGroup?.setAttrs({
			x: layout.operations.x,
			y: layout.operations.y,
			width: layout.operations.width,
			height: layout.operations.height,
		})
		const operationButtons = [
			playerGroup.findOne(`.${NODE_NAMES.backButton}`),
			playerGroup.findOne(`.${NODE_NAMES.playButton}`),
			playerGroup.findOne(`.${NODE_NAMES.forwardButton}`),
		].filter((node): node is Konva.Group => node instanceof Konva.Group)
		operationButtons.forEach((button, index) => {
			this.syncOperationButtonLayout(
				button,
				layout.operations.buttonSize,
				layout.operations.gap,
			)
			button.position({
				x: index * (layout.operations.buttonSize + layout.operations.gap),
				y: 0,
			})
		})

		this.syncInteractionHitTargets()
		this.syncPlaybackNodes()
		group.getLayer()?.batchDraw()
	}

	private syncStatusPlaceholderLayout(width: number, height: number): void {
		if (!(this.node instanceof Konva.Group)) return
		const placeholder = this.node.findOne(`.${NODE_NAMES.statusPlaceholder}`) as
			Konva.Group | undefined
		if (!placeholder) return
		const state = this.renderedState ?? "preparing"
		const layout = resolveAudioStatusPlaceholderLayout(width, height, {
			showSpinner: state === "uploading" || state === "preparing",
		})
		placeholder.setAttrs(layout.group)
		const spinner = placeholder.findOne(`.${NODE_NAMES.statusSpinner}`) as
			Konva.Shape | undefined
		spinner?.setAttrs({
			x: layout.spinner.x,
			y: layout.spinner.y,
			audioStatusSpinnerRadius: layout.spinner.radius,
			audioStatusSpinnerStrokeWidth: layout.spinner.strokeWidth,
		})
		const text = placeholder.findOne(`.${NODE_NAMES.statusText}`) as Konva.Text | undefined
		text?.setAttrs(layout.text)
	}

	private syncOperationButtonLayout(button: Konva.Group, buttonSize: number, gap: number): void {
		button.size({ width: buttonSize, height: buttonSize })
		const hit = button.findOne(`.${NODE_NAMES.controlHit}`) as Konva.Rect | undefined
		if (hit) {
			this.setInteractionHitBaseBounds(hit, {
				x: 0,
				y: 0,
				width: buttonSize,
				height: buttonSize,
				maxWidth: buttonSize + gap,
			})
		}

		const visual = button
			.getChildren()
			.find((candidate) => candidate instanceof Konva.Group) as Konva.Group | undefined
		visual?.position({ x: buttonSize / 2, y: buttonSize / 2 })
		const background = visual
			?.getChildren()
			.find((candidate) => candidate instanceof Konva.Circle) as Konva.Circle | undefined
		background?.radius(buttonSize / 2)

		const iconScale = buttonSize / AUDIO_PLAYER_DESIGN.operationIconReferenceButtonSize
		button.findOne(`.${NODE_NAMES.playTriangle}`)?.scale({ x: iconScale, y: iconScale })
		button.findOne(`.${NODE_NAMES.pauseBars}`)?.scale({ x: iconScale, y: iconScale })
		button.findOne(`.${NODE_NAMES.backButtonIcon}`)?.scale({ x: iconScale, y: iconScale })
		button.findOne(`.${NODE_NAMES.forwardButtonIcon}`)?.scale({ x: iconScale, y: iconScale })
	}

	private setInteractionHitBaseBounds(hit: Konva.Rect, bounds: AudioControlHitBounds): void {
		hit.setAttr("audioControlBaseHitBounds", bounds)
		hit.setAttrs({
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
		})
	}

	private setInteractionCircleHitBaseRadius(hit: Konva.Circle, radius: number): void {
		hit.setAttr("audioControlBaseHitRadius", radius)
		hit.radius(radius)
	}

	private syncInteractionHitTargets(): void {
		if (!(this.node instanceof Konva.Group)) return
		const coarsePointer = this.canvas.deviceInfo?.input?.coarsePointer ?? false
		const minimumScreenSize = coarsePointer
			? AUDIO_CONFIG.COARSE_POINTER_MIN_HIT_SIZE
			: AUDIO_CONFIG.DESKTOP_MIN_HIT_SIZE
		const nodeScale = this.node.getAbsoluteScale()
		const policy = resolveAudioControlInteractionPolicy({
			screenWidth: this.node.width() * Math.abs(nodeScale.x),
			screenHeight: this.node.height() * Math.abs(nodeScale.y),
			coarsePointer,
		})
		this.controlInteractionMode = policy.mode
		this.controlsEnabled = policy.controlsEnabled
		moveControlHitsToTop(this.node, `.${NODE_NAMES.controlHit}`)

		this.node.find(`.${NODE_NAMES.controlHit}`).forEach((candidate) => {
			candidate.listening(this.controlsEnabled)

			if (candidate instanceof Konva.Circle) {
				const baseRadius = candidate.getAttr("audioControlBaseHitRadius") as
					number | undefined
				if (baseRadius === undefined) return
				syncControlHitCircle(candidate, baseRadius, minimumScreenSize)
				return
			}

			if (!(candidate instanceof Konva.Rect)) return
			const baseBounds = candidate.getAttr("audioControlBaseHitBounds") as
				AudioControlHitBounds | undefined
			if (!baseBounds) return
			const minimumScreenHeight = candidate.hasName(NODE_NAMES.progressHit)
				? policy.progressMinimumScreenHeight
				: minimumScreenSize
			syncControlHitRect(candidate, baseBounds, minimumScreenSize, minimumScreenHeight)
		})
	}

	private syncPlaybackNodes(): void {
		if (!(this.node instanceof Konva.Group)) return
		const { duration, paused, ended, error } = this.playbackSnapshot
		const isPlaying = !paused && !ended
		this.node.findOne(`.${NODE_NAMES.playTriangle}`)?.visible(!isPlaying)
		this.node.findOne(`.${NODE_NAMES.pauseBars}`)?.visible(isPlaying)

		const progress = this.resolveDisplayedProgress()
		this.syncProgressNodes(progress)
		this.syncTimeNode()
		const errorText = this.node.findOne(`.${NODE_NAMES.error}`) as Konva.Text | undefined
		if (errorText) {
			errorText.text(error || this.resourceError ? this.getAudioLoadErrorText() : "")
		}
		this.backButtonStateSync?.()
		this.forwardButtonStateSync?.()
		this.syncWaveformNodes()
		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "AudioElement",
			reason: "playback-state",
		})
	}

	private syncWaveformNodes(): void {
		this.node?.findOne(`.${NODE_NAMES.waveform}`)?.getLayer()?.batchDraw()
	}

	private resolveDisplayedProgress(): number {
		if (this.pendingScrubProgress !== null) return this.pendingScrubProgress
		const { currentTime, duration } = this.playbackSnapshot
		return duration > 0 ? clampProgress(currentTime / duration) : 0
	}

	private resolveDisplayedCurrentTime(): number {
		const { currentTime, duration } = this.playbackSnapshot
		if (this.pendingScrubProgress !== null && duration > 0) {
			return duration * this.pendingScrubProgress
		}
		return currentTime
	}

	private syncTimeNode(): void {
		if (!(this.node instanceof Konva.Group)) return
		const { duration } = this.playbackSnapshot
		const timeText = this.node.findOne(`.${NODE_NAMES.time}`) as Konva.Text | undefined
		timeText?.text(
			`${formatTime(this.resolveDisplayedCurrentTime())} / ${formatTime(duration)}`,
		)
	}

	private syncProgressNodes(progress: number): void {
		if (!(this.node instanceof Konva.Group)) return
		const track = this.node.findOne(`.${NODE_NAMES.progressTrack}`) as Konva.Rect | undefined
		const fill = this.node.findOne(`.${NODE_NAMES.progressFill}`) as Konva.Rect | undefined
		const thumb = this.node.findOne(`.${NODE_NAMES.progressThumb}`) as Konva.Circle | undefined
		const thumbHit = this.node.findOne(`.${NODE_NAMES.progressThumbHit}`) as
			Konva.Circle | undefined
		if (!track) return
		const normalizedProgress = clampProgress(progress)
		fill?.width(track.width() * normalizedProgress)
		const thumbPosition = {
			x: track.x() + track.width() * normalizedProgress,
			y: track.y() + track.height() / 2,
		}
		thumb?.position(thumbPosition)
		thumbHit?.position(thumbPosition)
		track.getLayer()?.batchDraw()
	}

	private setProgressInteractionState(state: InteractiveState): void {
		if (!(this.node instanceof Konva.Group)) return
		const track = this.node.findOne(`.${NODE_NAMES.progressTrack}`) as Konva.Rect | undefined
		const thumb = this.node.findOne(`.${NODE_NAMES.progressThumb}`) as Konva.Circle | undefined
		track?.fill(state === "idle" ? AUDIO_CONFIG.TRACK : INTERACTION_COLORS.progressTrackHover)
		thumb?.fill(AUDIO_CONFIG.PROGRESS)
		const thumbScale = state === "active" ? 1.25 : state === "hover" ? 1.15 : 1
		thumb?.scale({ x: thumbScale, y: thumbScale })
		this.node.getLayer()?.batchDraw()
	}

	private subscribeWaveform(path?: string): void {
		this.waveformUnsubscribe()
		this.waveformSnapshot = { status: "idle", peaks: null }
		this.waveformNormalization = { low: 0, range: 1 }
		if (!path || !this.canvas.audioWaveformManager?.subscribe) return
		this.waveformUnsubscribe = this.canvas.audioWaveformManager.subscribe(path, (snapshot) => {
			this.waveformSnapshot = snapshot
			this.waveformNormalization = resolveWaveformNormalization(snapshot.peaks)
			if (snapshot.status === "ready" || snapshot.status === "error") {
				this.retryingPreparation = false
			}
			this.syncRenderState()
		})
	}

	private canUseControls(action: AudioControlAction): boolean {
		return this.elementControlInteractionPolicy.canInteract(action)
	}
}
