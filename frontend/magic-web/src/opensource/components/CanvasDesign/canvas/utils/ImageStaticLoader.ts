/**
 * 静态图片加载管理器
 * 专门用于加载静态资源（如图标、背景图等）
 * 提供图片加载、缓存和去重功能
 */
export class ImageStaticLoader {
	// 静态缓存，所有实例共享
	private static cachedImages: Map<string, HTMLImageElement> = new Map()
	// 用于跟踪正在加载的图片，避免重复请求
	private static loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map()

	/**
	 * 加载图片（带缓存和去重）
	 * @param imageSrc 图片源
	 * @returns Promise<HTMLImageElement>
	 */
	public async loadImage(imageSrc: string): Promise<HTMLImageElement> {
		// 检查缓存
		const cached = ImageStaticLoader.cachedImages.get(imageSrc)
		if (cached) {
			return Promise.resolve(cached)
		}

		// 检查是否正在加载中，避免重复请求
		const loadingPromise = ImageStaticLoader.loadingPromises.get(imageSrc)
		if (loadingPromise) {
			return loadingPromise
		}

		// 创建新的加载 Promise
		const promise = new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image()
			image.onload = () => {
				// 缓存图片
				ImageStaticLoader.cachedImages.set(imageSrc, image)
				// 移除加载中标记
				ImageStaticLoader.loadingPromises.delete(imageSrc)
				resolve(image)
			}
			image.onerror = (error) => {
				// 移除加载中标记
				ImageStaticLoader.loadingPromises.delete(imageSrc)
				reject(error)
			}
			image.src = imageSrc
		})

		// 记录加载中的 Promise
		ImageStaticLoader.loadingPromises.set(imageSrc, promise)
		return promise
	}

	/**
	 * 获取缓存的图片
	 * @param imageSrc 图片源
	 * @returns HTMLImageElement | undefined
	 */
	public getCachedImage(imageSrc: string): HTMLImageElement | undefined {
		return ImageStaticLoader.cachedImages.get(imageSrc)
	}

	/**
	 * 检查图片是否已缓存
	 * @param imageSrc 图片源
	 * @returns boolean
	 */
	public isCached(imageSrc: string): boolean {
		return ImageStaticLoader.cachedImages.has(imageSrc)
	}

	/**
	 * 检查图片是否正在加载
	 * @param imageSrc 图片源
	 * @returns boolean
	 */
	public isLoading(imageSrc: string): boolean {
		return ImageStaticLoader.loadingPromises.has(imageSrc)
	}

	/**
	 * 清除指定图片的缓存
	 * @param imageSrc 图片源
	 */
	public clearCache(imageSrc: string): void {
		ImageStaticLoader.cachedImages.delete(imageSrc)
	}

	/**
	 * 清除所有缓存
	 */
	public clearAllCache(): void {
		ImageStaticLoader.cachedImages.clear()
	}

	/**
	 * 预加载多个图片
	 * @param imageSrcs 图片源数组
	 * @returns Promise<HTMLImageElement[]>
	 */
	public async preloadImages(imageSrcs: string[]): Promise<HTMLImageElement[]> {
		return Promise.all(imageSrcs.map((src) => this.loadImage(src)))
	}
}
