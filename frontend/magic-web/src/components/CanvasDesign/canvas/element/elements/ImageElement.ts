import Konva from "konva"
import type { ImageElement as ImageElementData, LayerElement } from "../../types"
import { ElementTypeEnum } from "../../types"
import { BaseElement } from "../BaseElement"
import imageIcon from "../../../assets/image/image-icon.png"
import imageIconError from "../../../assets/image/image-icon-error.png"
import imageBackgroundUnselected from "../../../assets/image/image-background-unselected.jpg"
import imageBackgroundLoading from "../../../assets/image/image-background-loading.jpg"
import type {
	GenerateImageRequest,
	GenerateHightImageRequest,
	UploadImageResponse,
} from "../../../types.magic"
import { GenerationStatus } from "../../../types.magic"
import { generateUUID, collectElementsByType, type Rect, normalizePath } from "../../utils/utils"
import { TransformBehavior } from "../../interaction/TransformManager"
import type { Canvas } from "../../Canvas"
import type { ImageSource, ImageInfo, LoadedResource } from "../../utils/ImageResourceManager"
import { IMAGE_CONFIG, COLORS } from "./ImageElement.config"
import { ImageStaticLoader } from "../../utils/ImageStaticLoader"
import { RenderUtils } from "../../utils/RenderUtils"
import { BorderDecorator } from "../decorators/BorderDecorator"
import { InfoButtonDecorator } from "../decorators/InfoButtonDecorator"
import { ImagePollingManager } from "../../utils/ImagePollingManager"
import { DECORATOR_COLORS, DECORATOR_CONFIG } from "../decorators/DecoratorConfig"
import type { TransformContext } from "../BaseElement"

/**
 * 图片元素类
 */
export class ImageElement extends BaseElement<ImageElementData> {
	// 管理器和装饰器
	private imageLoader = new ImageStaticLoader()
	private pollingManager: ImagePollingManager
	private borderDecorator?: BorderDecorator
	private infoButtonDecorator?: InfoButtonDecorator

	// 生成相关
	private isGenerating: boolean = false

	// 渲染相关
	private backgroundNode?: Konva.Image
	private isGeneratingState: boolean = false // 生成中状态（AI 生成图片）
	private isLoadingState: boolean = false // 加载中状态（图片已生成，等待 ossSrc）
	private isErrorState: boolean = false
	private contentGroup?: Konva.Group
	private contentUpdateHandler?: () => void

	// 缓存已加载的图片对象（ImageBitmap | HTMLImageElement，由 ImageResourceManager 统一管理）
	private loadedImage?: ImageSource
	/** 从 resource:image:loaded 事件获取的 ossSrc */
	private storedOssSrc: string | null = null
	/** 从 resource:image:loaded 事件获取的 imageInfo */
	private storedImageInfo?: ImageInfo
	/** 已调用 loadResource 且尚未收到加载完成/失败事件 */
	private isResourceLoading = false

	// ossSrc 异步等待机制（生成/上传流程）
	private ossSrcPromise?: Promise<string>
	private ossSrcResolve?: (ossSrc: string) => void
	private ossSrcReject?: (reason?: Error) => void

	// resource:image:loaded / resource:image:load-failed 监听器
	private resourceLoadedHandler?: (event: {
		data: { path: string; resource: LoadedResource }
	}) => void
	private resourceLoadFailedHandler?: (event: { data: { path: string } }) => void

	// 临时生成图片请求数据（用于弹窗关闭后恢复）
	private tempGenerateImageRequest?: Partial<GenerateImageRequest>
	// 参考图信息列表（保存上传的参考图完整信息）
	private referenceImageInfos: UploadImageResponse[] = []
	// 上传结果（由全局上传管理器设置）
	public uploadResult?: UploadImageResponse

	constructor(data: ImageElementData, canvas: Canvas) {
		super(data, canvas)

		// 初始化轮询管理器（仅用于生成状态轮询）
		this.pollingManager = new ImagePollingManager({
			elementId: this.data.id,
			canvas: this.canvas,
			getElementData: () => this.data,
			onStatusUpdate: () => {
				this.isErrorState = true
				// reject ossSrc Promise（生成失败）
				if (this.ossSrcReject) {
					this.ossSrcReject(new Error("Image generation failed"))
					this.ossSrcResolve = undefined
					this.ossSrcReject = undefined
					this.ossSrcPromise = undefined
				}
				this.rerender()
			},
		})

		// 从 storage 恢复 tempGenerateImageRequest
		const tempConfig = ImageElement.getTempConfigFromStorage(this.canvas, this.data.id)

		// 如果有临时配置，恢复临时配置
		if (tempConfig) {
			this.tempGenerateImageRequest = tempConfig
		}
		// 如果没有临时配置，从 generateImageRequest 恢复临时配置
		else if (this.data.generateImageRequest && !this.tempGenerateImageRequest) {
			const { model_id, resolution, size } = this.data.generateImageRequest || {}
			this.tempGenerateImageRequest = {
				...(model_id && { model_id }),
				...(resolution && { resolution }),
				...(size && { size }),
			}
		}

		// 有 src：直接通过 ImageResourceManager 加载
		if (this.data.src) {
			this.loadImageFromPath(this.data.src)
			this.setupResourceLoadedListener()
		}
		// 没有 src 但有 generateImageRequest：启动轮询检查生成结果
		else if (this.data.generateImageRequest?.image_id) {
			this.createOssSrcPromise()
			this.pollingManager.start()
		}
		// 没有 src 但有 generateHightImageRequest：启动轮询检查生成结果
		else if (this.data.generateHightImageRequest?.image_id) {
			this.createOssSrcPromise()
			this.pollingManager.start()
		}
	}

	/**
	 * 重新渲染节点（重写以清理监听器）
	 */
	override rerender(): Konva.Node | null {
		// 在重新渲染前清理监听器和装饰器
		this.removeContentUpdateListener()
		this.borderDecorator?.destroy()
		this.borderDecorator = undefined
		this.infoButtonDecorator?.destroy()
		this.infoButtonDecorator = undefined

		// 调用父类的 rerender
		return super.rerender()
	}

