/**
 * Nested iframe content interceptor module
 *
 * Handles nested HTML iframes within the main iframe by intercepting their
 * relative-path src, fetching the target file content via postMessage, and
 * rendering the fully-processed HTML via srcdoc instead of the raw OSS URL.
 *
 * Message flow:
 *   Main iframe script → MAGIC_IFRAME_CONTENT_REQUEST → React App
 *   React App: find file → fetch content → processHtmlContent → getFullContent
 *   React App → MAGIC_IFRAME_CONTENT_RESPONSE → Main iframe script
 *   Main iframe script: iframe.srcdoc = processedHtml
 */

import { getFileContentById } from "@/opensource/pages/superMagic/utils/api"
import { processHtmlContent } from "../htmlProcessor"
import { getFullContent, decodeHTMLEntities } from "./full-content"
import {
	findMatchingFile,
	isKnownRequestFileId,
	resolveRequesterFolderPath,
	type FileItem,
} from "./fetchInterceptor"

// --------------------------------------------------------------------------
// Message type constants
// --------------------------------------------------------------------------

export const NESTED_IFRAME_MESSAGE_TYPES = {
	REQUEST: "MAGIC_IFRAME_CONTENT_REQUEST",
	RESPONSE: "MAGIC_IFRAME_CONTENT_RESPONSE",
} as const

// 规范化链路文件 ID：去重并补齐当前请求发起文件
function normalizeChainFileIds(chainFileIds: unknown, requesterFileId?: string): string[] {
	const normalized = Array.isArray(chainFileIds)
		? chainFileIds.filter((item): item is string => typeof item === "string" && item.length > 0)
		: []
	const unique = Array.from(new Set(normalized))
	if (requesterFileId && !unique.includes(requesterFileId)) unique.push(requesterFileId)
	return unique
}

function injectIframeChainScript(htmlContent: string, chainFileIds: string[]): string {
	if (!htmlContent) return htmlContent

	try {
		// 使用 DOM 方式注入，避免字符串 indexOf 命中脚本文本导致内容错位
		const parser = new DOMParser()
		const doc = parser.parseFromString(htmlContent, "text/html")
		const chainScript = doc.createElement("script")
		chainScript.setAttribute("data-injected", "iframe-chain")
		chainScript.textContent = `window.__MAGIC_IFRAME_CHAIN__=${JSON.stringify(chainFileIds)};`

		if (doc.head) doc.head.appendChild(chainScript)
		else if (doc.body) doc.body.insertBefore(chainScript, doc.body.firstChild)
		else doc.documentElement.appendChild(chainScript)

		const doctype = doc.doctype
		let doctypeString = ""
		if (doctype) {
			doctypeString = `<!DOCTYPE ${doctype.name}`
			if (doctype.publicId) doctypeString += ` PUBLIC "${doctype.publicId}"`
			if (doctype.systemId) doctypeString += ` "${doctype.systemId}"`
			doctypeString += ">\n"
		}

		return doctypeString + doc.documentElement.outerHTML
	} catch (error) {
		console.error("injectIframeChainScript failed:", error)
		return htmlContent
	}
}

// --------------------------------------------------------------------------
// Iframe-side injection script
// --------------------------------------------------------------------------

/**
 * Returns a self-contained JavaScript IIFE string to be injected into the
 * main iframe.  The script:
 *  1. Detects IFRAME elements whose src is a relative HTML file path.
 *  2. Immediately removes the src to prevent the browser from loading the
 *     raw (unprocessed) file.
 *  3. Sends MAGIC_IFRAME_CONTENT_REQUEST to window.parent (React App).
 *  4. On MAGIC_IFRAME_CONTENT_RESPONSE, sets element.srcdoc to the fully
 *     processed HTML content.
 *
 * The helper `isRelativeHtmlPath` is exposed on `window.__MAGIC_IS_RELATIVE_HTML_PATH__`
 * so that the dynamic resource interceptor in full-content.ts can skip these
 * elements and avoid double-processing.
 */
