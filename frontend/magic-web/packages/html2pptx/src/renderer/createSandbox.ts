import type { SlideConfig } from "../types/index"
import { LogLevel, createScopedLog } from "../logger"
import { DEFAULT_CONFIG } from "../utils/unit"
import {
	type LoadInterceptor,
	installLoadInterceptor,
} from "./loadInterceptor"
import { createAbortError, runCancelableSteps } from "./abort"
import { waitForRenderResources } from "./waitRenderResources"

/** 沙箱实例接口 */
export interface SandboxInstance {
	/** iframe 元素 */
	iframe: HTMLIFrameElement
	/** iframe window 对象 */
	window: Window
	/** iframe document 对象 */
	document: Document
	/** 渲染 HTML 内容 */
	render: (
		html: string,
		options?: { signal?: AbortSignal },
	) => Promise<{ iWindow: Window; iDocument: Document }>
	/** 销毁沙箱 */
	destroy: () => void
}

// 渲染阶段时间参数（毫秒）：
// - RENDER_TIMEOUT_MS: 整体渲染硬超时上限
// - READY_STATE_FALLBACK_MS: readyState 长时间不 complete 时的兜底等待时长
// - READY_STATE_POLL_MS: 轮询 document 就绪状态的间隔
// - NATIVE_LOAD_WAIT_MS: 等待原生 load 事件收敛的窗口
// 如需调优，建议优先调整 fallback 与整体超时，再微调轮询参数。
const RENDER_TIMEOUT_MS = 15000
const READY_STATE_FALLBACK_MS = 6000
const READY_STATE_POLL_MS = 50
const NATIVE_LOAD_WAIT_MS = 1500
const EXPORT_FINAL_FRAME_STYLE_ID = "__magic-export-final-frame-style"

interface RenderLifecycleState {
	settled: boolean
	timeoutId: ReturnType<typeof setTimeout> | null
	pollTimerId: ReturnType<typeof setTimeout> | null
	loadInterceptor: LoadInterceptor | null
}

/** 创建离屏隐藏 iframe，作为 HTML 渲染沙箱容器 */
function createHiddenIframe({
	htmlWidth,
	htmlHeight,
}: {
	htmlWidth: number
	htmlHeight: number
}): HTMLIFrameElement {
	const iframe = document.createElement("iframe")
	iframe.style.cssText = `
		width: ${htmlWidth}px;
		height: ${htmlHeight}px;
		position: fixed;
		left: -99999px;
		top: -99999px;
		z-index: -1;
		border: none;
		margin: 0;
		padding: 0;
		box-sizing: border-box;
		background: white;
		pointer-events: none;
	`
	iframe.setAttribute(
		"sandbox",
		"allow-scripts allow-modals allow-forms allow-same-origin allow-popups",
	)
	iframe.setAttribute("translate", "no")
	return iframe
}