	/**
	 * 销毁元素时清理资源
	 */
	override destroy(): void {
		this.removeResourceLoadedListener()
		this.pollingManager.destroy()
		this.borderDecorator?.destroy()
		this.infoButtonDecorator?.destroy()
		this.removeContentUpdateListener()
		// 清理缓存的图片对象
		this.loadedImage = undefined
		// 清理 ossSrc Promise
		this.ossSrcPromise = undefined
		this.ossSrcResolve = undefined
		this.ossSrcReject = undefined
		super.destroy()
	}

	/**
	 * 发起图片生成请求
	 * @param request 请求参数
	 * @returns 请求是否成功发起
	 */
	async generateImage(request: GenerateImageRequest): Promise<boolean> {
		if (!this.canvas.magicConfigManager.config?.methods?.generateImage) {
			return false
		}

		if (this.isGenerating) {
			return false
		}

		// 检查必要参数
		if (!request.model_id || !request.prompt) {
			return false
		}

		// 生成新的 image_id 并添加到请求中
		const requestWithId: GenerateImageRequest = {
			...request,
			image_id: generateUUID(),
		}

		this.isGenerating = true

		try {
			// 发起图片生成请求
			await this.canvas.magicConfigManager.config?.methods?.generateImage(requestWithId)

			// 请求成功，保存请求参数到元素，并清除错误状态
			const currentElement = this.canvas.elementManager.getElementData(this.data.id)
			if (currentElement) {
				this.canvas.elementManager.update(
					this.data.id,
					{
						generateImageRequest: requestWithId,
						status: undefined,
						errorMessage: undefined,
					},
					{ silent: false },
				)
			}

			// 重置错误状态标记
			this.isErrorState = false

			// 检查画布中的所有 Image 元素并设置名称
			this.updateImageElementNames()

			// 创建 ossSrc Promise
			this.createOssSrcPromise()

			// 启动轮询检查结果
			this.pollingManager.start()

			// 清除临时生成图片请求数据中的 prompt（保留其他配置，以便二次编辑时复用）
			this.clearTempGenerateImageRequestPrompt()

			// 触发重新渲染以清除错误状态显示
			this.rerender()

			return true
		} catch (error) {
			return false
		} finally {
			this.isGenerating = false
		}
	}

	/**
	 * 发起高清图片生成请求
	 * @param request 请求参数
	 * @returns 请求是否成功发起
	 */
	async generateHightImage(request: GenerateHightImageRequest): Promise<boolean> {
		if (!this.canvas.magicConfigManager.config?.methods?.generateHightImage) {
			return false
		}

		if (this.isGenerating) {
			return false
		}

		// 检查必要参数
		if (!request.file_path || !request.size) {
			return false
		}

		// 生成新的 image_id 并添加到请求中
		const requestWithId: GenerateHightImageRequest = {
			...request,
			image_id: generateUUID(),
		}

		this.isGenerating = true

		try {
			// 发起高清图片生成请求
			await this.canvas.magicConfigManager.config?.methods?.generateHightImage(requestWithId)

			// 请求成功，保存请求参数到元素，并清除错误状态
			const currentElement = this.canvas.elementManager.getElementData(this.data.id)
			if (currentElement) {
				this.canvas.elementManager.update(
					this.data.id,
					{
						generateHightImageRequest: requestWithId,
						status: undefined,
						errorMessage: undefined,
					},
					{ silent: false },
				)
			}

			// 重置错误状态标记
			this.isErrorState = false

			// 创建 ossSrc Promise
			this.createOssSrcPromise()

			// 启动轮询检查结果
			this.pollingManager.start()

			// 触发重新渲染以清除错误状态显示
			this.rerender()

			return true
		} catch (error) {
			return false
		} finally {
			this.isGenerating = false
		}
	}

	/**
	 * 获取图片生成状态
	 */
	isImageGenerating(): boolean {
		return this.isGenerating
	}

	/**
	 * 创建 ossSrc Promise（用于等待 ossSrc 换取完成）
	 */
	public createOssSrcPromise(): void {
		// 如果已经有 Promise，不重复创建
		if (this.ossSrcPromise) {
			return
		}

		this.ossSrcPromise = new Promise<string>((resolve, reject) => {
			this.ossSrcResolve = resolve
			this.ossSrcReject = reject
		})
	}

	/**
	 * 设置 ossSrc（公开方法，供外部调用）
	 * 会触发 ossSrcResolve 并启动预加载
	 */
	public setOssSrc(ossSrc: string): void {
		// resolve ossSrc Promise
		if (this.ossSrcResolve) {
			this.ossSrcResolve(ossSrc)
			this.ossSrcResolve = undefined
			this.ossSrcReject = undefined
			this.ossSrcPromise = undefined
		}
		// ossSrc 已获取，如果 src 存在则预加载图片
		if (this.data.src) {
			this.preloadImageInternal()
		}

		// 触发 ossSrcReady 事件
		this.canvas.eventEmitter.emit({
			type: "element:image:ossSrcReady",
			data: { elementId: this.data.id },
		})
	}

	/**
	 * 从 resource:image:loaded 事件应用资源
	 */
	private applyResourceFromEvent(resource: LoadedResource): void {
		this.loadedImage = resource.image
		this.storedOssSrc = resource.ossSrc
		this.storedImageInfo = resource.imageInfo
		this.isResourceLoading = false

		if (this.ossSrcResolve) {
			this.ossSrcResolve(resource.ossSrc)
			this.ossSrcResolve = undefined
			this.ossSrcReject = undefined
			this.ossSrcPromise = undefined
		}

		this.canvas.eventEmitter.emit({
			type: "element:image:ossSrcReady",
			data: { elementId: this.data.id },
		})

		this.rerender()
	}

	/**
	 * 处理图片加载失败的逻辑
	 */
	private handleImageLoadFailure(): void {
		this.loadedImage = undefined
		this.isResourceLoading = false
		this.isErrorState = true
		this.rerender()
	}

