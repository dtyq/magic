import { snapdom, type SnapdomPlugin } from "@zumer/snapdom"
import {
	decodeHTMLEntities,
	fallbackImageBase64,
	getFullContent,
} from "../../../contents/HTML/utils/full-content"
import {
	resolvePptScaleContentDimensions,
	type CanonicalContentDimensions,
} from "../../../contents/HTML/utils/slide-dimensions"
import { prepareScreenshotAnimations } from "./prepareScreenshotAnimations"
import { stabilizeSingleLineTextForSnapdom } from "./snapdomTextStabilizer"
import {
	createPPTThumbnailCacheKey,
	deletePPTThumbnail,
	savePPTThumbnail,
	type PPTThumbnailCacheContext,
	type PPTThumbnailCacheMode,
} from "./PPTThumbnailCache"
import {
	pptThumbnailCacheRepository,
	type PPTThumbnailCacheKey,
} from "@/services/superMagic/repositories/PPTThumbnailCacheRepository"

const THUMBNAIL_SCALE = 4
const THUMBNAIL_QUALITY = 0.8
const MAX_CONCURRENT_SCREENSHOT_GENERATIONS = 2
const MAX_PRIORITY_GENERATION_BURST = 3
const SCREENSHOT_PREPARATION_IDLE_TIMEOUT = 32
const MAX_CONCURRENT_IMAGE_CACHE_REFRESHES = MAX_CONCURRENT_SCREENSHOT_GENERATIONS

interface ScheduledScreenshotGeneration<T> {
	promise: Promise<T>
	cancel: (reason: unknown) => boolean
	hasStarted: () => boolean
}

type HoldScreenshotGenerationSlot = (operation: PromiseLike<unknown>) => void

interface PendingScreenshotGeneration {
	hasStarted: boolean
	hasCancelled: boolean
	hasSettled: boolean
	hasReleasedSlot: boolean
	start: () => void
}

interface LatestScreenshotRequest {
	requestId: number
	refreshId?: number
	content: string
	requestKind: SlideScreenshotRequestKind
	contentHash?: string
	dimensions?: CanonicalContentDimensions
}

interface InFlightScreenshotGeneration {
	requestId: number
	persistentKey?: string
	url: string
	content: string
	contentHash: string
	dimensions: CanonicalContentDimensions
	epoch: number
	hasRequiredConsumer: boolean
	scheduledGeneration: ScheduledScreenshotGeneration<string>
}

interface InlineCrossOriginImagesResult {
	restore: () => void
	inlinedCount: number
}

export type SlideScreenshotRequestKind = "preview" | "required"

/**
 * Limits the expensive DOM/iframe screenshot work across all service instances.
 * Queued work is freshness-biased so newly visible slides start promptly. A
 * bounded LIFO burst periodically falls back to the oldest task for fairness.
 */
class ScreenshotGenerationScheduler {
	private activeCount = 0
	private latestGenerationStreak = 0
	private readonly pendingGenerations: PendingScreenshotGeneration[] = []

	constructor(private readonly concurrency: number) {}

	schedule<T>(
		task: (signal: AbortSignal, holdSlotUntil: HoldScreenshotGenerationSlot) => Promise<T>,
	): ScheduledScreenshotGeneration<T> {
		let resolveGeneration: (value: T | PromiseLike<T>) => void = () => undefined
		let rejectGeneration: (reason?: unknown) => void = () => undefined
		const promise = new Promise<T>((resolve, reject) => {
			resolveGeneration = resolve
			rejectGeneration = reject
		})
		const abortController = new AbortController()
		const slotHolders: Promise<void>[] = []
		const holdSlotUntil: HoldScreenshotGenerationSlot = (operation) => {
			// Observe failures immediately so a rejected third-party operation cannot
			// produce an unhandled rejection while the scheduler is still awaiting it.
			slotHolders.push(
				Promise.resolve(operation).then(
					() => undefined,
					() => undefined,
				),
			)
		}
		let releaseActiveSlot = () => undefined
		const pendingGeneration: PendingScreenshotGeneration = {
			hasStarted: false,
			hasCancelled: false,
			hasSettled: false,
			hasReleasedSlot: false,
			start: () => {
				if (pendingGeneration.hasStarted || pendingGeneration.hasCancelled) return
				pendingGeneration.hasStarted = true
				this.activeCount += 1

				void (async () => {
					try {
						const value = await task(abortController.signal, holdSlotUntil)
						if (!pendingGeneration.hasCancelled) {
							pendingGeneration.hasSettled = true
							resolveGeneration(value)
						}
					} catch (error) {
						if (!pendingGeneration.hasCancelled) {
							pendingGeneration.hasSettled = true
							rejectGeneration(error)
						}
					} finally {
						// Cancellation settles the caller immediately, but third-party screenshot
						// work may be non-abortable. Keep the physical slot until every registered
						// operation has actually settled so real concurrency never exceeds the cap.
						// A non-settling operation intentionally blocks its slot; releasing it on a
						// timer would allow cancelled CPU/memory-heavy work to accumulate again.
						await Promise.all(slotHolders)
						releaseActiveSlot()
					}
				})()
			},
		}
		releaseActiveSlot = () => {
			if (!pendingGeneration.hasStarted || pendingGeneration.hasReleasedSlot) return
			pendingGeneration.hasReleasedSlot = true
			this.activeCount -= 1
			this.drain()
		}

		if (this.activeCount < this.concurrency) {
			pendingGeneration.start()
		} else {
			this.pendingGenerations.push(pendingGeneration)
		}

		return {
			promise,
			hasStarted: () => pendingGeneration.hasStarted,
			cancel: (reason: unknown) => {
				if (pendingGeneration.hasCancelled || pendingGeneration.hasSettled) return false
				pendingGeneration.hasCancelled = true
				pendingGeneration.hasSettled = true
				abortController.abort(reason)
				const pendingIndex = this.pendingGenerations.indexOf(pendingGeneration)
				if (pendingIndex >= 0) this.pendingGenerations.splice(pendingIndex, 1)
				rejectGeneration(reason)
				return true
			},
		}
	}

