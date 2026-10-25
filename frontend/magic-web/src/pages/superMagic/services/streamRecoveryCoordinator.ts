import { superMagicStore } from "@/pages/superMagic/stores"
import type { StreamRecoveryRequestPayload } from "@/pages/superMagic/stores/types"

export type StreamRecoveryOwnerToken = symbol

export interface StreamRecoveryResult {
	didPullSucceed: boolean
}

export interface StreamRecoveryContext extends StreamRecoveryRequestPayload {
	conversationId: string
	syncGeneration: number
}

export interface StreamRecoveryCoordinatorOptions {
	/** 非 watchdog 触发器的短窗口合并延迟；watchdog 默认立即进入既有恢复预算。 */
	debounceMs?: number
	/** HTTP 未找到真实 Tool Response 时使用的有界重试间隔。 */
	retryDelaysMs?: number[]
}

export interface StreamRecoveryOwnerRegistration {
	ownerToken: StreamRecoveryOwnerToken
	topicId: string
	conversationId: string
	getTaskStatus: () => string | undefined
	/** hidden 页面只保留待恢复请求，不启动新的 HTTP authoritative recovery。 */
	canRecover?: () => boolean
	recover: (context: StreamRecoveryContext) => Promise<StreamRecoveryResult>
}

interface StreamRecoveryStore {
	registerOnStreamRecoveryRequested: (
		callback: (payload: StreamRecoveryRequestPayload) => void,
	) => () => void
	beginTopicSync: (topicId: string) => number
	isTopicSyncCurrent: (topicId: string, generation: number) => boolean
	completeTopicSync: (
		topicId: string,
		generation: number,
		result: {
			succeeded: boolean
			taskStatus?: string
			latestSeqId?: string
			lifecycleEventPolicy?: "silent" | "live"
			trigger?: "websocket" | "recovery"
		},
	) => boolean
	cancelTopicSync: (topicId: string, generation: number) => void
	getLatestMessageSeqId: (topicId: string) => string
	resolveStreamRecoveryRequest?: (
		payload: StreamRecoveryRequestPayload,
	) => StreamRecoveryRequestPayload | undefined
	markToolResponseRecoveryScheduled?: (topicId: string, anchorAppMessageId?: string) => void
	markToolResponseRecoveryInFlight?: (topicId: string, anchorAppMessageId?: string) => void
	markToolResponseRecoveryAwaitingResponse?: (
		topicId: string,
		anchorAppMessageId?: string,
	) => void
	markToolResponseRecoveryDormant?: (topicId: string, anchorAppMessageId?: string) => void
}

interface RegisteredRecoveryOwner extends StreamRecoveryOwnerRegistration {
	registrationOrder: number
}

interface InFlightRecovery {
	topicId: string
	generation: number
	owner: RegisteredRecoveryOwner
	payload: StreamRecoveryRequestPayload
}

interface ScheduledRecovery {
	topicId: string
	payload: StreamRecoveryRequestPayload
	timer: ReturnType<typeof setTimeout> | null
	attempt: number
	rerunNeeded: boolean
}

/**
 * Store watchdog 与 React Hook 之间的单例协调器。
 *
 * Store listener 在模块生命周期内只注册一次；每个 Hook 只登记当前可用的
 * topic/conversation 上下文。同一 topic 同时只能存在一个 HTTP recovery generation。
 */
export class StreamRecoveryCoordinator {
	private listenerRegistered = false
	private registrationOrder = 0
	private readonly owners = new Map<StreamRecoveryOwnerToken, RegisteredRecoveryOwner>()
	private readonly inFlightRecoveries = new Map<string, InFlightRecovery>()
	private readonly scheduledRecoveries = new Map<string, ScheduledRecovery>()
	private readonly debounceMs: number
	private readonly retryDelaysMs: number[]

