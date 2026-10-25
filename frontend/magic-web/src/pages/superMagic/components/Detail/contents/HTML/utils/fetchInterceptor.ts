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

import { KEYBOARD_MESSAGE_TYPES } from "@dtyq/html-sandbox"
import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { env } from "@/utils/env"
import { rewriteHtmlCdnWithHost } from "./index"

// 消息类型常量，使用 MAGIC_FETCH_ 前缀避免冲突
export const FETCH_MESSAGE_TYPES = {
	REQUEST: "MAGIC_FETCH_URL_REQUEST",
	RESPONSE: "MAGIC_FETCH_URL_RESPONSE",
} as const

/** 注入 iframe 的 `isRelativePath`（与 getDynamicResourceInterceptorScript 共用，单处维护） */
export const injectedIsRelativePathFunctionSource = `
			function isRelativePath(url) {
				if (!url) return false;
				// 仅动态资源拦截脚本会定义该函数；同源沙箱页的绝对 URL 也按工作区相对路径处理
				if (typeof isSandboxAbsoluteResourceUrl === "function" && isSandboxAbsoluteResourceUrl(url)) return true;
				return !/^(https?:\\/\\/|\\/\\/|data:|blob:|mailto:|tel:|javascript:|about:)/i.test(url);
			}
`

// 键盘快捷键消息类型常量（MAGIC_KEYBOARD_ 前缀）。定义在 html-sandbox，iframe 运行时发送、
// 这里的宿主处理器识别，两端共用同一份，避免字面量各写一份而漂移。
export { KEYBOARD_MESSAGE_TYPES }

export const POST_MESSAGE_TARGET_STRATEGIES = {
	SAME_ORIGIN_ANCESTOR: "same-origin-ancestor",
	CROSS_ORIGIN_PARENT: "cross-origin-parent",
} as const

export type PostMessageTargetStrategy =
	(typeof POST_MESSAGE_TARGET_STRATEGIES)[keyof typeof POST_MESSAGE_TARGET_STRATEGIES]

export interface FileItem {
	file_id: string
	relative_file_path: string
	file_name?: string
	file_extension?: string
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
	/** postMessage 目标窗口选择策略 */
	postMessageTargetStrategy?: PostMessageTargetStrategy
}

/**
 * 注入到 iframe 运行时：沿 parent 链向上找到消息目标窗口。
 * 默认返回「最后一个仍与当前文档同源的窗口」，避免被第三方 iframe 嵌套时误发到 window.top 外站。
 * 若开启 cross-origin-parent 策略，则在遇到首个跨域边界时直接返回该父窗口，
 * 以支持 render-site 跨域沙箱 iframe 向外层 React 页面请求资源解析。
 */
export const MAGIC_FETCH_POST_MESSAGE_TARGET_HELPER = `
function __magicGetFetchPostMessageTarget() {
	var strategy = window.__MAGIC_POST_MESSAGE_TARGET_STRATEGY__ || '${POST_MESSAGE_TARGET_STRATEGIES.SAME_ORIGIN_ANCESTOR}';
	var w = window;
	while (true) {
		var p = w.parent;
		if (p === w) {
			return w;
		}
		try {
			void p.location.href;
			w = p;
		} catch (e) {
			return strategy === '${POST_MESSAGE_TARGET_STRATEGIES.CROSS_ORIGIN_PARENT}' ? p : w;
		}
	}
}
`.trim()

