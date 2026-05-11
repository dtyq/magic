import type { Canvas } from "../Canvas"
import { VideoElement } from "../element/elements/VideoElement"

export type VideoPlaybackToggleSource = "button" | "doubleClick" | "keyboardSpace"

/**
 * 统一处理视频播放相关的交互策略（空格键、按钮、双击与选择工具联动）。
 */
export class VideoPlaybackInteractionManager {
	private canvas: Canvas
	private consumedSpaceKeydown = false

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	/** 空格按下时：若允许则切换单选视频的预览播放，并标记已消费本次 keydown */
	public toggleSelectedVideoPlaybackByKeyboard(): boolean {
		this.consumedSpaceKeydown = false
		if (!this.canToggleSelectedVideoPlaybackByKeyboard()) {
			return false
		}

		const selectedVideo = this.getSingleSelectedVideoElement()
		if (!selectedVideo) {
			return false
		}

		selectedVideo.togglePreview()
		this.consumedSpaceKeydown = true
		return true
	}

	/** 空格 keyup 时若曾用空格触发过播放切换，则吞掉本次 keyup 避免误触 UI */
	public consumeSpaceKeyupAfterPlaybackToggle(): boolean {
		if (!this.consumedSpaceKeydown) {
			return false
		}

		this.consumedSpaceKeydown = false
		return true
	}

	/** 由 UI 控件或双击触发指定元素的内联预览切换 */
	public toggleElementPlayback(
		elementId: string,
		source: Exclude<VideoPlaybackToggleSource, "keyboardSpace">,
	): boolean {
		const videoElement = this.getVideoElementById(elementId)
		if (!videoElement || !this.canToggleElementPlayback(source, videoElement)) {
			return false
		}

		videoElement.togglePreview()
		return true
	}

	/** 当前是否允许用键盘切换选中视频（选择工具激活时禁止） */
	public canToggleSelectedVideoPlaybackByKeyboard(): boolean {
		if (this.isSelectionToolActive()) {
			return false
		}

		const selectedVideo = this.getSingleSelectedVideoElement()
		return !!selectedVideo && selectedVideo.canTogglePlayback()
	}

	/** 重置内部状态（空格消费标记） */
	public destroy(): void {
		this.consumedSpaceKeydown = false
	}

	private canToggleElementPlayback(
		source: Exclude<VideoPlaybackToggleSource, "keyboardSpace">,
		videoElement: VideoElement,
	): boolean {
		if (!videoElement.canTogglePlayback()) {
			return false
		}

		if (source === "button" || source === "doubleClick") {
			return this.isSelectionToolActive()
		}

		return false
	}

	private getSingleSelectedVideoElement(): VideoElement | undefined {
		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.length !== 1) {
			return undefined
		}

		return this.getVideoElementById(selectedIds[0])
	}

	private getVideoElementById(elementId: string): VideoElement | undefined {
		const elementInstance = this.canvas.elementManager.getElementInstance(elementId)
		return elementInstance instanceof VideoElement ? elementInstance : undefined
	}

	private isSelectionToolActive(): boolean {
		const activeTool = this.canvas.toolManager.getActiveTool()
		return !!activeTool && activeTool === this.canvas.toolManager.getSelectionTool()
	}
}