export function getNestedIframeInterceptorScript(): string {
	const requestType = NESTED_IFRAME_MESSAGE_TYPES.REQUEST
	const responseType = NESTED_IFRAME_MESSAGE_TYPES.RESPONSE

	return `
(function() {
	// Returns true when a URL is a relative path pointing to an HTML file
	function isRelativeHtmlPath(url) {
		if (!url) return false;
		// Absolute URLs are not relative
		if (/^(https?:\\/\\/|\\/\\/|data:|blob:|mailto:|tel:|javascript:|about:)/i.test(url)) return false;
		// Must end in .html or .htm (ignoring query/hash)
		var cleanUrl = url.split(/[?#]/)[0];
		return /\\.html?$/i.test(cleanUrl);
	}

	// Expose so the dynamic resource interceptor can defer to this module
	window.__MAGIC_IS_RELATIVE_HTML_PATH__ = isRelativeHtmlPath;

	function handleNestedIframeContent(element, relativePath, fallbackSrc) {
		// Guard against duplicate processing
		if (element.getAttribute('data-magic-iframe-loading')) return;
		element.setAttribute('data-magic-iframe-loading', 'true');
		// 保存原始相对路径，便于保存时还原
		if (!element.getAttribute('data-original-path')) {
			element.setAttribute('data-original-path', relativePath);
		}

		// 生成跳过场景的兜底页面，避免空白或反复重试
		function escapeHtml(value) {
			return String(value || '').replace(/[&<>"']/g, function(char) {
				return ({
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;'
				})[char];
			});
		}

		function buildFallbackHtml(reason, path) {
			var safePath = escapeHtml(path || '');
			var title = 'Iframe content unavailable';
			var desc =
				reason === 'cycle'
					? 'Detected circular iframe nesting. Rendering is skipped.'
					: 'Target file was not found. Rendering is skipped.';

			return '<!DOCTYPE html>' +
				'<html><head><meta charset="UTF-8" />' +
				'<style>' +
				'html,body{height:100%;margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;}' +
				'body{display:flex;align-items:center;justify-content:center;background:#fafafa;color:#1f2937;}' +
				'.card{max-width:520px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;padding:16px 18px;box-shadow:0 1px 2px rgba(0,0,0,.04);}' +
				'.title{font-size:14px;font-weight:600;margin:0 0 8px;}' +
				'.desc{font-size:12px;line-height:1.6;margin:0 0 10px;color:#4b5563;}' +
				'.path{font-size:12px;line-height:1.5;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:8px;word-break:break-all;}' +
				'</style></head><body>' +
				'<div class="card">' +
				'<p class="title">' + title + '</p>' +
				'<p class="desc">' + desc + '</p>' +
				'<div class="path">' + safePath + '</div>' +
				'</div></body></html>';
		}

		function applyFallbackPage(reason) {
			element.removeAttribute('src');
			element.srcdoc = buildFallbackHtml(reason, relativePath || fallbackSrc);
		}

		// Remove src immediately so the browser won't load the raw file
		element.removeAttribute('src');

		var requestId = 'nested_iframe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

		// Timeout fallback: restore src so at least something renders
		var timeoutId = setTimeout(function() {
			window.removeEventListener('message', responseHandler);
			element.removeAttribute('data-magic-iframe-loading');
			element.setAttribute('src', fallbackSrc || relativePath);
		}, 15000);

		function responseHandler(event) {
			if (
				event.data &&
				event.data.type === '${responseType}' &&
				event.data.requestId === requestId
			) {
				clearTimeout(timeoutId);
				window.removeEventListener('message', responseHandler);
				element.removeAttribute('data-magic-iframe-loading');

				if (event.data.skipProcessing) {
					// 文件不存在等不可处理场景：标记后跳过，避免反复请求
					var skipReason = event.data.skipReason || 'skip';
					element.setAttribute('data-magic-iframe-skipped', skipReason);
					element.setAttribute('data-magic-iframe-skipped-path', relativePath);
					// 渲染轻量提示页，提升可观测性
					applyFallbackPage(skipReason);
					return;
				}

				if (event.data.cycleDetected) {
					// 循环嵌套命中：标记后跳过，避免无限递归请求
					element.setAttribute('data-magic-iframe-skipped', 'cycle');
					element.setAttribute('data-magic-iframe-skipped-path', relativePath);
					applyFallbackPage('cycle');
					return;
				}

				if (event.data.success && event.data.content) {
					element.srcdoc = event.data.content;
				} else {
					// Fallback: restore original src
					element.setAttribute('src', fallbackSrc || relativePath);
				}
			}
		}

		window.addEventListener('message', responseHandler);

		var parentChain = Array.isArray(window.__MAGIC_IFRAME_CHAIN__) ? window.__MAGIC_IFRAME_CHAIN__.slice() : [];
		var currentFileId = window.__MAGIC_FILE_ID__ || '';
		if (currentFileId && parentChain.indexOf(currentFileId) === -1) {
			parentChain.push(currentFileId);
		}

		// 发送到顶层窗口，确保多层 iframe 下消息可达
		(window.top || window.parent).postMessage({
			type: '${requestType}',
			requestId: requestId,
			relativePath: relativePath,
			fileId: currentFileId,
			chainFileIds: parentChain
		}, '*');
	}

	// Process a single IFRAME element if it qualifies
	function processIframeElement(el) {
		var src = el.getAttribute('src');
		var originalPath = el.getAttribute('data-original-path');
		var requestPath = null;
		var fallbackSrc = src || '';

		// 初始化阶段 src 可能已是 OSS URL，优先用 data-original-path 识别
		if (originalPath && isRelativeHtmlPath(originalPath)) {
			requestPath = originalPath;
		} else if (src && isRelativeHtmlPath(src)) {
			requestPath = src;
		}

		// 已标记为跳过的节点不再重复处理；若路径变化则允许重新尝试
		var skippedReason = el.getAttribute('data-magic-iframe-skipped');
		var skippedPath = el.getAttribute('data-magic-iframe-skipped-path');
		if (skippedReason) {
			if (requestPath && skippedPath && requestPath !== skippedPath) {
				el.removeAttribute('data-magic-iframe-skipped');
				el.removeAttribute('data-magic-iframe-skipped-path');
			} else {
				return;
			}
		}

		if (requestPath) handleNestedIframeContent(el, requestPath, fallbackSrc || requestPath);
	}

	// Scan all existing IFRAME elements in the document
	function processExistingIframes() {
		document.querySelectorAll('iframe').forEach(function(el) {
			processIframeElement(el);
		});
	}

	// Watch for dynamically added/modified IFRAME elements
	var iframeObserver = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			if (mutation.type === 'childList') {
				mutation.addedNodes.forEach(function(node) {
					if (!node || node.nodeType !== 1) return;
					if (node.tagName === 'IFRAME') {
						processIframeElement(node);
					}
					if (node.querySelectorAll) {
						node.querySelectorAll('iframe').forEach(function(el) {
							processIframeElement(el);
						});
					}
				});
			}

			// Handle src attribute being set programmatically after insertion
			if (mutation.type === 'attributes' &&
				mutation.attributeName === 'src' &&
				mutation.target &&
				mutation.target.tagName === 'IFRAME') {
				processIframeElement(mutation.target);
			}
		});
	});

	function start() {
		processExistingIframes();
		iframeObserver.observe(document.documentElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['src']
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();
`
}

