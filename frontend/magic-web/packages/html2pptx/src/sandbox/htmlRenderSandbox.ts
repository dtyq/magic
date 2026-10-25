import type { SlideConfig } from "../api/options"
import { ExportFidelityError, isExportFidelityError } from "../errors"
import type { ExportIssue } from "../api/options"
import { LogLevel, createScopedLog } from "../logger"
import { NATIVE_LOAD_WAIT_MS, READY_STATE_POLL_MS } from "../shared/constants"
import { DEFAULT_CONFIG } from "../shared/unit"
import { createAbortError } from "./abort"
import {
	createHiddenIframe,
	isDocumentReadyForRender,
	measureContentSize,
	normalizeSandboxHtml,
	requiresNativeLoadWait,
} from "./htmlRenderSandbox.helpers"
import { installEChartsExportInterceptor } from "./echarts-export-interceptor"
import { SandboxReadyController, type SandboxReadyControllerInput } from "./waitSandboxReady"
import type { ResourceLoadError } from "../api/options"
import { detectRenderReadinessCapabilities } from "./render-readiness"

/** Sandbox render result */
export interface SandboxRenderResult {
	iWindow: Window
	iDocument: Document
	/** Measured content width in px, including horizontal overflow */
	totalWidth: number
	/** Measured content height in px, including vertical overflow for automatic pagination */
	totalHeight: number
}

/** Sandbox instance interface */
export interface SandboxInstance {
	/** iframe element */
	iframe: HTMLIFrameElement
	/** iframe window object */
	window: Window
	/** iframe document object */
	document: Document
	/** Render HTML content */
	render: (
		html: string,
		options?: {
			signal?: AbortSignal
			onResourceError?: (error: ResourceLoadError) => void
			onExportIssue?: (issue: ExportIssue) => void
		},
	) => Promise<SandboxRenderResult>
	/** Destroy the sandbox */
	destroy: () => void
}

interface RenderLifecycleState {
	settled: boolean
	readyStarted: boolean
	timeoutId: ReturnType<typeof setTimeout> | null
	pollTimerId: ReturnType<typeof setTimeout> | null
	readyController: SandboxReadyControllerLike | null
}

interface SandboxReadyControllerLike {
	waitForReady: (options?: { signal?: AbortSignal }) => Promise<void>
	restore: () => void
}

export type SandboxReadyControllerConstructor = new (
	input: SandboxReadyControllerInput,
) => SandboxReadyControllerLike

export interface HtmlRenderSandboxOptions {
	ReadyController?: SandboxReadyControllerConstructor
}

/**
 * One HTML render sandbox instance backed by a hidden iframe.
 * Multi-page export reuses the same instance for serial rendering, but every page after the
 * first receives a fresh iframe/browsing context. Replacing the iframe is required because
 * document.open()/write()/close() does not reset global lexical declarations such as top-level
 * const/let/class, and it also leaves page-owned timers/listeners attached to the old Window.
 * One instance does not support concurrent render calls.
 */
export class HtmlRenderSandbox implements SandboxInstance {
	private currentIframe: HTMLIFrameElement
	private currentWindow: Window
	private currentDocument: Document
	private hasStartedRender = false

	private rendering = false
	private readonly htmlWidth: number
	private readonly htmlHeight: number
	private readonly sandboxLog = createScopedLog("sandbox")
	private readonly ReadyController: SandboxReadyControllerConstructor

	constructor(config: SlideConfig = DEFAULT_CONFIG, options?: HtmlRenderSandboxOptions) {
		const { htmlWidth, htmlHeight } = config
		this.htmlWidth = htmlWidth
		this.htmlHeight = htmlHeight
		this.ReadyController = options?.ReadyController ?? SandboxReadyController
		const context = this.createBrowsingContext()
		this.currentIframe = context.iframe
		this.currentWindow = context.window
		this.currentDocument = context.document
	}

	get iframe(): HTMLIFrameElement {
		return this.currentIframe
	}

	get window(): Window {
		return this.currentWindow
	}

	get document(): Document {
		return this.currentDocument
	}

