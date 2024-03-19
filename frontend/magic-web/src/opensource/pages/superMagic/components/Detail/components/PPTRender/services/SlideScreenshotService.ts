import { snapdom } from "@zumer/snapdom"
import {
	decodeHTMLEntities,
	fallbackImageBase64,
	getFullContent,
} from "../../../contents/HTML/utils/full-content"

/**
 * Cache entry for slide screenshot
 */
interface ScreenshotCacheEntry {
	thumbnailUrl: string
	timestamp: number
	contentHash: string
}

/**
 * SlideScreenshotService - Manages screenshot generation with caching
 * Generates thumbnails from HTML content using snapDOM
 */
export class SlideScreenshotService {
	private cache: Map<string, ScreenshotCacheEntry> = new Map()
	private generatingUrls: Set<string> = new Set()

	/**
	 * Generate simple hash from content string
	 */
	private hashContent(content: string): string {
		let hash = 0
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32-bit integer
		}
		return hash.toString(36)
	}

	/**
	 * Generate screenshot for HTML content with caching
	 * @param url - Slide URL (used as cache key)
	 * @param content - HTML content to render
	 * @returns Object URL of the generated thumbnail
	 */
	async generateScreenshot(url: string, content: string): Promise<string> {
		if (!content) {
			throw new Error("Content is required")
		}

		const contentHash = this.hashContent(content)

		// Check cache first
		const cached = this.cache.get(url)
		if (cached && cached.contentHash === contentHash) {
			return cached.thumbnailUrl
		}

		// Check if already generating this URL
		if (this.generatingUrls.has(url)) {
			// Wait for ongoing generation
			return this.waitForGeneration(url)
		}

		// Mark as generating
		this.generatingUrls.add(url)

		try {
			const thumbnailUrl = await this.doGenerateScreenshot(content)

			// Cache the result
			this.cache.set(url, {
				thumbnailUrl,
				timestamp: Date.now(),
				contentHash,
			})

			return thumbnailUrl
		} finally {
			this.generatingUrls.delete(url)
		}
	}

	/**
	 * Wait for ongoing screenshot generation
	 */
	private async waitForGeneration(url: string): Promise<string> {
		// Poll until generation completes
		const maxWait = 15000 // 15 seconds - allow for longer iframe loads
		const startTime = Date.now()

		while (this.generatingUrls.has(url)) {
			if (Date.now() - startTime > maxWait) {
				throw new Error("Screenshot generation timeout")
			}
			await new Promise((resolve) => setTimeout(resolve, 100))
		}

		// Get from cache after generation completes
		const cached = this.cache.get(url)
		if (cached) {
			return cached.thumbnailUrl
		}

		throw new Error("Screenshot generation failed")
	}

	/**
	 * Perform actual screenshot generation
	 */
	private async doGenerateScreenshot(content: string): Promise<string> {
		// 创建临时容器用于渲染
		const container = document.createElement("div")
		container.style.cssText = `
			position: fixed;
			top: -9999px;
			left: -9999px;
			width: 1920px;
			height: 1080px;
			visibility: hidden;
			pointer-events: none;
			z-index: -1;
		`
		document.body.appendChild(container)

		let iframe: HTMLIFrameElement | null = null

		try {
			// 创建 iframe 用于隔离渲染
			iframe = document.createElement("iframe")
			iframe.style.cssText = "width: 100%; height: 100%; border: none;"
			// 禁用所有可能导致媒体播放的权限
			iframe.setAttribute("sandbox", "allow-scripts allow-same-origin")
			iframe.setAttribute("allow", "")
			container.appendChild(iframe)

			await this.setupScreenshotIframe({ iframe, content })

			// 使用 snapDOM 截图
			const iframeDoc = iframe.contentDocument
			if (!iframeDoc) {
				throw new Error("Iframe document not found")
			}

			const iframeBody = iframeDoc.body
			if (!iframeBody) {
				throw new Error("Iframe body not found")
			}

			await this.waitForImages(iframeDoc)

			const result = await snapdom(iframeBody, {
				width: 1920,
				height: 1080,
				backgroundColor: "#ffffff",
				fallbackURL: fallbackImageBase64,
			})

			const thumbnailUrl = await result.toWebp({
				width: 1920 / 4,
				height: 1080 / 4,
				quality: 0.8,
			})

			// 延迟清理以确保 blob 已完全处理并与 iframe 上下文分离
			// 使用 Promise 而不是 setTimeout，确保清理逻辑可控
			const iframeToCleanup = iframe
			await new Promise<void>((resolve) => {
				setTimeout(() => {
					this.cleanupScreenshotResources(iframeToCleanup, container)
					resolve()
				}, 100)
			})

			return thumbnailUrl.src
		} catch (error) {
			// 出错时立即清理
			this.cleanupScreenshotResources(iframe, container)
			throw error
		}
	}

	/**
	 * Cleanup screenshot resources including iframe and container
	 */
	private cleanupScreenshotResources(
		iframe: HTMLIFrameElement | null,
		container: HTMLElement,
	): void {
		try {
			if (iframe) {
				const iframeDoc = iframe.contentDocument

				// Step 1: 先暂停所有媒体元素（在卸载前立即停止）
				if (iframeDoc) {
					try {
						// 停止所有视频元素
						const videos = iframeDoc.querySelectorAll("video")
						videos.forEach((video) => {
							try {
								video.pause()
								video.currentTime = 0
								// 移除所有 source 元素
								const sources = video.querySelectorAll("source")
								sources.forEach((source) => source.remove())
								video.src = ""
								video.load()
							} catch (e) {
								// 忽略单个元素清理错误
							}
						})

						// 停止所有音频元素
						const audios = iframeDoc.querySelectorAll("audio")
						audios.forEach((audio) => {
							try {
								audio.pause()
								audio.currentTime = 0
								// 移除所有 source 元素
								const sources = audio.querySelectorAll("source")
								sources.forEach((source) => source.remove())
								audio.src = ""
								audio.load()
							} catch (e) {
								// 忽略单个元素清理错误
							}
						})

						// 停止所有嵌套 iframe
						const iframes = iframeDoc.querySelectorAll("iframe")
						iframes.forEach((nestedIframe) => {
							try {
								nestedIframe.src = "about:blank"
							} catch (e) {
								// 忽略错误
							}
						})
					} catch (e) {
						console.warn("Failed to stop media elements:", e)
					}
				}

				// Step 2: 设置 iframe 为 about:blank（触发完整卸载）
				try {
					iframe.src = "about:blank"
				} catch (e) {
					console.warn("Failed to set iframe src:", e)
				}
			}

			// Step 3: 立即移除容器（DOM 移除会触发所有资源释放）
			if (container.parentNode) {
				container.parentNode.removeChild(container)
			}
		} catch (error) {
			console.warn("Failed to cleanup screenshot resources:", error)
		}
	}

	private async setupScreenshotIframe({
		iframe,
		content,
	}: {
		iframe: HTMLIFrameElement
		content: string
	}): Promise<void> {
		const IFRAME_LOAD_TIMEOUT = 10000
		const RENDER_WAIT_TIME = 1200
		const FALLBACK_WAIT_TIME = 2000

		// 用于清理所有监听器和定时器
		const cleanupFunctions: Array<() => void> = []

		try {
			// 直接初始化 iframe 内容（截图场景不需要 messenger 模式）
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("Iframe load timeout"))
				}, IFRAME_LOAD_TIMEOUT)

				cleanupFunctions.push(() => clearTimeout(timeout))

				let resolved = false
				const handleResolve = () => {
					if (resolved) return
					resolved = true
					resolve()
				}

				// 策略1: 使用 iframe onload 事件
				const loadHandler = () => handleResolve()
				iframe.addEventListener("load", loadHandler)
				cleanupFunctions.push(() => iframe.removeEventListener("load", loadHandler))

				// 在绑定监听器后写入内容
				if (!iframe.contentDocument) {
					reject(new Error("Failed to access iframe contentDocument"))
					return
				}

				const decodedContent = decodeHTMLEntities(content)
				let fullContent = getFullContent(decodedContent, undefined, {
					dynamicInterception: {
						enable: false,
					},
				})

				// 注入早期媒体暂停脚本（在 HTML 内容中）
				const earlyPauseScript = `
					<script data-screenshot-pause>
					(function() {
						// 立即暂停所有媒体元素
						function pauseMedia(element) {
							try {
								if (element.pause) element.pause();
								element.currentTime = 0;
								element.autoplay = false;
								element.muted = true;
								element.addEventListener('play', function(e) {
									e.preventDefault();
									e.stopPropagation();
									this.pause();
								}, true);
								element.addEventListener('loadeddata', function() {
									this.pause();
								}, true);
							} catch (e) {}
						}
						
						// 重写 HTMLMediaElement.prototype.play
						if (window.HTMLMediaElement) {
							const originalPlay = HTMLMediaElement.prototype.play;
							HTMLMediaElement.prototype.play = function() {
								return Promise.reject(new Error('Media playback disabled for screenshot'));
							};
						}
						
						// 监听所有媒体元素
						document.addEventListener('DOMContentLoaded', function() {
							document.querySelectorAll('video, audio').forEach(pauseMedia);
						});
						
						// 持续监听新添加的元素
						new MutationObserver(function(mutations) {
							mutations.forEach(function(mutation) {
								mutation.addedNodes.forEach(function(node) {
									if (node.nodeType === 1) {
										if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
											pauseMedia(node);
										}
										if (node.querySelectorAll) {
											node.querySelectorAll('video, audio').forEach(pauseMedia);
										}
									}
								});
							});
						}).observe(document.documentElement, { childList: true, subtree: true });
					})();
					</script>
				`

				// 将脚本注入到 <head> 标签的最前面
				fullContent = fullContent.replace(/<head>/i, "<head>" + earlyPauseScript)

				iframe.contentDocument.open()
				iframe.contentDocument.write(fullContent)
				iframe.contentDocument.close()

				const doc = iframe.contentDocument

				// 策略2: 监听文档就绪状态变化
				if (doc) {
					const checkReadyState = () => {
						if (doc.readyState === "complete" || doc.readyState === "interactive") {
							handleResolve()
						}
					}
					doc.addEventListener("readystatechange", checkReadyState)
					cleanupFunctions.push(() =>
						doc.removeEventListener("readystatechange", checkReadyState),
					)

					// 立即检查当前状态
					checkReadyState()

					// 策略3: DOMContentLoaded 作为备用
					const domContentLoadedHandler = () => handleResolve()
					doc.addEventListener("DOMContentLoaded", domContentLoadedHandler)
					cleanupFunctions.push(() =>
						doc.removeEventListener("DOMContentLoaded", domContentLoadedHandler),
					)
				}

				// 策略4: 最终备用方案 - 等待合理的时间
				const fallbackTimer = setTimeout(() => {
					if (!resolved && iframe.contentDocument?.body) {
						handleResolve()
					}
				}, FALLBACK_WAIT_TIME)
				cleanupFunctions.push(() => clearTimeout(fallbackTimer))
			})

			// 等待内容加载后注入暂停脚本
			await this.injectPauseScript(iframe)

			// 等待渲染完成
			await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT_TIME))

			const doc = iframe.contentDocument
			const win = iframe.contentWindow

			if (!doc || !win) {
				throw new Error("Iframe文档未就绪")
			}
		} finally {
			// 确保所有监听器和定时器都被清理
			cleanupFunctions.forEach((cleanup) => {
				try {
					cleanup()
				} catch (e) {
					console.warn("Failed to cleanup listener", e)
				}
			})
		}
	}

	/**
	 * Inject script to pause animations and media playback
	 */
	private async injectPauseScript(iframe: HTMLIFrameElement): Promise<void> {
		const win = iframe.contentWindow
		const doc = iframe.contentDocument

		if (!win || !doc) return

		// 等待 head 元素就绪
		await new Promise<void>((resolve) => {
			if (doc.head) {
				resolve()
				return
			}

			const observer = new MutationObserver(() => {
				if (doc.head) {
					observer.disconnect()
					resolve()
				}
			})

			observer.observe(doc.documentElement, {
				childList: true,
				subtree: true,
			})

			// 超时保护
			setTimeout(() => {
				observer.disconnect()
				resolve()
			}, 1000)
		})

		try {
			const pauseScript = doc.createElement("script")
			pauseScript.textContent = `
				(function() {
					// 暂停 CSS 动画
					var style = document.createElement('style');
					style.id = 'magic-animation-pause';
					style.textContent = '*{animation:none!important}*::before,*::after{animation:none!important}';
					if (document.head) {
						document.head.appendChild(style);
					}
					
					// 暂停媒体元素的函数
					function pauseMediaElement(element) {
						try {
							// 暂停播放
							if (element.pause) {
								element.pause();
							}
							// 重置到开始
							element.currentTime = 0;
							// 禁用自动播放
							element.autoplay = false;
							element.muted = true;
							// 阻止播放事件
							element.addEventListener('play', function(e) {
								e.preventDefault();
								e.stopPropagation();
								element.pause();
							}, true);
						} catch (e) {
							// 忽略错误
						}
					}
					
					// 暂停所有现有的视频和音频
					function pauseAllMedia() {
						try {
							var videos = document.querySelectorAll('video');
							var audios = document.querySelectorAll('audio');
							
							videos.forEach(pauseMediaElement);
							audios.forEach(pauseMediaElement);
						} catch (e) {
							console.warn('Failed to pause media:', e);
						}
					}
					
					// 立即暂停现有媒体
					pauseAllMedia();
					
					// 监听 DOM 变化，暂停新添加的媒体元素
					var observer = new MutationObserver(function(mutations) {
						mutations.forEach(function(mutation) {
							mutation.addedNodes.forEach(function(node) {
								if (node.nodeType === 1) { // ELEMENT_NODE
									if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
										pauseMediaElement(node);
									}
									// 检查子元素
									if (node.querySelectorAll) {
										var videos = node.querySelectorAll('video');
										var audios = node.querySelectorAll('audio');
										videos.forEach(pauseMediaElement);
										audios.forEach(pauseMediaElement);
									}
								}
							});
						});
					});
					
					// 开始观察
					observer.observe(document.documentElement, {
						childList: true,
						subtree: true
					});
					
					// 定期检查（防止某些动态加载的媒体被遗漏）
					setInterval(pauseAllMedia, 200);
				})();
			`
			doc.head?.appendChild(pauseScript)
		} catch (e) {
			console.warn("Failed to inject animation pause script", e)
		}
	}

	private async waitForImages(doc: Document): Promise<void> {
		const MAX_ATTEMPTS = 3
		const BASE_TIMEOUT = 400
		const BACKOFF_DELAYS = [100, 150]

		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
			const images = Array.from(doc.images)
			if (images.length === 0) return

			images.forEach((img) => {
				if (img.loading === "lazy") img.loading = "eager"
			})

			const pendingImages = images.filter(
				(img) => img.naturalWidth === 0 || img.naturalHeight === 0,
			)

			if (pendingImages.length === 0) return

			await this.waitForImagesOnce(pendingImages, BASE_TIMEOUT + attempt * 150)

			const remainingImages = Array.from(doc.images).filter(
				(img) => img.naturalWidth === 0 || img.naturalHeight === 0,
			)

			if (remainingImages.length === 0) return

			const backoffDelay = BACKOFF_DELAYS[attempt]
			if (backoffDelay) {
				await new Promise((resolve) => setTimeout(resolve, backoffDelay))
			}
		}
	}

	private async waitForImagesOnce(
		pendingImages: HTMLImageElement[],
		timeoutMs: number,
	): Promise<void> {
		await new Promise<void>((resolve) => {
			let remaining = pendingImages.length
			let finished = false

			const finalize = () => {
				if (finished) return
				finished = true
				pendingImages.forEach((img) => {
					img.removeEventListener("load", handleDone)
					img.removeEventListener("error", handleError)
				})
				clearTimeout(timeout)
				resolve()
			}

			const handleDone = () => {
				remaining -= 1
				if (remaining <= 0) finalize()
			}

			const handleError = () => {
				remaining -= 1
				if (remaining <= 0) finalize()
			}

			pendingImages.forEach((img) => {
				img.addEventListener("load", handleDone, { once: true })
				img.addEventListener("error", handleError, { once: true })
			})

			const timeout = setTimeout(() => {
				finalize()
			}, timeoutMs)
		})
	}

	/**
	 * Get cached screenshot if available
	 */
	getCachedScreenshot(url: string): string | null {
		const cached = this.cache.get(url)
		return cached ? cached.thumbnailUrl : null
	}

	/**
	 * Check if screenshot is cached
	 */
	hasCachedScreenshot(url: string, content?: string): boolean {
		const cached = this.cache.get(url)
		if (!cached) return false

		// If content is provided, verify it matches
		if (content) {
			const contentHash = this.hashContent(content)
			return cached.contentHash === contentHash
		}

		return true
	}

	/**
	 * Clear cache for specific URL
	 */
	clearCache(url: string): void {
		const cached = this.cache.get(url)
		if (cached) {
			URL.revokeObjectURL(cached.thumbnailUrl)
			this.cache.delete(url)
		}
	}

	/**
	 * Clear all cached screenshots
	 */
	clearAllCache(): void {
		this.cache.forEach((entry) => {
			URL.revokeObjectURL(entry.thumbnailUrl)
		})
		this.cache.clear()
	}

	/**
	 * Clear old cached screenshots (older than maxAge milliseconds)
	 */
	clearOldCache(maxAge: number = 300000): void {
		// Default: 5 minutes
		const now = Date.now()
		const toDelete: string[] = []

		this.cache.forEach((entry, url) => {
			if (now - entry.timestamp > maxAge) {
				URL.revokeObjectURL(entry.thumbnailUrl)
				toDelete.push(url)
			}
		})

		toDelete.forEach((url) => this.cache.delete(url))
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats() {
		return {
			size: this.cache.size,
			urls: Array.from(this.cache.keys()),
		}
	}

	/**
	 * Cleanup all resources
	 */
	dispose(): void {
		this.clearAllCache()
		this.generatingUrls.clear()
	}
}

// Singleton instance for global use
let globalScreenshotService: SlideScreenshotService | null = null

/**
 * Get or create global screenshot service instance
 */
export function getScreenshotService(): SlideScreenshotService {
	if (!globalScreenshotService) {
		globalScreenshotService = new SlideScreenshotService()
	}
	return globalScreenshotService
}

/**
 * Factory function to create a new instance
 */
export function createScreenshotService(): SlideScreenshotService {
	return new SlideScreenshotService()
}
