/**
 * 媒体文件 src 拦截器工具函数
 * 用于在iframe中拦截Audio和Video元素的src设置，使用预加载的URL映射进行同步解析
 *
 * 支持的元素类型：HTMLAudioElement, HTMLVideoElement
 * 支持的媒体格式：音频(.mp3, .wav, .ogg等) 和 视频(.mp4, .webm, .avi等)
 */

// getTemporaryDownloadUrl 和 findMatchingFile 已移除，因为现在使用纯同步的预加载方案
import type { FileItem } from "./fetchInterceptor"

// 重新导出 FileItem 类型
export type { FileItem }

export interface MediaInterceptorConfig {
	/** 是否启用相对路径拦截 */
	enableRelativePathInterception?: boolean
	/** 预加载的文件URL映射表 */
	preloadedUrlMapping?: Record<string, string>
}

/**
 * 生成媒体文件 src 拦截器脚本
 * 拦截 HTMLAudioElement 和 HTMLVideoElement 的 src 属性设置，使用预加载映射进行同步解析
 *
 * 特性：
 * - 预加载映射：所有媒体文件URL在脚本执行前已预先获取
 * - 同步解析：无需异步请求，直接从映射表中查找URL
 * - 路径变体匹配：支持多种相对路径格式的匹配
 * - 完整拦截：同时拦截 src 属性和 setAttribute 方法
 * - 双元素支持：同时支持 Audio 和 Video 元素
 *
 * @param config 拦截器配置
 * @returns 拦截器脚本字符串
 */