	constructor(
		private readonly store: StreamRecoveryStore,
		options: StreamRecoveryCoordinatorOptions = {},
	) {
		this.debounceMs = options.debounceMs ?? 200
		this.retryDelaysMs = options.retryDelaysMs ?? [500, 1_500, 5_000]
	}

	registerOwner(registration: StreamRecoveryOwnerRegistration): () => void {
		this.ensureStoreListenerRegistered()

		const previousOwner = this.owners.get(registration.ownerToken)
		if (previousOwner) this.unregisterOwner(previousOwner)

		const registeredOwner: RegisteredRecoveryOwner = {
			...registration,
			registrationOrder: ++this.registrationOrder,
		}
		this.owners.set(registration.ownerToken, registeredOwner)
		const scheduled = this.scheduledRecoveries.get(registration.topicId)
		if (scheduled && !this.inFlightRecoveries.has(registration.topicId)) {
			this.scheduleRecovery(scheduled, 0)
		}
		const inFlightRecovery = this.inFlightRecoveries.get(registration.topicId)
		if (inFlightRecovery && inFlightRecovery.owner !== registeredOwner) {
			this.inFlightRecoveries.delete(registration.topicId)
			this.store.cancelTopicSync(registration.topicId, inFlightRecovery.generation)
		}

		return () => {
			if (this.owners.get(registration.ownerToken) !== registeredOwner) return
			this.unregisterOwner(registeredOwner)
		}
	}

	private ensureStoreListenerRegistered() {
		if (this.listenerRegistered) return
		this.store.registerOnStreamRecoveryRequested((payload) => {
			this.handleRecoveryRequested(payload)
		})
		this.listenerRegistered = true
	}

	private unregisterOwner(owner: RegisteredRecoveryOwner) {
		if (this.owners.get(owner.ownerToken) === owner) {
			this.owners.delete(owner.ownerToken)
		}

		const inFlightRecovery = this.inFlightRecoveries.get(owner.topicId)
		if (inFlightRecovery?.owner === owner) {
			this.inFlightRecoveries.delete(owner.topicId)
			this.store.cancelTopicSync(owner.topicId, inFlightRecovery.generation)
		}
		this.clearScheduledRecovery(owner.topicId)
	}

	private handleRecoveryRequested(payload: StreamRecoveryRequestPayload) {
		this.requestRecovery(payload)
	}

	/** 所有恢复来源先登记，再由 Topic 级 single-flight 统一发送 HTTP。 */
	requestRecovery(payload: StreamRecoveryRequestPayload) {
		const hasInFlightRecovery = this.inFlightRecoveries.has(payload.topicId)
		if (!hasInFlightRecovery) {
			this.store.markToolResponseRecoveryScheduled?.(payload.topicId)
		}
		const current = this.scheduledRecoveries.get(payload.topicId)
		if (current) {
			current.payload = mergeRecoveryPayload(current.payload, payload, {
				preserveCheckpointPriority: true,
			})
			if (this.inFlightRecoveries.has(payload.topicId)) {
				current.rerunNeeded = true
				return
			}
			if (current.timer) clearTimeout(current.timer)
			current.timer = null
			this.scheduleRecovery(
				current,
				!payload.reason || payload.reason === "stream_watchdog" ? 0 : this.debounceMs,
			)
			return
		}

		const scheduled: ScheduledRecovery = {
			topicId: payload.topicId,
			payload,
			timer: null,
			attempt: 0,
			rerunNeeded: false,
		}
		this.scheduledRecoveries.set(payload.topicId, scheduled)
		this.scheduleRecovery(
			scheduled,
			!payload.reason || payload.reason === "stream_watchdog" ? 0 : this.debounceMs,
		)
	}

	private scheduleRecovery(scheduled: ScheduledRecovery, delay: number) {
		if (scheduled.timer || (this.inFlightRecoveries.has(scheduled.topicId) && delay <= 0))
			return
		if (delay <= 0) {
			void this.startRecovery(scheduled.topicId)
			return
		}
		scheduled.timer = setTimeout(() => {
			scheduled.timer = null
			void this.startRecovery(scheduled.topicId)
		}, delay)
	}

