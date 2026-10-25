import { SuperMagicApi } from "@/apis"
import {
	ProjectStatus,
	TaskStatus,
	WorkspaceStatus,
	type ProjectListItem,
	type Topic,
	type Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { superMagicStore } from "@/pages/superMagic/stores"
import projectStore from "@/pages/superMagic/stores/core/project"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import {
	isTopicTerminalTaskStatus,
	type TopicReadProgressPayload,
} from "./topicReadProgressService"

const TERMINAL_TOPIC_TASK_STATUSES = new Set<TaskStatus>([
	TaskStatus.FINISHED,
	TaskStatus.ERROR,
	TaskStatus.SUSPENDED,
])

function resolveTopicTaskStatus(topic?: Pick<Topic, "task_status"> | null) {
	return topic?.task_status || (topic as Topic & { status?: TaskStatus })?.status
}

function isExplicitNonTerminalTopicTaskStatus(status?: TaskStatus) {
	return (
		status === TaskStatus.RUNNING ||
		status === TaskStatus.WAITING ||
		status === TaskStatus.WAITING_FOR_USER
	)
}

function isTerminalTopicTaskStatus(status?: TaskStatus) {
	return Boolean(status && TERMINAL_TOPIC_TASK_STATUSES.has(status))
}

function hasActiveTopicExecution(chatTopicId: string) {
	const topicMeta = superMagicStore.topicMeta.get(chatTopicId)
	const hasBufferedMessages = (superMagicStore.buffer.get(chatTopicId)?.messages?.length ?? 0) > 0
	return (
		hasBufferedMessages ||
		superMagicStore.hasPendingTopicExecution?.(chatTopicId) ||
		superMagicStore.isTopicStreaming?.(chatTopicId) ||
		Boolean(topicMeta?.isStream) ||
		Boolean(topicMeta?.isStreamLoading)
	)
}

interface OptimisticTopicRunningStateParams {
	topicStore: TopicStore
	topic?: Topic | null
	project?: ProjectListItem | null
	workspace?: Workspace | null
}

interface TopicReadProgressMarker {
	markTopicReadProgress: (payload: TopicReadProgressPayload) => void
}

interface ArrivedTopicStatusChangeParams {
	scopeName: string
	topicStore: TopicStore
	topicReadProgressService: TopicReadProgressMarker
	currentTopicStatusRef: { current: TaskStatus | undefined }
	nextStatus?: TaskStatus
	topicId: string
	lastReadAt?: string
	lastReadMessageId?: string
	onTopicStatusChanged?: (nextStatus: TaskStatus, topicId: string) => void
	terminalReadDelayMs?: number
}

/** 将后端最新 topic 状态补丁合并回指定 store，保证 scoped store 与 UI 同步。 */
export async function syncTopicStatusPatch({
	topicStore,
	topicId,
	localTaskStatus,
}: {
	topicStore: TopicStore
	topicId: string
	localTaskStatus?: TaskStatus
}) {
	if (!topicId) return

	const statusResponse = await SuperMagicApi.getTopicsStatus({ topic_ids: [topicId] })
	const statusItem = statusResponse.topics?.[0] || statusResponse.list?.[0]
	if (!statusItem) return

	const nextStatus = statusItem.status as TaskStatus
	const latestLocalStatus = localTaskStatus ?? resolveTopicTaskStatus(topicStore.selectedTopic)
	if (latestLocalStatus === TaskStatus.RUNNING && nextStatus === TaskStatus.WAITING) return

	topicStore.mergeTopic(topicId, {
		task_status: nextStatus,
		status: nextStatus,
		has_unread: statusItem.has_unread,
	})
}

/**
 * 判断前台消息 HTTP 对账后是否需要补拉话题状态。
 * 消息层与 topicStore.task_status 解耦，Tab 切回时常见“消息已终态、UI 仍 RUNNING”。
 */
export function shouldSyncTopicStatusAfterForegroundMessageReconciliation({
	chatTopicId,
	localTaskStatus,
}: {
	chatTopicId?: string
	localTaskStatus?: TaskStatus
}) {
	if (!chatTopicId || (typeof document !== "undefined" && document.visibilityState !== "visible"))
		return false

	if (isExplicitNonTerminalTopicTaskStatus(localTaskStatus)) return true

	if (!localTaskStatus || isTerminalTopicTaskStatus(localTaskStatus)) return false

	return !hasActiveTopicExecution(chatTopicId)
}

/** 前台消息对账完成后，用服务端话题状态补丁收敛本地 stale task_status。 */
export async function syncTopicStatusAfterForegroundMessageReconciliation({
	topicStore,
	topicId,
	chatTopicId,
	localTaskStatus,
}: {
	topicStore: TopicStore
	topicId?: string
	chatTopicId?: string
	localTaskStatus?: TaskStatus
}) {
	if (!topicId || !chatTopicId) return
	if (
		!shouldSyncTopicStatusAfterForegroundMessageReconciliation({
			chatTopicId,
			localTaskStatus,
		})
	)
		return

	await syncTopicStatusPatch({
		topicStore,
		topicId,
		localTaskStatus,
	})
}

/** 发送前先把当前话题及其关联资源乐观标记为运行中，减少低频轮询窗口中的状态滞后。 */
export function applyOptimisticTopicRunningState({
	topicStore,
	topic,
	project,
	workspace,
}: OptimisticTopicRunningStateParams) {
	if (topic?.id) {
		topicStore.mergeTopic(topic.id, {
			task_status: TaskStatus.RUNNING,
			status: TaskStatus.RUNNING,
		})
	}

	if (workspace?.id) {
		workspaceStore.applyWorkspaceStatusPatches([
			{ id: workspace.id, status: WorkspaceStatus.RUNNING },
		])
	}

	if (project?.id) {
		projectStore.applyProjectStatusPatches([{ id: project.id, status: ProjectStatus.RUNNING }])
	}
}

export function shouldCheckAttachmentsOnTaskStatus(status?: TaskStatus): boolean {
	return (
		status === TaskStatus.FINISHED ||
		status === TaskStatus.ERROR ||
		status === TaskStatus.SUSPENDED
	)
}

/**
 * 统一处理消息到达后的话题状态收敛：先本地更新状态，再同步 unread，终态时补记一次即时已读。
 */
export function handleArrivedTopicStatusChange({
	scopeName,
	topicStore,
	topicReadProgressService,
	currentTopicStatusRef,
	nextStatus,
	topicId,
	lastReadAt,
	lastReadMessageId,
	onTopicStatusChanged,
	terminalReadDelayMs = 1000,
}: ArrivedTopicStatusChangeParams) {
	if (!nextStatus || !topicId) return false

	const latestTopicStatus = currentTopicStatusRef.current
	// 状态不应出现从 RUNNING 回退到 WAITING 的情况（避免前端乐观更新与后端实际状态短暂没对齐）
	const shouldPreventStatusFallback =
		latestTopicStatus === TaskStatus.RUNNING && nextStatus === TaskStatus.WAITING
	if (shouldPreventStatusFallback) return false
	const hasStatusChanged = nextStatus !== latestTopicStatus
	if (!hasStatusChanged) return false

	currentTopicStatusRef.current = nextStatus
	topicStore.mergeTopic(topicId, {
		task_status: nextStatus,
		status: nextStatus,
	})
	onTopicStatusChanged?.(nextStatus, topicId)

	const shouldMarkImmediateRead =
		document.visibilityState === "visible" && isTopicTerminalTaskStatus(nextStatus)
	const syncPromise = syncTopicStatusPatch({
		topicStore,
		topicId,
	}).catch((error) => {
		console.warn(`[${scopeName}] 同步话题 unread 状态失败:`, error)
	})

	if (shouldMarkImmediateRead) {
		void syncPromise.finally(() => {
			setTimeout(() => {
				topicReadProgressService.markTopicReadProgress({
					topicId,
					lastReadAt,
					lastReadMessageId,
					reason: "message-change",
					immediate: true,
					allowWithoutUnreadCheck: true,
				})
			}, terminalReadDelayMs)
		})
	}

	return true
}
