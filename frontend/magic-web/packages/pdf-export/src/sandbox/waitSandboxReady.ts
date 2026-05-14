import { log, LogLevel } from "../logger"
import {
	createAbortError,
	runCancelableSteps,
	throwIfAborted,
	waitForTimeout,
	withAbort,
} from "./abort"
import {
	asElement,
	createResourceError,
	createWindowEvent,
	getTrackableResource,
	type ResourceRecord,
	type ResourceStatus,
} from "./waitSandboxReady.helpers"

export interface SandboxReadyControllerInput {
	iframeWindow: Window
	iframeDocument: Document
	nativeLoadWaitMs: number
	externalResourceTimeoutMs: number
}

type InterceptorPhase = (typeof INTERCEPTOR_PHASE)[keyof typeof INTERCEPTOR_PHASE]

interface LoadListenerRecord {
	original: EventListenerOrEventListenerObject
	wrapped: EventListener
	options?: boolean | AddEventListenerOptions
	called: boolean
	removed: boolean
	pendingTask: Promise<void> | null
}

interface DomReadyListenerRecord {
	original: EventListenerOrEventListenerObject
	wrapped: EventListener
	options?: boolean | AddEventListenerOptions
	called: boolean
	removed: boolean
	pendingTask: Promise<void> | null
}

const DEFAULT_EXTERNAL_RESOURCE_IDLE_MS = 500
const CANVAS_DELAY_MS = 2000
const EXPORT_FINAL_FRAME_STYLE_ID = "__magic-export-final-frame-style"

const INTERCEPTOR_PHASE = {
	INITIALIZED: "initialized",
	CAPTURE_ONLY: "capture-only",
	REPLAYING: "replaying",
	RESTORED: "restored",
} as const

const ALLOWED_TRANSITIONS: Record<InterceptorPhase, InterceptorPhase[]> = {
	[INTERCEPTOR_PHASE.INITIALIZED]: [
		INTERCEPTOR_PHASE.CAPTURE_ONLY,
		INTERCEPTOR_PHASE.REPLAYING,
		INTERCEPTOR_PHASE.RESTORED,
	],
	[INTERCEPTOR_PHASE.CAPTURE_ONLY]: [
		INTERCEPTOR_PHASE.REPLAYING,
		INTERCEPTOR_PHASE.RESTORED,
	],
	[INTERCEPTOR_PHASE.REPLAYING]: [
		INTERCEPTOR_PHASE.CAPTURE_ONLY,
		INTERCEPTOR_PHASE.RESTORED,
	],
	[INTERCEPTOR_PHASE.RESTORED]: [INTERCEPTOR_PHASE.RESTORED],
}

/**
 * 统一管理沙箱进入导出前必须收敛的所有准备工作：
 * load 生命周期拦截、外链 script/style 跟踪、字体、resize、
 * 最终帧样式，以及媒体/canvas 稳定等待。
 */
export class SandboxReadyController {
	private phase: InterceptorPhase = INTERCEPTOR_PHASE.INITIALIZED
	private restored = false
	private notifyResourceChange: () => void = () => {}
	private capturedOnload: ((this: Window, ev: Event) => unknown) | null = null
	private onloadCalled = false
	private resourceObserver: MutationObserver | null = null

	private readonly iframeWindow: Window
	private readonly iframeDocument: Document
	private readonly nativeLoadWaitMs: number
	private readonly externalResourceTimeoutMs: number
	private readonly loadListeners: LoadListenerRecord[] = []
	private readonly domReadyListeners: DomReadyListenerRecord[] = []
	private readonly inFlightTasks = new Set<Promise<void>>()
	private readonly resourceRecords = new Map<Element, ResourceRecord>()

	private readonly originalAddEventListener: Window["addEventListener"]
	private readonly originalRemoveEventListener: Window["removeEventListener"]
	private readonly originalOnloadDescriptor?: PropertyDescriptor
	private readonly originalDocumentAddEventListener: Document["addEventListener"]
	private readonly originalDocumentRemoveEventListener: Document["removeEventListener"]

