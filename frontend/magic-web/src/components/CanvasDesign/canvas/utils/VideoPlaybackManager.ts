import type { Canvas } from "../Canvas"
import { isOssExpired } from "./ossExpiryUtils"
import { resolveCanonicalResourcePath } from "./pathUtils"

/** 播放会话归属（由 consumerId 前缀推断） */
export type VideoPlaybackOwnerKind = "inline" | "fullscreen" | "unknown"

/** 单个 consumer 持有的 HTMLVideoElement 会话 */
export interface VideoPlaybackSession {
	consumerId: string
	/** 项目内资源 path，用于换链与分组 */
	path: string
	video: HTMLVideoElement
	createdAt: number
	lastActiveAt: number
	ownerKind: VideoPlaybackOwnerKind
	/** 是否处于「应出声/占线」活跃态（与 paused 等综合判断） */
	isActive: boolean
}

export interface VideoPlaybackConsumerState {
	isRefreshing: boolean
}

type VideoPlaybackIssueReason = "timer" | "waiting" | "error" | "acquire"
type VideoPlaybackConsumerStateListener = (state: VideoPlaybackConsumerState) => void

/** 同一 path 上所有会话的只读快照，便于调试与策略判断 */
export interface PathPlaybackGroupSnapshot {
	path: string
	consumerIds: string[]
	activeConsumerIds: string[]
	consumerCount: number
	activeConsumerCount: number
	lastResolvedOssSrc: string | null
	lastWarmupAt: number | null
}

interface AcquirePlaybackOptions {
	autoPlay?: boolean
	currentTime?: number
	muted?: boolean
	playbackRate?: number
	volume?: number
}

interface PathPlaybackGroup {
	path: string
	consumers: Map<string, VideoPlaybackSession>
	activeConsumerIds: Set<string>
	lastResolvedOssSrc: string | null
	lastWarmupAt: number | null
}

interface InternalVideoPlaybackSession extends VideoPlaybackSession {
	disposeBindings?: () => void
	resolvedOssSrc: string
	expiresAt: number | null
	isRefreshing: boolean
	refreshTimer: ReturnType<typeof setTimeout> | null
	refreshPromise: Promise<boolean> | null
}

/**
 * 同一视频 path 可对应多个 consumer（内联 + 全屏）；负责换链、复用 video 标签与 handoff
 */
export class VideoPlaybackManager {
	private canvas: Canvas
	private sessionsByConsumer = new Map<string, InternalVideoPlaybackSession>()
	private groupsByPath = new Map<string, PathPlaybackGroup>()
	private stateListenersByConsumer = new Map<string, Set<VideoPlaybackConsumerStateListener>>()

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	private getResolveAbsolutePath(): ((path: string) => string) | undefined {
		return this.canvas.magicConfigManager.config?.methods?.resolveAbsolutePath
	}

	public getSession(consumerId: string): VideoPlaybackSession | undefined {
		return this.sessionsByConsumer.get(consumerId)
	}

	public getVideoElement(consumerId: string): HTMLVideoElement | undefined {
		return this.sessionsByConsumer.get(consumerId)?.video
	}

	public getConsumerState(consumerId: string): VideoPlaybackConsumerState {
		return {
			isRefreshing: this.sessionsByConsumer.get(consumerId)?.isRefreshing ?? false,
		}
	}

	public subscribeConsumerState(
		consumerId: string,
		listener: VideoPlaybackConsumerStateListener,
	): () => void {
		let listeners = this.stateListenersByConsumer.get(consumerId)
		if (!listeners) {
			listeners = new Set()
			this.stateListenersByConsumer.set(consumerId, listeners)
		}
		listeners.add(listener)
		listener(this.getConsumerState(consumerId))

		return () => {
			const current = this.stateListenersByConsumer.get(consumerId)
			if (!current) {
				return
			}
			current.delete(listener)
			if (current.size === 0) {
				this.stateListenersByConsumer.delete(consumerId)
			}
		}
	}

	public getGroup(path: string): PathPlaybackGroupSnapshot | undefined {
		const key = resolveCanonicalResourcePath(path, this.getResolveAbsolutePath())
		const group = this.groupsByPath.get(key)
		return group ? this.buildGroupSnapshot(group) : undefined
	}