	/**
	 * 触发 path 的图片加载（通过 resource:image:loaded 事件获取完成通知）
	 */
	private loadImageFromPath(path: string): void {
		const getFileInfo = this.canvas.magicConfigManager.config?.methods?.getFileInfo
		if (!getFileInfo) {
			this.isErrorState = true
			this.rerender()
			return
		}

		this.isResourceLoading = true
		this.canvas.imageResourceManager.loadResource(path)
	}

	/**
	 * 监听 resource:image:loaded / resource:image:load-failed 事件
	 */
	private setupResourceLoadedListener(): void {
		this.removeResourceLoadedListener()
		if (!this.data.src) return

		const path = this.data.src
		this.resourceLoadedHandler = ({ data }) => {
			if (normalizePath(data.path) === normalizePath(path)) {
				this.applyResourceFromEvent(data.resource)
			}
		}
		this.resourceLoadFailedHandler = ({ data }) => {
			if (normalizePath(data.path) === normalizePath(path)) {
				this.handleImageLoadFailure()
			}
		}
		this.canvas.eventEmitter.on("resource:image:loaded", this.resourceLoadedHandler)
		this.canvas.eventEmitter.on("resource:image:load-failed", this.resourceLoadFailedHandler)

		// 同步可能已缓存的资源（如其他消费者已加载，或 memorized 事件尚未匹配）
		this.canvas.imageResourceManager.getResource(path).then((resource) => {
			if (
				resource &&
				!this.loadedImage &&
				normalizePath(path) === normalizePath(this.data.src || "")
			) {
				this.applyResourceFromEvent(resource)
			}
		})
	}

	/**
	 * 移除 resource:image:loaded / resource:image:load-failed 监听
	 */
	private removeResourceLoadedListener(): void {
		if (this.resourceLoadedHandler) {
			this.canvas.eventEmitter.off("resource:image:loaded", this.resourceLoadedHandler)
			this.resourceLoadedHandler = undefined
		}
		if (this.resourceLoadFailedHandler) {
			this.canvas.eventEmitter.off(
				"resource:image:load-failed",
				this.resourceLoadFailedHandler,
			)
			this.resourceLoadFailedHandler = undefined
		}
	}

	/**
	 * 获取图片信息（公开方法，供外部调用）
	 * @returns 图片信息，如果图片未加载则返回 undefined
	 */
	public getImageInfo(): ImageInfo | undefined {
		return this.storedImageInfo
	}

	/** 图片是否已加载完成 */
	public isImageLoaded(): boolean {
		return !!this.loadedImage
	}

	/**
	 * 预加载图片
	 * 当获取到 ossSrc 时调用，预先加载图片并在加载完成后触发重新渲染
	 * 使用 ImageResourceManager 统一管理资源，确保 render 和剪贴板使用同一个 Image 对象
	 */
	private preloadImageInternal(): void {
		if (!this.data.src) {
			return
		}

		// 如果已加载完成，不重复加载
		if (this.loadedImage) {
			return
		}

		// 使用 ImageResourceManager 加载图片（通过 resource:image:loaded 事件获取完成通知）
		this.isResourceLoading = true
		this.canvas.imageResourceManager.loadResource(this.data.src)
	}

