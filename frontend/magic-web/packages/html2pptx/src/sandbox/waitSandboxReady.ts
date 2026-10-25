import { throwIfAborted, waitForTimeout, withAbort } from "./abort"
import type { ResourceLoadError } from "../api/options"
import { CANVAS_DELAY_MS } from "../shared/constants"
import { waitForPageRenderReadiness } from "./render-readiness"

export interface SandboxReadyControllerInput {
	iframeWindow: Window
	iframeDocument: Document
	nativeLoadWaitMs: number
	onResourceError?: (error: ResourceLoadError) => void
	onPageError?: (error: unknown) => void
	echartsSourceHint?: boolean
	expectsExplicitRenderReady?: boolean
}

export class SandboxReadyController {
	private readonly iframeWindow: Window
	private readonly iframeDocument: Document
	private readonly nativeLoadWaitMs: number
	private readonly onResourceError?: (error: ResourceLoadError) => void
	private readonly echartsSourceHint: boolean
	private readonly expectsExplicitRenderReady: boolean

	constructor({
		iframeWindow,
		iframeDocument,
		nativeLoadWaitMs,
		onResourceError,
		onPageError,
		echartsSourceHint = false,
		expectsExplicitRenderReady = false,
	}: SandboxReadyControllerInput) {
		this.iframeWindow = iframeWindow
		this.iframeDocument = iframeDocument
		this.nativeLoadWaitMs = nativeLoadWaitMs
		this.onResourceError = onResourceError
		this.echartsSourceHint = echartsSourceHint
		this.expectsExplicitRenderReady = expectsExplicitRenderReady
		void onPageError
	}

	async waitForReady(options: { signal?: AbortSignal } = {}): Promise<void> {
		void this.onResourceError
		await waitForTimeout({ ms: this.nativeLoadWaitMs, signal: options.signal })
		await waitForRenderResources({
			iframeDocument: this.iframeDocument,
			signal: options.signal,
			skipCanvasDelay: true,
		})
		this.iframeWindow.dispatchEvent(new Event("resize"))
		const readiness = await waitForPageRenderReadiness({
			iframeWindow: this.iframeWindow,
			iframeDocument: this.iframeDocument,
			echartsSourceHint: this.echartsSourceHint,
			expectsExplicitRenderReady: this.expectsExplicitRenderReady,
			signal: options.signal,
			onResourceError: this.onResourceError,
		})
		await waitForRenderResources({
			iframeDocument: this.iframeDocument,
			signal: options.signal,
			skipCanvasDelay: readiness.handledCanvas,
		})
	}

	restore(): void {
		// The default implementation has no extra interceptors to restore; extensions can override this logic.
	}
}

function waitForImages(iframeDocument: Document, signal?: AbortSignal): Promise<void> {
	const images = iframeDocument.querySelectorAll("img")
	const promises = Array.from(images).map(async (img) => {
		if (!img.complete) {
			await new Promise<void>((resolveImage) => {
				const cleanup = () => {
					img.removeEventListener("load", onLoad)
					img.removeEventListener("error", onError)
					if (signal) signal.removeEventListener("abort", onAbort)
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
		}
		// `complete` only guarantees that the resource request finished. Await
		// decode when available so static pages can safely skip the old fixed
		// 1.5s grace period without capturing a partially decoded image.
		if (typeof img.decode === "function") {
			await withAbort({
				task: Promise.resolve()
					.then(() => img.decode())
					.catch(() => undefined),
				signal,
			})
		}
	})
	return Promise.all(promises).then(() => {})
}

function waitForVideos(iframeDocument: Document, signal?: AbortSignal): Promise<void> {
	const videos = iframeDocument.querySelectorAll("video")
	const promises = Array.from(videos).map((video) => {
		if (video.readyState >= 1) return Promise.resolve()
		return new Promise<void>((resolveVideo) => {
			const cleanup = () => {
				video.removeEventListener("loadedmetadata", onLoadedMetadata)
				video.removeEventListener("error", onError)
				if (signal) signal.removeEventListener("abort", onAbort)
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
	return Promise.all(promises).then(() => {})
}

function waitForCanvasDelay(iframeDocument: Document, signal?: AbortSignal): Promise<void> {
	const hasCanvas = Boolean(iframeDocument.querySelector("canvas"))
	if (!hasCanvas) return Promise.resolve()
	return waitForTimeout({ ms: CANVAS_DELAY_MS, signal })
}

export async function waitForRenderResources({
	iframeDocument,
	signal,
	skipCanvasDelay = false,
}: {
	iframeDocument: Document
	signal?: AbortSignal
	skipCanvasDelay?: boolean
}): Promise<void> {
	throwIfAborted(signal)
	if (!skipCanvasDelay) await waitForCanvasDelay(iframeDocument, signal)
	throwIfAborted(signal)
	await Promise.all([
		waitForImages(iframeDocument, signal),
		waitForVideos(iframeDocument, signal),
	])
	throwIfAborted(signal)
}