/** 解码内联 script 中被 HTML 转义的字符，避免脚本内容失真 */
function decodeInlineScriptEntities(rawHtml: string): string {
	return rawHtml.replace(
		/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
		(full, attrs: string, code: string) => {
			if (/\bsrc\s*=/.test(attrs)) return full
			const decodedCode = code
				.replace(/&amp;(?=(?:lt|gt|quot|#39|apos);)/gi, "&")
				.replace(/&lt;/gi, "<")
				.replace(/&gt;/gi, ">")
				.replace(/&quot;/gi, "\"")
				.replace(/&#39;|&apos;/gi, "'")
			if (decodedCode === code) return full
			return `<script${attrs}>${decodedCode}</script>`
		},
	)
}

/** 判断文档是否已达到可进入导出渲染阶段的状态 */
function isDocumentReadyForRender({
	iframeDocument,
	renderStartedAt,
}: {
	iframeDocument: Document
	renderStartedAt: number
}): boolean {
	const isReadyStateComplete = iframeDocument.readyState === "complete"
	if (isReadyStateComplete) return true

	const hasDomScaffold = Boolean(iframeDocument.documentElement && iframeDocument.body)
	if (!hasDomScaffold) return false

	return Date.now() - renderStartedAt >= READY_STATE_FALLBACK_MS
}

/** 注入导出态样式：冻结动画并强制落在最终帧，避免抓到过渡中间态 */
function injectExportFinalFrameStyles(iframeDocument: Document): void {
	if (iframeDocument.getElementById(EXPORT_FINAL_FRAME_STYLE_ID)) return
	const styleElement = iframeDocument.createElement("style")
	styleElement.id = EXPORT_FINAL_FRAME_STYLE_ID
	styleElement.textContent = `
		*,
		*::before,
		*::after {
			animation-play-state: paused !important;
			animation-delay: -999999s !important;
			animation-fill-mode: both !important;
			transition-property: none !important;
			transition-duration: 0s !important;
			transition-delay: 0s !important;
			scroll-behavior: auto !important;
		}
	`
	;(iframeDocument.head ?? iframeDocument.documentElement).appendChild(styleElement)
}

/** 执行导出前资源准备流程（load 拦截收敛、resize、媒体资源等待） */
async function runRenderPipeline({
	iframeWindow,
	iframeDocument,
	loadInterceptor,
	signal,
}: {
	iframeWindow: Window
	iframeDocument: Document
	loadInterceptor: LoadInterceptor | null
	signal?: AbortSignal
}): Promise<void> {
	await runCancelableSteps({
		signal,
		steps: [
			() => loadInterceptor?.waitForNativeLoad(NATIVE_LOAD_WAIT_MS) ?? Promise.resolve(),
			() => loadInterceptor?.activateCaptureOnly(),
			() => loadInterceptor?.fireAll() ?? Promise.resolve(),
			() => {
				iframeWindow.dispatchEvent(new Event("resize"))
			},
			() => injectExportFinalFrameStyles(iframeDocument),
			() => waitForRenderResources({ iframeDocument, signal }),
		],
	})
}

/**
 * 创建渲染沙箱
 * 用于将 HTML 内容渲染到隔离的 iframe 中
 */
export function createSandbox(
	config: SlideConfig = DEFAULT_CONFIG,
): Promise<SandboxInstance> {
	const { htmlWidth, htmlHeight } = config
	const iframe = createHiddenIframe({ htmlWidth, htmlHeight })
	const sandboxLog = createScopedLog("sandbox")

	// 添加到页面
	document.body.appendChild(iframe)

	// 获取 iframe 上下文
	const iframeWindow = iframe.contentWindow as Window
	const iframeDocument = iframe.contentDocument as Document

	// 错误处理
	iframe.addEventListener("error", (e) => {
		sandboxLog(LogLevel.L4, "iframe error", { error: String(e) })
	})

	/**
	 * 渲染 HTML 内容到 iframe
	 */
	function render(
		html: string,
		options?: { signal?: AbortSignal },
	): Promise<{ iWindow: Window; iDocument: Document }> {
		return new Promise((resolve, reject) => {
			const signal = options?.signal
			const lifecycleState: RenderLifecycleState = {
				settled: false,
				timeoutId: null,
				pollTimerId: null,
				loadInterceptor: null,
			}
			let checkLoaded: () => void = () => {}
			const renderStartedAt = Date.now()

			const finish = (
				type: "resolve" | "reject",
				payload: { iWindow: Window; iDocument: Document } | unknown,
			) => {
				if (lifecycleState.settled) return
				lifecycleState.settled = true
				cleanup()
				if (type === "resolve") {
					resolve(payload as { iWindow: Window; iDocument: Document })
					return
				}
				reject(payload)
			}

			const onDomReady = () => checkLoaded()
			const onAbort = () => {
				finish("reject", createAbortError())
			}

			const cleanup = () => {
				iframeDocument.removeEventListener("DOMContentLoaded", onDomReady)
				if (signal) signal.removeEventListener("abort", onAbort)
				lifecycleState.loadInterceptor?.restore()
				lifecycleState.loadInterceptor = null
				if (lifecycleState.timeoutId)
					clearTimeout(lifecycleState.timeoutId)
				if (lifecycleState.pollTimerId)
					clearTimeout(lifecycleState.pollTimerId)
				lifecycleState.timeoutId = null
				lifecycleState.pollTimerId = null
			}

			try {
				if (signal?.aborted) {
					finish("reject", createAbortError())
					return
				}
				signal?.addEventListener("abort", onAbort, { once: true })
				const normalizedHtml = decodeInlineScriptEntities(html)
				// 必须先安装拦截器，再写入 HTML，确保不漏掉 load 事件订阅
				lifecycleState.loadInterceptor = installLoadInterceptor(iframeWindow)

				// 写入 HTML 内容
				iframeDocument.write(normalizedHtml)

				// 关闭文档流
				iframeDocument.close()

				// 等待资源加载完成
				checkLoaded = () => {
					if (lifecycleState.settled) return
					if (isDocumentReadyForRender({ iframeDocument, renderStartedAt })) {
						// 等待一帧确保渲染完成
						iframeWindow.requestAnimationFrame(() => {
							if (lifecycleState.settled) return

							Promise.resolve()
								.then(async () => {
									await runRenderPipeline({
										iframeWindow,
										iframeDocument,
										loadInterceptor: lifecycleState.loadInterceptor,
										signal,
									})
									finish("resolve", { iWindow: iframeWindow, iDocument: iframeDocument })
								})
								.catch((error) => {
									finish("reject", error)
								})
						})
					} else {
						lifecycleState.pollTimerId = setTimeout(checkLoaded, READY_STATE_POLL_MS)
					}
				}

				lifecycleState.timeoutId = setTimeout(() => {
					sandboxLog(LogLevel.L4, `render timeout after ${RENDER_TIMEOUT_MS}ms`)
					finish(
						"reject",
						new Error(`[Sandbox] render timeout after ${RENDER_TIMEOUT_MS}ms`),
					)
				}, RENDER_TIMEOUT_MS)

				// 立即启动一次检查，避免错过 DOMContentLoaded 事件导致永远不进入轮询
				checkLoaded()
				iframeDocument.addEventListener("DOMContentLoaded", onDomReady, { once: true })
			} catch (e) {
				finish("reject", e)
			}
		})
	}

	/**
	 * 销毁沙箱
	 */
	function destroy() {
		if (iframe.parentNode) {
			iframe.parentNode.removeChild(iframe)
		}
	}

	return Promise.resolve({
		iframe,
		window: iframeWindow,
		document: iframeDocument,
		render,
		destroy,
	})
}
