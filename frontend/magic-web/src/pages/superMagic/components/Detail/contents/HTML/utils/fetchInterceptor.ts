/**
 * Fetch拦截器工具函数
 * 用于在iframe中拦截fetch请求，通过postMessage与父容器通信获取资源URL
 *
 * 消息类型命名空间: MAGIC_FETCH_*
 * 避免与其他iframe通信消息冲突，现有消息类型包括：
 * - contentLoaded, domReady, renderComplete, pageFullyLoaded
 * - linkClicked, DOM_CLICK, saveContent
 * - editModeChange, injectEditScript
 * - IMAGE_UPLOAD_RESULT, REQUEST_IMAGE_UPLOAD
 * - AI_OPTIMIZATION_ACTION, DashboardCardsChange
 */

import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { env } from "@/utils/env"
import { handleHtCdnUrl } from "./index"

// 消息类型常量，使用 MAGIC_FETCH_ 前缀避免冲突
export const FETCH_MESSAGE_TYPES = {
	REQUEST: "MAGIC_FETCH_URL_REQUEST",
	RESPONSE: "MAGIC_FETCH_URL_RESPONSE",
} as const

// 键盘快捷键消息类型常量，使用 MAGIC_KEYBOARD_ 前缀
export const KEYBOARD_MESSAGE_TYPES = {
	SAVE: "MAGIC_KEYBOARD_SAVE",
	SAVE_AND_EXIT: "MAGIC_KEYBOARD_SAVE_AND_EXIT",
	CANCEL: "MAGIC_KEYBOARD_CANCEL",
	SOURCE: "magic-html-iframe",
} as const

export interface FileItem {
	file_id: string
	relative_file_path: string
	file_name?: string
	updated_at?: string
}

// 从文件记录中提取“所在目录”路径（以 / 结尾）
function getFolderPathFromFile(file: FileItem): string {
	const filePath = file.relative_file_path || ""
	if (!filePath) return "/"
	if (file.file_name && filePath.endsWith(file.file_name))
		return filePath.slice(0, -file.file_name.length)

	const slashIndex = filePath.lastIndexOf("/")
	if (slashIndex < 0) return "/"
	return filePath.slice(0, slashIndex + 1)
}

export function resolveRequesterFolderPath(
	allFiles: FileItem[],
	requesterFileId: string | undefined,
	fallbackFolderPath: string,
): string {
	// 未携带 fileId 时回退到当前页面目录
	if (!requesterFileId) return fallbackFolderPath
	const requesterFile = allFiles.find((item) => item.file_id === requesterFileId)
	if (!requesterFile) return fallbackFolderPath
	return getFolderPathFromFile(requesterFile)
}

export function isKnownRequestFileId(
	allFiles: FileItem[],
	currentFileId: string,
	requesterFileId: string | undefined,
): boolean {
	// 兼容历史消息：未带 fileId 的请求先放行
	if (!requesterFileId) return true
	if (requesterFileId === currentFileId) return true
	// 允许同附件树内的嵌套文件请求
	return allFiles.some((item) => item.file_id === requesterFileId)
}

export interface FetchInterceptorConfig {
	/** 是否启用相对路径拦截 */
	enableRelativePathInterception?: boolean
	/** 文件ID，用于验证请求来源 */
	fileId?: string
}

/**
 * 生成fetch拦截器脚本
 * 通过postMessage与父容器通信来解析相对路径
 *
 * 特性：
 * - Promise缓存：避免同时发起多个相同URL的请求
 * - 结果缓存：已解析的URL会被缓存，避免重复解析
 * - 错误处理：请求失败时自动清理缓存状态
 * - 文件ID验证：通过fileId确保请求来自正确的iframe
 *
 * @param config 拦截器配置
 * @returns 拦截器脚本字符串
 */