	public getConsumersByPath(path: string): VideoPlaybackSession[] {
		const key = resolveCanonicalResourcePath(path, this.getResolveAbsolutePath())
		const group = this.groupsByPath.get(key)
		return group ? Array.from(group.consumers.values()) : []
	}

	public getActiveConsumerCount(path: string): number {
		const key = resolveCanonicalResourcePath(path, this.getResolveAbsolutePath())
		return this.groupsByPath.get(key)?.activeConsumerIds.size ?? 0
	}

	public async acquire(
		path: string,
		consumerId: string,
		options?: AcquirePlaybackOptions,
	): Promise<VideoPlaybackSession | null> {
		const normalizedPath = resolveCanonicalResourcePath(path, this.getResolveAbsolutePath())
		const existing = this.sessionsByConsumer.get(consumerId)
		if (existing && existing.path === normalizedPath) {
			existing.ownerKind = this.inferOwnerKind(consumerId)
			existing.lastActiveAt = Date.now()
			if (existing.refreshPromise) {
				await existing.refreshPromise.catch(() => false)
			} else if (this.isSessionRefreshDue(existing)) {
				await this.refreshSessionPlayback(existing, "acquire").catch(() => false)
			}
			this.applyPlaybackOptions(existing.video, options)
			this.syncSessionActiveState(existing, !existing.video.paused && !existing.video.ended)
			if (options?.autoPlay) {
				await existing.video.play().catch(() => undefined)
			}
			return existing
		}

		if (existing) {
			this.release(consumerId)
		}

		let ossInfo = await this.canvas.videoResourceManager.ensureFreshOssInfo(path)
		if (!ossInfo) {
			return null
		}

		const video = document.createElement("video")
		video.crossOrigin = "anonymous"
		video.preload = "auto"
		video.playsInline = true
		video.src = ossInfo.ossSrc
		this.applyPlaybackOptions(video, options)

		let isReady = await this.waitUntilReady(video, options?.currentTime)
		if (!isReady && this.isCanvasVirtualResourceUrl(ossInfo.ossSrc)) {
			const fallbackOssInfo =
				await this.canvas.videoResourceManager.resolveVirtualPlaybackFallbackOssInfo(
					path,
					ossInfo.ossSrc,
				)
			if (fallbackOssInfo) {
				ossInfo = fallbackOssInfo
				video.src = ossInfo.ossSrc
				isReady = await this.waitUntilReady(video, options?.currentTime)
			}
		}
		if (!isReady) {
			this.disposeVideo(video)
			return null
		}

		const group = this.getOrCreateGroup(normalizedPath)
		group.lastResolvedOssSrc = ossInfo.ossSrc
		group.lastWarmupAt = Date.now()
		await this.cachePlaybackResource(normalizedPath, ossInfo.ossSrc, ossInfo.expiresAt)

		const now = Date.now()
		const session: InternalVideoPlaybackSession = {
			consumerId,
			path: normalizedPath,
			video,
			createdAt: now,
			lastActiveAt: now,
			ownerKind: this.inferOwnerKind(consumerId),
			isActive: !video.paused && !video.ended,
			resolvedOssSrc: ossInfo.ossSrc,
			expiresAt: ossInfo.expiresAt,
			isRefreshing: false,
			refreshTimer: null,
			refreshPromise: null,
		}
		session.disposeBindings = this.bindSessionActivity(session)
		this.sessionsByConsumer.set(consumerId, session)
		group.consumers.set(consumerId, session)
		this.syncSessionActiveState(session, session.isActive)
		this.scheduleSessionRefresh(session)

		if (options?.autoPlay) {
			await video.play().catch(() => undefined)
		}

		return session
	}