// --------------------------------------------------------------------------
// React-app-side message handler
// --------------------------------------------------------------------------

/**
 * Creates a window message handler for the React app side.
 * Handles MAGIC_IFRAME_CONTENT_REQUEST messages sent by the injected script:
 *  1. Locates the target HTML file in the attachment list.
 *  2. Fetches its raw content via API.
 *  3. Pre-resolves all resource paths to absolute OSS URLs (processHtmlContent).
 *  4. Injects all required runtime scripts (getFullContent).
 *  5. Responds with MAGIC_IFRAME_CONTENT_RESPONSE containing the full HTML.
 *
 * @param allFiles - Flattened list of all project files
 * @param htmlRelativeFolderPath - Folder path of the currently displayed HTML file
 * @param fileId - file_id of the currently displayed HTML file (for request validation)
 * @param attachmentList - Full attachment list (passed to processHtmlContent)
 */
export function createNestedIframeContentHandler(
	allFiles: FileItem[],
	htmlRelativeFolderPath: string,
	fileId: string,
	attachmentList: unknown[],
) {
	return async (event: MessageEvent) => {
		if (!event.data || event.data.type !== NESTED_IFRAME_MESSAGE_TYPES.REQUEST) return

		const { requestId, relativePath, fileId: messageFileId, chainFileIds } = event.data

		// 允许当前文件及其嵌套文件，避免深层请求被误过滤
		if (!isKnownRequestFileId(allFiles, fileId, messageFileId)) return

		const sendResponse = (
			success: boolean,
			content?: string,
			error?: string,
			cycleDetected?: boolean,
			skipProcessing?: boolean,
			skipReason?: string,
		) => {
			;(event.source as Window)?.postMessage(
				{
					type: NESTED_IFRAME_MESSAGE_TYPES.RESPONSE,
					requestId,
					success,
					content,
					error,
					cycleDetected,
					skipProcessing,
					skipReason,
				},
				"*",
			)
		}

		try {
			const requestChainFileIds = normalizeChainFileIds(chainFileIds, messageFileId)
			// 按“请求来源文件”的目录解析相对路径，避免深层目录错位
			const requesterFolderPath = resolveRequesterFolderPath(
				allFiles,
				messageFileId,
				htmlRelativeFolderPath,
			)

			// 1. Locate the target file by its relative path
			const matchedFile = findMatchingFile(allFiles, relativePath, requesterFolderPath)

			if (!matchedFile?.file_id) {
				// 未找到文件时通知前端跳过，避免无限重试
				sendResponse(
					false,
					undefined,
					"File not found: " + relativePath,
					false,
					true,
					"not-found",
				)
				return
			}

			if (requestChainFileIds.includes(matchedFile.file_id)) {
				// 命中循环依赖（A -> B -> A），直接跳过处理
				sendResponse(false, undefined, "Circular iframe nesting detected", true)
				return
			}

			// 2. Fetch raw HTML content
			const rawContent = await getFileContentById(matchedFile.file_id, {
				responseType: "text",
			})

			if (typeof rawContent !== "string") {
				sendResponse(false, undefined, "Failed to fetch file content")
				return
			}

			// 3. Compute the nested file's folder path for resource resolution
			const nestedFileFolderPath =
				matchedFile.relative_file_path && matchedFile.file_name
					? matchedFile.relative_file_path.replace(matchedFile.file_name, "")
					: requesterFolderPath

			// 4. Pre-resolve all resource paths in the nested HTML to absolute OSS URLs.
			//    This eliminates the need for a relay mechanism for inner resources.
			const processedResult = await processHtmlContent({
				content: rawContent,
				attachments: attachmentList,
				attachmentList,
				fileId: matchedFile.file_id,
				fileName: matchedFile.file_name,
				html_relative_path: nestedFileFolderPath,
			})

			// 5. Inject all required runtime scripts (Magic methods, storage mocks, etc.)
			const fullContent = getFullContent(
				decodeHTMLEntities(processedResult.processedContent),
				matchedFile.file_id,
				{
					dynamicInterception: {
						enable: true,
						fileId: matchedFile.file_id,
					},
				},
			)

			const fullContentWithChain = injectIframeChainScript(fullContent, requestChainFileIds)
			sendResponse(true, fullContentWithChain)
		} catch (error) {
			sendResponse(false, undefined, error instanceof Error ? error.message : "Unknown error")
		}
	}
}