	constructor({
		iframeWindow,
		iframeDocument,
		nativeLoadWaitMs,
		externalResourceTimeoutMs,
	}: SandboxReadyControllerInput) {
		this.iframeWindow = iframeWindow
		this.iframeDocument = iframeDocument
		this.nativeLoadWaitMs = nativeLoadWaitMs
		this.externalResourceTimeoutMs = externalResourceTimeoutMs
		this.originalAddEventListener = iframeWindow.addEventListener.bind(
			iframeWindow,
		) as Window["addEventListener"]
		this.originalRemoveEventListener = iframeWindow.removeEventListener.bind(
			iframeWindow,
		) as Window["removeEventListener"]
		this.originalOnloadDescriptor = Object.getOwnPropertyDescriptor(iframeWindow, "onload")
		this.originalDocumentAddEventListener = iframeDocument.addEventListener.bind(
			iframeDocument,
		) as Document["addEventListener"]
		this.originalDocumentRemoveEventListener = iframeDocument.removeEventListener.bind(
			iframeDocument,
		) as Document["removeEventListener"]

		this.installLoadLifecycleInterceptor()
		this.installExternalResourceTracker()
	}

	async waitForReady(options: { signal?: AbortSignal } = {}): Promise<void> {
		const signal = options.signal
		await runCancelableSteps({
			signal,
			steps: [
				() => this.waitForNativeLoad(),
				() => this.scanInitialDocumentResources(),
				() => this.activateCaptureOnly(),
				() => this.replayLoadCallbacks(),
				() => this.waitForExternalResources({ signal }),
				() => this.waitForDocumentFonts(signal),
				() => {
					this.iframeWindow.dispatchEvent(createWindowEvent(this.iframeWindow, "resize"))
				},
				() => this.injectExportFinalFrameStyles(),
				() => this.waitForRenderResources(signal),
			],
		})
	}

	restore(): void {
		if (this.restored) return
		this.transitionPhase(INTERCEPTOR_PHASE.RESTORED)
		this.restored = true
		this.restoreExternalResourceTracker()
		this.restoreLoadLifecycleInterceptor()
	}

	private installLoadLifecycleInterceptor(): void {
		this.iframeWindow.addEventListener = ((
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions,
		): void => {
			if (this.isRestored()) {
				this.originalAddEventListener(type, listener, options)
				return
			}
			if (type !== "load") {
				this.originalAddEventListener(type, listener, options)
				return
			}

			const record: LoadListenerRecord = {
				original: listener,
				options,
				called: false,
				removed: false,
				wrapped: () => {},
				pendingTask: null,
			}

			record.wrapped = (event: Event) => {
				record.called = true
				record.pendingTask = this.trackTask(this.invokeListener(listener, event))
			}
			this.loadListeners.push(record)

			if (this.isNativeDispatchPhase())
				this.originalAddEventListener("load", record.wrapped, options)
		}) as typeof this.iframeWindow.addEventListener

		this.iframeWindow.removeEventListener = ((
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | EventListenerOptions,
		): void => {
			if (this.isRestored()) {
				this.originalRemoveEventListener(type, listener, options)
				return
			}
			if (type !== "load") {
				this.originalRemoveEventListener(type, listener, options)
				return
			}

			for (const record of this.loadListeners) {
				if (record.original !== listener) continue
				record.removed = true
				this.originalRemoveEventListener(
					"load",
					record.wrapped,
					record.options as boolean | EventListenerOptions,
				)
			}
		}) as typeof this.iframeWindow.removeEventListener

		this.iframeDocument.addEventListener = ((
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions,
		): void => {
			if (this.isRestored()) {
				this.originalDocumentAddEventListener(type, listener, options)
				return
			}
			if (type !== "DOMContentLoaded") {
				this.originalDocumentAddEventListener(type, listener, options)
				return
			}

			const record: DomReadyListenerRecord = {
				original: listener,
				options,
				called: false,
				removed: false,
				wrapped: () => {},
				pendingTask: null,
			}
			record.wrapped = (event: Event) => {
				record.called = true
				record.pendingTask = this.trackTask(this.invokeListener(listener, event))
			}
			this.domReadyListeners.push(record)

			if (this.isNativeDispatchPhase() && this.iframeDocument.readyState === "loading") {
				this.originalDocumentAddEventListener("DOMContentLoaded", record.wrapped, options)
			}
		}) as typeof this.iframeDocument.addEventListener

		this.iframeDocument.removeEventListener = ((
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | EventListenerOptions,
		): void => {
			if (this.isRestored()) {
				this.originalDocumentRemoveEventListener(type, listener, options)
				return
			}
			if (type !== "DOMContentLoaded") {
				this.originalDocumentRemoveEventListener(type, listener, options)
				return
			}
			for (const record of this.domReadyListeners) {
				if (record.original !== listener) continue
				record.removed = true
				this.originalDocumentRemoveEventListener(
					"DOMContentLoaded",
					record.wrapped,
					record.options as boolean | EventListenerOptions,
				)
			}
		}) as typeof this.iframeDocument.removeEventListener

		try {
			Object.defineProperty(this.iframeWindow, "onload", {
				get: () => this.capturedOnload,
				set: (handler: ((this: Window, ev: Event) => unknown) | null) => {
					this.capturedOnload = typeof handler === "function" ? handler : null
				},
				configurable: true,
			})
		} catch (error) {
			log(LogLevel.L3, "failed to intercept window.onload", { error: String(error) })
		}
	}

