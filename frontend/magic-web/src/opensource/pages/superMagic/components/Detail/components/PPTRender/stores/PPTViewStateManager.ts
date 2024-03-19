import { makeAutoObservable, runInAction } from "mobx"
import type { PPTLoggerService } from "../services"

/**
 * PPTViewStateManager - Manages view state
 * Responsibilities:
 * - Zoom/scale ratio management
 * - Panning offset management
 * - Fullscreen state management
 */
export class PPTViewStateManager {
	/** Scale ratio for zoom */
	scaleRatio: number = 1

	/** Vertical offset for panning */
	verticalOffset: number = 0

	/** Horizontal offset for panning */
	horizontalOffset: number = 0

	/** Fullscreen state */
	isFullscreen: boolean = false

	private logger: PPTLoggerService

	constructor(logger: PPTLoggerService) {
		this.logger = logger

		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * Set scale ratio
	 * @param ratio - New scale ratio
	 */
	setScaleRatio(ratio: number): void {
		this.logger.debug("设置缩放比例", {
			operation: "setScaleRatio",
			metadata: { ratio, previousRatio: this.scaleRatio },
		})

		this.scaleRatio = ratio
	}

	/**
	 * Set vertical offset
	 * @param offset - New vertical offset
	 */
	setVerticalOffset(offset: number): void {
		this.verticalOffset = offset
	}

	/**
	 * Set horizontal offset
	 * @param offset - New horizontal offset
	 */
	setHorizontalOffset(offset: number): void {
		this.horizontalOffset = offset
	}

	/**
	 * Set fullscreen state
	 * @param isFullscreen - Fullscreen state
	 */
	setFullscreen(isFullscreen: boolean): void {
		this.logger.debug(isFullscreen ? "进入全屏" : "退出全屏", {
			operation: "setFullscreen",
			metadata: { isFullscreen },
		})

		this.isFullscreen = isFullscreen
	}

	/**
	 * Reset view state to defaults
	 */
	resetViewState(): void {
		this.logger.debug("重置视图状态", {
			operation: "PPTViewStateManager.resetViewState",
		})

		runInAction(() => {
			this.scaleRatio = 1
			this.verticalOffset = 0
			this.horizontalOffset = 0
			this.isFullscreen = false
		})
	}

	/**
	 * Reset to initial state
	 */
	reset(): void {
		this.resetViewState()
	}
}
