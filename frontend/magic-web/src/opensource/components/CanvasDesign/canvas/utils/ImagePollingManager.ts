import type { Canvas } from "../Canvas"
import type { ImageElement as ImageElementData } from "../types"
import type { GetImageGenerationResultParams } from "../../types.magic"
import { IMAGE_CONFIG } from "../element/elements/ImageElement.config"

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
		if (this.isPolling) {
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

		const elementData = this.config.getElementData()

		// 有 generateImageRequest：轮询生成结果
		if (elementData.generateImageRequest?.image_id) {
			await this.pollGenerationResult(elementData.generateImageRequest.image_id)
			return
		}

		// 有 generateHightImageRequest：轮询生成结果
		if (elementData.generateHightImageRequest?.image_id) {
			await this.pollGenerationResult(elementData.generateHightImageRequest.image_id)
			return
		}

		// 没有生成请求，停止轮询
		this.stop()
	}

	/**
	 * 智能提取文件名中的名称部分
	 * 自动识别并去除末尾的数值后缀（全部是数字且长度超过5位）
	 * @param fileName 完整的文件名，例如 "streetwear_collab_2026012111.png"
	 * @returns 提取的名称，例如 "streetwear_collab"
	 */
	private extractSmartNameFromFileName(fileName: string): string {
		// 去掉文件扩展名
		const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "")

		// 匹配末尾的下划线+全部是数字的模式，且数字长度超过5位
		// 例如：_2026012111, _123456, _1234567890
		// 匹配规则：下划线后跟至少6位连续数字（超过5位）
		const numericSuffixMatch = fileNameWithoutExt.match(/_(\d{6,})$/)

		if (numericSuffixMatch) {
			// 找到数值后缀，去除这部分
			const suffixIndex = fileNameWithoutExt.lastIndexOf(numericSuffixMatch[0])
			return fileNameWithoutExt.substring(0, suffixIndex)
		}

		// 如果没有找到数值后缀，返回原文件名（不含扩展名）
		return fileNameWithoutExt
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
				updateData.src = result.file_dir + result.file_name

				// 如果是高清放大请求，保留已设置的名称（不覆盖）
				const elementData = this.config.getElementData()
				if (elementData.generateHightImageRequest) {
					// 高清放大请求，保留已设置的名称（如 "原图片名称_4K"）
					// 不更新 name，保持创建时设置的值
				} else {
					// 普通生图请求，智能提取名称
					updateData.name = this.extractSmartNameFromFileName(result.file_name)
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
			if (result.status === "pending" || result.status === "processing") {
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