export function generateFetchInterceptorScript(config: FetchInterceptorConfig = {}): string {
	const { fileId = "" } = config

	if (!env("MAGIC_CDNHOST")) {
		return ""
	}

	const cdnHost = env("MAGIC_CDNHOST")

	// 将 handleHtCdnUrl 函数转换为字符串
	let handleHtCdnUrlString = handleHtCdnUrl.toString()

	// 智能识别编译后的函数名称
	// 匹配模式：functionName("MAGIC_CDNHOST") 或 ${functionName("MAGIC_CDNHOST")}
	const envFunctionMatch = handleHtCdnUrlString.match(/(\w+)\(["']MAGIC_CDNHOST["']\)/)
	const compiledFunctionName = envFunctionMatch ? envFunctionMatch[1] : "env"

	// 直接将所有 env("MAGIC_CDNHOST") 调用替换为实际的 CDN 地址
	handleHtCdnUrlString = handleHtCdnUrlString
		// 替换模板字符串中的 ${compiledFunctionName("MAGIC_CDNHOST")}
		.replace(
			new RegExp(`\\$\\{${compiledFunctionName}\\(["']MAGIC_CDNHOST["']\\)\\}`, "g"),
			cdnHost,
		)
		// 替换普通调用 compiledFunctionName("MAGIC_CDNHOST")
		.replace(
			new RegExp(`${compiledFunctionName}\\(["']MAGIC_CDNHOST["']\\)`, "g"),
			`"${cdnHost}"`,
		)

	return `
(function() {
	// 设置文件ID，用于验证请求来源
	window.__MAGIC_FILE_ID__ = '${fileId}';
	
	// 保存原始的fetch函数
	const originalFetch = window.fetch;
	
	// URL缓存，存储已解析的URL
	const urlCache = new Map();
	// 正在进行的请求缓存，避免同时发起多个相同的请求
	const pendingRequests = new Map();
	
	// 检查是否为相对路径
	function isRelativePath(url) {
		return !/^(https?:\\/\\/|\\/\\/|data:|blob:)/.test(url);
	}
	
	// 生成唯一的请求ID
	function generateRequestId() {
		return 'fetch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
	}
	
	// 检查是否为 HTML 文件
	function isHtmlFile(url) {
		const cleanUrl = url.split(/[?#]/)[0];
		return cleanUrl.toLowerCase().endsWith('.html') || cleanUrl.toLowerCase().endsWith('.htm');
	}
	
	// 注入 CDN 处理函数
	const handleHtCdnUrl = ${handleHtCdnUrlString};
	
	// 处理 HTML 内容 - 注入所有必要的脚本和替换CDN资源
	function processHtmlContent(htmlContent) {
		try {
			const htmlDoc = handleHtCdnUrl(htmlContent);
			return htmlDoc.documentElement.outerHTML;
		} catch (error) {
			console.error('处理 HTML CDN 替换失败:', error);
			return htmlContent;
		}
	}
	
	// 通过postMessage请求父容器解析URL
	function requestUrlFromParent(relativePath) {
		return new Promise((resolve, reject) => {
			const requestId = generateRequestId();
			
			// 设置超时
			const timeout = setTimeout(() => {
				window.removeEventListener('message', messageHandler);
				// 清理pending状态
				pendingRequests.delete(relativePath);
				reject(new Error('URL解析超时'));
			}, 10000); // 10秒超时
	
		// 监听父容器的响应
		function messageHandler(event) {
			if (
				event.data &&
				event.data.type === '${FETCH_MESSAGE_TYPES.RESPONSE}' &&
				event.data.requestId === requestId
			) {
					clearTimeout(timeout);
					window.removeEventListener('message', messageHandler);
					
					if (event.data.success) {
						// 缓存结果到urlCache
						urlCache.set(relativePath, event.data.url);
						// 清理pending状态
						pendingRequests.delete(relativePath);
						resolve(event.data.url);
					} else {
						// 清理pending状态
						pendingRequests.delete(relativePath);
						reject(new Error(event.data.error || 'URL解析失败'));
					}
				}
			}
			
			window.addEventListener('message', messageHandler);
			
		// 向顶层容器发送请求，支持多层 iframe
		(window.top || window.parent).postMessage({
			type: '${FETCH_MESSAGE_TYPES.REQUEST}',
			requestId: requestId,
			relativePath: relativePath,
			fileId: window.__MAGIC_FILE_ID__ || ''
		}, '*');
		});
	}
	
	// 重写fetch函数
	window.fetch = async function(input, init = {}) {
		// 获取URL
		let url = typeof input === 'string' ? input : input.url;
		const originalUrl = url;
		
		// 如果是相对路径且启用了拦截
		if (${config.enableRelativePathInterception !== false} && isRelativePath(url)) {
			// 检查是否为 HTML 文件
			const isHtml = isHtmlFile(url);
			
			// 1. 检查已完成的缓存
			if (urlCache.has(url)) {
				const cachedUrl = urlCache.get(url);
				// 如果缓存的是错误标记，返回404响应
				if (cachedUrl === '__NOT_FOUND__') {
					return Promise.resolve(new Response(null, {
						status: 404,
						statusText: 'Not Found',
						headers: { 'Content-Type': 'text/plain' }
					}));
				}
				url = cachedUrl;
			} 
			// 2. 检查是否有正在进行的请求
			else if (pendingRequests.has(url)) {
				try {
					// 等待正在进行的请求完成
					const resolvedUrl = await pendingRequests.get(url);
					url = resolvedUrl;
				} catch (error) {
					// 如果pending请求失败，返回404响应
					return Promise.resolve(new Response(null, {
						status: 404,
						statusText: 'Not Found',
						headers: { 'Content-Type': 'text/plain' }
					}));
				}
			} 
			// 3. 发起新的请求
			else {
				try {
					// 创建Promise并缓存到pending中
					const requestPromise = requestUrlFromParent(url);
					pendingRequests.set(url, requestPromise);
					
					const resolvedUrl = await requestPromise;
					url = resolvedUrl;
				} catch (error) {
					// 请求失败，缓存错误标记并返回404响应
					urlCache.set(url, '__NOT_FOUND__');
					return Promise.resolve(new Response(null, {
						status: 404,
						statusText: 'Not Found',
						headers: { 'Content-Type': 'text/plain' }
					}));
				}
			}
			
			// 如果是 HTML 文件，拦截响应并处理内容
			if (isHtml) {
				try {
					const response = await originalFetch.call(this, url, init);
					
					// 只处理成功的响应
					if (response.ok) {
						const htmlContent = await response.text();
						// 处理 HTML 内容
						const processedHtml = processHtmlContent(htmlContent);
						
						// 返回处理后的内容
						return new Response(processedHtml, {
							status: response.status,
							statusText: response.statusText,
							headers: response.headers
						});
					}
					
					// 非成功响应，直接返回
					return response;
				} catch (error) {
					console.error('处理 HTML 内容失败:', error);
					// 失败时调用原始 fetch
					return originalFetch.call(this, url, init);
				}
			}
		}
		
		// 调用原始fetch函数
		return originalFetch.call(this, url, init);
	};
	
	// 保持原始fetch的属性 (WebView 中可能不可配置)
	try {
		Object.defineProperty(window.fetch, 'toString', {
			value: () => 'function fetch() { [native code] }'
		});
	} catch (e) {}
	
	// 拦截 XMLHttpRequest (AJAX)
	const OriginalXHR = window.XMLHttpRequest;
	const originalOpen = OriginalXHR.prototype.open;
	
	OriginalXHR.prototype.open = function(method, url, async, user, password) {
		// 保存原始URL
		this._originalUrl = url;
		
		// 如果是相对路径且启用了拦截
		if (${config.enableRelativePathInterception !== false} && isRelativePath(url)) {
			// 标记这个请求需要处理
			this._needsInterception = true;
			this._interceptedUrl = url;
			
			// 先用原始URL调用open（后续会在send中替换）
			return originalOpen.call(this, method, url, async !== false, user, password);
		}
		
		// 非相对路径，直接调用原始方法
		return originalOpen.call(this, method, url, async !== false, user, password);
	};
	
	const originalSend = OriginalXHR.prototype.send;
	
	OriginalXHR.prototype.send = async function(body) {
		// 如果不需要拦截，直接发送
		if (!this._needsInterception) {
			return originalSend.call(this, body);
		}
		
		const interceptedUrl = this._interceptedUrl;
		
		try {
			// 1. 检查缓存
			if (urlCache.has(interceptedUrl)) {
				const cachedUrl = urlCache.get(interceptedUrl);
				
				// 如果缓存的是错误标记，返回404
				if (cachedUrl === '__NOT_FOUND__') {
					try {
						Object.defineProperty(this, 'status', { value: 404, writable: false });
						Object.defineProperty(this, 'statusText', { value: 'Not Found', writable: false });
						Object.defineProperty(this, 'responseText', { value: '', writable: false });
						Object.defineProperty(this, 'response', { value: '', writable: false });
						Object.defineProperty(this, 'readyState', { value: 4, writable: false });
					} catch (e) {}
					// 触发事件
					setTimeout(() => {
						if (this.onreadystatechange) this.onreadystatechange();
						if (this.onload) this.onload();
					}, 0);
					return;
				}
				
				// 使用缓存的URL重新open
				const method = this._method || 'GET';
				const async = this._async !== false;
				originalOpen.call(this, method, cachedUrl, async);
				return originalSend.call(this, body);
			}
			
			// 2. 检查pending请求
			if (pendingRequests.has(interceptedUrl)) {
				try {
					const resolvedUrl = await pendingRequests.get(interceptedUrl);
					const method = this._method || 'GET';
					const async = this._async !== false;
					originalOpen.call(this, method, resolvedUrl, async);
					return originalSend.call(this, body);
				} catch (error) {
					try {
						Object.defineProperty(this, 'status', { value: 404, writable: false });
						Object.defineProperty(this, 'statusText', { value: 'Not Found', writable: false });
						Object.defineProperty(this, 'responseText', { value: '', writable: false });
						Object.defineProperty(this, 'response', { value: '', writable: false });
						Object.defineProperty(this, 'readyState', { value: 4, writable: false });
					} catch (e) {}
					setTimeout(() => {
						if (this.onreadystatechange) this.onreadystatechange();
						if (this.onload) this.onload();
					}, 0);
					return;
				}
			}
			
			// 3. 发起新的请求
			try {
				const requestPromise = requestUrlFromParent(interceptedUrl);
				pendingRequests.set(interceptedUrl, requestPromise);
				
				const resolvedUrl = await requestPromise;
				const method = this._method || 'GET';
				const async = this._async !== false;
				originalOpen.call(this, method, resolvedUrl, async);
				return originalSend.call(this, body);
			} catch (error) {
				urlCache.set(interceptedUrl, '__NOT_FOUND__');
				try {
					Object.defineProperty(this, 'status', { value: 404, writable: false });
					Object.defineProperty(this, 'statusText', { value: 'Not Found', writable: false });
					Object.defineProperty(this, 'responseText', { value: '', writable: false });
					Object.defineProperty(this, 'response', { value: '', writable: false });
					Object.defineProperty(this, 'readyState', { value: 4, writable: false });
				} catch (e) {}
				setTimeout(() => {
					if (this.onreadystatechange) this.onreadystatechange();
					if (this.onload) this.onload();
				}, 0);
				return;
			}
		} catch (error) {
			// 发生错误，使用原始URL发送
			return originalSend.call(this, body);
		}
	};
	
	// 保存method和async参数供send使用
	const originalOpenWithParams = OriginalXHR.prototype.open;
	OriginalXHR.prototype.open = function(method, url, async, user, password) {
		this._method = method;
		this._async = async;
		return originalOpenWithParams.call(this, method, url, async, user, password);
	};
	
})();
`
}

/**
 * 默认的fetch拦截器配置
 */
export const defaultFetchInterceptorConfig: FetchInterceptorConfig = {
	enableRelativePathInterception: true,
}

/**
 * 拦截记录回调函数类型
 * @param relativePath 相对路径
 * @param fileId 文件 ID
 * @param updatedAt 文件最后更新时间
 * @param expiresAt URL 过期时间
 */
export type OnFetchIntercepted = (
	relativePath: string,
	fileId: string,
	updatedAt: string | undefined,
	expiresAt: string | undefined,
) => void

/**
 * 父容器处理iframe fetch请求的函数
 * @param allFiles 所有文件列表
 * @param htmlRelativeFolderPath HTML文件的相对文件夹路径
 * @param fileId 文件ID，用于验证请求来源
 * @param onFetchIntercepted 拦截记录回调函数，用于记录拦截的相对路径和文件信息
 * @returns 消息处理函数
 */
export function createParentMessageHandler(
	allFiles: FileItem[],
	htmlRelativeFolderPath: string,
	fileId: string,
	onFetchIntercepted?: OnFetchIntercepted,
) {
	return async (event: MessageEvent) => {
		// 验证消息来源和类型
		if (!event.data || event.data.type !== FETCH_MESSAGE_TYPES.REQUEST) {
			return
		}

		const { requestId, relativePath, fileId: messageFileId } = event.data

		// 允许当前文件和嵌套文件请求，避免深层资源请求被丢弃
		if (!isKnownRequestFileId(allFiles, fileId, messageFileId)) return

		try {
			// 使用请求来源文件目录作为相对路径解析基准
			const requesterFolderPath = resolveRequesterFolderPath(
				allFiles,
				messageFileId,
				htmlRelativeFolderPath,
			)
			// 查找匹配的文件
			const matchedFile = findMatchingFile(allFiles, relativePath, requesterFolderPath)

			if (matchedFile) {
				// 使用 getTemporaryDownloadUrl 获取OSS URL
				const response = await getTemporaryDownloadUrl({ file_ids: [matchedFile.file_id] })

				if (response && response.length > 0 && response[0].url) {
					const ossUrl = response[0].url
					const expiresAt = response[0].expires_at
					const updatedAt = matchedFile.updated_at

					// 记录拦截信息
					if (onFetchIntercepted) {
						onFetchIntercepted(relativePath, matchedFile.file_id, updatedAt, expiresAt)
					}

					// 发送成功响应，包含 expires_at
					;(event.source as Window)?.postMessage(
						{
							type: FETCH_MESSAGE_TYPES.RESPONSE,
							requestId,
							success: true,
							url: ossUrl,
							expires_at: expiresAt,
						},
						"*",
					)
					return
				}
			}

			// 发送失败响应
			;(event.source as Window)?.postMessage(
				{
					type: FETCH_MESSAGE_TYPES.RESPONSE,
					requestId,
					success: false,
					error: "未找到匹配的文件",
				},
				"*",
			)
		} catch (error) {
			// 发送错误响应
			;(event.source as Window)?.postMessage(
				{
					type: FETCH_MESSAGE_TYPES.RESPONSE,
					requestId,
					success: false,
					error: error instanceof Error ? error.message : "未知错误",
				},
				"*",
			)
		}
	}
}

/**
 * 查找匹配的文件
 * @param allFiles 所有文件列表
 * @param relativePath 相对路径
 * @param htmlRelativeFolderPath HTML文件的相对文件夹路径
 * @returns 匹配的文件或null
 */
export function findMatchingFile(
	allFiles: FileItem[],
	relativePath: string,
	htmlRelativeFolderPath: string,
): FileItem | null {
	// 分离URL的基础路径和查询参数/锚点
	const [basePath] = relativePath.split(/([?#].*)/)
	const cleanUrl = basePath || relativePath

	// 优先匹配同目录下的文件（精确路径匹配）
	const sameDirectoryMatches: FileItem[] = []

	// 第一遍遍历：计算相对路径并分类
	for (const file of allFiles) {
		if (!file.relative_file_path) continue

		// 计算相对于HTML文件的路径
		let fileRelativePath = file.relative_file_path
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
				fileRelativePath = forwardSteps.join("/")
			} else {
				fileRelativePath = "../".repeat(backSteps) + forwardSteps.join("/")
			}
		}

		// 判断是否在同目录（相对路径不包含"../"）
		const isSameDirectory = !fileRelativePath.startsWith("../")

		// 直接匹配
		if (cleanUrl === fileRelativePath) {
			return file
		}

		// 处理各种相对路径格式的变体
		const cleanPath = fileRelativePath.startsWith("/")
			? fileRelativePath.slice(1)
			: fileRelativePath
		const pathWithSlash = fileRelativePath.startsWith("/")
			? fileRelativePath
			: "/" + fileRelativePath

		const pathVariants = [
			fileRelativePath, // 原始路径
			cleanPath, // 去掉开头斜杠
			`./${cleanPath}`, // 当前目录相对路径
			pathWithSlash, // 添加开头斜杠
		]

		for (const variant of pathVariants) {
			if (cleanUrl === variant) {
				return file
			}
		}

		// 分类文件：只记录同目录的文件，用于后续的严格文件名匹配
		if (isSameDirectory) {
			sameDirectoryMatches.push(file)
		}
	}

	// 如果精确匹配都失败，只考虑同目录下的文件名匹配（严格限制）
	// 这用于处理路径格式不一致但文件确实在同目录的情况
	if (sameDirectoryMatches.length > 0) {
		const requestFileName = cleanUrl.split("/").pop()
		if (requestFileName) {
			for (const file of sameDirectoryMatches) {
				if (!file.relative_file_path) continue

				// 重新计算相对路径（与上面逻辑一致）
				let fileRelativePath = file.relative_file_path
				if (htmlRelativeFolderPath && htmlRelativeFolderPath !== "/") {
					const htmlSegments = htmlRelativeFolderPath.split("/").filter((s) => s)
					const fileSegments = file.relative_file_path.split("/").filter((s) => s)

					let commonLength = 0
					while (
						commonLength < Math.min(htmlSegments.length, fileSegments.length) &&
						htmlSegments[commonLength] === fileSegments[commonLength]
					) {
						commonLength++
					}

					const backSteps = htmlSegments.length - commonLength
					const forwardSteps = fileSegments.slice(commonLength)

					if (backSteps === 0) {
						fileRelativePath = forwardSteps.join("/")
					} else {
						fileRelativePath = "../".repeat(backSteps) + forwardSteps.join("/")
					}
				}

				// 确保是同目录（不包含"../"）
				if (fileRelativePath.startsWith("../")) {
					continue
				}

				const fileName = fileRelativePath.split("/").pop()
				// 只匹配文件名，且确保路径段数相同（严格匹配）
				if (fileName === requestFileName) {
					const relativeSegments = fileRelativePath.split("/").filter((s) => s)
					const requestSegments = cleanUrl.split("/").filter((s) => s)
					// 路径段数必须完全一致，不允许跨目录匹配
					if (relativeSegments.length === requestSegments.length) {
						return file
					}
				}
			}
		}
	}

	// 如果同目录下没有匹配，不再尝试其他目录的文件
	// 严格按目录和层级匹配，不允许跨目录匹配
	return null
}

/**
 * 为HTML内容注入fetch拦截器脚本
 * @param htmlContent 原始HTML内容
 * @param config fetch拦截器配置
 * @returns 注入脚本后的HTML内容
 */
export function injectFetchInterceptorScript(
	htmlContent: string,
	config: FetchInterceptorConfig = defaultFetchInterceptorConfig,
): string {
	const fetchInterceptorScript = generateFetchInterceptorScript(config)

	if (!fetchInterceptorScript) {
		return htmlContent
	}

	let finalContent = htmlContent

	// 在head标签中注入fetch拦截器脚本
	const headEndIndex = finalContent.indexOf("</head>")
	if (headEndIndex !== -1) {
		const scriptTag = `<script data-injected="fetch-interceptor">${fetchInterceptorScript}</script>`
		finalContent =
			finalContent.slice(0, headEndIndex) + scriptTag + finalContent.slice(headEndIndex)
	} else {
		// 如果没有head标签，在html开始处注入
		const htmlStartIndex = finalContent.indexOf("<html")
		if (htmlStartIndex !== -1) {
			const htmlTagEndIndex = finalContent.indexOf(">", htmlStartIndex) + 1
			const scriptTag = `<script data-injected="fetch-interceptor">${fetchInterceptorScript}</script>`
			finalContent =
				finalContent.slice(0, htmlTagEndIndex) +
				scriptTag +
				finalContent.slice(htmlTagEndIndex)
		}
	}

	return finalContent
}

/**
 * 生成键盘快捷键拦截脚本
 * 在 iframe 内部监听键盘事件，并通过 postMessage 发送到父窗口
 */
function generateKeyboardInterceptorScript(): string {
	return `
(function() {
	const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
	
	document.addEventListener('keydown', function(e) {
		const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
		
		// Cmd/Ctrl + S (保存) 或 Shift + Cmd/Ctrl + S (保存并退出)
		if (isCmdOrCtrl && e.key === 's') {
			e.preventDefault();
			e.stopPropagation();
			
			window.parent.postMessage({
				type: e.shiftKey ? '${KEYBOARD_MESSAGE_TYPES.SAVE_AND_EXIT}' : '${KEYBOARD_MESSAGE_TYPES.SAVE}',
				source: '${KEYBOARD_MESSAGE_TYPES.SOURCE}'
			}, '*');
		}
		
		// Escape (退出编辑模式)
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			
			window.parent.postMessage({
				type: '${KEYBOARD_MESSAGE_TYPES.CANCEL}',
				source: '${KEYBOARD_MESSAGE_TYPES.SOURCE}'
			}, '*');
		}
	}, true);
})();
`
}

/**
 * 为HTML内容注入键盘快捷键拦截器脚本
 * @param htmlContent 原始HTML内容
 * @returns 注入脚本后的HTML内容
 */
export function injectKeyboardInterceptorScript(htmlContent: string): string {
	const keyboardInterceptorScript = generateKeyboardInterceptorScript()

	let finalContent = htmlContent

	// 在head标签中注入键盘拦截器脚本
	const headEndIndex = finalContent.indexOf("</head>")
	if (headEndIndex !== -1) {
		const scriptTag = `<script data-injected="keyboard-interceptor">${keyboardInterceptorScript}</script>`
		finalContent =
			finalContent.slice(0, headEndIndex) + scriptTag + finalContent.slice(headEndIndex)
	} else {
		// 如果没有head标签，在html开始处注入
		const htmlStartIndex = finalContent.indexOf("<html")
		if (htmlStartIndex !== -1) {
			const htmlTagEndIndex = finalContent.indexOf(">", htmlStartIndex) + 1
			const scriptTag = `<script data-injected="keyboard-interceptor">${keyboardInterceptorScript}</script>`
			finalContent =
				finalContent.slice(0, htmlTagEndIndex) +
				scriptTag +
				finalContent.slice(htmlTagEndIndex)
		}
	}

	return finalContent
}

/**
 * 键盘快捷键处理函数类型
 */
export interface KeyboardHandlers {
	onSave: () => void | Promise<void>
	onSaveAndExit: () => void | Promise<void>
	onCancel: () => void | Promise<void>
}

/**
 * 创建键盘快捷键消息处理器
 * 用于处理来自 iframe 内部的键盘快捷键消息
 * @param handlers 键盘事件处理函数对象
 * @returns 消息处理函数
 */
export function createKeyboardMessageHandler(handlers: KeyboardHandlers) {
	return (event: MessageEvent) => {
		if (event.data?.source !== KEYBOARD_MESSAGE_TYPES.SOURCE) return

		switch (event.data.type) {
			case KEYBOARD_MESSAGE_TYPES.SAVE:
				void handlers.onSave()
				break
			case KEYBOARD_MESSAGE_TYPES.SAVE_AND_EXIT:
				void handlers.onSaveAndExit()
				break
			case KEYBOARD_MESSAGE_TYPES.CANCEL:
				void handlers.onCancel()
				break
		}
	}
}
