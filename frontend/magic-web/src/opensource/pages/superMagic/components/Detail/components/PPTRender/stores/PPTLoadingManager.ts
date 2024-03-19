import { makeAutoObservable, runInAction } from "mobx"
import type { PPTLoggerService } from "../services"
import type { SlideItem } from "../PPTSidebar/types"

/**
 * PPTLoadingManager - Manages loading state and progress
 * Responsibilities:
 * - Track overall loading state
 * - Calculate and update loading progress
 * - Manage file version records
 */
export class PPTLoadingManager {
	/** Whether slides are being initialized and loaded */
	isInitializing: boolean = false

	/** Loading progress (0-100) */
	loadingProgress: number = 0

	/** 每页 PPT 的文件版本记录 */
	slidesFileVersions: Record<string, number | undefined> = {}

	private logger: PPTLoggerService

	constructor(logger: PPTLoggerService) {
		this.logger = logger

		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * Computed: Whether PPT is ready to display
	 * 计算属性：PPT 是否已准备好显示
	 */
	get isReady(): boolean {
		return !this.isInitializing
	}

	/**
	 * Calculate loading percentage based on slides
	 * @param slides - Array of slide items
	 */
	calculateLoadingPercentage(slides: SlideItem[]): number {
		if (slides.length === 0) return 0
		const loadedCount = slides.filter(
			(slide) => slide.loadingState === "loaded" || slide.loadingState === "error",
		).length
		return Math.round((loadedCount / slides.length) * 100)
	}

	/**
	 * Update loading progress based on slides
	 * @param slides - Array of slide items
	 */
	updateProgress(slides: SlideItem[]): void {
		const percentage = this.calculateLoadingPercentage(slides)
		runInAction(() => {
			this.loadingProgress = percentage
		})
	}

	/**
	 * Set initializing state
	 * @param isInitializing - Whether slides are being initialized and loaded
	 */
	setInitializing(isInitializing: boolean): void {
		this.logger.debug(isInitializing ? "开始初始化和加载幻灯片" : "初始化和加载完成", {
			operation: "PPTLoadingManager.setInitializing",
			metadata: { isInitializing },
		})

		runInAction(() => {
			this.isInitializing = isInitializing
			// When initialization completes, ensure progress is 100%
			if (!isInitializing) {
				this.loadingProgress = 100
			}
		})
	}

	/**
	 * Reset loading state
	 */
	resetLoadingState(): void {
		this.logger.debug("重置加载状态", {
			operation: "PPTLoadingManager.resetLoadingState",
		})

		runInAction(() => {
			this.isInitializing = false
			this.loadingProgress = 0
		})
	}

	/**
	 * Set single slide's file version
	 * @param fileId - File ID
	 * @param version - File version
	 */
	setSlideFileVersion(fileId: string, version: number | undefined): void {
		this.logger.debug("设置文件版本", {
			operation: "setSlideFileVersion",
			metadata: { fileId, version },
		})

		this.slidesFileVersions[fileId] = version
	}

	/**
	 * Batch set file versions
	 * @param versions - Record of fileId to version
	 */
	setSlidesFileVersions(versions: Record<string, number | undefined>): void {
		this.logger.debug("批量设置文件版本", {
			operation: "setSlidesFileVersions",
			metadata: { versionCount: Object.keys(versions).length },
		})

		this.slidesFileVersions = { ...this.slidesFileVersions, ...versions }
	}

	/**
	 * Get file version by file ID
	 * @param fileId - File ID
	 */
	getSlideFileVersion(fileId: string): number | undefined {
		return this.slidesFileVersions[fileId]
	}

	/**
	 * Reset to initial state
	 */
	reset(): void {
		this.logger.debug("重置 PPTLoadingManager", {
			operation: "PPTLoadingManager.reset",
		})

		runInAction(() => {
			this.isInitializing = false
			this.loadingProgress = 0
			this.slidesFileVersions = {}
		})
	}
}
