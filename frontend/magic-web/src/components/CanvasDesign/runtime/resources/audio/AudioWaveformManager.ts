import type { Canvas } from "../../core/Canvas"
import type { CanvasResourceTaskPriority } from "../scheduler/CanvasResourceScheduler"
import type { CanvasResourceReferenceResolverChangeOptions } from "../../shared/path/canvasResourcePath"

export type AudioWaveformStatus = "idle" | "loading" | "ready" | "error"

export interface AudioWaveformSnapshot {
	status: AudioWaveformStatus
	peaks: Float32Array | null
}

export interface AudioWaveformPrepareOptions {
	priority?: CanvasResourceTaskPriority
	signal?: AbortSignal
}

export type AudioWaveformSnapshotHandler = (snapshot: AudioWaveformSnapshot) => void

interface PendingWaveformRequest {
	abortController: AbortController
	consumers: Set<symbol>
	promise: Promise<boolean>
}

const EMPTY_SNAPSHOT: AudioWaveformSnapshot = {
	status: "idle",
	peaks: null,
}

const AUDIO_WAVEFORM_BUCKET_COUNT = 512

/** 将解码后的 PCM 数据压缩为轻量的归一化峰值数组。 */
export function buildAudioWaveformPeaks(
	audioBuffer: Pick<AudioBuffer, "length" | "numberOfChannels" | "getChannelData">,
	bucketCount = AUDIO_WAVEFORM_BUCKET_COUNT,
): Float32Array {
	const safeBucketCount = Math.max(1, Math.floor(bucketCount))
	const peaks = new Float32Array(safeBucketCount)
	if (audioBuffer.length <= 0 || audioBuffer.numberOfChannels <= 0) return peaks

	for (let bucketIndex = 0; bucketIndex < safeBucketCount; bucketIndex += 1) {
		const start = Math.floor((bucketIndex * audioBuffer.length) / safeBucketCount)
		const end = Math.max(
			start + 1,
			Math.floor(((bucketIndex + 1) * audioBuffer.length) / safeBucketCount),
		)
		let sumSquares = 0
		let sampleCount = 0
		for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
			const channelData = audioBuffer.getChannelData(channelIndex)
			const safeEnd = Math.min(end, channelData.length)
			for (let sampleIndex = start; sampleIndex < safeEnd; sampleIndex += 1) {
				const sample = channelData[sampleIndex] ?? 0
				sumSquares += sample * sample
				sampleCount += 1
			}
		}
		peaks[bucketIndex] = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0
	}

	const sortedPeaks = Array.from(peaks).sort((left, right) => left - right)
	const percentileIndex = Math.min(sortedPeaks.length - 1, Math.floor(sortedPeaks.length * 0.95))
	const normalizationPeak = sortedPeaks[percentileIndex] ?? 0
	if (normalizationPeak <= 0) return peaks

	for (let index = 0; index < peaks.length; index += 1) {
		peaks[index] = Math.min(1, peaks[index] / normalizationPeak)
	}
	return peaks
}

/** 可见音频的真实波形解码、去重、取消与运行时缓存。 */
export class AudioWaveformManager {
	private readonly canvas: Canvas
	private readonly snapshots = new Map<string, AudioWaveformSnapshot>()
	private readonly handlers = new Map<string, Set<AudioWaveformSnapshotHandler>>()
	private readonly peaksByCacheKey = new Map<string, Float32Array>()
	private readonly cacheKeysByIdentity = new Map<string, Set<string>>()
	private readonly pendingByIdentity = new Map<string, PendingWaveformRequest>()
	private readonly generationByIdentity = new Map<string, number>()
	private audioContext?: AudioContext
	private destroyed = false

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	public subscribe(path: string, handler: AudioWaveformSnapshotHandler): () => void {
		const identity = this.canvas.audioResourceManager.getResourceIdentity(path)
		const handlers = this.handlers.get(identity) ?? new Set<AudioWaveformSnapshotHandler>()
		handlers.add(handler)
		this.handlers.set(identity, handlers)
		handler(this.getSnapshot(path))
		return () => {
			const currentHandlers = this.handlers.get(identity)
			currentHandlers?.delete(handler)
			if (currentHandlers?.size === 0) this.handlers.delete(identity)
		}
	}