	render(
		html: string,
		options?: {
			signal?: AbortSignal
			onResourceError?: (error: ResourceLoadError) => void
			onExportIssue?: (issue: ExportIssue) => void
		},
	): Promise<SandboxRenderResult> {
		if (this.rendering) {
			return Promise.reject(new Error("[Sandbox] concurrent render is not supported"))
		}
		this.rendering = true
		let iframeWindow: Window
		let iframeDocument: Document

		try {
			const context = this.acquireRenderContext()
			iframeWindow = context.window
			iframeDocument = context.document
		} catch (error) {
			this.rendering = false
			return Promise.reject(error)
		}

		return new Promise((resolve, reject) => {
			const signal = options?.signal
			const renderAbortController = new AbortController()
			const renderSignal = renderAbortController.signal
			let pageErrorRecorded = false
			let renderFailureRecorded = false
			let rejectPageError: (error: Error) => void = () => {}
			const pageErrorPromise = new Promise<never>((_, rejectPageErrorPromise) => {
				rejectPageError = rejectPageErrorPromise
			})
			// Page scripts can fail synchronously during document.write before readiness starts.
			// Attach a handler immediately; Promise.race below still observes the original rejection.
			void pageErrorPromise.catch(() => undefined)
			const pendingUnhandledRejections = new Map<
				Promise<unknown>,
				ReturnType<typeof setTimeout>
			>()
			const lifecycleState: RenderLifecycleState = {
				settled: false,
				readyStarted: false,
				timeoutId: null,
				pollTimerId: null,
				readyController: null,
			}
			let checkLoaded: () => void = () => {}
			const renderStartedAt = Date.now()

			const finish = (type: "resolve" | "reject", payload: SandboxRenderResult | unknown) => {
				if (lifecycleState.settled) return
				lifecycleState.settled = true
				try {
					cleanup()
				} finally {
					this.rendering = false
				}
				if (type === "resolve") {
					resolve(payload as SandboxRenderResult)
					return
				}
				reject(payload)
			}

			const onDomReady = () => checkLoaded()
			const onAbort = () => {
				finish("reject", createAbortError())
			}
			const recordPageError = (error: unknown) => {
				if (pageErrorRecorded || lifecycleState.settled) return
				pageErrorRecorded = true
				const message = error instanceof Error ? error.message : String(error)
				const fatal = isExportFidelityError(error)
				try {
					options?.onExportIssue?.({
						code: "page-script-error",
						message,
						severity: fatal ? "error" : "warning",
					})
				} catch {
					// Diagnostics must never replace the page result.
				}
				if (fatal) {
					rejectPageError(error)
					return
				}
				if (options?.onExportIssue) {
					// A host that subscribes to issues opts into best-effort rendering. Ordinary
					// page script errors are surfaced as warnings and do not abort the export.
					return
				}
				rejectPageError(
					new ExportFidelityError(
						`[Sandbox] page script failed: ${message}`,
						"script",
						error,
					),
				)
			}
			const recordRenderFailure = (error: unknown) => {
				if (renderFailureRecorded || lifecycleState.settled || signal?.aborted) return
				if (pageErrorRecorded && isExportFidelityError(error)) return
				renderFailureRecorded = true
				try {
					options?.onExportIssue?.({
						code: "render-error",
						message: error instanceof Error ? error.message : String(error),
						severity: "error",
					})
				} catch {
					// Diagnostics must never replace the render failure.
				}
			}
			const onWindowError = (event: ErrorEvent) => {
				Promise.resolve().then(() => {
					if (event.defaultPrevented || lifecycleState.settled) return
					const error =
						event.error ?? new Error(event.message || "Unknown page script error")
					recordPageError(error)
				})
			}
			const onUnhandledRejection = (event: PromiseRejectionEvent) => {
				const previousTimer = pendingUnhandledRejections.get(event.promise)
				if (previousTimer) clearTimeout(previousTimer)
				const timer = setTimeout(() => {
					pendingUnhandledRejections.delete(event.promise)
					if (event.defaultPrevented || lifecycleState.settled) return
					recordPageError(event.reason ?? new Error("Unhandled page promise rejection"))
				}, 0)
				pendingUnhandledRejections.set(event.promise, timer)
			}
			const onRejectionHandled = (event: PromiseRejectionEvent) => {
				const timer = pendingUnhandledRejections.get(event.promise)
				if (timer) clearTimeout(timer)
				pendingUnhandledRejections.delete(event.promise)
			}

			const cleanup = () => {
				if (!renderSignal.aborted) renderAbortController.abort()
				iframeDocument.removeEventListener("DOMContentLoaded", onDomReady)
				iframeWindow.removeEventListener("error", onWindowError)
				iframeWindow.removeEventListener("unhandledrejection", onUnhandledRejection)
				iframeWindow.removeEventListener("rejectionhandled", onRejectionHandled)
				for (const timer of pendingUnhandledRejections.values()) clearTimeout(timer)
				pendingUnhandledRejections.clear()
				if (signal) signal.removeEventListener("abort", onAbort)
				lifecycleState.readyController?.restore()
				lifecycleState.readyController = null
				if (lifecycleState.timeoutId) clearTimeout(lifecycleState.timeoutId)
				if (lifecycleState.pollTimerId) clearTimeout(lifecycleState.pollTimerId)
				lifecycleState.timeoutId = null
				lifecycleState.pollTimerId = null
			}

			try {
				if (signal?.aborted) {
					finish("reject", createAbortError())
					return
				}
				signal?.addEventListener("abort", onAbort, { once: true })
				const needsNativeLoadWait = requiresNativeLoadWait(html)
				const normalizedHtml = normalizeSandboxHtml(html)
				const readinessCapabilities = detectRenderReadinessCapabilities(normalizedHtml)

				// Explicitly clear the previous page document before installing the ready controller so this page's load and resource events are not missed.
				iframeDocument.open()
				// Install for every page before document.write. Runtime activity, rather than source
				// syntax, decides whether this page actually contains an ECharts instance.
				installEChartsExportInterceptor(iframeWindow)
				iframeWindow.addEventListener("error", onWindowError)
				iframeWindow.addEventListener("unhandledrejection", onUnhandledRejection)
				iframeWindow.addEventListener("rejectionhandled", onRejectionHandled)
				lifecycleState.readyController = new this.ReadyController({
					iframeWindow,
					iframeDocument,
					nativeLoadWaitMs: needsNativeLoadWait ? NATIVE_LOAD_WAIT_MS : 0,
					onResourceError: options?.onResourceError,
					onPageError: recordPageError,
					...readinessCapabilities,
				})

				iframeDocument.write(normalizedHtml)
				iframeDocument.close()

				checkLoaded = () => {
					if (lifecycleState.settled) return
					if (isDocumentReadyForRender({ iframeDocument, renderStartedAt })) {
						if (lifecycleState.readyStarted) return
						lifecycleState.readyStarted = true
						if (lifecycleState.pollTimerId) {
							clearTimeout(lifecycleState.pollTimerId)
							lifecycleState.pollTimerId = null
						}
						iframeWindow.requestAnimationFrame(() => {
							if (lifecycleState.settled) return

							Promise.resolve()
								.then(async () => {
									await Promise.race([
										lifecycleState.readyController?.waitForReady({
											signal: renderSignal,
										}) ?? Promise.resolve(),
										pageErrorPromise,
									])
									const measured = measureContentSize({
										iframeDocument,
										fallbackWidth: this.htmlWidth,
										fallbackHeight: this.htmlHeight,
									})
									finish("resolve", {
										iWindow: iframeWindow,
										iDocument: iframeDocument,
										totalWidth: measured.width,
										totalHeight: measured.height,
									})
								})
								.catch((error) => {
									recordRenderFailure(error)
									finish("reject", error)
								})
						})
					} else {
						lifecycleState.pollTimerId = setTimeout(checkLoaded, READY_STATE_POLL_MS)
					}
				}

				checkLoaded()
				iframeDocument.addEventListener("DOMContentLoaded", onDomReady, { once: true })
			} catch (error) {
				recordRenderFailure(error)
				finish("reject", error)
			}
		})
	}