	private restoreLoadLifecycleInterceptor(): void {
		this.iframeWindow.addEventListener = this.originalAddEventListener
		this.iframeWindow.removeEventListener = this.originalRemoveEventListener
		this.iframeDocument.addEventListener = this.originalDocumentAddEventListener
		this.iframeDocument.removeEventListener = this.originalDocumentRemoveEventListener
		try {
			if (this.originalOnloadDescriptor) {
				Object.defineProperty(this.iframeWindow, "onload", this.originalOnloadDescriptor)
				return
			}
			delete (this.iframeWindow as { onload?: unknown }).onload
		} catch (error) {
			log(LogLevel.L3, "restore window.onload failed", { error: String(error) })
		}
	}

	private installExternalResourceTracker(): void {
		this.originalDocumentAddEventListener("load", this.onCapturedResourceLoad, true)
		this.originalDocumentAddEventListener("error", this.onCapturedResourceError, true)

		try {
			this.resourceObserver = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					if (mutation.type === "childList") {
						mutation.addedNodes.forEach(this.discoverNodeTree)
						mutation.removedNodes.forEach(this.pruneNodeTree)
					} else if (mutation.type === "attributes") {
						const element = asElement(mutation.target)
						if (element) this.trackElement(element)
					}
				}
				this.notifyResourceChange()
			})
			this.resourceObserver.observe(this.iframeDocument, {
				attributes: true,
				attributeFilter: ["src", "href", "rel", "disabled"],
				childList: true,
				subtree: true,
			})
		} catch (error) {
			log(LogLevel.L3, "sandbox ready observer init failed", { error: String(error) })
		}
	}

	private restoreExternalResourceTracker(): void {
		this.originalDocumentRemoveEventListener("load", this.onCapturedResourceLoad, true)
		this.originalDocumentRemoveEventListener("error", this.onCapturedResourceError, true)
		this.resourceObserver?.disconnect()
		this.resourceObserver = null
		for (const record of this.resourceRecords.values()) {
			record.cleanup?.()
		}
		this.resourceRecords.clear()
		this.notifyResourceChange = () => {}
	}

	private readonly onCapturedResourceLoad = (event: Event): void => {
		const element = asElement(event.target)
		if (!element) return
		this.markResource(element, "loaded")
	}

	private readonly onCapturedResourceError = (event: Event): void => {
		const element = asElement(event.target)
		if (!element) return
		this.markResource(element, "errored", "load error")
	}

	private waitForNativeLoad(): Promise<void> {
		if (this.isRestored()) return Promise.resolve()
		if (this.iframeDocument.readyState === "complete") return Promise.resolve()
		return new Promise<void>((resolve) => {
			let done = false
			const finish = () => {
				if (done) return
				done = true
				this.originalRemoveEventListener("load", onLoad)
				resolve()
			}
			const onLoad = () => {
				finish()
			}
			this.originalAddEventListener("load", onLoad, { once: true })
			setTimeout(finish, this.nativeLoadWaitMs)
		})
	}

	private activateCaptureOnly(): void {
		if (this.isRestored()) return
		this.transitionPhase(INTERCEPTOR_PHASE.CAPTURE_ONLY)
	}

	private async replayLoadCallbacks(): Promise<void> {
		if (this.isRestored()) return
		const previousPhase = this.phase
		this.transitionPhase(INTERCEPTOR_PHASE.REPLAYING)

		const fakeLoadEvent = createWindowEvent(this.iframeWindow, "load")
		const fakeDomReadyEvent = createWindowEvent(this.iframeWindow, "DOMContentLoaded")
		const pendingTasks: Promise<void>[] = []

		if (!this.onloadCalled && this.capturedOnload) {
			try {
				this.onloadCalled = true
				pendingTasks.push(
					this.trackTask(
						Promise.resolve(this.capturedOnload.call(this.iframeWindow, fakeLoadEvent)).then(
							() => undefined,
						),
					),
				)
			} catch (error) {
				log(LogLevel.L3, "window.onload callback failed", { error: String(error) })
			}
		}

		for (const record of this.loadListeners) {
			if (record.called || record.removed) continue
			try {
				record.called = true
				const task = this.trackTask(this.invokeListener(record.original, fakeLoadEvent))
				record.pendingTask = task
				pendingTasks.push(task)
			} catch (error) {
				log(LogLevel.L3, "load listener callback failed", { error: String(error) })
			}
		}

		for (const record of this.domReadyListeners) {
			if (record.called || record.removed) continue
			try {
				record.called = true
				const task = this.trackTask(
					this.invokeListener(record.original, fakeDomReadyEvent),
				)
				record.pendingTask = task
				pendingTasks.push(task)
			} catch (error) {
				log(LogLevel.L3, "DOMContentLoaded callback failed", { error: String(error) })
			}
		}

		this.collectPendingCallbackTasks(pendingTasks)
		await Promise.allSettled(pendingTasks)

		if (!this.isRestored()) {
			if (previousPhase === INTERCEPTOR_PHASE.INITIALIZED)
				this.transitionPhase(INTERCEPTOR_PHASE.INITIALIZED)
			else this.transitionPhase(INTERCEPTOR_PHASE.CAPTURE_ONLY)
		}
	}

	private waitForExternalResources(options: { signal?: AbortSignal } = {}): Promise<void> {
		const timeoutMs = this.externalResourceTimeoutMs
		const idleMs = DEFAULT_EXTERNAL_RESOURCE_IDLE_MS
		const signal = options.signal

		throwIfAborted(signal)
		this.scanDocument()
		this.pruneDisconnectedPending()

		log(LogLevel.L2, "等待沙箱外链资源加载", {
			total: this.resourceRecords.size,
			pending: this.getPendingRecords().length,
			timeoutMs,
			idleMs,
		})

		return new Promise<void>((resolve, reject) => {
			let settled = false
			let idleTimer: ReturnType<typeof setTimeout> | null = null
			let timeoutTimer: ReturnType<typeof setTimeout> | null = null
			let checkQueued = false
			const previousNotify = this.notifyResourceChange

			const cleanup = () => {
				settled = true
				this.notifyResourceChange = previousNotify
				if (idleTimer) clearTimeout(idleTimer)
				if (timeoutTimer) clearTimeout(timeoutTimer)
				signal?.removeEventListener("abort", onAbort)
			}

			const fail = (error: unknown) => {
				if (settled) return
				cleanup()
				reject(error)
			}

			const done = () => {
				if (settled) return
				cleanup()
				resolve()
			}

			const onAbort = () => fail(createAbortError())

			const scheduleCheck = () => {
				if (settled || checkQueued) return
				checkQueued = true
				Promise.resolve().then(() => {
					checkQueued = false
					check()
				})
			}

			const check = () => {
				if (settled) return
				try {
					throwIfAborted(signal)
					this.scanDocument()
					this.pruneDisconnectedPending()

					const errored = this.getErroredRecords()
					if (errored.length > 0) {
						fail(createResourceError("external resource load failed", errored))
						return
					}

					const pending = this.getPendingRecords()
					if (pending.length > 0) {
						if (idleTimer) {
							clearTimeout(idleTimer)
							idleTimer = null
						}
						return
					}

					if (idleTimer) return
					idleTimer = setTimeout(() => {
						idleTimer = null
						this.scanDocument()
						this.pruneDisconnectedPending()
						const latestErrored = this.getErroredRecords()
						if (latestErrored.length > 0) {
							fail(createResourceError("external resource load failed", latestErrored))
							return
						}
						if (this.getPendingRecords().length === 0) {
							log(LogLevel.L2, "沙箱外链资源加载完成", {
								total: this.resourceRecords.size,
								errored: latestErrored.length,
							})
							done()
							return
						}
						check()
					}, idleMs)
				} catch (error) {
					fail(error)
				}
			}

			this.notifyResourceChange = scheduleCheck
			signal?.addEventListener("abort", onAbort, { once: true })
			timeoutTimer = setTimeout(() => {
				fail(
					createResourceError(
						`external resources timeout after ${timeoutMs}ms`,
						this.getPendingRecords(),
					),
				)
			}, timeoutMs)

			check()
		})
	}

	private async waitForDocumentFonts(signal?: AbortSignal): Promise<void> {
		const fonts = this.iframeDocument.fonts
		if (!fonts?.ready) return
		await withAbort({
			task: fonts.ready.then(() => undefined).catch(() => undefined),
			signal,
		})
	}

	private injectExportFinalFrameStyles(): void {
		if (this.iframeDocument.getElementById(EXPORT_FINAL_FRAME_STYLE_ID)) return
		const styleElement = this.iframeDocument.createElement("style")
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
		;(this.iframeDocument.head ?? this.iframeDocument.documentElement).appendChild(styleElement)
	}

	private async waitForRenderResources(signal?: AbortSignal): Promise<void> {
		throwIfAborted(signal)
		await this.waitForCanvasDelay(signal)
		throwIfAborted(signal)
		await Promise.all([this.waitForImages(signal), this.waitForVideos(signal)])
		throwIfAborted(signal)
	}

	private waitForCanvasDelay(signal?: AbortSignal): Promise<void> {
		const hasCanvas = Boolean(this.iframeDocument.querySelector("canvas"))
		if (!hasCanvas) return Promise.resolve()
		return waitForTimeout({ ms: CANVAS_DELAY_MS, signal })
	}

	private waitForImages(signal?: AbortSignal): Promise<void> {
		const images = this.iframeDocument.querySelectorAll("img")
		const promises = Array.from(images).map((img) => {
			if (img.complete) return Promise.resolve()
			return new Promise<void>((resolveImage) => {
				const cleanup = () => {
					img.removeEventListener("load", onLoad)
					img.removeEventListener("error", onError)
					signal?.removeEventListener("abort", onAbort)
				}
				const onLoad = () => {
					cleanup()
					resolveImage()
				}
				const onError = () => {
					cleanup()
					resolveImage()
				}
				const onAbort = () => {
					cleanup()
					resolveImage()
				}
				img.addEventListener("load", onLoad, { once: true })
				img.addEventListener("error", onError, { once: true })
				signal?.addEventListener("abort", onAbort, { once: true })
			})
		})
		return Promise.all(promises).then(() => undefined)
	}

	private waitForVideos(signal?: AbortSignal): Promise<void> {
		const videos = this.iframeDocument.querySelectorAll("video")
		const promises = Array.from(videos).map((video) => {
			if (video.readyState >= 1) return Promise.resolve()
			return new Promise<void>((resolveVideo) => {
				const cleanup = () => {
					video.removeEventListener("loadedmetadata", onLoadedMetadata)
					video.removeEventListener("error", onError)
					signal?.removeEventListener("abort", onAbort)
				}
				const onLoadedMetadata = () => {
					cleanup()
					resolveVideo()
				}
				const onError = () => {
					cleanup()
					resolveVideo()
				}
				const onAbort = () => {
					cleanup()
					resolveVideo()
				}
				video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true })
				video.addEventListener("error", onError, { once: true })
				signal?.addEventListener("abort", onAbort, { once: true })
			})
		})
		return Promise.all(promises).then(() => undefined)
	}

	private transitionPhase(nextPhase: InterceptorPhase): void {
		const allowedPhases = ALLOWED_TRANSITIONS[this.phase]
		if (!allowedPhases.includes(nextPhase)) {
			log(LogLevel.L3, "invalid interceptor phase transition", {
				from: this.phase,
				to: nextPhase,
			})
			return
		}
		this.phase = nextPhase
	}

	private isNativeDispatchPhase(): boolean {
		return this.phase === INTERCEPTOR_PHASE.INITIALIZED
	}

	private isRestored(): boolean {
		return this.restored || this.phase === INTERCEPTOR_PHASE.RESTORED
	}

	private invokeListener(
		listener: EventListenerOrEventListenerObject,
		event: Event,
	): Promise<void> {
		let result: unknown
		try {
			if (typeof listener === "function") result = listener.call(this.iframeWindow, event)
			else result = listener.handleEvent(event)
		} catch (error) {
			log(LogLevel.L3, "load callback sync failed", { error: String(error) })
			return Promise.resolve()
		}

		return Promise.resolve(result)
			.then(() => undefined)
			.catch((error) => {
				log(LogLevel.L3, "load callback async failed", { error: String(error) })
			})
	}

	private trackTask(task: Promise<void>): Promise<void> {
		this.inFlightTasks.add(task)
		task.finally(() => {
			this.inFlightTasks.delete(task)
		})
		return task
	}

	private collectPendingCallbackTasks(pendingTasks: Promise<void>[]): void {
		for (const record of this.loadListeners) {
			if (!record.pendingTask) continue
			if (pendingTasks.includes(record.pendingTask)) continue
			pendingTasks.push(record.pendingTask)
		}
		for (const record of this.domReadyListeners) {
			if (!record.pendingTask) continue
			if (pendingTasks.includes(record.pendingTask)) continue
			pendingTasks.push(record.pendingTask)
		}
		for (const task of this.inFlightTasks) {
			if (pendingTasks.includes(task)) continue
			pendingTasks.push(task)
		}
	}

	private scanInitialDocumentResources(): void {
		this.iframeDocument.querySelectorAll("script[src],link[href]").forEach((element) => {
			this.trackElement(element, { assumeLoadedWhenDocumentComplete: true })
		})
	}

	private scanDocument(): void {
		this.iframeDocument.querySelectorAll("script[src],link[href]").forEach((element) => {
			this.trackElement(element)
		})
	}

	private readonly discoverNodeTree = (node: Node): void => {
		const element = asElement(node)
		if (!element) return
		this.trackElement(element)
		element.querySelectorAll?.("script[src],link[href]").forEach((child) => {
			this.trackElement(child)
		})
	}

	private readonly pruneNodeTree = (node: Node): void => {
		const element = asElement(node)
		if (!element) return
		this.removeRecord(element)
		element.querySelectorAll?.("script[src],link[href]").forEach((child) => {
			this.removeRecord(child)
		})
	}

	private pruneDisconnectedPending(): void {
		for (const [element, record] of this.resourceRecords) {
			if (record.status === "pending" && !element.isConnected) this.removeRecord(element)
		}
	}

	private trackElement(
		element: Element,
		options?: { assumeLoadedWhenDocumentComplete?: boolean },
	): void {
		const descriptor = getTrackableResource(element, options)
		if (!descriptor) {
			this.removeRecord(element)
			return
		}

		const existing = this.resourceRecords.get(element)
		if (existing && existing.url === descriptor.url && existing.kind === descriptor.kind) {
			if (existing.status === "pending" && descriptor.initialStatus === "loaded") {
				existing.status = "loaded"
				existing.error = undefined
				this.notifyResourceChange()
			}
			return
		}

		existing?.cleanup?.()
		const record: ResourceRecord = {
			element,
			kind: descriptor.kind,
			url: descriptor.url,
			label: descriptor.label,
			status: descriptor.initialStatus,
		}

		const onLoad = () => this.markResource(element, "loaded")
		const onError = () => this.markResource(element, "errored", "load error")
		element.addEventListener("load", onLoad, { once: true })
		element.addEventListener("error", onError, { once: true })
		record.cleanup = () => {
			element.removeEventListener("load", onLoad)
			element.removeEventListener("error", onError)
		}

		this.resourceRecords.set(element, record)
		this.notifyResourceChange()
	}

	private removeRecord(element: Element): void {
		const record = this.resourceRecords.get(element)
		if (!record) return
		record.cleanup?.()
		this.resourceRecords.delete(element)
		this.notifyResourceChange()
	}

	private markResource(
		element: Element,
		status: Exclude<ResourceStatus, "pending">,
		error?: string,
	): void {
		if (!getTrackableResource(element)) return
		this.trackElement(element)
		const record = this.resourceRecords.get(element)
		if (!record) return
		record.status = status
		record.error = error
		this.notifyResourceChange()
	}

	private getPendingRecords(): ResourceRecord[] {
		return Array.from(this.resourceRecords.values()).filter(
			(record) => record.status === "pending",
		)
	}

	private getErroredRecords(): ResourceRecord[] {
		return Array.from(this.resourceRecords.values()).filter(
			(record) => record.status === "errored",
		)
	}
}