	private clearScheduledRecovery(topicId: string) {
		const scheduled = this.scheduledRecoveries.get(topicId)
		if (!scheduled) return
		if (scheduled.timer) clearTimeout(scheduled.timer)
		this.scheduledRecoveries.delete(topicId)
	}

	private async startRecovery(topicId: string) {
		if (this.inFlightRecoveries.has(topicId)) return
		const scheduled = this.scheduledRecoveries.get(topicId)
		if (!scheduled) return
		const resolvedPayload = this.store.resolveStreamRecoveryRequest
			? this.store.resolveStreamRecoveryRequest(scheduled.payload)
			: scheduled.payload
		if (!resolvedPayload) {
			this.clearScheduledRecovery(topicId)
			return
		}
		// The resolver may narrow a broad WS watermark to the Tool anchor that
		// still needs recovery. Keep both pieces of information: the resolved
		// reason/anchor drives the request, while the scheduled payload's higher
		// requiredSeqId remains the authoritative-tail completion barrier.
		const mergedPayload = mergeRecoveryPayload(scheduled.payload, resolvedPayload, {
			preserveCheckpointPriority: true,
		})
		scheduled.payload = mergedPayload

		const owner = this.selectCurrentOwner(topicId)
		if (!owner) return
		if (owner.canRecover && !owner.canRecover()) return

		// Must happen before recover() reaches its first await so Store can merge later watchdogs.
		const generation = this.store.beginTopicSync(topicId)
		const inFlightRecovery: InFlightRecovery = {
			topicId,
			generation,
			owner,
			payload: mergedPayload,
		}
		this.inFlightRecoveries.set(topicId, inFlightRecovery)
		this.store.markToolResponseRecoveryInFlight?.(topicId)

		void this.executeRecovery(inFlightRecovery)
	}

	getTopicRecoveryStatus(topicId: string) {
		const scheduled = this.scheduledRecoveries.get(topicId)
		const inFlight = this.inFlightRecoveries.get(topicId)
		return {
			hasScheduled: Boolean(scheduled),
			hasInFlight: Boolean(inFlight),
			reason: scheduled?.payload.reason || inFlight?.payload.reason,
		}
	}

	resumeTopicRecovery(topicId: string) {
		const scheduled = this.scheduledRecoveries.get(topicId)
		if (!scheduled || this.inFlightRecoveries.has(topicId)) return
		this.scheduleRecovery(scheduled, 0)
	}

	/**
	 * A foreground tail may cover a recovery request that was queued while the
	 * document was hidden. Resolve that request before resuming the queue so the
	 * visibility handler cannot launch a second serial HTTP recovery.
	 */
	acknowledgeTopicSync(topicId: string, latestSeqId?: string) {
		const scheduled = this.scheduledRecoveries.get(topicId)
		if (!scheduled) return
		const resolvedPayload = this.store.resolveStreamRecoveryRequest
			? this.store.resolveStreamRecoveryRequest(scheduled.payload)
			: scheduled.payload
		if (!resolvedPayload) {
			this.clearScheduledRecovery(topicId)
			return
		}
		if (resolvedPayload.reason === "checkpoint_rollback") return
		if (
			resolvedPayload.requiredSeqId &&
			(!latestSeqId || compareRecoverySeqId(latestSeqId, resolvedPayload.requiredSeqId) < 0)
		)
			return
		this.clearScheduledRecovery(topicId)
	}

	private selectCurrentOwner(topicId: string): RegisteredRecoveryOwner | undefined {
		let selectedOwner: RegisteredRecoveryOwner | undefined
		this.owners.forEach((owner) => {
			if (owner.topicId !== topicId) return
			if (!selectedOwner || owner.registrationOrder > selectedOwner.registrationOrder) {
				selectedOwner = owner
			}
		})
		return selectedOwner
	}