	private drain(): void {
		while (this.activeCount < this.concurrency) {
			const nextGeneration = this.takeNextGeneration()
			if (!nextGeneration) {
				this.latestGenerationStreak = 0
				return
			}
			nextGeneration.start()
		}
	}

	private takeNextGeneration(): PendingScreenshotGeneration | undefined {
		if (this.pendingGenerations.length === 0) return undefined

		if (this.latestGenerationStreak < MAX_PRIORITY_GENERATION_BURST) {
			this.latestGenerationStreak += 1
			return this.pendingGenerations.pop()
		}

		this.latestGenerationStreak = 0
		return this.pendingGenerations.shift()
	}
}

const screenshotGenerationScheduler = new ScreenshotGenerationScheduler(
	MAX_CONCURRENT_SCREENSHOT_GENERATIONS,
)

/**
 * Cache entry for slide screenshot
 */
interface ScreenshotCacheEntry {
	persistentKey?: string
	thumbnailUrl: string
	timestamp: number
	contentHash: string
	content: string
	dimensions: CanonicalContentDimensions
}

class ScreenshotGenerationCancelledError extends Error {
	constructor() {
		super("Screenshot generation cancelled")
		this.name = "AbortError"
	}
}

/**
 * SlideScreenshotService - Manages screenshot generation with caching
 * Generates thumbnails from HTML content using snapDOM
 */
export class SlideScreenshotService {
	private cache: Map<string, ScreenshotCacheEntry> = new Map()
	private inFlightGenerations: Map<string, InFlightScreenshotGeneration[]> = new Map()
	private latestRequestsByUrl: Map<string, LatestScreenshotRequest> = new Map()
	private nextRequestId = 0
	private generationEpoch = 0
	private previewGenerationEpoch = 0
	private disposed = false

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

	private getContentHash(content: string, dimensions?: CanonicalContentDimensions): string {
		const resolvedDimensions = dimensions ?? resolvePptScaleContentDimensions(content)
		return this.hashContent(
			`${content}:${resolvedDimensions.width}x${resolvedDimensions.height}`,
		)
	}

	/**
	 * Generate screenshot for HTML content with caching
	 * @param url - Slide URL (used as cache key)
	 * @param content - HTML content to render
	 * @returns Object URL of the generated thumbnail
	 */
	async generateScreenshot(
		url: string,
		content: string,
		requestKind: SlideScreenshotRequestKind = "required",
		cacheContext?: PPTThumbnailCacheContext,
		cacheMode: PPTThumbnailCacheMode = "use",
	): Promise<string> {
		if (this.disposed) {
			throw new ScreenshotGenerationCancelledError()
		}
		if (!content) {
			throw new Error("Content is required")
		}
		if (cacheMode === "refresh") {
			// 强制刷新不复用旧任务；连同异步缓存读取一起取消，防止同内容的旧图重新写回。
			this.inFlightGenerations.forEach((bucket, key) => {
				for (const entry of [...bucket]) {
					if (entry.url !== url) continue
					entry.scheduledGeneration.cancel(new ScreenshotGenerationCancelledError())
					this.clearInFlightGeneration(key, entry)
				}
			})
			this.clearCache(url)
		}

		const requestEpoch = this.generationEpoch
		const requestPreviewEpoch = this.previewGenerationEpoch
		const requestId = ++this.nextRequestId
		const refreshId =
			cacheMode === "refresh" ? requestId : this.latestRequestsByUrl.get(url)?.refreshId
		this.latestRequestsByUrl.set(url, { requestId, content, requestKind, refreshId })

		await this.yieldForPreparation()
		this.throwIfGenerationCancelled(requestEpoch)
		if (requestKind === "preview" && requestPreviewEpoch !== this.previewGenerationEpoch) {
			throw new ScreenshotGenerationCancelledError()
		}

		const dimensions = resolvePptScaleContentDimensions(content)
		const contentHash = this.getContentHash(content, dimensions)
		const persistentKey = cacheContext
			? createPPTThumbnailCacheKey(cacheContext, {
					...dimensions,
					scale: THUMBNAIL_SCALE,
					mimeType: "image/webp",
					quality: THUMBNAIL_QUALITY,
				})
			: undefined
		const generationKey = `${url}\u0000${contentHash}\u0000${refreshId ?? ""}`
		if (this.latestRequestsByUrl.get(url)?.requestId === requestId) {
			this.latestRequestsByUrl.set(url, {
				requestId,
				refreshId,
				content,
				requestKind,
				contentHash,
				dimensions,
			})
		}

		// Check cache first
		const cached = this.cache.get(url)
		if (
			cacheMode === "use" &&
			cached &&
			cached.persistentKey === persistentKey?.key &&
			this.matchesPreparedContent(cached, content, contentHash, dimensions)
		) {
			return cached.thumbnailUrl
		}

		// Share the exact same request instead of creating duplicate iframes.
		const inFlightGeneration = this.inFlightGenerations
			.get(generationKey)
			?.find(
				(generation) =>
					generation.persistentKey === persistentKey?.key &&
					this.matchesPreparedContent(generation, content, contentHash, dimensions),
			)
		if (inFlightGeneration) {
			inFlightGeneration.requestId = requestId
			if (requestKind === "required") inFlightGeneration.hasRequiredConsumer = true
			return this.waitForGeneration(
				inFlightGeneration.scheduledGeneration.promise,
				requestEpoch,
			)
		}

		const inFlightEntry = this.createScreenshotRequest({
			url,
			content,
			contentHash,
			dimensions,
			requestEpoch,
			requestId,
			requestKind,
			persistentKey,
			cacheMode,
		})
		const { scheduledGeneration } = inFlightEntry
		const generationBucket = this.inFlightGenerations.get(generationKey) ?? []
		generationBucket.push(inFlightEntry)
		this.inFlightGenerations.set(generationKey, generationBucket)
		void scheduledGeneration.promise.then(
			() => this.clearInFlightGeneration(generationKey, inFlightEntry),
			() => this.clearInFlightGeneration(generationKey, inFlightEntry),
		)

		return this.waitForGeneration(scheduledGeneration.promise, requestEpoch)
	}

