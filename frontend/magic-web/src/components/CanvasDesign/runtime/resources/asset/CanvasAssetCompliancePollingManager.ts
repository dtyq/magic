import type { Canvas } from "../../core/Canvas"
import type {
	CanvasAssetComplianceState,
	CanvasAssetComplianceStatus,
} from "../../../public/magic-types"

const DEFAULT_POLLING_INTERVAL = 2500
const DEFAULT_MAX_POLLING_INTERVAL = 30_000
const DEFAULT_MAX_DURATION = 5 * 60 * 1000
const DEFAULT_BACKOFF_FACTOR = 2

export interface CanvasAssetCompliancePollingOptions {
	intervalMs?: number
	maxIntervalMs?: number
	maxDurationMs?: number
	backoffFactor?: number
	/** Avoid background-tab polling; the next visible event resumes immediately. */
	pauseWhenHidden?: boolean
	onUpdate?: (state: CanvasAssetComplianceState) => void
	onSettled?: (state: CanvasAssetComplianceState) => void
	onError?: (error: unknown) => void
}

interface PollingListener {
	id: symbol
	options: CanvasAssetCompliancePollingOptions
}

interface PollingEntry {
	assetId: string
	listeners: PollingListener[]
	timer?: ReturnType<typeof setTimeout>
	inFlight: boolean
	token: symbol
	startedAt: number
	consecutiveErrors: number
}

function isTerminalStatus(status: CanvasAssetComplianceStatus): boolean {
	return status !== "PROCESSING"
}

/**
 * Canvas 级素材合规轮询器。
 *
 * 轮询状态属于素材服务，不写回媒体 Content；合规任务模块订阅
 * 状态回调即可复用同一套请求去重、定时器清理和旧请求隔离逻辑。
 */
export class CanvasAssetCompliancePollingManager {
	private readonly entries = new Map<string, PollingEntry>()
	private readonly states = new Map<string, CanvasAssetComplianceState>()
	private readonly queuedEntries = new Set<PollingEntry>()
	private pollFlushScheduled = false
	private destroyed = false

