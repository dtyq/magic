import Konva from "konva"
import imageBackgroundLoading from "../../../assets/image/image-background-loading.jpg"
import imageBackgroundUnselected from "../../../assets/image/image-background-unselected.jpg"
import imageIconError from "../../../assets/image/image-icon-error.png"
import { VIDEO_CONFIG, VIDEO_PLACEHOLDER } from "../elements/VideoElement.config"
import { layoutLucideSolidPlayPath } from "../elements/videoPlayIconPath"
import { RenderUtils } from "../../utils/RenderUtils"
import { ImageStaticLoader } from "../../utils/ImageStaticLoader"
import type { Canvas } from "../../Canvas"
import type { LoadedVideoMetadata, VideoPosterSource } from "../../utils/VideoResourceManager"
import { VideoMediaState } from "./VideoMediaState"
import { VideoPlaybackController } from "./VideoPlaybackController"

interface CreatePlayerNodeOptions {
	showLoadingOverlay?: boolean
	onFullscreenClick?: () => void
	onPlayButtonClick?: () => void
	onContentDoubleClick?: () => void
}

interface PlayerNodeRefs {
	canvas: Canvas
	group: Konva.Group
	previewNode: Konva.Image
	hitNode: Konva.Rect
	playButtonGroup: Konva.Group
	playButtonBg: Konva.Circle
	playTriangle: Konva.Path
	pauseBarsGroup: Konva.Group
	pauseBarLeft: Konva.Rect
	pauseBarRight: Konva.Rect
	controlsGroup: Konva.Group
	progressGroup: Konva.Group
	progressBackground: Konva.Rect
	progressText: Konva.Text
	fullscreenButtonGroup: Konva.Group
	fullscreenButtonBg: Konva.Rect
	fullscreenIcon: Konva.Group
	isHovering: boolean
	bufferingOverlay: Konva.Group
	bufferingSpinnerRoot: Konva.Group
	bufferingSpinnerShape: Konva.Shape
}

/**
 * 视频 Konva 渲染：占位/生成中 UI、首帧海报、内联播放器控件与缓冲遮罩；
 * 通过 VideoPlaybackController / VideoMediaState 与 HTMLVideoElement 交互。
 */
export class VideoRenderer {
	private imageLoader = new ImageStaticLoader()
	private playback = new VideoPlaybackController()
	private mediaState = new VideoMediaState()
	private playerUnsub?: () => void
	private playerRefs?: PlayerNodeRefs
	private placeholderTriangleNode?: Konva.Path
	private placeholderTriangleGroup?: Konva.Group
	private previewVideo?: HTMLVideoElement
	private posterSource?: VideoPosterSource
	private previewMetadata?: LoadedVideoMetadata
	private placeholderContentGroup?: Konva.Group
	private placeholderLayout?: {
		textWidth: number
		textHeight: number
		backgroundWidth: number
		backgroundHeight: number
		withBackground: boolean
	}
	private placeholderUsesCenteredLayout = false
	private renderToken = 0
	private forceLoadingOverlay = false

	public destroy(): void {
		this.clearPlayerUiSubscription()
		this.detachPlayback()
		this.clearPoster()
		this.resetTransientContent()
	}

	public resetPreview(): void {
		this.forceLoadingOverlay = false
		this.detachPlayback()
		this.clearPoster()
	}

	private clearPoster(): void {
		this.posterSource = undefined
		this.previewMetadata = undefined
	}

	public detachPlayback(): void {
		this.clearPlayerUiSubscription()
		this.playerRefs = undefined
		this.mediaState.detach()
		this.playback.detach()
		this.previewVideo = undefined
		this.forceLoadingOverlay = false
	}

	private clearPlayerUiSubscription(): void {
		this.playerUnsub?.()
		this.playerUnsub = undefined
	}

	public resetTransientContent(): void {
		this.placeholderContentGroup = undefined
		this.placeholderLayout = undefined
		this.placeholderUsesCenteredLayout = false
		this.placeholderTriangleNode = undefined
		this.placeholderTriangleGroup = undefined
		this.renderToken += 1
	}

	public hasPreview(): boolean {
		return !!this.previewVideo || !!this.posterSource
	}

	public getPreviewSource(): CanvasImageSource | undefined {
		return this.previewVideo ?? this.posterSource
	}