export function getPostMessageTargetBootstrapScript(
	strategy: PostMessageTargetStrategy = POST_MESSAGE_TARGET_STRATEGIES.SAME_ORIGIN_ANCESTOR,
): string {
	return `window.__MAGIC_POST_MESSAGE_TARGET_STRATEGY__='${strategy}';`
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
	const {
		fileId = "",
		postMessageTargetStrategy = POST_MESSAGE_TARGET_STRATEGIES.SAME_ORIGIN_ANCESTOR,
	} = config

	if (!env("MAGIC_CDNHOST")) {
		return ""
	}

	const cdnHost = env("MAGIC_CDNHOST")

	// 必须使用零依赖的 rewriteHtmlCdnWithHost：对打包后的 handleHtCdnUrl.toString() 会带上 env 等闭包，
	// 注入 iframe 后运行会变成 ReferenceError（如 `i is not defined`）。
	const rewriteHtmlCdnWithHostFn = rewriteHtmlCdnWithHost.toString()

	return `
(function() {
	// 设置文件ID，用于验证请求来源
	window.__MAGIC_FILE_ID__ = '${fileId}';
	${getPostMessageTargetBootstrapScript(postMessageTargetStrategy)}
	
	// 保存原始的fetch函数
	const originalFetch = window.fetch;
	
	// URL缓存，存储已解析的URL
	const urlCache = new Map();
	// 正在进行的请求缓存，避免同时发起多个相同的请求
	const pendingRequests = new Map();

	function isCachedUrlFresh(entry) {
		if (!entry || !entry.url || entry.url === '__NOT_FOUND__') return false;
		if (!entry.expiresAt) return false;
		const expireTime = Date.parse(String(entry.expiresAt).replace(/-/g, '/'));
		return !isNaN(expireTime) && expireTime - Date.now() > 5 * 60 * 1000;
	}

	function takeFreshCacheEntry(key) {
		const entry = urlCache.get(key);
		if (!entry) return null;
		if (entry.url === '__NOT_FOUND__') return entry;
		if (isCachedUrlFresh(entry)) return entry;
		urlCache.delete(key);
		return null;
	}

	function cacheResolvedUrl(relativePath, url, expiresAt) {
		if (!url || !expiresAt) {
			urlCache.delete(relativePath);
			return;
		}
		urlCache.set(relativePath, { url: url, expiresAt: expiresAt });
	}
	
	${injectedIsRelativePathFunctionSource}
	
	// 生成唯一的请求ID
	function generateRequestId() {
		return 'fetch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
	}
	
	// 检查是否为 HTML 文件
	function isHtmlFile(url) {
		const cleanUrl = url.split(/[?#]/)[0];
		return cleanUrl.toLowerCase().endsWith('.html') || cleanUrl.toLowerCase().endsWith('.htm');
	}
	
	const __MAGIC_CDN_HOST__ = ${JSON.stringify(cdnHost)};
	const rewriteHtmlCdnWithHost = ${rewriteHtmlCdnWithHostFn};

	${MAGIC_FETCH_POST_MESSAGE_TARGET_HELPER}
	
	// 处理 HTML 内容 - 注入所有必要的脚本和替换CDN资源
	function processHtmlContent(htmlContent) {
		try {
			const htmlDoc = rewriteHtmlCdnWithHost(htmlContent, __MAGIC_CDN_HOST__);
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
						// Skip cache when expires_at is missing; parent also refuses it.
						cacheResolvedUrl(relativePath, event.data.url, event.data.expires_at);
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
			
		// 向挂载了 createParentMessageHandler 的同源祖先窗口发送（避免被第三方 iframe 嵌套时误发到 window.top 外站）
		__magicGetFetchPostMessageTarget().postMessage({
			type: '${FETCH_MESSAGE_TYPES.REQUEST}',
			requestId: requestId,
			relativePath: relativePath,
			fileId: window.__MAGIC_FILE_ID__ || ''
		}, '*');
		});
	}
	
	// 重写fetch函数
	window.fetch = async function(input, init) {
		// 原生 fetch 支持 string、URL 和 Request。未改写 URL 时必须透传原始 input，
		// 否则 Request 中的 method、headers、body 等配置会在退化为 URL 字符串后丢失。
		const isRequestInput = typeof Request !== 'undefined' && input instanceof Request;
		const signal = init && init.signal !== undefined ? init.signal : isRequestInput ? input.signal : undefined;
		if (signal && signal.aborted) throw signal.reason;
		// Each caller owns its cancellation; the shared URL lookup remains usable by other callers.
		const waitForUrl = (promise) => {
			if (!signal) return promise;
			return new Promise((resolve, reject) => {
				const onAbort = () => { cleanup(); reject(signal.reason); };
				const cleanup = () => signal.removeEventListener('abort', onAbort);
				signal.addEventListener('abort', onAbort, { once: true });
				if (signal.aborted) onAbort();
				promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
			});
		};
		let url = typeof input === 'string' ? input : isRequestInput ? input.url : String(input);
		const originalUrl = url;
		const executeOriginalFetch = (resolvedUrl) => {
			let resolvedInput = input;
			if (resolvedUrl !== originalUrl) {
				resolvedInput = isRequestInput ? new Request(resolvedUrl, input) : resolvedUrl;
			}
			return originalFetch.call(this, resolvedInput, init);
		};
		
		// 如果是相对路径且启用了拦截
		if (${config.enableRelativePathInterception !== false} && isRelativePath(url)) {
			// 检查是否为 HTML 文件
			const isHtml = isHtmlFile(url);
			
			// 1. 检查已完成的缓存
			if (urlCache.has(url)) {
				const cachedUrl = takeFreshCacheEntry(url);
				if (cachedUrl && cachedUrl.url === '__NOT_FOUND__') {
					return Promise.resolve(new Response(null, {
						status: 404,
						statusText: 'Not Found',
						headers: { 'Content-Type': 'text/plain' }
					}));
				}
				if (cachedUrl) url = cachedUrl.url;
			}
			// 2. 检查是否有正在进行的请求
			if (isRelativePath(url) && pendingRequests.has(url)) {
				try {
					// 等待正在进行的请求完成
					const resolvedUrl = await waitForUrl(pendingRequests.get(url));
					url = resolvedUrl;
				} catch (error) {
					if (signal && signal.aborted) throw signal.reason;
					// 如果pending请求失败，返回404响应
					return Promise.resolve(new Response(null, {
						status: 404,
						statusText: 'Not Found',
						headers: { 'Content-Type': 'text/plain' }
					}));
				}
			}
			// 3. 发起新的请求
			else if (isRelativePath(url)) {
				try {
					// 创建Promise并缓存到pending中
					const requestPromise = requestUrlFromParent(url);
					pendingRequests.set(url, requestPromise);
					
					const resolvedUrl = await waitForUrl(requestPromise);
					if (pendingRequests.get(url) === requestPromise) pendingRequests.delete(url);
					url = resolvedUrl;
				} catch (error) {
					if (signal && signal.aborted) throw signal.reason;
					// 请求失败，缓存错误标记并返回404响应
					urlCache.set(url, { url: '__NOT_FOUND__' });
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
					const response = await executeOriginalFetch(url);
					
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
					if (signal && signal.aborted) throw signal.reason;
					console.error('处理 HTML 内容失败:', error);
					// 失败时调用原始 fetch
					return executeOriginalFetch(url);
				}
			}
		}
		
		// 调用原始fetch函数
		return executeOriginalFetch(url);
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
	const originalSetRequestHeader = OriginalXHR.prototype.setRequestHeader;
	const originalAbort = OriginalXHR.prototype.abort;
	const xhrRequests = new WeakMap();
	const nativeDispatchEvent = EventTarget.prototype.dispatchEvent;
	OriginalXHR.prototype.setRequestHeader = function(name, value) {
		const request = xhrRequests.get(this);
		if (request && request.sending) throw new DOMException('The object is in an invalid state.', 'InvalidStateError');
		const result = originalSetRequestHeader.call(this, name, value);
		if (request) request.headers.push([String(name), String(value)]);
		return result;
	};
	OriginalXHR.prototype.abort = function() {
		// Invalidating before native abort also covers the interval before native send starts.
		const request = xhrRequests.get(this);
		const wasResolving = request && request.resolving;
		clearSyntheticResponse(this, request);
		xhrRequests.delete(this);
		const result = originalAbort.call(this);
		// Before native send starts, native abort has no in-flight operation to notify.
		if (wasResolving) {
			nativeDispatchEvent.call(this, new ProgressEvent('abort'));
			nativeDispatchEvent.call(this, new ProgressEvent('loadend'));
		}
		return result;
	};
	
	function clearSyntheticResponse(xhr, request) {
		if (!request || !request.syntheticProperties) return;
		request.syntheticProperties.forEach(entry => {
			const current = Object.getOwnPropertyDescriptor(xhr, entry.name);
			// Do not remove an application override installed after our synthetic response.
			if (!current || current.get !== entry.get) return;
			if (entry.previous) Object.defineProperty(xhr, entry.name, entry.previous);
			else delete xhr[entry.name];
		});
	}
	OriginalXHR.prototype.open = function(method, url, async, user, password) {
		clearSyntheticResponse(this, xhrRequests.get(this));
		// Install metadata before open fires synchronous readystatechange callbacks.
		xhrRequests.set(this, { headers: [], method: method, async: async !== false, user: user, password: password });
		this._needsInterception = false;
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
	
	OriginalXHR.prototype.send = function(body) {
		if (!this._needsInterception) return originalSend.call(this, body);
		const request = xhrRequests.get(this);
		if (this.readyState !== 1 || !request || request.sending) {
			throw new DOMException('The object is in an invalid state.', 'InvalidStateError');
		}
		const interceptedUrl = this._interceptedUrl;
		const isCurrent = () => xhrRequests.get(this) === request;
		const sendResolved = (resolvedUrl) => {
			if (!isCurrent()) return;
			request.resolving = false;
			originalOpen.call(this, request.method, resolvedUrl, request.async, request.user, request.password);
			if (!isCurrent()) return;
			// open() clears native author headers; replay successful calls in their original order.
			request.headers.forEach(header => originalSetRequestHeader.apply(this, header));
			return originalSend.call(this, body);
		};
		const failLookup = () => {
			if (!isCurrent()) return;
			request.resolving = false;
			request.sending = false;
			request.syntheticProperties = [];
			const response = { status: 404, statusText: 'Not Found', responseText: '', response: '', readyState: 4 };
			Object.keys(response).forEach(name => {
				const previous = Object.getOwnPropertyDescriptor(this, name);
				const get = () => response[name];
				try {
					Object.defineProperty(this, name, { get, configurable: true });
					request.syntheticProperties.push({ name, get, previous });
				} catch (e) {}
			});
			setTimeout(() => {
				if (!isCurrent()) return;
				nativeDispatchEvent.call(this, new Event('readystatechange'));
				if (!isCurrent()) return;
				nativeDispatchEvent.call(this, new ProgressEvent('load'));
				if (!isCurrent()) return;
				nativeDispatchEvent.call(this, new ProgressEvent('loadend'));
			}, 0);
		};

		request.sending = true;
		const cachedUrl = takeFreshCacheEntry(interceptedUrl);
		if (cachedUrl) {
			if (cachedUrl.url === '__NOT_FOUND__') return failLookup();
			try {
				return sendResolved(cachedUrl.url);
			} catch (error) {
				request.sending = false;
				throw error;
			}
		}

		request.resolving = true;
		let requestPromise = pendingRequests.get(interceptedUrl);
		if (!requestPromise) {
			requestPromise = requestUrlFromParent(interceptedUrl);
			pendingRequests.set(interceptedUrl, requestPromise);
		}
		// Keep asynchronous URL resolution internal: XMLHttpRequest.send returns undefined.
		void requestPromise.then(sendResolved, () => {
			if (!isCurrent()) return;
			urlCache.set(interceptedUrl, { url: '__NOT_FOUND__' });
			failLookup();
		}).catch(() => {
			if (!isCurrent()) return;
			request.resolving = false;
			request.sending = false;
			nativeDispatchEvent.call(this, new ProgressEvent('error'));
			nativeDispatchEvent.call(this, new ProgressEvent('loadend'));
		});
	};

})();
`
}