	public getSnapshot(path: string): AudioWaveformSnapshot {
		if (!path) return EMPTY_SNAPSHOT
		const identity = this.canvas.audioResourceManager.getResourceIdentity(path)
		return this.snapshots.get(identity) ?? EMPTY_SNAPSHOT
	}

	public async prepare(path: string, options?: AudioWaveformPrepareOptions): Promise<boolean> {
		if (this.destroyed || !path || options?.signal?.aborted) return false
		const identity = this.canvas.audioResourceManager.getResourceIdentity(path)
		const consumer = Symbol(`audio-waveform:${identity}`)
		let pending = this.pendingByIdentity.get(identity)
		if (!pending) {
			const abortController = new AbortController()
			const generation = this.getGeneration(identity)
			this.setSnapshot(identity, { status: "loading", peaks: null })
			pending = {
				abortController,
				consumers: new Set(),
				promise: this.loadWaveform(path, identity, generation, abortController, options)
					.catch((error) => {
						if (isAbortError(error)) return false
						this.handlePrepareFailure(path, identity, generation)
						return false
					})
					.finally(() => {
						const current = this.pendingByIdentity.get(identity)
						if (current?.abortController === abortController) {
							this.pendingByIdentity.delete(identity)
							if (
								abortController.signal.aborted &&
								this.isCurrentGeneration(identity, generation) &&
								this.snapshots.get(identity)?.status === "loading"
							) {
								this.setSnapshot(identity, EMPTY_SNAPSHOT)
							}
						}
					}),
			}
			this.pendingByIdentity.set(identity, pending)
		}

		pending.consumers.add(consumer)
		return this.waitForConsumer(identity, pending, consumer, options?.signal)
	}

	public invalidatePath(path: string): void {
		if (!path) return
		this.invalidateIdentity(this.canvas.audioResourceManager.getResourceIdentity(path))
	}