	public play(): void {
		void this.playback.play()
	}

	public pause(): void {
		this.playback.pause()
	}

	public toggle(): void {
		this.playback.toggle()
	}

	public loadPoster(poster: VideoPosterSource, metadata: LoadedVideoMetadata): void {
		this.posterSource = poster
		this.previewMetadata = metadata
	}

	public attachPlayback(video: HTMLVideoElement): void {
		if (this.previewVideo === video) {
			return
		}

		this.clearPlayerUiSubscription()
		this.playerRefs = undefined
		this.mediaState.detach()
		this.playback.detach()
		this.previewVideo = video
		this.forceLoadingOverlay = false
		this.mediaState.attach(video)
		this.playback.attach(video)
	}

	public hasAttachedPlayback(): boolean {
		return !!this.previewVideo
	}

	/**
	 * 资源就绪后的播放器节点：Konva.Image + 暂停时三角 + 选择工具下点击切换播放。
	 */
	public createPlayerNode(
		width: number,
		height: number,
		canvas: Canvas,
		options?: CreatePlayerNodeOptions,
	): Konva.Group | null {
		const imageSource = this.previewVideo ?? this.posterSource
		if (!imageSource) {
			return null
		}

		const video = this.previewVideo
		this.forceLoadingOverlay = options?.showLoadingOverlay ?? false

		this.clearPlayerUiSubscription()

		const group = new Konva.Group({
			width,
			height,
			name: "video-player-group",
		})

		const previewNode = new Konva.Image({
			image: imageSource,
			width,
			height,
			x: 0,
			y: 0,
			cornerRadius: VIDEO_CONFIG.CORNER_RADIUS,
			listening: false,
		})

		const nudgeLayerDraw = () => {
			previewNode.getLayer()?.batchDraw()
		}
		if (video) {
			// Konva.Image 对 video 不会订阅有效重绘信号（与 img 的 load 不同），首帧解码后需主动刷层。
			video.addEventListener("loadeddata", nudgeLayerDraw)
			video.addEventListener("seeked", nudgeLayerDraw)
		}

		const iconSize = VIDEO_CONFIG.PLAYER_PLAY_ICON_SIZE
		const initialSnap = video ? this.mediaState.getSnapshot() : this.getPosterSnapshot()
		const playButtonGroup = new Konva.Group({
			x: width / 2,
			y: height / 2,
			listening: true,
			name: "video-player-play-button",
			visible: initialSnap.paused || initialSnap.ended,
		})
		const playButtonBg = new Konva.Circle({
			x: 0,
			y: 0,
			radius: this.getPlayButtonRadius(iconSize),
			fill: "rgba(15, 23, 42, 0.34)",
			stroke: "rgba(255, 255, 255, 0.22)",
			strokeWidth: 1,
			listening: true,
			shadowColor: "rgba(0, 0, 0, 0.18)",
			shadowBlur: 12,
			shadowOffsetY: 3,
		})
		const triangle = new Konva.Path({
			fill: VIDEO_CONFIG.PLAY_ICON_FILL,
			opacity: 0.92,
			listening: false,
			name: "video-player-triangle",
		})
		layoutLucideSolidPlayPath(triangle, 0, 0, iconSize)
		const pauseBarsGroup = new Konva.Group({
			listening: false,
			name: "video-player-pause-bars",
			visible: false,
			opacity: 0.92,
		})
		const pauseBarLeft = new Konva.Rect({
			fill: VIDEO_CONFIG.PLAY_ICON_FILL,
			cornerRadius: 999,
			listening: false,
		})
		const pauseBarRight = new Konva.Rect({
			fill: VIDEO_CONFIG.PLAY_ICON_FILL,
			cornerRadius: 999,
			listening: false,
		})
		pauseBarsGroup.add(pauseBarLeft)
		pauseBarsGroup.add(pauseBarRight)
		playButtonGroup.add(playButtonBg)
		playButtonGroup.add(triangle)
		playButtonGroup.add(pauseBarsGroup)

		const bufferingSpinnerShape = new Konva.Shape({
			listening: false,
			name: "video-player-buffer-spinner",
			sceneFunc(context, shape) {
				const r = shape.getAttr("_spinnerR") as number | undefined
				const sw = shape.getAttr("_spinnerSw") as number | undefined
				if (r === undefined || sw === undefined || r <= 0 || sw <= 0) {
					return
				}
				context.beginPath()
				context.arc(0, 0, r, 0, Math.PI * 2)
				context.strokeStyle = "rgba(255, 255, 255, 0.35)"
				context.lineWidth = sw
				context.stroke()

				context.beginPath()
				context.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI / 2)
				context.strokeStyle = "#ffffff"
				context.lineWidth = sw
				context.lineCap = "round"
				context.stroke()
			},
		})
		this.applyBufferingSpinnerMetrics(bufferingSpinnerShape, iconSize)

