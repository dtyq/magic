import type { Canvas } from "../Canvas"
import type { ImageElement as ImageElementData } from "../types"
import type { GetImageGenerationResultParams } from "../../types.magic"
import { IMAGE_CONFIG } from "../element/elements/ImageElement.config"
import { joinUploadStoragePath } from "./pathUtils"
import { getImageGenerationTaskMeta } from "./imageGenerationTaskMeta"
import {
	extractSmartNameFromFileName,
	shouldContinueGenerationPolling,
} from "./generationPollingUtils"

/**
 * 轮询管理器配置
 */
export interface PollingManagerConfig {
	/** 元素 ID */
	elementId: string
	/** Canvas 实例 */
	canvas: Canvas
	/** 获取元素数据 */
	getElementData: () => ImageElementData
	/** 状态更新回调 */
	onStatusUpdate?: () => void
}

/**
 * 图片轮询管理器
 * 负责轮询检查图片生成结果
 */
export class ImagePollingManager {
	private config: PollingManagerConfig
	private isPolling: boolean = false
	private pollingTimer?: ReturnType<typeof setTimeout>

	constructor(config: PollingManagerConfig) {
		this.config = config
	}

	/**
	 * 启动轮询检查图片生成结果
	 */
	public start(): void {
		if (this.isPolling || !this.shouldPollCurrentElement()) {
			return
		}

		this.isPolling = true
		this.poll()
	}

	/**
	 * 停止轮询
	 */
	public stop(): void {
		this.isPolling = false
		if (this.pollingTimer) {
			clearTimeout(this.pollingTimer)
			this.pollingTimer = undefined
		}
	}

	/**
	 * 检查是否正在轮询
	 */
	public isActive(): boolean {
		return this.isPolling
	}

	/**
	 * 轮询获取图片生成结果
	 */
	private async poll(): Promise<void> {
		if (!this.isPolling) {
			return
		}

		if (!this.shouldPollCurrentElement()) {
			this.stop()
			return
		}

		const imageId = this.getPollingImageId()
		if (imageId) {
			await this.pollGenerationResult(imageId)
			return
		}

		// 没有生成请求，停止轮询
		this.stop()
	}

	private getPollingImageId(): string | undefined {
		const elementData = this.config.getElementData()
		if (elementData.generateImageRequest?.image_id) {
			return elementData.generateImageRequest.image_id
		}

		return getImageGenerationTaskMeta(elementData)?.image_id
	}

	private shouldPollCurrentElement(): boolean {
		const elementData = this.config.getElementData()
		if (!this.getPollingImageId()) {
			return false
		}

		if (elementData.src) {
			return false
		}

		if (elementData.status && !shouldContinueGenerationPolling(elementData.status)) {
			return false
		}

		return true
	}

	/**
	 * 轮询图片生成结果
	 */
	private async pollGenerationResult(imageId: string): Promise<void> {
		const getImageGenerationResult =
			this.config.canvas.magicConfigManager.config?.methods?.getImageGenerationResult
		if (!getImageGenerationResult) {
			this.stop()
			return
		}

		try {
			const params: GetImageGenerationResultParams = {
				image_id: imageId,
			}

			const result = await getImageGenerationResult(params)

			// 构建更新数据
			const updateData: Partial<ImageElementData> = {
				status: result.status,
				errorMessage: result.error_message ?? undefined,
			}

			if (result.file_dir && result.file_name) {
				updateData.src = joinUploadStoragePath(result.file_dir, result.file_name)

				const elementData = this.config.getElementData()
				const imageGenerationTaskMeta = getImageGenerationTaskMeta(elementData)
				if (imageGenerationTaskMeta) {
					// 高清放大 / 去背景任务，保留创建时设置的名称
					// 不更新 name，保持创建时设置的值
				} else {
					// 普通生图请求，智能提取名称
					updateData.name = extractSmartNameFromFileName(result.file_name)
				}
			}

			// 更新元素数据
			this.config.canvas.elementManager.update(this.config.elementId, updateData, {
				silent: false,
			})

			// 发出图片结果更新事件
			this.config.canvas.eventEmitter.emit({
				type: "element:image:resultUpdated",
				data: {
					elementId: this.config.elementId,
				},
			})

			// 根据状态决定是否继续轮询
			if (shouldContinueGenerationPolling(result.status)) {
				// 5 秒后继续轮询
				this.pollingTimer = setTimeout(() => {
					this.poll()
				}, IMAGE_CONFIG.POLLING_INTERVAL)
			} else {
				// completed 或 failed，停止轮询
				this.stop()
			}
		} catch (error) {
			// getImageGenerationResult 失败，停止轮询
			this.stop()
			// 触发状态更新（进入错误状态）
			this.config.onStatusUpdate?.()
		}
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.stop()
	}
}