	public handoff(fromConsumerId: string, toConsumerId: string): VideoPlaybackSession | null {
		const session = this.sessionsByConsumer.get(fromConsumerId)
		if (!session) {
			return null
		}

		if (fromConsumerId === toConsumerId) {
			return session
		}

		this.release(toConsumerId)
		const group = this.groupsByPath.get(session.path)
		this.sessionsByConsumer.delete(fromConsumerId)
		this.sessionsByConsumer.set(toConsumerId, session)
		session.consumerId = toConsumerId
		session.ownerKind = this.inferOwnerKind(toConsumerId)
		session.lastActiveAt = Date.now()
		if (group) {
			group.consumers.delete(fromConsumerId)
			group.consumers.set(toConsumerId, session)
			if (group.activeConsumerIds.delete(fromConsumerId)) {
				group.activeConsumerIds.add(toConsumerId)
			}
		}
		this.emitConsumerState(fromConsumerId)
		this.emitConsumerState(toConsumerId, session)
		return session
	}

	public release(consumerId: string): void {
		const session = this.sessionsByConsumer.get(consumerId)
		if (!session) {
			return
		}

		this.sessionsByConsumer.delete(consumerId)
		const group = this.groupsByPath.get(session.path)
		if (group) {
			group.consumers.delete(consumerId)
			group.activeConsumerIds.delete(consumerId)
			if (group.consumers.size === 0) {
				this.groupsByPath.delete(session.path)
			}
		}
		session.disposeBindings?.()
		session.disposeBindings = undefined
		this.clearScheduledSessionRefresh(session)
		this.disposeVideo(session.video)
		this.emitConsumerState(consumerId)
	}

	public destroy(): void {
		this.sessionsByConsumer.forEach((session) => {
			session.disposeBindings?.()
			session.disposeBindings = undefined
			this.clearScheduledSessionRefresh(session)
			this.disposeVideo(session.video)
			this.emitConsumerState(session.consumerId)
		})
		this.sessionsByConsumer.clear()
		this.groupsByPath.clear()
		this.stateListenersByConsumer.clear()
	}

	private applyPlaybackOptions(video: HTMLVideoElement, options?: AcquirePlaybackOptions): void {
		if (!options) {
			return
		}

		if (typeof options.muted === "boolean") {
			video.muted = options.muted
		}
		if (typeof options.volume === "number") {
			video.volume = Math.max(0, Math.min(1, options.volume))
		}
		if (typeof options.playbackRate === "number" && Number.isFinite(options.playbackRate)) {
			video.playbackRate = options.playbackRate
		}
	}