		const bufferingSpinnerRoot = new Konva.Group({
			listening: false,
			name: "video-player-buffer-spin-root",
		})
		bufferingSpinnerRoot.add(bufferingSpinnerShape)

		const bufferingOverlay = new Konva.Group({
			x: width / 2,
			y: height / 2,
			listening: false,
			visible: false,
			name: "video-player-buffer-overlay",
		})
		bufferingOverlay.add(bufferingSpinnerRoot)

		const hit = new Konva.Rect({
			x: 0,
			y: 0,
			width,
			height,
			fill: "transparent",
			cornerRadius: VIDEO_CONFIG.CORNER_RADIUS,
			listening: true,
			name: "video-player-hit",
		})

		const controlsGroup = new Konva.Group({
			visible: true,
			name: "video-player-controls",
		})

		const progressGroup = new Konva.Group({
			listening: false,
			name: "video-player-progress",
		})
		const progressBackground = new Konva.Rect({
			fill: VIDEO_CONFIG.CONTROL_TEXT_BG,
			cornerRadius: VIDEO_CONFIG.CORNER_RADIUS,
			listening: false,
		})
		const progressText = new Konva.Text({
			text: "",
			fontSize: VIDEO_CONFIG.CONTROL_TEXT_FONT_SIZE,
			fontFamily: VIDEO_CONFIG.CONTROL_TEXT_FONT_FAMILY,
			fill: VIDEO_CONFIG.CONTROL_TEXT_COLOR,
			listening: false,
		})
		progressGroup.add(progressBackground)
		progressGroup.add(progressText)

		const fullscreenButtonGroup = new Konva.Group({
			listening: true,
			name: "video-player-fullscreen-button",
		})
		const fullscreenButtonBg = new Konva.Rect({
			width: VIDEO_CONFIG.CONTROL_BUTTON_SIZE,
			height: VIDEO_CONFIG.CONTROL_BUTTON_SIZE,
			cornerRadius: VIDEO_CONFIG.CORNER_RADIUS,
			fill: VIDEO_CONFIG.CONTROL_BUTTON_BG,
			listening: true,
		})
		const fullscreenIcon = this.createFullscreenIcon()
		fullscreenButtonGroup.add(fullscreenButtonBg)
		fullscreenButtonGroup.add(fullscreenIcon)

		controlsGroup.add(progressGroup)
		controlsGroup.add(fullscreenButtonGroup)

		const showControls = () => {
			if (!this.playerRefs || !canvas.permissionManager.canShowTransientElementAffordance()) {
				return
			}
			const snapshot = this.mediaState.getSnapshot()
			this.playerRefs.isHovering = true
			this.updateControlsVisibility(snapshot)
			group.getLayer()?.batchDraw()
		}

		const hideControls = () => {
			if (!this.playerRefs) {
				return
			}
			const snapshot = this.mediaState.getSnapshot()
			this.playerRefs.isHovering = false
			this.resetControlHoverStyles(this.playerRefs)
			this.updateControlsVisibility(snapshot)
			if (canvas.permissionManager.canUseSelectionToolAffordance()) {
				canvas.cursorManager.restoreToolCursor()
			}
			group.getLayer()?.batchDraw()
		}

		const handlePointerMove = () => {
			if (
				!this.playerRefs ||
				!this.playerRefs.isHovering ||
				!canvas.permissionManager.canShowTransientElementAffordance()
			) {
				return
			}
			const snapshot = this.mediaState.getSnapshot()
			const controlsWereHidden = !this.playerRefs.isHovering
			this.playerRefs.isHovering = true
			this.updateControlsVisibility(snapshot)
			if (controlsWereHidden) {
				group.getLayer()?.batchDraw()
			}
		}

