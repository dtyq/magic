import type { Canvas } from "../Canvas"
import { VideoElement } from "../element/elements/VideoElement"

/**
 * 视频选中播放协调器
 * 规则：
 * 1. 单选视频元素时自动播放
 * 2. 多选或取消选中时暂停所有视频
 */
export class VideoSelectionPlaybackManager {
	private canvas: Canvas
	private deselectHandler: (() => void) | undefined

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.setupEventListeners()
	}

	private setupEventListeners(): void {
		this.deselectHandler = () => {
			this.pauseAllVideos()
		}

		this.canvas.eventEmitter.on("element:deselect", this.deselectHandler)
	}

	private pauseAllVideos(exceptElementId?: string): void {
		this.canvas.elementManager.getAllElementIds().forEach((elementId) => {
			if (elementId === exceptElementId) {
				return
			}
			const elementInstance = this.canvas.elementManager.getElementInstance(elementId)
			if (elementInstance instanceof VideoElement) {
				elementInstance.pausePreview()
			}
		})
	}

	/** 取消监听 element:deselect */
	public destroy(): void {
		if (this.deselectHandler) {
			this.canvas.eventEmitter.off("element:deselect", this.deselectHandler)
			this.deselectHandler = undefined
		}
	}
}