	constructor(private readonly canvas: Canvas) {
		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", this.handleVisibilityChange)
		}
	}

	public start(assetId: string, options: CanvasAssetCompliancePollingOptions = {}): () => void {
		if (this.destroyed) return () => undefined
		const normalizedAssetId = assetId.trim()
		if (!normalizedAssetId) return () => undefined

		const listener: PollingListener = {
			id: Symbol(`asset-compliance-listener:${normalizedAssetId}`),
			options,
		}

		const existing = this.entries.get(normalizedAssetId)
		if (existing) {
			existing.listeners.push(listener)
			return () => this.removeListener(normalizedAssetId, listener.id)
		}

		const entry: PollingEntry = {
			assetId: normalizedAssetId,
			listeners: [listener],
			inFlight: false,
			token: Symbol(`asset-compliance:${normalizedAssetId}`),
			startedAt: Date.now(),
			consecutiveErrors: 0,
		}
		this.entries.set(normalizedAssetId, entry)
		this.queuePoll(entry)
		return () => this.removeListener(normalizedAssetId, listener.id)
	}

	public stop(assetId: string): void {
		const normalizedAssetId = assetId.trim()
		const entry = this.entries.get(normalizedAssetId)
		if (!entry) return
		this.clearEntry(entry)
	}

	public stopAll(): void {
		for (const entry of this.entries.values()) this.clearEntry(entry)
		this.queuedEntries.clear()
		this.entries.clear()
	}

	public getState(assetId: string): CanvasAssetComplianceState | undefined {
		return this.states.get(assetId.trim())
	}

	public destroy(): void {
		this.destroyed = true
		if (typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", this.handleVisibilityChange)
		}
		this.stopAll()
		this.states.clear()
	}

	private queuePoll(entry: PollingEntry): void {
		if (!this.isCurrentEntry(entry) || entry.inFlight) return
		this.queuedEntries.add(entry)
		if (this.pollFlushScheduled) return
		this.pollFlushScheduled = true
		queueMicrotask(() => {
			this.pollFlushScheduled = false
			const entries = Array.from(this.queuedEntries)
			this.queuedEntries.clear()
			void this.pollEntries(entries)
		})
	}

	private async pollEntries(entries: PollingEntry[]): Promise<void> {
		const readyEntries: PollingEntry[] = []
		for (const entry of entries) {
			if (!this.isCurrentEntry(entry) || entry.inFlight) continue
			if (this.shouldPauseForVisibility(entry)) continue
			if (this.hasTimedOut(entry)) {
				this.emitError(entry, new Error("Asset compliance polling timed out"))
				// The local watcher has reached its terminal condition even though the
				// server task is still PROCESSING. Notify consumers so optimistic UI state
				// is cleared and a later refresh can resume from the server state.
				this.emitSettled(
					entry,
					this.states.get(entry.assetId) ?? {
						assetId: entry.assetId,
						status: "PROCESSING",
						failedReason: null,
					},
				)
				this.clearEntry(entry)
				continue
			}
			readyEntries.push(entry)
		}
		if (readyEntries.length === 0) return

		readyEntries.forEach((entry) => {
			entry.inFlight = true
		})
		const methods = this.canvas.magicConfigManager.config?.methods
		const getAssetComplianceStatus = methods?.getAssetComplianceStatus
		const getAssetComplianceStatuses = methods?.getAssetComplianceStatuses
		if (!getAssetComplianceStatus && !getAssetComplianceStatuses) {
			readyEntries.forEach((entry) => {
				this.emitError(entry, new Error("Asset compliance resolver is not configured"))
				this.clearEntry(entry)
				entry.inFlight = false
			})
			return
		}

		try {
			if (
				getAssetComplianceStatuses &&
				(readyEntries.length > 1 || !getAssetComplianceStatus)
			) {
				const states = await getAssetComplianceStatuses(
					readyEntries.map((entry) => entry.assetId),
				)
				const statesByAssetId = new Map(states.map((state) => [state.assetId, state]))
				readyEntries.forEach((entry) => {
					const state = statesByAssetId.get(entry.assetId)
					if (state) this.applyState(entry, state)
					else
						this.applyError(
							entry,
							new Error(`Asset status is unavailable: ${entry.assetId}`),
						)
				})
			} else if (getAssetComplianceStatus) {
				const results = await Promise.allSettled(
					readyEntries.map((entry) => getAssetComplianceStatus(entry.assetId)),
				)
				results.forEach((result, index) => {
					const entry = readyEntries[index]
					if (result.status === "fulfilled") this.applyState(entry, result.value)
					else this.applyError(entry, result.reason)
				})
			} else {
				readyEntries.forEach((entry) => {
					this.applyError(entry, new Error("Asset compliance resolver is not configured"))
				})
			}
		} catch (error) {
			// The host resolver may fall back to single-item requests for older
			// deployments. If it still fails, keep the existing retry behavior.
			readyEntries.forEach((entry) => this.applyError(entry, error))
		} finally {
			readyEntries.forEach((entry) => {
				entry.inFlight = false
			})
		}
	}

	private applyState(entry: PollingEntry, state: CanvasAssetComplianceState): void {
		if (!this.isCurrentEntry(entry)) return
		this.states.set(entry.assetId, state)
		entry.consecutiveErrors = 0
		this.emitUpdate(entry, state)
		if (isTerminalStatus(state.status)) {
			this.emitSettled(entry, state)
			this.clearEntry(entry)
			return
		}
		this.scheduleNextPoll(entry)
	}

	private applyError(entry: PollingEntry, error: unknown): void {
		if (!this.isCurrentEntry(entry)) return
		// 与生成结果轮询一致：临时网络/服务异常不改变素材状态，
		// 通知调用方后继续下一周期重试。
		this.emitError(entry, error)
		entry.consecutiveErrors += 1
		this.scheduleNextPoll(entry)
	}

	private emitUpdate(entry: PollingEntry, state: CanvasAssetComplianceState): void {
		for (const listener of entry.listeners) {
			listener.options.onUpdate?.(state)
		}
	}

	private emitSettled(entry: PollingEntry, state: CanvasAssetComplianceState): void {
		for (const listener of entry.listeners) {
			listener.options.onSettled?.(state)
		}
	}

	private emitError(entry: PollingEntry, error: unknown): void {
		for (const listener of entry.listeners) {
			listener.options.onError?.(error)
		}
	}

	private removeListener(assetId: string, listenerId: symbol): void {
		const entry = this.entries.get(assetId)
		if (!entry) return
		entry.listeners = entry.listeners.filter((listener) => listener.id !== listenerId)
		if (entry.listeners.length === 0) {
			this.clearEntry(entry)
		}
	}

	private scheduleNextPoll(entry: PollingEntry): void {
		if (!this.isCurrentEntry(entry)) return
		if (entry.timer) clearTimeout(entry.timer)
		if (this.shouldPauseForVisibility(entry)) return
		const baseInterval = Math.max(
			0,
			entry.listeners[0]?.options.intervalMs ?? DEFAULT_POLLING_INTERVAL,
		)
		const options = entry.listeners[0]?.options
		const backoffFactor = Math.max(1, options?.backoffFactor ?? DEFAULT_BACKOFF_FACTOR)
		const maxInterval = Math.max(
			baseInterval,
			options?.maxIntervalMs ?? DEFAULT_MAX_POLLING_INTERVAL,
		)
		const interval = Math.min(
			maxInterval,
			baseInterval * backoffFactor ** Math.max(0, entry.consecutiveErrors - 1),
		)
		entry.timer = setTimeout(() => {
			entry.timer = undefined
			this.queuePoll(entry)
		}, interval)
	}

	private shouldPauseForVisibility(entry: PollingEntry): boolean {
		return (
			entry.listeners[0]?.options.pauseWhenHidden !== false &&
			typeof document !== "undefined" &&
			document.visibilityState === "hidden"
		)
	}

	private hasTimedOut(entry: PollingEntry): boolean {
		const maxDuration = Math.max(
			0,
			entry.listeners[0]?.options.maxDurationMs ?? DEFAULT_MAX_DURATION,
		)
		return maxDuration > 0 && Date.now() - entry.startedAt >= maxDuration
	}

	private readonly handleVisibilityChange = (): void => {
		if (
			this.destroyed ||
			typeof document === "undefined" ||
			document.visibilityState === "hidden"
		) {
			return
		}
		for (const entry of this.entries.values()) {
			if (entry.timer) {
				clearTimeout(entry.timer)
				entry.timer = undefined
			}
			this.queuePoll(entry)
		}
	}

	private isCurrentEntry(entry: PollingEntry): boolean {
		const current = this.entries.get(entry.assetId)
		return !this.destroyed && current === entry && current?.token === entry.token
	}

	private clearEntry(entry: PollingEntry): void {
		this.queuedEntries.delete(entry)
		if (entry.timer) clearTimeout(entry.timer)
		entry.timer = undefined
		if (this.entries.get(entry.assetId) === entry) this.entries.delete(entry.assetId)
	}
}