	/**
	 * 更新当前 Image 元素的名称（Image 1, Image 2, ...）
	 */
	private updateImageElementNames(): void {
		const currentElement = this.canvas.elementManager.getElementData(this.data.id)

		if (!currentElement || !!currentElement.name) return

		// 获取所有顶层元素
		const allElements = this.canvas.elementManager.getAllElements()

		// 收集所有 Image 类型的元素（包括子元素）
		const imageElements = collectElementsByType(allElements, ElementTypeEnum.Image)

		// 按照 zIndex 降序排序（zIndex 大的在前面）
		imageElements.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))

		// 找到当前元素在列表中的索引
		const currentIndex = imageElements.findIndex((element) => element.id === this.data.id)

		if (currentIndex !== -1) {
			// 只为当前元素设置名称
			const newName = this.canvas.t
				? this.canvas.t("image.nameWithIndex", {
						defaultValue: "Image {{index}}",
						index: currentIndex + 1,
					})
				: `Image ${currentIndex + 1}`

			if (currentElement.name !== newName) {
				this.canvas.elementManager.update(
					this.data.id,
					{
						name: newName,
					},
					{ silent: false },
				)
			}
		}
	}

	/**
	 * 预加载图片（公开方法，供外部调用）
	 */
	public preloadImage(): void {
		this.preloadImageInternal()
	}

	/**
	 * 检查图片是否满足生成条件（正在生成中或等待生成结果）
	 */
	private isImageGenerationPending(): boolean {
		// 有生成请求但还没有 src，说明正在生成中
		const hasGenerateRequest =
			!!this.data.generateImageRequest || !!this.data.generateHightImageRequest
		const hasSrc = !!this.data.src
		const status = this.data.status

		// 情况1: 有生成请求但还没有 src
		if (hasGenerateRequest && !hasSrc) {
			return true
		}

		// 情况2: 有 src 但状态是 pending 或 processing
		if (
			hasSrc &&
			(status === GenerationStatus.Pending || status === GenerationStatus.Processing)
		) {
			return true
		}

		// 情况3: 有 src 但还没有 ossSrc（正在换取中）
		if (hasSrc && this.data.src && !this.storedOssSrc) {
			return true
		}

		return false
	}

	/**
	 * 获取可绘制图片源（ImageBitmap | HTMLImageElement）
	 * 该方法使用 ImageResourceManager 管理资源，避免重复加载
	 * 如果图片正在生成中，会等待生成完成 + ossSrc 换取完成 + 图片加载完成
	 * @returns Promise<ImageSource | null> - 成功返回图片对象，失败返回 null
	 */
	public async getHTMLImageElement(): Promise<ImageSource | null> {
		// 如果 loadedImage 已加载，直接返回
		if (this.loadedImage) {
			return this.loadedImage
		}

		// 检查图片是否正在生成中或等待结果
		if (this.isImageGenerationPending()) {
			// 如果还没有 ossSrcPromise，创建一个
			if (!this.ossSrcPromise) {
				this.createOssSrcPromise()
			}

			// 等待 ossSrc 就绪（包括生成完成 + 换取完成）
			try {
				await this.ossSrcPromise
				// 如果图片已经加载完成
				if (this.loadedImage) {
					return this.loadedImage
				}
			} catch (error) {
				// 生成失败，返回 null
				return null
			}
		}

		// 使用 getResource 加载并获取图片
		const src = this.data.src
		if (!src) return null

		try {
			const resource = await this.canvas.imageResourceManager.getResource(src)
			if (resource) {
				this.loadedImage = resource.image
				this.storedOssSrc = resource.ossSrc
				this.storedImageInfo = resource.imageInfo
				this.isResourceLoading = false
				return resource.image
			}
			return null
		} catch (error) {
			return null
		}
	}

	/**
	 * 将元素渲染到Canvas上下文
	 * @param ctx - Canvas 2D渲染上下文
	 * @param offsetX - 元素在Canvas中的X偏移量
	 * @param offsetY - 元素在Canvas中的Y偏移量
	 * @param options - 可选参数
	 * @param options.shouldDrawBorder - 是否绘制边框（默认 false）
	 * @param options.width - 可选的渲染宽度，如果提供则使用此宽度而非元素实际宽度
	 * @param options.height - 可选的渲染高度，如果提供则使用此高度而非元素实际高度
	 * @returns Promise<boolean> - 渲染是否成功
	 */
	public override async renderToCanvas(
		ctx: CanvasRenderingContext2D,
		offsetX: number,
		offsetY: number,
		options?: { shouldDrawBorder?: boolean; width?: number; height?: number },
	): Promise<boolean> {
		try {
			// 获取图片元素
			const img = await this.getHTMLImageElement()
			if (!img) {
				return false
			}

			// 计算元素的实际尺寸（考虑 scaleX/scaleY）
			const width = this.data.width || 0
			const height = this.data.height || 0
			const scaleX = this.data.scaleX ?? 1
			const scaleY = this.data.scaleY ?? 1

			const actualWidth = width * scaleX
			const actualHeight = height * scaleY

			// 如果提供了可选的宽高，则使用提供的宽高
			const renderWidth = options?.width ?? actualWidth
			const renderHeight = options?.height ?? actualHeight

			if (renderWidth <= 0 || renderHeight <= 0) {
				return false
			}

			// 绘制图片到Canvas
			ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight)

			// 如果需要绘制边框
			if (options?.shouldDrawBorder) {
				ctx.save()
				ctx.strokeStyle = DECORATOR_COLORS.BORDER_DEFAULT
				ctx.lineWidth = DECORATOR_CONFIG.BORDER_WIDTH
				ctx.strokeRect(offsetX, offsetY, renderWidth, renderHeight)
				ctx.restore()
			}

			return true
		} catch (error) {
			return false
		}
	}

	/**
	 * 获取图片默认配置
	 * @param width 可选的宽度，如果不提供则使用默认值
	 * @param height 可选的高度，如果不提供则使用默认值
	 */
	static getDefaultConfig(width?: number, height?: number) {
		return {
			width: width ?? IMAGE_CONFIG.DEFAULT_WIDTH,
			height: height ?? IMAGE_CONFIG.DEFAULT_HEIGHT,
		}
	}

	/**
	 * 从 storage 中获取临时配置
	 */
	static getTempConfigFromStorage(
		canvas: Canvas,
		elementId: string,
	): Partial<GenerateImageRequest> | undefined {
		const methods = canvas.magicConfigManager.config?.methods
		if (!methods?.getStorage) return undefined

		const storage = methods.getStorage()
		return storage?.tempImageConfigs?.[elementId]
	}

	/**
	 * 保存临时配置到 storage
	 */
	static saveTempConfigToStorage(
		canvas: Canvas,
		elementId: string,
		config: Partial<GenerateImageRequest>,
	): void {
		const methods = canvas.magicConfigManager.config?.methods
		if (!methods?.getStorage || !methods?.saveStorage) {
			return
		}

		const storage = methods.getStorage() || {}
		const tempImageConfigs = storage.tempImageConfigs || {}

		tempImageConfigs[elementId] = config

		const newStorage = {
			...storage,
			tempImageConfigs,
		}

		methods.saveStorage(newStorage)
	}

	/**
	 * 从 storage 中清除临时配置
	 */
	static clearTempConfigFromStorage(canvas: Canvas, elementId: string): void {
		const methods = canvas.magicConfigManager.config?.methods
		if (!methods?.getStorage || !methods?.saveStorage) return

		const storage = methods.getStorage()
		if (!storage?.tempImageConfigs) return

		const tempImageConfigs = { ...storage.tempImageConfigs }
		delete tempImageConfigs[elementId]

		methods.saveStorage({
			...storage,
			tempImageConfigs,
		})
	}

	/**
	 * 获取渲染名称（用于显示的默认名称，支持多语言）
	 */
	public getRenderName(): string {
		return this.getText("image.defaultName", "图片生成器")
	}

	/**
	 * 获取名称标签文本（根据状态添加后缀）
	 */
	public override getNameLabelText(): string {
		const baseName = this.data.name || this.getRenderName()

		// 如果是错误状态（图片加载失败），直接返回原始名称
		if (this.isErrorState) {
			return baseName
		}

		const hasRequest = !!this.data.generateImageRequest || !!this.data.generateHightImageRequest
		const status = this.data.status

		// 有结果且失败，添加"(失败)"后缀
		if (status === GenerationStatus.Failed) {
			const suffix = this.getText("image.nameSuffix.failed", "(失败)")
			return `${baseName}${suffix}`
		}

		// 有结果且状态是 pending 或 processing
		if (status === GenerationStatus.Pending || status === GenerationStatus.Processing) {
			// 区分上传中和生成中
			if (hasRequest) {
				const suffix = this.getText("image.nameSuffix.generating", "(生成中)")
				return `${baseName}${suffix}`
			} else {
				const suffix = this.getText("image.nameSuffix.uploading", "(上传中)")
				return `${baseName}${suffix}`
			}
		}

		// 检查是否正在加载图片（ossSrc 存在但图片还在异步加载）
		if (this.isLoadingState) {
			const suffix = this.getText("image.nameSuffix.loading", "(加载中)")
			return `${baseName}${suffix}`
		}

		// 优先检查：有 src 说明已经生成成功，检查 ossSrc 是否为空
		if (this.data.src) {
			// 有 src 但 ossSrc 为空，添加"(加载中)"后缀
			if (!this.storedOssSrc) {
				const suffix = this.getText("image.nameSuffix.loading", "(加载中)")
				return `${baseName}${suffix}`
			}
			// 有 src 且 ossSrc 不为空，返回原始名称（已加载完成）
			return baseName
		}

		// 没有 src，但有请求且没有状态，添加"(生成中)"后缀
		if (hasRequest && !status) {
			const suffix = this.getText("image.nameSuffix.generating", "(生成中)")
			return `${baseName}${suffix}`
		}

		// 其他情况返回原始名称
		return baseName
	}

	/**
	 * 重写边界计算方法（用于 Transformer）
	 * Image 元素应该使用固定的 width/height，而不是计算子节点边界
	 */
	protected override setupCustomBoundingRect(node: Konva.Group): void {
		if (!(node instanceof Konva.Group)) {
			return
		}

		// Image 元素使用固定尺寸，基于 Group 的 width/height
		node.getClientRect = (config?: Parameters<Konva.Node["getClientRect"]>[0]) => {
			const width = node.width()
			const height = node.height()
			const scaleX = node.scaleX()
			const scaleY = node.scaleY()

			// 创建一个临时的矩形节点来计算位置
			const tempRect = new Konva.Rect({
				x: 0,
				y: 0,
				width: width || 0,
				height: height || 0,
			})

			// 将临时矩形添加到 Group 中（临时）
			node.add(tempRect)
			const tempRectClientRect = tempRect.getClientRect(config)
			tempRect.destroy()

			return {
				x: tempRectClientRect.x,
				y: tempRectClientRect.y,
				width: width * scaleX,
				height: height * scaleY,
			}
		}
	}

	/**
	 * 重写边界计算，排除 info 按钮的影响
	 * 直接返回图片的实际尺寸，不考虑装饰性按钮
	 */
	public override getBoundingRect(): Rect | null {
		if (!this.node) return null

		// 获取相对于 layer 的位置
		const layer = this.node.getLayer()
		if (!layer) return null

		// 优先使用节点的实际尺寸
		let width = this.data.width || 0
		let height = this.data.height || 0

		if (this.node instanceof Konva.Group) {
			const groupWidth = this.node.width()
			const groupHeight = this.node.height()
			const scaleX = this.node.scaleX()
			const scaleY = this.node.scaleY()

			if (groupWidth !== undefined && groupHeight !== undefined) {
				width = groupWidth * scaleX
				height = groupHeight * scaleY
			}

			// 创建临时矩形来计算位置
			const tempRect = new Konva.Rect({
				x: 0,
				y: 0,
				width: groupWidth || this.data.width || width,
				height: groupHeight || this.data.height || height,
			})

			this.node.add(tempRect)
			const tempRectClientRect = tempRect.getClientRect({
				relativeTo: layer,
			})
			tempRect.destroy()

			return {
				x: tempRectClientRect.x,
				y: tempRectClientRect.y,
				width,
				height,
			}
		}

		// 如果不是 Group，使用默认方法
		const clientRect = this.node.getClientRect({
			relativeTo: layer,
		})

		return {
			x: clientRect.x,
			y: clientRect.y,
			width,
			height,
		}
	}

	/**
	 * 获取图片加载状态（基于事件更新的本地状态）
	 */
	private getImageLoadState(): {
		ossSrc: string | null
		thumbnailAvailable: boolean
		imageLoaded: boolean
		isLoading: boolean
	} {
		if (!this.data.src) {
			return {
				ossSrc: null,
				thumbnailAvailable: false,
				imageLoaded: false,
				isLoading: false,
			}
		}

		return {
			ossSrc: this.storedOssSrc,
			thumbnailAvailable: !!this.storedImageInfo, // 主图加载后 thumbnail 一并返回
			imageLoaded: !!this.loadedImage,
			isLoading: this.isResourceLoading,
		}
	}

	render(): Konva.Group | null {
		// 检查是否有生成请求（生图或高清图）
		const hasRequest = !!this.data.generateImageRequest || !!this.data.generateHightImageRequest
		const status = this.data.status

		// 有 src：视为 completed 状态，直接渲染图片或加载状态
		if (!!this.data.src || status === GenerationStatus.Completed) {
			// 如果图片加载失败，渲染错误状态
			if (this.isErrorState) {
				return this.renderError(this.getText("image.loadError", "图片加载失败"))
			}

			// 从 ImageResourceManager 实时查询状态
			const loadState = this.getImageLoadState()

			// 主图已加载，直接渲染主图
			if (loadState.imageLoaded && loadState.ossSrc && this.data.src) {
				return this.renderImage(loadState.ossSrc)
			}

			// 其他情况（ossSrc 未换取、图片加载中、缩略图可用但主图未加载）都显示加载中
			return this.renderLoadingPlaceholder()
		}

		// 有结果且失败，渲染错误信息
		if (status === GenerationStatus.Failed) {
			const errorMessage =
				this.data.errorMessage || this.getText("image.generateFailed", "图片生成失败")
			return this.renderError(errorMessage)
		}

		// 有结果且状态是 pending 或 processing，渲染生成中状态
		if (status === GenerationStatus.Pending || status === GenerationStatus.Processing) {
			return this.renderGeneratingPlaceholder()
		}

		// 有请求但没有结果，渲染生成中状态
		if (hasRequest && !status) {
			return this.renderGeneratingPlaceholder()
		}

		// 没有请求，渲染无状态占位符
		return this.renderEmptyPlaceholder()
	}

	update(newData: ImageElementData): boolean {
		// 判断是否需要重新渲染
		const needsRerender =
			this.data.generateImageRequest?.image_id !== newData.generateImageRequest?.image_id ||
			this.data.generateHightImageRequest?.image_id !==
				newData.generateHightImageRequest?.image_id ||
			this.data.src !== newData.src ||
			this.data.status !== newData.status

		// 检查 src 是否变化
		const srcChanged = this.data.src !== newData.src

		// 检查状态是否变为 failed
		const oldStatus = this.data.status
		const newStatus = newData.status
		const statusChangedToFailed =
			oldStatus !== GenerationStatus.Failed && newStatus === GenerationStatus.Failed

		this.data = newData

		// 如果 src 变化，重新加载图片并设置/移除监听
		if (srcChanged) {
			this.loadedImage = undefined
			this.storedOssSrc = null
			this.storedImageInfo = undefined
			this.isResourceLoading = false
			if (newData.src) {
				this.loadImageFromPath(newData.src)
				this.setupResourceLoadedListener()
			} else {
				this.removeResourceLoadedListener()
			}
		}

		// 如果状态变为 failed，reject ossSrcPromise
		if (statusChangedToFailed && this.ossSrcReject) {
			this.ossSrcReject(new Error(newData.errorMessage || "Image generation failed"))
			this.ossSrcResolve = undefined
			this.ossSrcReject = undefined
			this.ossSrcPromise = undefined
		}

		if (needsRerender) {
			return true
		}

		// 更新基础属性
		if (this.node instanceof Konva.Group) {
			this.updateBaseProps(this.node, newData)

			// 更新内部节点的尺寸
			if (newData.width !== undefined && newData.height !== undefined) {
				const newWidth = newData.width
				const newHeight = newData.height

				// 更新所有子节点的尺寸
				this.node.children?.forEach((child) => {
					const childName = child.name()

					if (child instanceof Konva.Image) {
						if (!childName) {
							child.width(newWidth)
							child.height(newHeight)
						}
					} else if (child instanceof Konva.Rect) {
						if (
							childName === "hit-area" ||
							childName === "background" ||
							childName === "decorator-border"
						) {
							child.width(newWidth)
							child.height(newHeight)
						}
					}
				})

				// 更新背景节点
				if (this.backgroundNode) {
					this.backgroundNode.width(newWidth)
					this.backgroundNode.height(newHeight)
				}

				// 更新内容组的缩放
				if (this.contentGroup) {
					this.updateContentScale()
				}

				// 更新边框
				if (this.borderDecorator) {
					this.borderDecorator.updateSize(newWidth, newHeight)
				}

				// 更新 info 按钮
				if (this.infoButtonDecorator) {
					this.infoButtonDecorator.updateConfig({ width: newWidth, height: newHeight })
				}

				// 更新裁剪区域
				this.node.clipFunc((ctx) => {
					ctx.rect(0, 0, newWidth, newHeight)
				})

				// 触发重绘
				this.node.getLayer()?.batchDraw()
			}
		}

		return false
	}

	/**
	 * 渲染无状态占位符
	 */
	private renderEmptyPlaceholder(): Konva.Group {
		if (!this.data.width || !this.data.height) {
			throw new Error("Image element must have width and height")
		}

		const width = this.data.width
		const height = this.data.height

		// 重置状态标记
		this.isGeneratingState = false
		this.isLoadingState = false
		this.isErrorState = false

		// 创建 Group 容器
		const group = new Konva.Group({
			width,
			height,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点
		RenderUtils.createHitNode(group, width, height)

		// 异步加载背景和内容
		this.imageLoader.loadImage(imageBackgroundUnselected).then((backgroundImage) => {
			// 创建背景图片节点
			const backgroundNode = RenderUtils.createBackgroundImage(
				group,
				width,
				height,
				backgroundImage,
			)

			// 保存背景节点引用
			this.backgroundNode = backgroundNode

			// 创建居中的图标和文本
			RenderUtils.createCenteredIconText(group, width, height, {
				text: this.getText("image.empty", "请发送生成图像的指令"),
				textColor: COLORS.EMPTY_TEXT,
				iconSrc: imageIcon,
				withBackground: false,
				t: this.canvas.t,
			}).then((contentGroup) => {
				this.contentGroup = contentGroup
				this.setupContentUpdateListener(group)
			})

			// 创建边框
			this.createBorder(group, width, height)
		})

		this.finalizeNode(group)
		return group
	}

	/**
	 * 渲染生成中状态占位符
	 */
	private renderGeneratingPlaceholder(): Konva.Group {
		if (!this.data.width || !this.data.height) {
			throw new Error("Image element must have width and height")
		}

		const width = this.data.width
		const height = this.data.height

		// 标记为生成中状态
		this.isGeneratingState = true
		this.isLoadingState = false
		this.isErrorState = false

		// 创建 Group 容器
		const group = new Konva.Group({
			width,
			height,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点
		RenderUtils.createHitNode(group, width, height)

		// 区分上传中和生成中
		const hasRequest = !!this.data.generateImageRequest || !!this.data.generateHightImageRequest
		// 如果是 processing 状态且不是临时元素，视为生成中（即使没有生成请求信息）
		const isGenerating =
			hasRequest ||
			(this.data.status === GenerationStatus.Processing &&
				!this.canvas.elementManager.isTemporary(this.data.id))
		const displayText = isGenerating
			? this.getText("image.generating", "正在生成中...")
			: this.getText("image.uploading", "正在上传中...")

		// 异步加载背景和内容
		this.imageLoader.loadImage(imageBackgroundLoading).then((backgroundImage) => {
			// 创建背景图片节点
			RenderUtils.createBackgroundImage(group, width, height, backgroundImage)

			// 创建居中的图标和文本
			RenderUtils.createCenteredIconText(group, width, height, {
				text: displayText,
				textColor: COLORS.LOADING_TEXT,
				iconSrc: imageIcon,
				withBackground: true,
				t: this.canvas.t,
			}).then((contentGroup) => {
				this.contentGroup = contentGroup
				this.setupContentUpdateListener(group)
			})

			// 创建边框
			this.createBorder(group, width, height)
		})

		this.finalizeNode(group)
		return group
	}

	/**
	 * 渲染加载中状态占位符
	 */
	private renderLoadingPlaceholder(): Konva.Group {
		if (!this.data.width || !this.data.height) {
			throw new Error("Image element must have width and height")
		}

		const width = this.data.width
		const height = this.data.height

		// 标记为加载中状态
		this.isGeneratingState = false
		this.isLoadingState = true
		this.isErrorState = false

		// 创建 Group 容器
		const group = new Konva.Group({
			width,
			height,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点
		RenderUtils.createHitNode(group, width, height)

		// 异步加载背景和内容
		this.imageLoader.loadImage(imageBackgroundLoading).then((backgroundImage) => {
			// 创建背景图片节点
			RenderUtils.createBackgroundImage(group, width, height, backgroundImage)

			// 创建居中的图标和文本
			RenderUtils.createCenteredIconText(group, width, height, {
				text: this.getText("image.loading", "正在加载中..."),
				textColor: COLORS.LOADING_TEXT,
				iconSrc: imageIcon,
				withBackground: true,
				t: this.canvas.t,
			}).then((contentGroup) => {
				this.contentGroup = contentGroup
				this.setupContentUpdateListener(group)
			})

			// 创建边框
			this.createBorder(group, width, height)
		})

		this.finalizeNode(group)
		return group
	}

	/**
	 * 渲染实际图片
	 */
	private renderImage(imageUrl: string): Konva.Group {
		if (!this.data.width || !this.data.height) {
			throw new Error("Image element must have width and height")
		}

		const width = this.data.width
		const height = this.data.height

		// 重置状态标记
		this.isGeneratingState = false
		this.isLoadingState = false
		this.isErrorState = false

		// 创建 Group 容器
		const group = new Konva.Group({
			width,
			height,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点
		RenderUtils.createHitNode(group, width, height)

		// 使用预加载好的图片对象
		if (!this.loadedImage) {
			this.finalizeNode(group)
			return group
		}

		// 创建图片节点
		const imageNode = new Konva.Image({
			image: this.loadedImage,
			width: width,
			height: height,
			x: 0,
			y: 0,
			listening: false,
		})

		group.add(imageNode)

		// 创建边框
		this.createBorder(group, width, height)

		// 只有在有生成请求（生图）时才创建 info 按钮
		if (this.data.generateImageRequest) {
			this.createInfoButton(group, width, height)
		}

		this.finalizeNode(group)
		return group
	}

	/**
	 * 渲染错误信息
	 */
	private renderError(errorMessage: string): Konva.Group {
		if (!this.data.width || !this.data.height) {
			throw new Error("Image element must have width and height")
		}

		const width = this.data.width
		const height = this.data.height

		// 标记为错误状态
		this.isGeneratingState = false
		this.isLoadingState = false
		this.isErrorState = true

		// 创建 Group 容器
		const group = new Konva.Group({
			width,
			height,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点
		RenderUtils.createHitNode(group, width, height)

		// 异步加载背景和内容
		this.imageLoader.loadImage(imageBackgroundUnselected).then((backgroundImage) => {
			// 创建背景图片节点
			const backgroundNode = RenderUtils.createBackgroundImage(
				group,
				width,
				height,
				backgroundImage,
			)

			// 保存背景节点引用
			this.backgroundNode = backgroundNode

			// 创建居中的图标和错误文本
			RenderUtils.createCenteredIconText(group, width, height, {
				text: errorMessage,
				textColor: COLORS.ERROR_TEXT,
				iconSrc: imageIconError,
				withBackground: false,
				isErrorState: true,
				t: this.canvas.t,
				onRetry: () => {
					const imageRequest = this.data.generateImageRequest
					const hightImageRequest = this.data.generateHightImageRequest
					if (imageRequest) {
						this.generateImage(imageRequest)
					} else if (hightImageRequest) {
						this.generateHightImage(hightImageRequest)
					}
				},
				hasGenerateImageRequest:
					!!this.data.generateImageRequest || !!this.data.generateHightImageRequest,
				canvas: this.canvas,
			}).then((contentGroup) => {
				this.contentGroup = contentGroup
				this.setupContentUpdateListener(group)
			})

			// 创建边框
			this.createBorder(group, width, height)
		})

		this.finalizeNode(group)
		return group
	}

	/**
	 * 创建边框
	 */
	private createBorder(group: Konva.Group, width: number, height: number): void {
		this.borderDecorator = new BorderDecorator(group, width, height, {
			isAnimated: this.isGeneratingState || this.isLoadingState,
			elementId: this.data.id,
			canvas: this.canvas,
		})
		this.borderDecorator.create(this.backgroundNode)
	}

	/**
	 * 创建 Info 按钮
	 */
	private createInfoButton(group: Konva.Group, width: number, height: number): void {
		this.infoButtonDecorator = new InfoButtonDecorator(group, {
			elementId: this.data.id,
			canvas: this.canvas,
			width,
			height,
		})
		this.infoButtonDecorator.create()
	}

	/**
	 * 更新内容的反向缩放
	 */
	private updateContentScale(): void {
		if (!this.contentGroup || !(this.node instanceof Konva.Group)) {
			return
		}

		RenderUtils.updateContentScale(
			this.contentGroup,
			this.node,
			this.data.width || 0,
			this.data.height || 0,
		)
	}

	/**
	 * 设置内容更新事件监听
	 */
	private setupContentUpdateListener(group: Konva.Group): void {
		if (this.contentUpdateHandler) {
			return
		}

		this.contentUpdateHandler = () => {
			this.updateContentScale()
		}

		// 监听 viewport 缩放事件
		this.canvas.eventEmitter.on("viewport:scale", this.contentUpdateHandler)

		// 监听 Group 的 transform 事件
		group.on("transform", this.contentUpdateHandler)
	}

	/**
	 * 移除内容更新事件监听
	 */
	private removeContentUpdateListener(): void {
		if (this.contentUpdateHandler) {
			this.canvas.eventEmitter.off("viewport:scale", this.contentUpdateHandler)
		}

		if (this.node instanceof Konva.Group && this.contentUpdateHandler) {
			this.node.off("transform", this.contentUpdateHandler)
		}

		this.contentUpdateHandler = undefined
		this.contentGroup = undefined
	}

	/**
	 * 保存临时生成图片请求数据
	 */
	saveTempGenerateImageRequest(request: Partial<GenerateImageRequest>): void {
		this.tempGenerateImageRequest = request
		ImageElement.saveTempConfigToStorage(this.canvas, this.data.id, request)
	}

	/**
	 * 获取临时生成图片请求数据
	 */
	getTempGenerateImageRequest(): Partial<GenerateImageRequest> | undefined {
		return this.tempGenerateImageRequest
	}

	/**
	 * 清除临时生成图片请求数据
	 */
	clearTempGenerateImageRequest(): void {
		this.tempGenerateImageRequest = undefined
		ImageElement.clearTempConfigFromStorage(this.canvas, this.data.id)
	}

	/**
	 * 清除临时生成图片请求数据中的 prompt（保留其他配置）
	 */
	clearTempGenerateImageRequestPrompt(): void {
		if (this.tempGenerateImageRequest) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { prompt, ...rest } = this.tempGenerateImageRequest
			this.tempGenerateImageRequest = rest
			ImageElement.saveTempConfigToStorage(this.canvas, this.data.id, rest)
		}
	}

	/**
	 * 保存参考图信息（单个）
	 * 与 saveReferenceImageInfos 一致：对新项预加载资源，供 Popover 缩略图立即展示
	 */
	saveReferenceImageInfo(fileInfo: UploadImageResponse): void {
		const exists = this.referenceImageInfos.some((info) => info.path === fileInfo.path)
		if (!exists) {
			this.canvas.imageResourceManager.loadResource(fileInfo.path)
			this.referenceImageInfos.push(fileInfo)
		}
	}

	/**
	 * 批量保存参考图信息（追加模式，性能优化版本）
	 */
	saveReferenceImageInfos(fileInfos: UploadImageResponse[]): void {
		// 构建现有 path 的 Set，用于快速查重
		const existingPaths = new Set(this.referenceImageInfos.map((info) => info.path))

		// 过滤出不重复的新信息
		const newInfos = fileInfos.filter((info) => !existingPaths.has(info.path))

		// 为新的参考图加载资源
		newInfos.forEach((info) => {
			this.canvas.imageResourceManager.loadResource(info.path)
		})

		// 批量添加
		this.referenceImageInfos.push(...newInfos)
	}

	/**
	 * 完全替换参考图信息列表（用于重新排序或批量更新）
	 */
	setReferenceImageInfos(fileInfos: UploadImageResponse[]): void {
		// 为新的参考图加载资源
		fileInfos.forEach((info) => {
			this.canvas.imageResourceManager.loadResource(info.path)
		})

		// 完全替换
		this.referenceImageInfos = fileInfos

		// 触发资源回收事件
		this.canvas.eventEmitter.emit({
			type: "referenceImages:changed",
			data: { elementId: this.data.id },
		})
	}

	/**
	 * 获取参考图信息列表
	 */
	getReferenceImageInfos(): UploadImageResponse[] {
		return [...this.referenceImageInfos]
	}

	/**
	 * 移除参考图信息
	 * 触发资源回收：ImageResourceManager 会检查 usedPaths，释放不再被引用的资源
	 */
	removeReferenceImageInfo(path: string): void {
		this.referenceImageInfos = this.referenceImageInfos.filter((info) => info.path !== path)
		this.canvas.eventEmitter.emit({
			type: "referenceImages:changed",
			data: { elementId: this.data.id },
		})
	}

	/**
	 * 清除所有参考图信息
	 * 触发资源回收（与 removeReferenceImageInfo 一致）
	 */
	clearReferenceImageInfos(): void {
		this.referenceImageInfos = []
		this.canvas.eventEmitter.emit({
			type: "referenceImages:changed",
			data: { elementId: this.data.id },
		})
	}

	/**
	 * Image 在 transformend 时将 scale 应用到尺寸
	 */
	public override getTransformBehavior(): TransformBehavior {
		return TransformBehavior.APPLY_TO_SIZE
	}

	/**
	 * 应用变换到图片元素
	 * APPLY_TO_SIZE 行为：在实时缩放和 transformend 时将 scale 应用到 width/height
	 */
	public override applyTransform(
		updates: LayerElement,
		context: TransformContext,
	): Partial<LayerElement> {
		// 在实时缩放时应用到尺寸
		if (context.isRealtime && context.isScaling) {
			const scaleX = updates.scaleX ?? 1
			const scaleY = updates.scaleY ?? 1

			if (scaleX !== 1 || scaleY !== 1) {
				const newSize = this.applyScaleToSize(updates, context)

				// 更新裁剪区域
				this.updateClipRegion(newSize.width, newSize.height)

				return {
					x: updates.x,
					y: updates.y,
					width: newSize.width,
					height: newSize.height,
					scaleX: 1,
					scaleY: 1,
				}
			}
		}

		// transformend 时应用到尺寸
		if (!context.isRealtime) {
			const scaleX = updates.scaleX ?? 1
			const scaleY = updates.scaleY ?? 1

			if (scaleX !== 1 || scaleY !== 1) {
				const newSize = this.applyScaleToSize(updates, context)

				// 更新裁剪区域
				this.updateClipRegion(newSize.width, newSize.height)

				return {
					x: updates.x,
					y: updates.y,
					width: newSize.width,
					height: newSize.height,
					scaleX: 1,
					scaleY: 1,
				}
			}
		}

		// 其他情况（纯拖拽）
		return {
			x: updates.x,
			y: updates.y,
		}
	}

	/**
	 * 更新裁剪区域
	 */
	private updateClipRegion(width: number, height: number): void {
		if (this.node instanceof Konva.Group) {
			this.node.clipFunc((ctx) => {
				ctx.rect(0, 0, width, height)
			})
		}
	}

	/**
	 * 在 transform 过程中更新裁剪区域
	 * @deprecated 使用 applyTransform 替代
	 */
	public override onTransformResize(width: number, height: number): void {
		this.updateClipRegion(width, height)
	}
}