		const handleFullscreenMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
			e.cancelBubble = true
			if (e.evt) {
				e.evt.stopPropagation()
				e.evt.stopImmediatePropagation()
			}
			if (!canvas.permissionManager.canUseSelectionToolAffordance()) {
				return
			}
			options?.onFullscreenClick?.()
		}

		fullscreenButtonBg.on("mousedown", handleFullscreenMouseDown)
		fullscreenButtonBg.on("click tap", (e) => {
			e.cancelBubble = true
			if (e.evt) {
				e.evt.stopPropagation()
			}
		})
		fullscreenButtonBg.on("mouseenter", () => {
			if (!canvas.permissionManager.canUseSelectionToolAffordance()) {
				return
			}
			fullscreenButtonBg.fill(VIDEO_CONFIG.CONTROL_BUTTON_BG_HOVER)
			canvas.cursorManager.setTemporary("pointer")
			group.getLayer()?.batchDraw()
		})
		fullscreenButtonBg.on("mouseleave", () => {
			if (!canvas.permissionManager.canUseSelectionToolAffordance()) {
				return
			}
			fullscreenButtonBg.fill(VIDEO_CONFIG.CONTROL_BUTTON_BG)
			canvas.cursorManager.restoreToolCursor()
			group.getLayer()?.batchDraw()
		})
		playButtonGroup.on("mouseenter", () => {
			if (
				!canvas.permissionManager.canUseSelectionToolAffordance() ||
				!playButtonGroup.visible()
			) {
				return
			}
			this.updatePlayButtonHoverState(playButtonBg, triangle, pauseBarsGroup, true)
			canvas.cursorManager.setTemporary("pointer")
			group.getLayer()?.batchDraw()
		})
		playButtonGroup.on("mouseleave", () => {
			if (!canvas.permissionManager.canUseSelectionToolAffordance()) {
				return
			}
			this.updatePlayButtonHoverState(playButtonBg, triangle, pauseBarsGroup, false)
			canvas.cursorManager.restoreToolCursor()
			group.getLayer()?.batchDraw()
		})

		// 禁止在 mousedown 上截断冒泡，否则 stage 上的选择工具无法选中/拖拽。
		// 中心按钮统一负责播放/暂停；双击画面区域仍可切换播放状态。
		playButtonGroup.on("click tap", () => {
			options?.onPlayButtonClick?.()
		})
		hit.on("dblclick dbltap", () => {
			options?.onContentDoubleClick?.()
		})
		group.on("mouseenter", showControls)
		group.on("mouseleave", hideControls)
		group.on("mousemove", handlePointerMove)
		group.on("dragmove", handlePointerMove)
		group.on("dragstart", hideControls)

		group.add(previewNode)
		group.add(bufferingOverlay)
		group.add(hit)
		group.add(playButtonGroup)
		group.add(controlsGroup)

		this.playerRefs = {
			canvas,
			group,
			previewNode,
			hitNode: hit,
			playButtonGroup,
			playButtonBg,
			playTriangle: triangle,
			pauseBarsGroup,
			pauseBarLeft,
			pauseBarRight,
			controlsGroup,
			progressGroup,
			progressBackground,
			progressText,
			fullscreenButtonGroup,
			fullscreenButtonBg,
			fullscreenIcon,
			isHovering: false,
			bufferingOverlay,
			bufferingSpinnerRoot,
			bufferingSpinnerShape,
		}
		this.updatePlayerUi(initialSnap)
		this.updatePlayerLayout(group, width, height)

		let rafId = 0
		let lastSpinnerTs = 0
		const draw = () => group.getLayer()?.batchDraw()
		const stopRaf = () => {
			if (rafId !== 0) {
				cancelAnimationFrame(rafId)
				rafId = 0
			}
			lastSpinnerTs = 0
		}
		const periodMs = VIDEO_CONFIG.BUFFER_SPINNER_PERIOD_MS
		const rafLoop = (ts: number) => {
			const snap = this.mediaState.getSnapshot()
			const showLoadingOverlay = snap.isBuffering || this.forceLoadingOverlay
			if (showLoadingOverlay && this.playerRefs?.bufferingSpinnerRoot) {
				if (lastSpinnerTs > 0) {
					const dt = ts - lastSpinnerTs
					const root = this.playerRefs.bufferingSpinnerRoot
					root.rotation((root.rotation() + (dt / periodMs) * 360) % 360)
				}
				lastSpinnerTs = ts
			} else {
				lastSpinnerTs = 0
				this.playerRefs?.bufferingSpinnerRoot?.rotation(0)
			}

			draw()
			const v = this.previewVideo
			if (this.forceLoadingOverlay || (v && !v.paused && !v.ended)) {
				rafId = requestAnimationFrame(rafLoop)
			} else {
				rafId = 0
			}
		}

		let unsubMedia: (() => void) | undefined
		if (video) {
			unsubMedia = this.mediaState.subscribe(({ reason, snapshot }) => {
				this.updatePlayerUi(snapshot)

				const playing = !snapshot.paused && !snapshot.ended
				if (this.forceLoadingOverlay || playing) {
					if (rafId === 0) {
						rafId = requestAnimationFrame(rafLoop)
					}
				} else {
					stopRaf()
				}

				if (
					reason === "metadata" ||
					reason === "buffer" ||
					reason === "error" ||
					reason === "playback" ||
					reason === "stall" ||
					(reason === "time" && !playing)
				) {
					draw()
				}
			})
		}

		if (this.forceLoadingOverlay && rafId === 0) {
			rafId = requestAnimationFrame(rafLoop)
		}

		this.playerUnsub = () => {
			stopRaf()
			unsubMedia?.()
			video?.removeEventListener("loadeddata", nudgeLayerDraw)
			video?.removeEventListener("seeked", nudgeLayerDraw)
		}

		return group
	}

	private getPosterSnapshot(): ReturnType<VideoMediaState["getSnapshot"]> {
		return {
			duration: this.previewMetadata?.duration ?? 0,
			currentTime: 0,
			videoWidth: this.previewMetadata?.videoWidth ?? 0,
			videoHeight: this.previewMetadata?.videoHeight ?? 0,
			readyState: this.posterSource ? HTMLMediaElement.HAVE_CURRENT_DATA : 0,
			paused: true,
			ended: false,
			playbackRate: 1,
			buffered: [],
			errorCode: null,
			isBuffering: false,
		}
	}

	public updatePlayerLayout(parentGroup: Konva.Group, width: number, height: number): void {
		if (!this.playerRefs) {
			return
		}

		const {
			group,
			previewNode,
			hitNode,
			playButtonGroup,
			playButtonBg,
			playTriangle,
			pauseBarLeft,
			pauseBarRight,
			progressGroup,
			progressBackground,
			fullscreenButtonGroup,
			fullscreenIcon,
			bufferingOverlay,
			bufferingSpinnerShape,
		} = this.playerRefs

		group.width(width)
		group.height(height)
		previewNode.width(width)
		previewNode.height(height)
		hitNode.width(width)
		hitNode.height(height)

		const iconSize = VIDEO_CONFIG.PLAYER_PLAY_ICON_SIZE
		const inverseScale = RenderUtils.getInverseScale(parentGroup)
		bufferingOverlay.position({ x: width / 2, y: height / 2 })
		bufferingOverlay.scale(inverseScale)
		this.applyBufferingSpinnerMetrics(bufferingSpinnerShape, iconSize)

		playButtonGroup.position({
			x: width / 2,
			y: height / 2,
		})
		playButtonGroup.scale(inverseScale)
		playButtonBg.radius(this.getPlayButtonRadius(iconSize))
		layoutLucideSolidPlayPath(playTriangle, 0, 0, iconSize)
		this.updatePauseBarsLayout(pauseBarLeft, pauseBarRight, iconSize)
		const buttonSize = VIDEO_CONFIG.CONTROL_BUTTON_SIZE
		const paddingX = VIDEO_CONFIG.CONTROL_PADDING * inverseScale.x
		const paddingY = VIDEO_CONFIG.CONTROL_PADDING * inverseScale.y
		const scaledButtonWidth = buttonSize * inverseScale.x
		const scaledButtonHeight = buttonSize * inverseScale.y

		progressGroup.scale(inverseScale)
		const progressHeight = progressBackground.height() * inverseScale.y
		progressGroup.position({
			x: paddingX,
			y: height - progressHeight - paddingY,
		})

		fullscreenButtonGroup.scale(inverseScale)
		fullscreenButtonGroup.position({
			x: width - scaledButtonWidth - paddingX,
			y: height - scaledButtonHeight - paddingY,
		})

		fullscreenIcon.position({
			x: (buttonSize - fullscreenIcon.width()) / 2,
			y: (buttonSize - fullscreenIcon.height()) / 2,
		})
	}

	private updatePlayerUi(snapshot: ReturnType<VideoMediaState["getSnapshot"]>): void {
		if (!this.playerRefs) {
			return
		}

		const { group, playTriangle, pauseBarsGroup, progressBackground, progressText } =
			this.playerRefs
		if (!snapshot.isBuffering && !this.forceLoadingOverlay) {
			this.playerRefs.bufferingSpinnerRoot.rotation(0)
		}
		playTriangle.visible(snapshot.paused || snapshot.ended)
		pauseBarsGroup.visible(!snapshot.paused && !snapshot.ended)
		this.updateControlsVisibility(snapshot)

		const progressLabel = `${this.formatTime(snapshot.currentTime)} / ${this.formatTime(
			snapshot.duration,
		)}`
		progressText.text(progressLabel)
		progressText.position({
			x: VIDEO_CONFIG.CONTROL_TEXT_PADDING_X,
			y: VIDEO_CONFIG.CONTROL_TEXT_PADDING_Y,
		})
		progressBackground.width(progressText.width() + VIDEO_CONFIG.CONTROL_TEXT_PADDING_X * 2)
		progressBackground.height(progressText.height() + VIDEO_CONFIG.CONTROL_TEXT_PADDING_Y * 2)

		const parentGroup = group.getParent()
		if (parentGroup instanceof Konva.Group) {
			this.updatePlayerLayout(parentGroup, group.width(), group.height())
		}
	}

	private updateControlsVisibility(snapshot: ReturnType<VideoMediaState["getSnapshot"]>): void {
		if (!this.playerRefs) {
			return
		}

		const { playButtonGroup, controlsGroup, bufferingOverlay, isHovering } = this.playerRefs
		const shouldShowControls = isHovering
		const showBuffering = snapshot.isBuffering || this.forceLoadingOverlay
		bufferingOverlay.visible(showBuffering)
		playButtonGroup.visible(shouldShowControls && !showBuffering)
		controlsGroup.visible(shouldShowControls)
	}

	private formatTime(seconds: number): string {
		const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
		const minutes = Math.floor(totalSeconds / 60)
		const remainingSeconds = totalSeconds % 60
		return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
			.toString()
			.padStart(2, "0")}`
	}

	private createFullscreenIcon(): Konva.Group {
		const size = 14
		const corner = 4
		const stroke = 1.5
		const icon = new Konva.Group({
			width: size,
			height: size,
			listening: false,
		})
		const color = VIDEO_CONFIG.CONTROL_TEXT_COLOR

		const lines = [
			[corner, 0, 0, 0, 0, corner],
			[size - corner, 0, size, 0, size, corner],
			[0, size - corner, 0, size, corner, size],
			[size, size - corner, size, size, size - corner, size],
		]

		lines.forEach((points) => {
			icon.add(
				new Konva.Line({
					points,
					stroke: color,
					strokeWidth: stroke,
					lineCap: "round",
					lineJoin: "round",
					listening: false,
				}),
			)
		})

		return icon
	}

	private updatePlayButtonHoverState(
		playButtonBg: Konva.Circle,
		playTriangle: Konva.Path,
		pauseBarsGroup: Konva.Group,
		isHovered: boolean,
	): void {
		playButtonBg.fill(isHovered ? "rgba(15, 23, 42, 0.48)" : "rgba(15, 23, 42, 0.34)")
		playTriangle.opacity(isHovered ? 1 : 0.92)
		pauseBarsGroup.opacity(isHovered ? 1 : 0.92)
	}

	private resetControlHoverStyles(
		refs: Pick<
			PlayerNodeRefs,
			"playButtonBg" | "playTriangle" | "pauseBarsGroup" | "fullscreenButtonBg"
		>,
	): void {
		this.updatePlayButtonHoverState(
			refs.playButtonBg,
			refs.playTriangle,
			refs.pauseBarsGroup,
			false,
		)
		refs.fullscreenButtonBg.fill(VIDEO_CONFIG.CONTROL_BUTTON_BG)
	}

	private updatePauseBarsLayout(
		pauseBarLeft: Konva.Rect,
		pauseBarRight: Konva.Rect,
		iconSize: number,
	): void {
		const barWidth = Math.max(3, iconSize * 0.18)
		const barHeight = iconSize * 0.72
		const gap = iconSize * 0.18
		const topY = -barHeight / 2
		pauseBarLeft.width(barWidth)
		pauseBarLeft.height(barHeight)
		pauseBarLeft.position({
			x: -(gap / 2) - barWidth,
			y: topY,
		})
		pauseBarRight.width(barWidth)
		pauseBarRight.height(barHeight)
		pauseBarRight.position({
			x: gap / 2,
			y: topY,
		})
	}

	public createPlaceholderNode(
		group: Konva.Group,
		width: number,
		height: number,
		options: {
			text: string
			mode: "empty" | "loading" | "error"
			showRetryButton?: boolean
			onRetry?: () => void
			canvas?: Canvas
			onBackgroundReady?: (backgroundNode: Konva.Image) => void
		},
	): void {
		this.resetTransientContent()

		const renderToken = this.renderToken
		const backgroundSrc =
			options.mode === "loading" ? imageBackgroundLoading : imageBackgroundUnselected
		const textColor =
			options.mode === "loading"
				? VIDEO_PLACEHOLDER.colors.textLoading
				: VIDEO_PLACEHOLDER.colors.textEmpty
		const withBackground = options.mode === "loading"

		this.imageLoader.loadImage(backgroundSrc).then((backgroundImage) => {
			if (renderToken !== this.renderToken) {
				return
			}

			const backgroundNode = RenderUtils.createBackgroundImage(
				group,
				width,
				height,
				backgroundImage,
			)
			options.onBackgroundReady?.(backgroundNode)
			if (options.mode === "error" && options.canvas) {
				const showRetry = Boolean(options.showRetryButton && options.onRetry)
				RenderUtils.createCenteredIconText(group, width, height, {
					text: options.text,
					textColor: VIDEO_PLACEHOLDER.colors.textEmpty,
					iconSrc: imageIconError,
					withBackground: false,
					isErrorState: true,
					t: options.canvas.t,
					...(showRetry
						? { onRetry: options.onRetry, hasGenerateImageRequest: true }
						: { hasGenerateImageRequest: false }),
					canvas: options.canvas,
				}).then((contentGroup) => {
					if (renderToken !== this.renderToken) {
						return
					}
					this.placeholderUsesCenteredLayout = true
					this.placeholderContentGroup = contentGroup
					group.findOne(".decorator-border")?.moveToTop()
					group.getLayer()?.batchDraw()
				})
				return
			}
			const triangleGroup = new Konva.Group({
				listening: false,
				name: "video-placeholder-triangle-group",
			})
			const triangleNode = new Konva.Path({
				data: "",
				fill: withBackground
					? VIDEO_PLACEHOLDER.colors.textLoading
					: VIDEO_PLACEHOLDER.colors.textEmpty,
				listening: false,
				name: "video-placeholder-triangle",
			})
			triangleGroup.add(triangleNode)
			group.add(triangleGroup)
			this.placeholderTriangleGroup = triangleGroup
			this.placeholderTriangleNode = triangleNode
			const contentGroup = this.createPlaceholderContent(
				width,
				height,
				options.text,
				textColor,
				{
					withBackground,
				},
			)
			group.add(contentGroup)
			this.placeholderUsesCenteredLayout = false
			this.placeholderContentGroup = contentGroup
			this.updatePlaceholderContentLayout(group, width, height)
			group.findOne(".decorator-border")?.moveToTop()
			group.getLayer()?.batchDraw()
		})
	}

	public updatePlaceholderContentLayout(
		parentGroup: Konva.Group,
		width: number,
		height: number,
	): void {
		if (this.placeholderUsesCenteredLayout && this.placeholderContentGroup) {
			RenderUtils.updateContentScale(this.placeholderContentGroup, parentGroup, width, height)
			return
		}

		if (!this.placeholderContentGroup || !this.placeholderLayout) {
			return
		}

		const inverseScale = RenderUtils.getInverseScale(parentGroup)
		const { textWidth, textHeight, backgroundWidth, backgroundHeight, withBackground } =
			this.placeholderLayout
		const iconSize = VIDEO_CONFIG.PLACEHOLDER_PLAY_ICON_SIZE
		const textBlockHeight = withBackground ? backgroundHeight : textHeight
		const { iconTextSpacing } = VIDEO_PLACEHOLDER.layout
		const textNode = this.placeholderContentGroup.findOne<Konva.Text>(".video-placeholder-text")
		const backgroundNode = this.placeholderContentGroup.findOne<Konva.Rect>(
			".video-placeholder-text-bg",
		)

		if (!this.placeholderTriangleNode || !this.placeholderTriangleGroup || !textNode) {
			return
		}

		const scaledBackgroundWidth = backgroundWidth * inverseScale.x
		const scaledIconHeight = iconSize * inverseScale.y
		const scaledTextBlockHeight = textBlockHeight * inverseScale.y
		const scaledSpacing = iconTextSpacing * inverseScale.y
		const totalHeight = scaledIconHeight + scaledSpacing + scaledTextBlockHeight
		const topY = height / 2 - totalHeight / 2
		layoutLucideSolidPlayPath(this.placeholderTriangleNode, 0, 0, iconSize)
		this.placeholderTriangleGroup.scale(inverseScale)
		this.placeholderTriangleGroup.position({
			x: width / 2,
			y: topY + scaledIconHeight / 2,
		})

		if (backgroundNode) {
			backgroundNode.position({
				x: 0,
				y: 0,
			})
		}

		textNode.position({
			x: backgroundNode
				? VIDEO_PLACEHOLDER.layout.textPaddingX
				: (backgroundWidth - textWidth) / 2,
			y: withBackground ? VIDEO_PLACEHOLDER.layout.textPaddingY : 0,
		})

		this.placeholderContentGroup.scale(inverseScale)
		this.placeholderContentGroup.position({
			x: width / 2 - scaledBackgroundWidth / 2,
			y: topY + scaledIconHeight + scaledSpacing,
		})
	}

	private createPlaceholderContent(
		width: number,
		height: number,
		text: string,
		textColor: string,
		options: { withBackground: boolean },
	): Konva.Group {
		void width
		void height

		const { layout, colors, textBackgroundCornerRadius } = VIDEO_PLACEHOLDER
		const textMeasureNode = new Konva.Text({
			text,
			fontSize: layout.textFontSize,
			fontFamily: layout.textFontFamily,
			listening: false,
		})
		const textWidth = textMeasureNode.width()
		const textHeight = textMeasureNode.height()
		const backgroundWidth = options.withBackground
			? textWidth + layout.textPaddingX * 2
			: textWidth
		const backgroundHeight = options.withBackground
			? textHeight + layout.textPaddingY * 2
			: textHeight

		this.placeholderLayout = {
			textWidth,
			textHeight,
			backgroundWidth,
			backgroundHeight,
			withBackground: options.withBackground,
		}

		const contentGroup = new Konva.Group({
			listening: false,
		})

		if (options.withBackground) {
			contentGroup.add(
				new Konva.Rect({
					x: 0,
					y: 0,
					width: backgroundWidth,
					height: backgroundHeight,
					fill: colors.loadingBg,
					cornerRadius: textBackgroundCornerRadius,
					listening: false,
					name: "video-placeholder-text-bg",
				}),
			)
		}

		contentGroup.add(
			new Konva.Text({
				text,
				fontSize: layout.textFontSize,
				fontFamily: layout.textFontFamily,
				fill: textColor,
				listening: false,
				name: "video-placeholder-text",
			}),
		)

		return contentGroup
	}

	private getPlayButtonRadius(iconSize: number): number {
		return iconSize * 0.72
	}

	/**
	 * 缓冲转圈外径与播放区三角/暂停条所用 iconSize 一致（无半透明圆背景），描边比例对齐全屏 .spinner。
	 */
	private applyBufferingSpinnerMetrics(shape: Konva.Shape, iconSize: number): void {
		const strokeWidth = Math.max(2, (iconSize * 3) / 36)
		const centerlineR = Math.max(strokeWidth * 1.25, iconSize / 2 - strokeWidth / 2)
		shape.setAttrs({
			_spinnerR: centerlineR,
			_spinnerSw: strokeWidth,
		})
	}
}