	private waitUntilReady(video: HTMLVideoElement, currentTime?: number): Promise<boolean> {
		return new Promise((resolve) => {
			let settled = false

			const cleanup = () => {
				video.removeEventListener("loadeddata", handleLoadedData)
				video.removeEventListener("loadedmetadata", handleLoadedMetadata)
				video.removeEventListener("error", handleError)
			}

			const finish = (success: boolean) => {
				if (settled) {
					return
				}
				settled = true
				cleanup()
				resolve(success)
			}

			const handleError = () => {
				finish(false)
			}

			const handleLoadedMetadata = () => {
				if (
					typeof currentTime !== "number" ||
					!Number.isFinite(currentTime) ||
					currentTime <= 0
				) {
					return
				}

				try {
					video.currentTime = Math.max(0, currentTime)
				} catch {
					// ignore invalid seek target and continue waiting for loadeddata
				}
			}

			const handleLoadedData = () => {
				finish(true)
			}

			video.addEventListener("loadedmetadata", handleLoadedMetadata)
			video.addEventListener("loadeddata", handleLoadedData)
			video.addEventListener("error", handleError)
			video.load()

			if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
				handleLoadedData()
			}
		})
	}

	private getOrCreateGroup(path: string): PathPlaybackGroup {
		let group = this.groupsByPath.get(path)
		if (!group) {
			group = {
				path,
				consumers: new Map(),
				activeConsumerIds: new Set(),
				lastResolvedOssSrc: null,
				lastWarmupAt: null,
			}
			this.groupsByPath.set(path, group)
		}
		return group
	}

	private buildGroupSnapshot(group: PathPlaybackGroup): PathPlaybackGroupSnapshot {
		return {
			path: group.path,
			consumerIds: Array.from(group.consumers.keys()),
			activeConsumerIds: Array.from(group.activeConsumerIds),
			consumerCount: group.consumers.size,
			activeConsumerCount: group.activeConsumerIds.size,
			lastResolvedOssSrc: group.lastResolvedOssSrc,
			lastWarmupAt: group.lastWarmupAt,
		}
	}

	private inferOwnerKind(consumerId: string): VideoPlaybackOwnerKind {
		if (consumerId.startsWith("video:inline:")) {
			return "inline"
		}
		if (consumerId.startsWith("video:fullscreen:")) {
			return "fullscreen"
		}
		return "unknown"
	}

	private bindSessionActivity(session: InternalVideoPlaybackSession): () => void {
		const video = session.video
		const markActive = () => {
			session.lastActiveAt = Date.now()
			this.syncSessionActiveState(session, true)
			this.scheduleSessionRefresh(session)
		}
		const markInactive = () => {
			session.lastActiveAt = Date.now()
			this.syncSessionActiveState(session, false)
			this.clearScheduledSessionRefresh(session)
		}
		const touchOnly = () => {
			session.lastActiveAt = Date.now()
		}
		const resetToFirstFrame = () => {
			if (!Number.isFinite(video.duration) || video.duration <= 0) {
				return
			}
			try {
				video.currentTime = 0
			} catch {
				// ignore seek failure and keep native ended state
			}
		}
		const handleEnded = () => {
			resetToFirstFrame()
			markInactive()
		}
		const handleWaiting = () => {
			markActive()
			if (this.isSessionRefreshDue(session)) {
				void this.refreshSessionPlayback(session, "waiting")
			}
		}
		const handleError = () => {
			if (
				this.isCanvasVirtualResourceUrl(session.resolvedOssSrc) ||
				session.expiresAt !== null
			) {
				void this.refreshSessionPlayback(session, "error")
			}
		}

		video.addEventListener("play", markActive)
		video.addEventListener("playing", markActive)
		video.addEventListener("waiting", handleWaiting)
		video.addEventListener("seeking", markActive)
		video.addEventListener("timeupdate", touchOnly)
		video.addEventListener("pause", markInactive)
		video.addEventListener("ended", handleEnded)
		video.addEventListener("error", handleError)

		return () => {
			video.removeEventListener("play", markActive)
			video.removeEventListener("playing", markActive)
			video.removeEventListener("waiting", handleWaiting)
			video.removeEventListener("seeking", markActive)
			video.removeEventListener("timeupdate", touchOnly)
			video.removeEventListener("pause", markInactive)
			video.removeEventListener("ended", handleEnded)
			video.removeEventListener("error", handleError)
		}
	}

	private syncSessionActiveState(session: InternalVideoPlaybackSession, isActive: boolean): void {
		session.isActive = isActive
		const group = this.groupsByPath.get(session.path)
		if (!group) {
			return
		}

		if (isActive) {
			group.activeConsumerIds.add(session.consumerId)
		} else {
			group.activeConsumerIds.delete(session.consumerId)
		}
	}

	private scheduleSessionRefresh(session: InternalVideoPlaybackSession): void {
		this.clearScheduledSessionRefresh(session)
		if (
			!session.isActive ||
			session.isRefreshing ||
			session.expiresAt === null ||
			this.isCanvasVirtualResourceUrl(session.resolvedOssSrc)
		) {
			return
		}

		const delay = session.expiresAt - Date.now()
		if (delay <= 0) return

		session.refreshTimer = setTimeout(() => {
			session.refreshTimer = null
			if (!this.isTrackedSession(session)) {
				return
			}
			void this.refreshSessionPlayback(session, "timer")
		}, delay)
	}

	private clearScheduledSessionRefresh(session: InternalVideoPlaybackSession): void {
		if (!session.refreshTimer) {
			return
		}
		clearTimeout(session.refreshTimer)
		session.refreshTimer = null
	}

	private isSessionRefreshDue(session: InternalVideoPlaybackSession): boolean {
		if (this.isCanvasVirtualResourceUrl(session.resolvedOssSrc)) return false
		return isOssExpired(session.expiresAt)
	}

	private async cachePlaybackResource(
		path: string,
		ossSrc: string,
		expiresAt: number | null,
	): Promise<void> {
		if (this.isCanvasVirtualResourceUrl(ossSrc)) return

		await this.canvas.mediaResourceOfflineCacheManager.rememberResolvedResource({
			path,
			url: ossSrc,
			mediaType: "video",
			expiresAt,
		})
	}

	private isCanvasVirtualResourceUrl(url: string): boolean {
		try {
			return new URL(url, window.location.href).pathname.includes("/canvas-design-media/")
		} catch {
			return false
		}
	}

	private isTrackedSession(session: InternalVideoPlaybackSession): boolean {
		return this.sessionsByConsumer.get(session.consumerId) === session
	}

	private async refreshSessionPlayback(
		session: InternalVideoPlaybackSession,
		reason: VideoPlaybackIssueReason,
	): Promise<boolean> {
		if (!this.isTrackedSession(session)) {
			return false
		}
		if (session.refreshPromise) {
			return session.refreshPromise
		}

		session.lastActiveAt = Date.now()
		session.isRefreshing = true
		this.clearScheduledSessionRefresh(session)
		this.emitConsumerState(session.consumerId, session)

		const promise = (async () => {
			const previousOssSrc = session.resolvedOssSrc
			const video = session.video
			const resumeTime =
				Number.isFinite(video.currentTime) && video.currentTime > 0 ? video.currentTime : 0
			const shouldResume = !video.paused && !video.ended
			const playbackOptions: AcquirePlaybackOptions = {
				muted: video.muted,
				volume: video.volume,
				playbackRate: video.playbackRate,
			}

			const fallbackOssInfo =
				reason === "error" && this.isCanvasVirtualResourceUrl(previousOssSrc)
					? await this.canvas.videoResourceManager.resolveVirtualPlaybackFallbackOssInfo(
							session.path,
							previousOssSrc,
						)
					: null
			const ossInfo =
				fallbackOssInfo ??
				(await this.canvas.videoResourceManager.ensureFreshOssInfo(session.path, {
					forceRefresh: true,
				}))
			if (!ossInfo || !this.isTrackedSession(session)) {
				return false
			}

			session.resolvedOssSrc = ossInfo.ossSrc
			session.expiresAt = ossInfo.expiresAt
			const group = this.groupsByPath.get(session.path)
			if (group) {
				group.lastResolvedOssSrc = ossInfo.ossSrc
				group.lastWarmupAt = Date.now()
			}
			await this.cachePlaybackResource(session.path, ossInfo.ossSrc, ossInfo.expiresAt)

			const shouldReload = reason !== "timer" || ossInfo.ossSrc !== previousOssSrc
			if (shouldReload) {
				const isReady = await this.reloadSessionSource(video, ossInfo.ossSrc, {
					currentTime: resumeTime,
					playbackOptions,
				})
				if (!isReady || !this.isTrackedSession(session)) {
					return false
				}
			}

			this.applyPlaybackOptions(video, playbackOptions)
			if (shouldResume) {
				await video.play().catch(() => undefined)
			}
			return true
		})()

		session.refreshPromise = promise

		try {
			return await promise
		} finally {
			session.refreshPromise = null
			session.isRefreshing = false
			if (this.isTrackedSession(session)) {
				this.syncSessionActiveState(session, !session.video.paused && !session.video.ended)
				this.scheduleSessionRefresh(session)
				this.emitConsumerState(session.consumerId, session)
			}
		}
	}

	private async reloadSessionSource(
		video: HTMLVideoElement,
		ossSrc: string,
		options: {
			currentTime?: number
			playbackOptions?: AcquirePlaybackOptions
		},
	): Promise<boolean> {
		video.pause()
		video.src = ossSrc
		this.applyPlaybackOptions(video, options.playbackOptions)
		return this.waitUntilReady(video, options.currentTime)
	}

	private emitConsumerState(consumerId: string, session?: InternalVideoPlaybackSession): void {
		const listeners = this.stateListenersByConsumer.get(consumerId)
		if (!listeners || listeners.size === 0) {
			return
		}

		const state: VideoPlaybackConsumerState = {
			isRefreshing: session?.isRefreshing ?? false,
		}
		listeners.forEach((listener) => listener(state))
	}

	private disposeVideo(video: HTMLVideoElement): void {
		video.pause()
		if (video.parentElement) {
			video.parentElement.removeChild(video)
		}
		video.removeAttribute("src")
		video.load()
	}
}