	destroy(): void {
		if (this.currentIframe.parentNode) {
			this.currentIframe.parentNode.removeChild(this.currentIframe)
		}
	}

	/**
	 * Keep the initially-created iframe for the first page so public accessors remain usable
	 * immediately after construction. Every later page rotates to a new browsing context before
	 * any HTML is written, destroying the previous page's Window together with its timers and
	 * event listeners.
	 */
	private acquireRenderContext(): { window: Window; document: Document } {
		if (this.hasStartedRender) {
			const previousIframe = this.currentIframe
			const context = this.createBrowsingContext()
			this.currentIframe = context.iframe
			this.currentWindow = context.window
			this.currentDocument = context.document
			previousIframe.remove()
		} else {
			this.hasStartedRender = true
		}

		return {
			window: this.currentWindow,
			document: this.currentDocument,
		}
	}

	private createBrowsingContext(): {
		iframe: HTMLIFrameElement
		window: Window
		document: Document
	} {
		const iframe = createHiddenIframe({
			htmlWidth: this.htmlWidth,
			htmlHeight: this.htmlHeight,
		})
		document.body.appendChild(iframe)

		const iframeWindow = iframe.contentWindow
		const iframeDocument = iframe.contentDocument
		if (!iframeWindow || !iframeDocument) {
			iframe.remove()
			throw new Error("[Sandbox] failed to create iframe browsing context")
		}

		iframe.addEventListener("error", (event) => {
			this.sandboxLog(LogLevel.L4, "iframe error", { error: String(event) })
		})

		return { iframe, window: iframeWindow, document: iframeDocument }
	}
}