/**
 * 默认的fetch拦截器配置
 */
export const defaultFetchInterceptorConfig: FetchInterceptorConfig = {
	enableRelativePathInterception: true,
	postMessageTargetStrategy: POST_MESSAGE_TARGET_STRATEGIES.SAME_ORIGIN_ANCESTOR,
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
	resolvedUrl?: string,
) => void

/**
 * 父容器处理iframe fetch请求的函数
 * @param allFiles 所有文件列表
 * @param htmlRelativeFolderPath HTML文件的相对文件夹路径
 * @param fileId 文件ID，用于验证请求来源
 * @param onFetchIntercepted 拦截记录回调函数，用于记录拦截的相对路径和文件信息
 * @param access legacy share/session override; prefer `fileApi` when available
 * @param fileApi bound file client closed over at the React/iframe boundary
 * @returns 消息处理函数
 */
export function createParentMessageHandler(
	allFiles: FileItem[],
	htmlRelativeFolderPath: string,
	fileId: string,
	onFetchIntercepted?: OnFetchIntercepted,
	access?: FileAccessContext | null,
	fileApi?: Pick<FileApi, "getTemporaryDownloadUrl">,
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
				const fetchUrls = fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl
				const response = await fetchUrls({
					file_ids: [matchedFile.file_id],
					access: access ?? undefined,
				})

				if (response && response.length > 0 && response[0].url) {
					const ossUrl = response[0].url
					const expiresAt = response[0].expires_at
					const updatedAt = matchedFile.updated_at

					// 记录拦截信息
					if (onFetchIntercepted) {
						onFetchIntercepted(
							relativePath,
							matchedFile.file_id,
							updatedAt,
							expiresAt,
							ossUrl,
						)
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
 * 键盘快捷键处理函数类型
 */
export interface KeyboardHandlers {
	onSave: () => void | Promise<void>
	onSaveAndExit: () => void | Promise<void>
	onCancel: () => void | Promise<void>
	/** Return true when Escape was consumed by a local editor surface. */
	onEscape?: () => boolean
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
				if (handlers.onEscape?.()) break
				void handlers.onCancel()
				break
		}
	}
}