export function generateMediaInterceptorScript(config: MediaInterceptorConfig = {}): string {
	const preloadedMapping = config.preloadedUrlMapping || {}
	const preloadedMappingJson = JSON.stringify(preloadedMapping)

	return `
(function() {
	// 预加载的URL映射表
	const preloadedUrlMapping = ${preloadedMappingJson};
	const urlCache = new Map(Object.entries(preloadedUrlMapping));
	
	// 检查是否为相对路径
	function isRelativePath(url) {
		return !/^(https?:\\/\\/|\\/\\/|data:|blob:)/.test(url);
	}
	
	// 同步解析URL（使用预加载映射）
	function resolveMediaUrlSync(url) {
		if (!url || !${config.enableRelativePathInterception !== false} || !isRelativePath(url)) {
			return url;
		}
		
		// 1. 检查预加载的映射表
		if (urlCache.has(url)) {
			return urlCache.get(url);
		}
		
		// 2. 尝试匹配相对路径的变体
		const pathVariants = [
			url,
			url.startsWith('./') ? url.slice(2) : './' + url,
			url.startsWith('/') ? url.slice(1) : '/' + url,
		];
		
		for (const variant of pathVariants) {
			if (urlCache.has(variant)) {
				const resolvedUrl = urlCache.get(variant);
				// 缓存这个映射关系，避免下次再查找
				urlCache.set(url, resolvedUrl);
				return resolvedUrl;
			}
		}
		
		// 3. 如果预加载映射中没有找到，返回原始URL
		return url;
	}
	
	// 拦截 Audio 和 Video 元素的 src 属性
	let originalAudioSrcDescriptor, originalVideoSrcDescriptor;
	let originalAudioSetAttribute, originalVideoSetAttribute;
	
	try {
		// 尝试从多个位置获取 src 描述符
		originalAudioSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype, 'src') ||
									  Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src') ||
									  Object.getOwnPropertyDescriptor(Element.prototype, 'src');
		
		originalVideoSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'src') ||
									 Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src') ||
									 Object.getOwnPropertyDescriptor(Element.prototype, 'src');
		
		// 如果仍然无法获取描述符，创建一个备用方案
		if (!originalAudioSrcDescriptor) {
			originalAudioSrcDescriptor = {
				get: function() { return this.getAttribute('src') || ''; },
				set: function(value) { 
					if (value) {
						this.setAttribute('src', value);
					} else {
						this.removeAttribute('src');
					}
				},
				enumerable: true,
				configurable: true
			};
		}
		
		if (!originalVideoSrcDescriptor) {
			originalVideoSrcDescriptor = {
				get: function() { return this.getAttribute('src') || ''; },
				set: function(value) { 
					if (value) {
						this.setAttribute('src', value);
					} else {
						this.removeAttribute('src');
					}
				},
				enumerable: true,
				configurable: true
			};
		}
		
		originalAudioSetAttribute = HTMLAudioElement.prototype.setAttribute;
		originalVideoSetAttribute = HTMLVideoElement.prototype.setAttribute;
	} catch (error) {
		return; // 如果获取失败，直接返回
	}
	
	// 重写 Audio src 属性的 setter（纯同步版本）
	try {
		Object.defineProperty(HTMLAudioElement.prototype, 'src', {
			get: originalAudioSrcDescriptor.get,
			set: function(url) {
				if (!url) {
					return originalAudioSrcDescriptor.set.call(this, url);
				}
				
				const resolvedUrl = resolveMediaUrlSync(url);
				return originalAudioSrcDescriptor.set.call(this, resolvedUrl);
			},
			enumerable: true,
			configurable: true
		});
	} catch (error) {
		// 静默处理错误
	}
	
	// 重写 Video src 属性的 setter（纯同步版本）
	try {
		Object.defineProperty(HTMLVideoElement.prototype, 'src', {
			get: originalVideoSrcDescriptor.get,
			set: function(url) {
				if (!url) {
					return originalVideoSrcDescriptor.set.call(this, url);
				}
				
				const resolvedUrl = resolveMediaUrlSync(url);
				return originalVideoSrcDescriptor.set.call(this, resolvedUrl);
			},
			enumerable: true,
			configurable: true
		});
	} catch (error) {
		// 静默处理错误
	}
	
	// 重写 Audio setAttribute 方法（纯同步版本）
	try {
		HTMLAudioElement.prototype.setAttribute = function(name, value) {
			if (name.toLowerCase() === 'src' && value) {
				const resolvedValue = resolveMediaUrlSync(value);
				return originalAudioSetAttribute.call(this, name, resolvedValue);
			} else {
				return originalAudioSetAttribute.call(this, name, value);
			}
		};
	} catch (error) {
		// 静默处理错误
	}
	
	// 重写 Video setAttribute 方法（纯同步版本）
	try {
		HTMLVideoElement.prototype.setAttribute = function(name, value) {
			if (name.toLowerCase() === 'src' && value) {
				const resolvedValue = resolveMediaUrlSync(value);
				return originalVideoSetAttribute.call(this, name, resolvedValue);
			} else {
				return originalVideoSetAttribute.call(this, name, value);
			}
		};
	} catch (error) {
		// 静默处理错误
	}
	
	// 处理页面中已存在的媒体元素
	function processExistingElements() {
		// 处理所有现有的 audio 元素
		const existingAudios = document.querySelectorAll('audio');
		existingAudios.forEach((audio) => {
			const attrSrc = audio.getAttribute('src');
			if (attrSrc) {
				const resolvedSrc = resolveMediaUrlSync(attrSrc);
				if (resolvedSrc !== attrSrc) {
					originalAudioSrcDescriptor.set.call(audio, resolvedSrc);
				}
			}
		});
		
		// 处理所有现有的 video 元素
		const existingVideos = document.querySelectorAll('video');
		existingVideos.forEach((video) => {
			const attrSrc = video.getAttribute('src');
			if (attrSrc) {
				const resolvedSrc = resolveMediaUrlSync(attrSrc);
				if (resolvedSrc !== attrSrc) {
					originalVideoSrcDescriptor.set.call(video, resolvedSrc);
				}
			}
		});
	}
	
	// 立即处理现有元素
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', processExistingElements);
	} else {
		processExistingElements();
	}
	
	// 监听动态添加的元素
	if (window.MutationObserver) {
		const observer = new MutationObserver(function(mutations) {
			mutations.forEach(function(mutation) {
				mutation.addedNodes.forEach(function(node) {
					if (node.nodeType === Node.ELEMENT_NODE) {
						// 检查新添加的 audio/video 元素
						if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
							const attrSrc = node.getAttribute('src');
							if (attrSrc) {
								const resolvedSrc = resolveMediaUrlSync(attrSrc);
								if (resolvedSrc !== attrSrc) {
									if (node.tagName === 'AUDIO') {
										originalAudioSrcDescriptor.set.call(node, resolvedSrc);
									} else {
										originalVideoSrcDescriptor.set.call(node, resolvedSrc);
									}
								}
							}
						}
						// 检查新添加元素的子元素中是否有 audio/video
						if (node.querySelectorAll) {
							const childAudios = node.querySelectorAll('audio[src]');
							const childVideos = node.querySelectorAll('video[src]');
							childAudios.forEach(audio => {
								const attrSrc = audio.getAttribute('src');
								if (attrSrc) {
									const resolvedSrc = resolveMediaUrlSync(attrSrc);
									if (resolvedSrc !== attrSrc) {
										originalAudioSrcDescriptor.set.call(audio, resolvedSrc);
									}
								}
							});
							childVideos.forEach(video => {
								const attrSrc = video.getAttribute('src');
								if (attrSrc) {
									const resolvedSrc = resolveMediaUrlSync(attrSrc);
									if (resolvedSrc !== attrSrc) {
										originalVideoSrcDescriptor.set.call(video, resolvedSrc);
									}
								}
							});
						}
					}
				});
			});
		});
		
		observer.observe(document.body || document.documentElement, {
			childList: true,
			subtree: true
		});
	}
})();
`
}

/**
 * 默认的 Media 拦截器配置
 */
export const defaultMediaInterceptorConfig: MediaInterceptorConfig = {
	enableRelativePathInterception: true,
}