	private isRecoveryCurrent(recovery: InFlightRecovery): boolean {
		return (
			this.inFlightRecoveries.get(recovery.topicId) === recovery &&
			this.owners.get(recovery.owner.ownerToken) === recovery.owner &&
			this.selectCurrentOwner(recovery.topicId) === recovery.owner
		)
	}

	private async executeRecovery(recovery: InFlightRecovery) {
		const scheduled = this.scheduledRecoveries.get(recovery.topicId)
		const isWebSocketAuthoritativeTail = recovery.payload.reason === "persistent_message"
		const lifecycleContext = {
			lifecycleEventPolicy: isWebSocketAuthoritativeTail
				? ("live" as const)
				: ("silent" as const),
			trigger: isWebSocketAuthoritativeTail ? ("websocket" as const) : ("recovery" as const),
		}
		try {
			const pullResult = await recovery.owner.recover({
				...recovery.payload,
				conversationId: recovery.owner.conversationId,
				syncGeneration: recovery.generation,
			})
			if (!this.isRecoveryCurrent(recovery)) return
			if (!this.store.isTopicSyncCurrent(recovery.topicId, recovery.generation)) return

			const taskStatus = recovery.owner.getTaskStatus()
			if (!pullResult.didPullSucceed) {
				this.store.completeTopicSync(recovery.topicId, recovery.generation, {
					succeeded: false,
					taskStatus,
					...lifecycleContext,
				})
				if (this.isRetryableRecovery(recovery.payload)) {
					this.scheduleRetry(recovery, scheduled)
				}
				return
			}

			this.store.completeTopicSync(recovery.topicId, recovery.generation, {
				succeeded: true,
				taskStatus,
				latestSeqId: this.store.getLatestMessageSeqId(recovery.topicId),
				...lifecycleContext,
			})
			// Any successful authoritative pull can race role=tool persistence. Re-check the
			// canonical Tool sidecar even when the original trigger was a WS watermark, then
			// continue through the same bounded Tool recovery budget if the response is absent.
			const pendingToolRecovery = this.store.resolveStreamRecoveryRequest?.({
				...recovery.payload,
				reason: "tool_response",
			})
			if (pendingToolRecovery && scheduled) {
				scheduled.payload = mergeRecoveryPayload(recovery.payload, pendingToolRecovery)
				this.store.markToolResponseRecoveryAwaitingResponse?.(recovery.topicId)
				this.scheduleRetry(recovery, scheduled)
			} else if (!scheduled?.rerunNeeded) {
				this.clearScheduledRecovery(recovery.topicId)
			}
		} catch {
			if (this.isRecoveryCurrent(recovery)) {
				this.store.cancelTopicSync(recovery.topicId, recovery.generation)
			}
			this.store.markToolResponseRecoveryAwaitingResponse?.(recovery.topicId)
			if (this.isRetryableRecovery(recovery.payload)) this.scheduleRetry(recovery, scheduled)
		} finally {
			if (this.inFlightRecoveries.get(recovery.topicId) === recovery) {
				this.inFlightRecoveries.delete(recovery.topicId)
			}
			if (scheduled?.rerunNeeded) {
				if (scheduled.timer) clearTimeout(scheduled.timer)
				scheduled.timer = null
				scheduled.rerunNeeded = false
				this.scheduleRecovery(scheduled, 0)
			}
		}
	}

	private scheduleRetry(recovery: InFlightRecovery, scheduled?: ScheduledRecovery) {
		if (!scheduled || this.scheduledRecoveries.get(recovery.topicId) !== scheduled) return
		const nextAttempt = scheduled.attempt + 1
		if (nextAttempt > this.retryDelaysMs.length) {
			this.store.markToolResponseRecoveryDormant?.(recovery.topicId)
			this.clearScheduledRecovery(recovery.topicId)
			return
		}
		scheduled.attempt = nextAttempt
		this.scheduleRecovery(scheduled, this.retryDelaysMs[nextAttempt - 1])
	}