	/** 缓存读取和原渲染任务共用一个可取消句柄；命中不占用 iframe 截图槽。 */
	private createScreenshotRequest(options: {
		url: string
		content: string
		contentHash: string
		dimensions: CanonicalContentDimensions
		requestEpoch: number
		requestId: number
		requestKind: SlideScreenshotRequestKind
		persistentKey?: PPTThumbnailCacheKey
		cacheMode: PPTThumbnailCacheMode
	}): InFlightScreenshotGeneration {
		const { url, content, contentHash, dimensions, requestEpoch, persistentKey } = options
		const controller = new AbortController()
		let renderTask: ScheduledScreenshotGeneration<string> | undefined
		const shouldCommit = () =>
			!controller.signal.aborted &&
			!this.disposed &&
			this.generationEpoch === requestEpoch &&
			this.latestRequestsByUrl.get(url)?.requestId === entry.requestId
		const accept = (thumbnailUrl: string) => {
			this.throwIfAborted(controller.signal)
			this.throwIfGenerationCancelled(requestEpoch)
			// Different revisions of the same slide may overlap. Only the most recently
			// requested revision should become the URL-level cache entry.
			if (shouldCommit()) {
				this.setCachedScreenshot(url, {
					thumbnailUrl,
					content,
					contentHash,
					dimensions,
					timestamp: Date.now(),
					persistentKey: persistentKey?.key,
				})
			}
			return thumbnailUrl
		}
		const run = async () => {
			this.throwIfAborted(controller.signal)
			if (persistentKey) {
				if (options.cacheMode === "refresh") {
					await this.waitForAbortableOperation(
						deletePPTThumbnail(persistentKey.key),
						controller.signal,
					)
				} else {
					// 沿用 Repository 的故障超时；正常读取排队不应提前触发昂贵的重复截图。
					const blob = await this.waitForAbortableOperation(
						pptThumbnailCacheRepository.getThumbnail(persistentKey.key),
						controller.signal,
					)
					this.throwIfAborted(controller.signal)
					this.throwIfGenerationCancelled(requestEpoch)
					if (blob) return accept(URL.createObjectURL(blob))
				}
			}
			this.throwIfAborted(controller.signal)
			renderTask = screenshotGenerationScheduler.schedule(async (signal, holdSlotUntil) => {
				let persistable = false
				const generation = this.doGenerateScreenshot(
					content,
					dimensions,
					signal,
					holdSlotUntil,
					...(persistentKey
						? ([
								(ready: boolean) => {
									persistable = ready
								},
							] as const)
						: []),
				)
				holdSlotUntil(generation)
				const thumbnailUrl = await this.waitForAbortableOperation(
					generation,
					signal,
					(lateUrl) => this.releaseScreenshot(lateUrl),
				)
				try {
					accept(thumbnailUrl)
				} catch (error) {
					this.releaseScreenshot(thumbnailUrl)
					throw error
				}
				if (persistentKey && persistable && shouldCommit()) {
					void savePPTThumbnail(persistentKey, thumbnailUrl, shouldCommit)
				}
				return thumbnailUrl
			})
			return renderTask.promise
		}
		// 下一微任务才开始读取，使共享请求先登记，取消与 required 升级能覆盖读库阶段。
		const entry: InFlightScreenshotGeneration = {
			url,
			content,
			contentHash,
			dimensions,
			requestId: options.requestId,
			persistentKey: persistentKey?.key,
			epoch: requestEpoch,
			hasRequiredConsumer: options.requestKind === "required",
			scheduledGeneration: {
				promise: Promise.resolve().then(run),
				hasStarted: () => renderTask?.hasStarted() ?? false,
				cancel: (reason) => {
					if (controller.signal.aborted) return false
					controller.abort(reason)
					renderTask?.cancel(reason)
					return true
				},
			},
		}
		return entry
	}

	/**
	 * Cancel only automatic sidebar screenshots when fullscreen takes over. Required work such as
	 * editor saves or manual refreshes remains protected, and existing cached thumbnails stay valid.
	 */
	cancelPreviewGenerations(): void {
		if (this.disposed) return
		this.previewGenerationEpoch += 1
		const cancellationError = new ScreenshotGenerationCancelledError()
		const queuedGenerations: Array<{
			key: string
			entry: InFlightScreenshotGeneration
		}> = []
		const activeGenerations: Array<{
			key: string
			entry: InFlightScreenshotGeneration
		}> = []

		this.inFlightGenerations.forEach((generationBucket, key) => {
			generationBucket.forEach((entry) => {
				const latestRequest = this.latestRequestsByUrl.get(entry.url)
				if (
					latestRequest?.requestKind === "required" &&
					latestRequest.content === entry.content
				) {
					entry.hasRequiredConsumer = true
				}
				if (entry.hasRequiredConsumer) return

				const target = entry.scheduledGeneration.hasStarted()
					? activeGenerations
					: queuedGenerations
				target.push({ key, entry })
			})
		})

		const cancelGeneration = ({ key, entry }: (typeof queuedGenerations)[number]) => {
			entry.scheduledGeneration.cancel(cancellationError)
			// Remove synchronously so a required request cannot reuse the rejected promise.
			this.clearInFlightGeneration(key, entry)
		}
		// Remove queued work first so an active generation that happens to finish during
		// cancellation cannot start another preview from this service.
		queuedGenerations.forEach(cancelGeneration)
		activeGenerations.forEach(cancelGeneration)

		this.latestRequestsByUrl.forEach((request, url) => {
			if (request.requestKind === "preview") this.latestRequestsByUrl.delete(url)
		})
	}