/**
 * 创建预加载的URL映射表
 * @param allFiles 所有文件列表
 * @param urlMap 已获取的URL映射
 * @param htmlRelativeFolderPath HTML文件的相对文件夹路径
 * @returns 预加载的URL映射表
 */
export function createPreloadedUrlMapping(
	allFiles: FileItem[],
	urlMap: Map<string, { url?: string }>,
	htmlRelativeFolderPath: string,
): Record<string, string> {
	const mapping: Record<string, string> = {}

	// 定义支持的媒体文件扩展名
	const mediaExtensions = [
		".mp3",
		".wav",
		".ogg",
		".m4a",
		".aac",
		".flac", // 音频格式
		".mp4",
		".webm",
		".avi",
		".mov",
		".mkv",
		".wmv", // 视频格式
	]

	// 遍历所有文件，查找媒体文件
	allFiles.forEach((file) => {
		if (!file.relative_file_path || !file.file_name) return

		// 检查是否为媒体文件
		const isMediaFile = mediaExtensions.some((ext) =>
			file.file_name?.toLowerCase().endsWith(ext),
		)

		if (isMediaFile) {
			// 计算相对于HTML文件的路径
			let relativePath = file.relative_file_path
			if (htmlRelativeFolderPath && htmlRelativeFolderPath !== "/") {
				// 如果HTML文件在子目录中，需要计算相对路径
				const htmlSegments = htmlRelativeFolderPath.split("/").filter((s) => s)
				const fileSegments = file.relative_file_path.split("/").filter((s) => s)

				// 找到共同的前缀
				let commonLength = 0
				while (
					commonLength < Math.min(htmlSegments.length, fileSegments.length) &&
					htmlSegments[commonLength] === fileSegments[commonLength]
				) {
					commonLength++
				}

				// 构建相对路径
				const backSteps = htmlSegments.length - commonLength
				const forwardSteps = fileSegments.slice(commonLength)

				if (backSteps === 0) {
					relativePath = forwardSteps.join("/")
				} else {
					relativePath = "../".repeat(backSteps) + forwardSteps.join("/")
				}
			}

			// 检查是否已经获取了OSS URL
			const urlInfo = urlMap.get(file.file_id)
			if (urlInfo && urlInfo.url) {
				// 添加多种路径变体到映射表
				// 注意：不包含仅文件名，避免不同目录下的同名文件互相覆盖
				const pathVariants = [
					relativePath,
					relativePath.startsWith("/") ? relativePath.slice(1) : "/" + relativePath,
					relativePath.startsWith("./") ? relativePath : "./" + relativePath,
					// 移除 file.file_name，严格按目录和层级匹配，不允许跨目录匹配
				]

				pathVariants.forEach((variant) => {
					if (variant && !mapping[variant] && urlInfo.url) {
						mapping[variant] = urlInfo.url
					}
				})
			}
		}
	})

	return mapping
}

/**
 * 为HTML内容注入 Media src 拦截器脚本
 * @param htmlContent 原始HTML内容
 * @param config Media拦截器配置
 * @returns 注入脚本后的HTML内容
 */
export function injectMediaInterceptorScript(
	htmlContent: string,
	config: MediaInterceptorConfig = defaultMediaInterceptorConfig,
): string {
	const mediaInterceptorScript = generateMediaInterceptorScript(config)

	if (!mediaInterceptorScript) {
		return htmlContent
	}

	let finalContent = htmlContent

	// 在head标签中注入 Media 拦截器脚本
	const headEndIndex = finalContent.indexOf("</head>")
	if (headEndIndex !== -1) {
		const scriptTag = `<script data-injected="media-interceptor">${mediaInterceptorScript}</script>`
		finalContent =
			finalContent.slice(0, headEndIndex) + scriptTag + finalContent.slice(headEndIndex)
	} else {
		// 如果没有head标签，在html开始处注入
		const htmlStartIndex = finalContent.indexOf("<html")
		if (htmlStartIndex !== -1) {
			const htmlTagEndIndex = finalContent.indexOf(">", htmlStartIndex) + 1
			const scriptTag = `<script data-injected="media-interceptor">${mediaInterceptorScript}</script>`
			finalContent =
				finalContent.slice(0, htmlTagEndIndex) +
				scriptTag +
				finalContent.slice(htmlTagEndIndex)
		}
	}

	return finalContent
}

// ============== 兼容旧API的别名导出 ==============

/** @deprecated 使用 MediaInterceptorConfig 代替 */
export type AudioInterceptorConfig = MediaInterceptorConfig

/** @deprecated 使用 generateMediaInterceptorScript 代替 */
export const generateAudioInterceptorScript = generateMediaInterceptorScript

/** @deprecated 使用 defaultMediaInterceptorConfig 代替 */
export const defaultAudioInterceptorConfig = defaultMediaInterceptorConfig

/** @deprecated 使用 injectMediaInterceptorScript 代替 */
export const injectAudioInterceptorScript = injectMediaInterceptorScript