	private isRetryableRecovery(payload: StreamRecoveryRequestPayload) {
		return (
			payload.reason === "tool_response" ||
			payload.reason === "persistent_message" ||
			payload.reason === "checkpoint_rollback"
		)
	}
}

function compareRecoverySeqId(left?: string, right?: string) {
	if (!left) return right ? -1 : 0
	if (!right) return 1
	const leftDigits = left.replace(/^0+(?=\d)/, "")
	const rightDigits = right.replace(/^0+(?=\d)/, "")
	if (/^\d+$/.test(leftDigits) && /^\d+$/.test(rightDigits)) {
		if (leftDigits.length !== rightDigits.length) return leftDigits.length - rightDigits.length
	}
	return leftDigits.localeCompare(rightDigits)
}

function mergeRecoveryPayload(
	current: StreamRecoveryRequestPayload,
	incoming: StreamRecoveryRequestPayload,
	options: { preserveCheckpointPriority?: boolean } = {},
): StreamRecoveryRequestPayload {
	const incomingHasAnchor = Boolean(incoming.anchorSeqId || incoming.anchorAppMessageId)
	const currentHasAnchor = Boolean(current.anchorSeqId || current.anchorAppMessageId)
	const anchorIsEarlier =
		incomingHasAnchor &&
		(!currentHasAnchor || compareRecoverySeqId(incoming.anchorSeqId, current.anchorSeqId) < 0)
	const checkpointPriorityPayload = options.preserveCheckpointPriority
		? incoming.reason === "checkpoint_rollback"
			? incoming
			: current.reason === "checkpoint_rollback"
				? current
				: undefined
		: undefined
	return {
		...current,
		...incoming,
		...(current.correlationId && !incoming.correlationId
			? { correlationId: current.correlationId }
			: {}),
		// 非 checkpoint 触发器合并进来时，仍需保留最近一次 checkpoint 的动作语义。
		...(current.checkpointRollback && !incoming.checkpointRollback
			? { checkpointRollback: current.checkpointRollback }
			: {}),
		// 状态撤销/删除需要完整快照；同一防抖窗口内的普通消息水位不能将其降级为尾部对账。
		...(checkpointPriorityPayload
			? {
					reason: "checkpoint_rollback" as const,
					correlationId: checkpointPriorityPayload.correlationId,
					checkpointRollback: checkpointPriorityPayload.checkpointRollback,
				}
			: {}),
		...(anchorIsEarlier
			? {
					anchorAppMessageId: incoming.anchorAppMessageId,
					anchorSeqId: incoming.anchorSeqId,
				}
			: {
					anchorAppMessageId: current.anchorAppMessageId || incoming.anchorAppMessageId,
					anchorSeqId: current.anchorSeqId || incoming.anchorSeqId,
				}),
		...(compareRecoverySeqId(incoming.requiredSeqId, current.requiredSeqId) > 0
			? { requiredSeqId: incoming.requiredSeqId }
			: {}),
	}
}

const streamRecoveryCoordinator = new StreamRecoveryCoordinator(superMagicStore)

export function registerStreamRecoveryOwner(registration: StreamRecoveryOwnerRegistration) {
	return streamRecoveryCoordinator.registerOwner(registration)
}

export function requestTopicRecovery(payload: StreamRecoveryRequestPayload) {
	streamRecoveryCoordinator.requestRecovery(payload)
}

export function getTopicRecoveryStatus(topicId: string) {
	return streamRecoveryCoordinator.getTopicRecoveryStatus(topicId)
}

export function resumeTopicRecovery(topicId: string) {
	streamRecoveryCoordinator.resumeTopicRecovery(topicId)
}

export function acknowledgeTopicSync(topicId: string, latestSeqId?: string) {
	streamRecoveryCoordinator.acknowledgeTopicSync(topicId, latestSeqId)
}