	private yieldForPreparation(): Promise<void> {
		return new Promise((resolve) => {
			if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
				window.requestIdleCallback(() => resolve(), {
					timeout: SCREENSHOT_PREPARATION_IDLE_TIMEOUT,
				})
				return
			}

			setTimeout(resolve, 0)
		})
	}

	private throwIfGenerationCancelled(epoch: number): void {
		if (this.generationEpoch !== epoch) {
			throw new ScreenshotGenerationCancelledError()
		}
	}

	private getAbortReason(signal: AbortSignal): unknown {
		return signal.reason ?? new ScreenshotGenerationCancelledError()
	}

	private throwIfAborted(signal: AbortSignal): void {
		if (signal.aborted) throw this.getAbortReason(signal)
	}

	/**
	 * Races non-abortable browser/third-party work against the task signal. The
	 * underlying promise is still observed so a late Blob URL can be reclaimed.
	 * The scheduler separately retains the physical slot for registered work until
	 * the original operation settles.
	 */
	private waitForAbortableOperation<T>(
		operation: Promise<T>,
		signal: AbortSignal,
		onLateResolve?: (value: T) => void,
	): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			let settled = false
			const removeAbortListener = () => signal.removeEventListener("abort", handleAbort)
			const handleAbort = () => {
				if (settled) return
				settled = true
				removeAbortListener()
				reject(this.getAbortReason(signal))
			}

			if (signal.aborted) {
				handleAbort()
			} else {
				signal.addEventListener("abort", handleAbort, { once: true })
			}

			void operation.then(
				(value) => {
					if (settled) {
						try {
							onLateResolve?.(value)
						} catch {
							// Cleanup failures must not create an unhandled rejection.
						}
						return
					}
					settled = true
					removeAbortListener()
					resolve(value)
				},
				(error) => {
					if (settled) return
					settled = true
					removeAbortListener()
					reject(error)
				},
			)
		})
	}

	private waitForAbortableDelay(delayMs: number, signal: AbortSignal): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (signal.aborted) {
				reject(this.getAbortReason(signal))
				return
			}

			const handleAbort = () => {
				clearTimeout(timeout)
				signal.removeEventListener("abort", handleAbort)
				reject(this.getAbortReason(signal))
			}
			const timeout = setTimeout(() => {
				signal.removeEventListener("abort", handleAbort)
				resolve()
			}, delayMs)
			signal.addEventListener("abort", handleAbort, { once: true })
		})
	}

	private createSnapdomAbortPlugin(signal: AbortSignal): SnapdomPlugin {
		const throwIfAborted = () => this.throwIfAborted(signal)
		return {
			name: "magic-screenshot-abort",
			beforeSnap: throwIfAborted,
			beforeClone: throwIfAborted,
			afterClone: throwIfAborted,
			beforeRender: throwIfAborted,
			afterRender: throwIfAborted,
			beforeExport: throwIfAborted,
		}
	}

	private async waitForGeneration(generation: Promise<string>, epoch: number): Promise<string> {
		try {
			const thumbnailUrl = await generation
			if (this.generationEpoch !== epoch) {
				this.releaseScreenshot(thumbnailUrl)
				throw new ScreenshotGenerationCancelledError()
			}
			return thumbnailUrl
		} catch (error) {
			this.throwIfGenerationCancelled(epoch)
			throw error
		}
	}

	private matchesPreparedContent(
		candidate: Pick<ScreenshotCacheEntry, "content" | "contentHash" | "dimensions">,
		content: string,
		contentHash: string,
		dimensions: CanonicalContentDimensions,
	): boolean {
		return (
			candidate.contentHash === contentHash &&
			candidate.dimensions.width === dimensions.width &&
			candidate.dimensions.height === dimensions.height &&
			candidate.content === content
		)
	}

	private isLatestRequestedContent(
		url: string,
		content: string,
		contentHash: string,
		dimensions: CanonicalContentDimensions,
	): boolean {
		const latestRequest = this.latestRequestsByUrl.get(url)
		if (!latestRequest) return false
		if (latestRequest.content !== content) return false
		if (latestRequest.contentHash && latestRequest.contentHash !== contentHash) return false
		if (
			latestRequest.dimensions &&
			(latestRequest.dimensions.width !== dimensions.width ||
				latestRequest.dimensions.height !== dimensions.height)
		) {
			return false
		}
		return true
	}

	private setCachedScreenshot(url: string, entry: ScreenshotCacheEntry): void {
		const previousEntry = this.cache.get(url)
		if (previousEntry && previousEntry.thumbnailUrl !== entry.thumbnailUrl) {
			this.revokeThumbnailUrl(previousEntry.thumbnailUrl)
		}
		this.cache.set(url, entry)
	}

	private clearInFlightGeneration(key: string, generation: InFlightScreenshotGeneration): void {
		const generationBucket = this.inFlightGenerations.get(key)
		if (!generationBucket) return
		const generationIndex = generationBucket.indexOf(generation)
		if (generationIndex >= 0) generationBucket.splice(generationIndex, 1)
		if (generationBucket.length === 0) this.inFlightGenerations.delete(key)
	}

	/**
	 * Perform actual screenshot generation
	 */
	private async doGenerateScreenshot(
		content: string,
		{ width, height }: CanonicalContentDimensions,
		signal: AbortSignal,
		holdSlotUntil: HoldScreenshotGenerationSlot,
		onCacheable?: (cacheable: boolean) => void,
	): Promise<string> {
		this.throwIfAborted(signal)
		// 创建临时容器用于渲染
		const container = document.createElement("div")
		container.style.cssText = `
			position: fixed;
			top: -9999px;
			left: -9999px;
				width: ${width}px;
				height: ${height}px;
			visibility: hidden;
			pointer-events: none;
			z-index: -1;
		`
		document.body.appendChild(container)

		let iframe: HTMLIFrameElement | null = null
		let thumbnailUrl: { src: string } | null = null
		let resourcesCleaned = false
		const cleanupResources = () => {
			if (resourcesCleaned) return
			resourcesCleaned = true
			this.cleanupScreenshotResources(iframe, container)
		}
		// Abort removes the iframe synchronously, even if snapDOM itself is still
		// resolving a non-abortable export promise in the background.
		signal.addEventListener("abort", cleanupResources, { once: true })

		try {
			// 创建 iframe 用于隔离渲染
			iframe = document.createElement("iframe")
			iframe.style.cssText = "width: 100%; height: 100%; border: none;"
			// 禁用所有可能导致媒体播放的权限
			iframe.setAttribute("sandbox", "allow-scripts allow-same-origin")
			iframe.setAttribute("allow", "")
			container.appendChild(iframe)

			await this.setupScreenshotIframe({ iframe, content, signal })
			this.throwIfAborted(signal)

			// 使用 snapDOM 截图
			const iframeDoc = iframe.contentDocument
			if (!iframeDoc) {
				throw new Error("Iframe document not found")
			}

			const screenshotTarget = this.getScreenshotTarget(iframeDoc)
			if (!screenshotTarget) {
				throw new Error("Iframe screenshot target not found")
			}

			const renderingReady = await this.waitForRenderingReady(iframeDoc, signal)
			await prepareScreenshotAnimations(iframeDoc, screenshotTarget, signal, (delay, abort) =>
				this.waitForAbortableDelay(delay, abort),
			)

			const restoreTextStyles = stabilizeSingleLineTextForSnapdom(screenshotTarget)
			let restoreImageSources: () => void = () => undefined
			try {
				let usedFallbackImage = false
				const captureWithSnapdom = async (onFallback: () => void) => {
					const snapdomGeneration = snapdom(screenshotTarget, {
						width,
						height,
						backgroundColor: "#ffffff",
						embedFonts: true,
						fallbackURL: () => {
							onFallback()
							return fallbackImageBase64
						},
						plugins: [this.createSnapdomAbortPlugin(signal)],
					})
					holdSlotUntil(snapdomGeneration)
					return this.waitForAbortableOperation(snapdomGeneration, signal)
				}

				let result = await captureWithSnapdom(() => {
					usedFallbackImage = true
				})

				if (usedFallbackImage && this.hasCrossOriginImagesForSnapdom(screenshotTarget)) {
					const inlineResult = await this.inlineCrossOriginImagesForSnapdom(
						screenshotTarget,
						signal,
					)
					restoreImageSources = inlineResult.restore
					if (inlineResult.inlinedCount > 0) {
						usedFallbackImage = false
						result = await captureWithSnapdom(() => {
							usedFallbackImage = true
						})
					}
				}

				this.throwIfAborted(signal)

				// A resource-budget fallback can render, but must not persist a snapshot
				// taken before late styles/scripts have finished loading.
				onCacheable?.(
					renderingReady && iframeDoc.readyState === "complete" && !usedFallbackImage,
				)

				const webpGeneration = result.toWebp({
					width: width / THUMBNAIL_SCALE,
					height: height / THUMBNAIL_SCALE,
					quality: THUMBNAIL_QUALITY,
				})
				holdSlotUntil(webpGeneration)
				thumbnailUrl = await this.waitForAbortableOperation(
					webpGeneration,
					signal,
					(lateThumbnail) => {
						this.releaseScreenshot(lateThumbnail.src)
						lateThumbnail.src = ""
					},
				)
			} finally {
				restoreTextStyles()
				restoreImageSources()
			}
			if (!thumbnailUrl) {
				throw new Error("Screenshot generation failed")
			}

			// 延迟清理以确保 blob 已完全处理并与 iframe 上下文分离
			// 使用 Promise 而不是 setTimeout，确保清理逻辑可控
			await this.waitForAbortableDelay(100, signal)
			cleanupResources()

			return thumbnailUrl.src
		} catch (error) {
			if (thumbnailUrl) {
				const discardedThumbnailSrc = thumbnailUrl.src
				thumbnailUrl.src = ""
				this.releaseScreenshot(discardedThumbnailSrc)
			}
			// 出错时立即清理
			cleanupResources()
			throw error
		} finally {
			signal.removeEventListener("abort", cleanupResources)
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
		signal,
	}: {
		iframe: HTMLIFrameElement
		content: string
		signal: AbortSignal
	}): Promise<void> {
		const IFRAME_LOAD_TIMEOUT = 10000
		const IFRAME_RESOURCE_WAIT_BUDGET = 2000

		// 用于清理所有监听器和定时器
		const cleanupFunctions: Array<() => void> = []

		try {
			// 直接初始化 iframe 内容（截图场景不需要 messenger 模式）
			await this.waitForAbortableOperation(
				new Promise<void>((resolve, reject) => {
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
					<style data-screenshot-animation-fill>
					*,*::before,*::after{animation-fill-mode:both!important}
					</style>
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
					// head 可带属性，公共脚本也可能包含 "<head>" 字符串；只操作真实节点，避免截断脚本并泄漏源码。
					const screenshotDoc = new DOMParser().parseFromString(fullContent, "text/html")
					screenshotDoc.head.insertAdjacentHTML("afterbegin", earlyPauseScript)
					const doctype = screenshotDoc.doctype
						? new XMLSerializer().serializeToString(screenshotDoc.doctype)
						: ""
					fullContent = doctype + screenshotDoc.documentElement.outerHTML

					iframe.contentDocument.open()
					iframe.contentDocument.write(fullContent)
					iframe.contentDocument.close()

					// Wait for load, not DOMContentLoaded: slides often start their scripted
					// entrances in window.onload after external scripts/styles finish.
					const doc = iframe.contentDocument
					let completionScheduled = false
					const checkComplete = () => {
						if (doc.readyState !== "complete" || completionScheduled) return
						completionScheduled = true
						// A task boundary lets the document's load handlers run before capture,
						// including engines that omit the parent iframe's load notification.
						const completionTimer = setTimeout(handleResolve, 0)
						cleanupFunctions.push(() => clearTimeout(completionTimer))
					}
					doc.addEventListener("readystatechange", checkComplete)
					cleanupFunctions.push(() =>
						doc.removeEventListener("readystatechange", checkComplete),
					)
					checkComplete()

					// External fonts/images can keep load (and parser-blocked scripts)
					// pending indefinitely. Keep the existing best-effort body fallback;
					// resource checks and animation sampling still run before snapDOM.
					const resourceWaitTimer = setTimeout(() => {
						if (
							doc.body &&
							(doc.body.childElementCount > 0 || doc.body.textContent?.trim())
						) {
							handleResolve()
						}
					}, IFRAME_RESOURCE_WAIT_BUDGET)
					cleanupFunctions.push(() => clearTimeout(resourceWaitTimer))
				}),
				signal,
			)

			// 等待内容加载后注入暂停脚本
			await this.injectPauseScript(iframe, signal)

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
	 * Keep media playback disabled while preparing the screenshot
	 */
	private async injectPauseScript(iframe: HTMLIFrameElement, signal: AbortSignal): Promise<void> {
		const win = iframe.contentWindow
		const doc = iframe.contentDocument

		if (!win || !doc) return

		// 等待 head 元素就绪
		let observer: MutationObserver | null = null
		let headTimeout: ReturnType<typeof setTimeout> | undefined
		try {
			await this.waitForAbortableOperation(
				new Promise<void>((resolve) => {
					if (doc.head) {
						resolve()
						return
					}

					observer = new MutationObserver(() => {
						if (doc.head) resolve()
					})

					observer.observe(doc.documentElement, {
						childList: true,
						subtree: true,
					})

					// 超时保护
					headTimeout = setTimeout(resolve, 1000)
				}),
				signal,
			)
		} finally {
			observer?.disconnect()
			if (headTimeout !== undefined) clearTimeout(headTimeout)
		}
		this.throwIfAborted(signal)

		try {
			const pauseScript = doc.createElement("script")
			pauseScript.textContent = `
				(function() {
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

	private getScreenshotTarget(doc: Document): HTMLElement | null {
		const slideContainer = doc.querySelector<HTMLElement>(".slide-container")
		const ftCanvas = doc.querySelector<HTMLElement>("main.ft-canvas")
		const slide = doc.querySelector<HTMLElement>("main.slide")
		return slideContainer || ftCanvas || slide || doc.body
	}

	/**
	 * A regular img request can populate Chromium's cache with a no-CORS response.
	 * A later CORS fetch from snapDOM may then reuse that entry and fail even though
	 * OSS returns the correct CORS headers for a fresh request. Refresh the resource
	 * cache and inline the result before snapDOM reads the image pixels.
	 */
	private async inlineCrossOriginImagesForSnapdom(
		target: HTMLElement,
		signal: AbortSignal,
	): Promise<InlineCrossOriginImagesResult> {
		const restorations: Array<() => void> = []
		const entries = Array.from(this.collectCrossOriginImagesByUrl(target).entries())
		let isRestored = false
		const restore = () => {
			if (isRestored) return
			isRestored = true
			for (let index = restorations.length - 1; index >= 0; index -= 1) {
				restorations[index]()
			}
		}

		try {
			for (
				let index = 0;
				index < entries.length;
				index += MAX_CONCURRENT_IMAGE_CACHE_REFRESHES
			) {
				this.throwIfAborted(signal)
				const batch = entries.slice(index, index + MAX_CONCURRENT_IMAGE_CACHE_REFRESHES)
				await Promise.all(
					batch.map(([sourceUrl, images]) =>
						this.refreshAndInlineImageGroup(sourceUrl, images, signal, restorations),
					),
				)
			}
			return {
				restore,
				inlinedCount: restorations.length,
			}
		} catch (error) {
			restore()
			throw error
		}
	}

	private collectCrossOriginImagesByUrl(target: HTMLElement): Map<string, HTMLImageElement[]> {
		const imagesByUrl = new Map<string, HTMLImageElement[]>()
		for (const image of Array.from(target.querySelectorAll<HTMLImageElement>("img[src]"))) {
			const sourceUrl = image.currentSrc || image.src
			if (!this.isCrossOriginHttpUrl(sourceUrl)) continue
			const images = imagesByUrl.get(sourceUrl) ?? []
			images.push(image)
			imagesByUrl.set(sourceUrl, images)
		}
		return imagesByUrl
	}

	private hasCrossOriginImagesForSnapdom(target: HTMLElement): boolean {
		return this.collectCrossOriginImagesByUrl(target).size > 0
	}

	private async refreshAndInlineImageGroup(
		sourceUrl: string,
		images: HTMLImageElement[],
		signal: AbortSignal,
		restorations: Array<() => void>,
	): Promise<void> {
		try {
			const response = await fetch(sourceUrl, {
				cache: "reload",
				credentials: "omit",
				mode: "cors",
				signal,
			})
			if (!response.ok) return

			const blob = await response.blob()
			const mimeType = blob.type.toLowerCase()
			if (mimeType && !mimeType.startsWith("image/")) return

			const dataUrl = await this.readBlobAsDataUrl(blob, signal)
			if (!dataUrl.startsWith("data:")) return

			await Promise.all(
				images.map((image) =>
					this.replaceImageSourceForSnapdom(image, dataUrl, signal, restorations),
				),
			)
		} catch {
			this.throwIfAborted(signal)
			// Keep the original source so snapDOM's existing fallback behavior remains intact.
		}
	}

	private async replaceImageSourceForSnapdom(
		image: HTMLImageElement,
		dataUrl: string,
		signal: AbortSignal,
		restorations: Array<() => void>,
	): Promise<void> {
		const originalSrc = image.getAttribute("src")
		const originalSrcset = image.getAttribute("srcset")
		const originalSizes = image.getAttribute("sizes")
		const pictureSources = Array.from(
			image.parentElement?.tagName === "PICTURE"
				? image.parentElement.querySelectorAll<HTMLSourceElement>("source")
				: [],
		).map((source) => ({
			source,
			srcset: source.getAttribute("srcset"),
			sizes: source.getAttribute("sizes"),
		}))

		image.removeAttribute("srcset")
		image.removeAttribute("sizes")
		pictureSources.forEach(({ source }) => {
			source.removeAttribute("srcset")
			source.removeAttribute("sizes")
		})
		image.src = dataUrl

		const restore = () => {
			this.restoreAttribute(image, "src", originalSrc)
			this.restoreAttribute(image, "srcset", originalSrcset)
			this.restoreAttribute(image, "sizes", originalSizes)
			pictureSources.forEach(({ source, srcset, sizes }) => {
				this.restoreAttribute(source, "srcset", srcset)
				this.restoreAttribute(source, "sizes", sizes)
			})
		}
		restorations.push(restore)

		if (typeof image.decode === "function") {
			await this.waitForAbortableOperation(
				image.decode().catch(() => undefined),
				signal,
			)
		}
	}

	private isCrossOriginHttpUrl(sourceUrl: string): boolean {
		try {
			const url = new URL(sourceUrl, window.location.href)
			return (
				(url.protocol === "http:" || url.protocol === "https:") &&
				url.origin !== window.location.origin
			)
		} catch {
			return false
		}
	}

	private readBlobAsDataUrl(blob: Blob, signal: AbortSignal): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			let settled = false
			let abortedBySignal = false
			const cleanup = () => signal.removeEventListener("abort", handleAbort)
			const settle = (callback: () => void) => {
				if (settled) return
				settled = true
				cleanup()
				callback()
			}
			const handleAbort = () => {
				abortedBySignal = true
				try {
					reader.abort()
				} catch {
					// Ignore abort calls when the FileReader has already completed.
				}
				settle(() => reject(this.getAbortReason(signal)))
			}

			if (signal.aborted) {
				handleAbort()
				return
			}

			signal.addEventListener("abort", handleAbort, { once: true })
			reader.onload = () => settle(() => resolve(String(reader.result ?? "")))
			reader.onerror = () =>
				settle(() => reject(reader.error ?? new Error("Failed to read image blob")))
			reader.onabort = () => {
				if (abortedBySignal) return
				settle(() => reject(new Error("Image blob read was aborted")))
			}

			try {
				reader.readAsDataURL(blob)
			} catch (error) {
				settle(() => reject(error))
			}
		})
	}

	private restoreAttribute(element: Element, name: string, value: string | null): void {
		if (value === null) {
			element.removeAttribute(name)
			return
		}
		element.setAttribute(name, value)
	}

	private async waitForRenderingReady(doc: Document, signal: AbortSignal): Promise<boolean> {
		const readiness = await Promise.all([
			this.waitForFonts(doc, signal),
			this.waitForImages(doc, signal),
		])
		await this.waitForAnimationFrames(doc, 2, signal)
		return readiness.every(Boolean)
	}

	private async waitForFonts(doc: Document, signal: AbortSignal): Promise<boolean> {
		const fonts = doc.fonts
		if (!fonts?.ready) return false

		let timeout: ReturnType<typeof setTimeout> | undefined
		try {
			return await this.waitForAbortableOperation(
				Promise.race([
					fonts.ready.then(
						() => true,
						() => false,
					),
					new Promise<boolean>((resolve) => {
						timeout = setTimeout(() => resolve(false), 3000)
					}),
				]),
				signal,
			)
		} finally {
			if (timeout !== undefined) clearTimeout(timeout)
		}
	}

	private async waitForAnimationFrames(
		doc: Document,
		frameCount: number,
		signal: AbortSignal,
	): Promise<void> {
		const win = doc.defaultView
		for (let i = 0; i < frameCount; i += 1) {
			if (!win?.requestAnimationFrame) {
				await this.waitForAbortableDelay(16, signal)
				continue
			}

			let frameId: number | undefined
			try {
				await this.waitForAbortableOperation(
					new Promise<void>((resolve) => {
						frameId = win.requestAnimationFrame(() => resolve())
					}),
					signal,
				)
			} finally {
				if (frameId !== undefined) win.cancelAnimationFrame(frameId)
			}
		}
	}

	private async waitForImages(doc: Document, signal: AbortSignal): Promise<boolean> {
		const MAX_ATTEMPTS = 3
		const BASE_TIMEOUT = 400
		const BACKOFF_DELAYS = [100, 150]

		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
			this.throwIfAborted(signal)
			const images = Array.from(doc.images)
			if (images.length === 0) return true

			images.forEach((img) => {
				if (img.loading === "lazy") img.loading = "eager"
			})

			const pendingImages = images.filter(
				(img) => img.naturalWidth === 0 || img.naturalHeight === 0,
			)

			if (pendingImages.length === 0) return true

			await this.waitForImagesOnce(pendingImages, BASE_TIMEOUT + attempt * 150, signal)

			const remainingImages = Array.from(doc.images).filter(
				(img) => img.naturalWidth === 0 || img.naturalHeight === 0,
			)

			if (remainingImages.length === 0) return true

			const backoffDelay = BACKOFF_DELAYS[attempt]
			if (backoffDelay) {
				await this.waitForAbortableDelay(backoffDelay, signal)
			}
		}
		return false
	}

	private async waitForImagesOnce(
		pendingImages: HTMLImageElement[],
		timeoutMs: number,
		signal: AbortSignal,
	): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			if (signal.aborted) {
				reject(this.getAbortReason(signal))
				return
			}

			let remaining = pendingImages.length
			let finished = false

			const finalize = (error?: unknown) => {
				if (finished) return
				finished = true
				pendingImages.forEach((img) => {
					img.removeEventListener("load", handleDone)
					img.removeEventListener("error", handleError)
				})
				clearTimeout(timeout)
				signal.removeEventListener("abort", handleAbort)
				if (error) {
					reject(error)
				} else {
					resolve()
				}
			}

			const handleDone = () => {
				remaining -= 1
				if (remaining <= 0) finalize()
			}

			const handleError = () => {
				remaining -= 1
				if (remaining <= 0) finalize()
			}

			const handleAbort = () => finalize(this.getAbortReason(signal))
			const timeout = setTimeout(() => {
				finalize()
			}, timeoutMs)

			signal.addEventListener("abort", handleAbort, { once: true })
			pendingImages.forEach((img) => {
				img.addEventListener("load", handleDone, { once: true })
				img.addEventListener("error", handleError, { once: true })
			})
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
			const dimensions = resolvePptScaleContentDimensions(content)
			const contentHash = this.getContentHash(content, dimensions)
			return this.matchesPreparedContent(cached, content, contentHash, dimensions)
		}

		return true
	}

	/**
	 * Release a generated thumbnail that no consumer accepted. Cached thumbnails
	 * remain owned by this service and are released through the cache lifecycle.
	 */
	releaseScreenshot(thumbnailUrl: string): void {
		const isCached = Array.from(this.cache.values()).some(
			(entry) => entry.thumbnailUrl === thumbnailUrl,
		)
		if (!isCached) this.revokeThumbnailUrl(thumbnailUrl)
	}

	private revokeThumbnailUrl(thumbnailUrl: string): void {
		if (thumbnailUrl.startsWith("blob:")) {
			URL.revokeObjectURL(thumbnailUrl)
		}
	}

	/**
	 * Clear cache for specific URL
	 */
	clearCache(url: string): void {
		const cached = this.cache.get(url)
		if (cached) {
			this.revokeThumbnailUrl(cached.thumbnailUrl)
			this.cache.delete(url)
		}
		this.latestRequestsByUrl.delete(url)
	}

	/**
	 * Clear all cached screenshots
	 */
	clearAllCache(): void {
		this.cache.forEach((entry) => {
			this.revokeThumbnailUrl(entry.thumbnailUrl)
		})
		this.cache.clear()
		this.latestRequestsByUrl.clear()
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
				this.revokeThumbnailUrl(entry.thumbnailUrl)
				if (
					this.isLatestRequestedContent(
						url,
						entry.content,
						entry.contentHash,
						entry.dimensions,
					)
				) {
					this.latestRequestsByUrl.delete(url)
				}
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
	 * Cancel this deck's queued and active work, then release all cached Blob URLs.
	 * Unlike dispose, reset keeps the service available for the next deck in the same Store.
	 */
	reset(): void {
		if (this.disposed) return
		this.releaseAllResources()
	}

	/** Permanently cleanup all resources owned by this service instance. */
	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		this.releaseAllResources()
	}

	private releaseAllResources(): void {
		this.generationEpoch += 1
		this.previewGenerationEpoch += 1
		const cancellationError = new ScreenshotGenerationCancelledError()
		const queuedGenerations: ScheduledScreenshotGeneration<string>[] = []
		const activeGenerations: ScheduledScreenshotGeneration<string>[] = []
		this.inFlightGenerations.forEach((generationBucket) => {
			generationBucket.forEach((generation) => {
				const target = generation.scheduledGeneration.hasStarted()
					? activeGenerations
					: queuedGenerations
				target.push(generation.scheduledGeneration)
			})
		})
		// Remove this service's queued work first so an active generation that happens
		// to finish during cleanup cannot start work that this same pass is cancelling.
		queuedGenerations.forEach((generation) => generation.cancel(cancellationError))
		activeGenerations.forEach((generation) => generation.cancel(cancellationError))
		this.clearAllCache()
		this.inFlightGenerations.clear()
		this.latestRequestsByUrl.clear()
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