	public handleResourceReferenceResolverChanged(
		options?: CanvasResourceReferenceResolverChangeOptions,
	): void {
		if (!options?.changedResourceIdentities) {
			this.invalidateAll()
			return
		}

		const affectedIdentities = new Set<string>()
		this.snapshots.forEach((_snapshot, identity) => affectedIdentities.add(identity))
		this.pendingByIdentity.forEach((_pending, identity) => affectedIdentities.add(identity))
		this.cacheKeysByIdentity.forEach((_cacheKeys, identity) => affectedIdentities.add(identity))
		affectedIdentities.forEach((identity) => {
			if (options.changedResourceIdentities?.has(identity)) this.invalidateIdentity(identity)
		})
	}

	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		this.invalidateAll()
		this.handlers.clear()
		const context = this.audioContext
		this.audioContext = undefined
		if (context && context.state !== "closed") void context.close()
	}

	private async loadWaveform(
		path: string,
		identity: string,
		generation: number,
		abortController: AbortController,
		options?: AudioWaveformPrepareOptions,
	): Promise<boolean> {
		const resource = await this.canvas.audioResourceManager.getResource(path, {
			allowCachedFallback: true,
			priority: options?.priority ?? "visible",
			signal: abortController.signal,
		})
		if (!resource) {
			if (!abortController.signal.aborted && !this.destroyed) {
				this.handlePrepareFailure(path, identity, generation)
			}
			return false
		}
		if (abortController.signal.aborted || this.destroyed) return false

		const cacheKey = `${resource.resourceIdentity}\0${
			resource.resourceVersion ?? resource.sourceUpdatedAt ?? "unversioned"
		}`
		const cachedPeaks = this.peaksByCacheKey.get(cacheKey)
		if (cachedPeaks) {
			if (this.isCurrentGeneration(identity, generation)) {
				this.setSnapshot(identity, { status: "ready", peaks: cachedPeaks })
			}
			return true
		}

		const peaks = await this.canvas.resourceScheduler.run(
			"audio:waveform-decode",
			async (signal) => {
				const response = await fetch(resource.ossSrc, { signal })
				if (!response.ok) throw new Error(`Audio waveform fetch failed: ${response.status}`)
				const arrayBuffer = await response.arrayBuffer()
				if (signal.aborted) throw createAbortError()
				const decoded = await this.getAudioContext().decodeAudioData(arrayBuffer)
				if (signal.aborted) throw createAbortError()
				return buildAudioWaveformPeaks(decoded)
			},
			{
				source: "AudioWaveformManager",
				ownerId: identity,
				path,
				priority: options?.priority ?? "visible",
				signal: abortController.signal,
			},
		)

		if (
			abortController.signal.aborted ||
			this.destroyed ||
			!this.isCurrentGeneration(identity, generation)
		) {
			return false
		}
		this.peaksByCacheKey.set(cacheKey, peaks)
		const cacheKeys = this.cacheKeysByIdentity.get(identity) ?? new Set<string>()
		cacheKeys.add(cacheKey)
		this.cacheKeysByIdentity.set(identity, cacheKeys)
		this.setSnapshot(identity, { status: "ready", peaks })
		return true
	}

	private waitForConsumer(
		identity: string,
		pending: PendingWaveformRequest,
		consumer: symbol,
		signal?: AbortSignal,
	): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			let settled = false
			const finish = (value: boolean) => {
				if (settled) return
				settled = true
				signal?.removeEventListener("abort", handleAbort)
				pending.consumers.delete(consumer)
				if (
					pending.consumers.size === 0 &&
					this.pendingByIdentity.get(identity) === pending
				) {
					pending.abortController.abort()
				}
				resolve(value)
			}
			const handleAbort = () => finish(false)
			if (signal?.aborted) {
				finish(false)
				return
			}
			signal?.addEventListener("abort", handleAbort, { once: true })
			pending.promise.then(finish, () => finish(false))
		})
	}

	private getAudioContext(): AudioContext {
		if (this.audioContext && this.audioContext.state !== "closed") return this.audioContext
		const audioContextGlobal = globalThis as typeof globalThis & {
			webkitAudioContext?: typeof AudioContext
		}
		const AudioContextConstructor =
			globalThis.AudioContext ?? audioContextGlobal.webkitAudioContext
		if (!AudioContextConstructor) throw new Error("AudioContext is not available")
		this.audioContext = new AudioContextConstructor()
		return this.audioContext
	}

	private handlePrepareFailure(path: string, identity: string, generation: number): void {
		if (!this.isCurrentGeneration(identity, generation)) return
		this.setSnapshot(identity, { status: "error", peaks: null })
		if (this.canvas.audioResourceManager.getFailureReason(path) === "not-found") return
		this.canvas.visibilityManager?.invalidateAudioLoadRequest(path, "waveform-decode-failed", {
			scheduleRefresh: false,
		})
	}

	private invalidateIdentity(identity: string): void {
		this.generationByIdentity.set(identity, this.getGeneration(identity) + 1)
		this.pendingByIdentity.get(identity)?.abortController.abort()
		this.pendingByIdentity.delete(identity)
		this.cacheKeysByIdentity.get(identity)?.forEach((cacheKey) => {
			this.peaksByCacheKey.delete(cacheKey)
		})
		this.cacheKeysByIdentity.delete(identity)
		this.setSnapshot(identity, EMPTY_SNAPSHOT)
	}

	private invalidateAll(): void {
		const identities = new Set([
			...this.snapshots.keys(),
			...this.pendingByIdentity.keys(),
			...this.cacheKeysByIdentity.keys(),
		])
		identities.forEach((identity) => this.invalidateIdentity(identity))
		this.snapshots.clear()
		this.peaksByCacheKey.clear()
		this.cacheKeysByIdentity.clear()
	}

	private getGeneration(identity: string): number {
		return this.generationByIdentity.get(identity) ?? 0
	}

	private isCurrentGeneration(identity: string, generation: number): boolean {
		return !this.destroyed && this.getGeneration(identity) === generation
	}

	private setSnapshot(identity: string, snapshot: AudioWaveformSnapshot): void {
		this.snapshots.set(identity, snapshot)
		this.handlers.get(identity)?.forEach((handler) => handler(snapshot))
	}
}

function createAbortError(): Error {
	const error = new Error("Aborted")
	error.name = "AbortError"
	return error
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError"
}
