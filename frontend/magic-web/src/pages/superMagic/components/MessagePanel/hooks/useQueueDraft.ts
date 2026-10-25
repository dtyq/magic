import { useEffect, useRef, useState, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import { cloneDeep, isEqual } from "lodash-es"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import { userStore } from "@/models/user"
import MagicModal from "@/components/base/MagicModal"
import magicToast from "@/components/base/MagicToaster/utils"
import { getNetworkMonitor } from "@/services/recordSummary/NetworkMonitor"
import type {
	MessageEditorRef,
	QueueDraftSnapshot,
	QueueMessageInput,
} from "../../MessageEditor/types"
import type { QueuedMessage } from "./useMessageQueue"

interface UseQueueDraftOptions {
	projectId?: string
	topicId?: string
	editorRef: RefObject<MessageEditorRef | null>
	queueRef: RefObject<QueuedMessage[]>
	acquireLock: (id: string) => boolean
	releaseLock: (id: string) => void
	findLocalQueueItem: (id: string) => QueuedMessage | undefined
	finalizeLocalRemoval: (id: string) => Promise<void>
	resumeLocalQueue: () => void
	removeForDraft: (item: QueuedMessage) => Promise<void>
	fetchQueueList: () => Promise<QueuedMessage[] | undefined>
	serialize: (input: QueueMessageInput, syncId: string) => Record<string, unknown>
}

/** 协调队列与编辑器，所有可恢复内容仍由既有 DraftStore 持有。 */
export default function useQueueDraft({
	projectId,
	topicId,
	editorRef,
	queueRef,
	acquireLock,
	releaseLock,
	removeForDraft,
	findLocalQueueItem,
	finalizeLocalRemoval,
	resumeLocalQueue,
	fetchQueueList,
	serialize,
}: UseQueueDraftOptions) {
	const { t } = useTranslation("super")
	const [queueDraft, setQueueDraft] = useState<QueueDraftSnapshot | null>(null)
	const [isQueueOperationPending, setIsQueueOperationPending] = useState(false)
	const pendingRef = useRef(false)
	const unsubscribeRef = useRef<(() => void) | undefined>()
	const appliedModelDraftRef = useRef<string>()
	const scope = `${userStore.user.userInfo?.organization_code}/${userStore.user.userInfo?.user_id}/${projectId}/${topicId}`
	const scopeRef = useRef(scope)
	scopeRef.current = scope

	const onEditorReady = useMemoizedFn(() => {
		unsubscribeRef.current?.()
		unsubscribeRef.current = editorRef.current?.subscribeQueueDraft((draft) => {
			setQueueDraft(draft)
			if (!draft) appliedModelDraftRef.current = undefined
			if (draft?.queueDraft.localSource && draft.queueDraft.phase !== "removing")
				void finalizeLocalRemoval(draft.queueDraft.sourceId).catch(() => undefined)
			const editor = editorRef.current
			if (editor?.editor && !editor.editor.isDestroyed) {
				// 只有确认移除后才能编辑这条消息；结果未知时允许重试确认。
				editor.editor.setEditable(draft?.queueDraft.phase !== "removing")
			}
			if (draft && appliedModelDraftRef.current !== draft.queueDraft.clientSyncId) {
				appliedModelDraftRef.current = draft.queueDraft.clientSyncId
				editor?.setModels({
					languageModel: draft.queueDraft.selectedModel,
					imageModel: draft.queueDraft.selectedImageModel,
					videoModel: draft.queueDraft.selectedVideoModel,
				})
			}
		})
	})

	useEffect(() => {
		setQueueDraft(null)
		appliedModelDraftRef.current = undefined
		onEditorReady()
		return () => {
			unsubscribeRef.current?.()
		}
	}, [scope, onEditorReady])

	const takeOutQueueItem = useMemoizedFn(
		async (id: string, returnPosition: "original" | "tail") => {
			const editor = editorRef.current
			const key = editor?.getDraftKey()
			let item = queueRef.current?.find((message) => message.id === id)
			if (
				!editor ||
				!key ||
				!item ||
				!userStore.user.userInfo?.user_id ||
				!userStore.user.userInfo?.organization_code ||
				key.projectId !== projectId ||
				key.topicId !== topicId
			) {
				magicToast.warning(t("messageQueue.editorNotReady"))
				return
			}
			if (
				pendingRef.current ||
				item.status !== "pending" ||
				item.syncState === "submitted" ||
				!acquireLock(id)
			) {
				magicToast.warning(t("messageQueue.operationInProgress"))
				return
			}
			pendingRef.current = true
			setIsQueueOperationPending(true)
			const operationScope = scopeRef.current
			let switching = false
			try {
				switching = await editor.beginDraftSwitch()
				if (!switching || operationScope !== scopeRef.current) return
				item = queueRef.current?.find((message) => message.id === id)
				if (!item || item.status !== "pending" || item.syncState === "submitted")
					throw new Error("queue_source_unavailable")
				const previousValue = cloneDeep(editor.getValue())
				const pending = (queueRef.current ?? []).filter(
					(message) => message.status === "pending",
				)
				const index = pending.findIndex((message) => message.id === id)
				const { content, mentionItems, ...source } = item
				const snapshot: QueueDraftSnapshot = {
					...key,
					value: cloneDeep(content),
					mentionItems: cloneDeep(mentionItems),
					queueDraft: {
						selectedModel: source.selectedModel,
						selectedImageModel: source.selectedImageModel,
						selectedVideoModel: source.selectedVideoModel,
						topicMode: source.topicMode,
						agentCode: source.agentCode,
						dynamicParams: source.dynamicParams,
						sourceId: id,
						userId: userStore.user.userInfo?.user_id ?? "",
						organizationCode: userStore.user.userInfo?.organization_code ?? "",
						returnPosition,
						beforeId:
							pending.slice(index + 1).find((message) => !message.syncState)?.id ??
							null,
						afterId:
							pending
								.slice(0, index)
								.reverse()
								.find((message) => !message.syncState)?.id ?? null,
						originalIndex: index,
						phase: "removing",
						clientSyncId: crypto.randomUUID(),
						expectedSyncId: item.clientSyncId ?? "",
						localSource: item.syncState === "local",
					},
				}
				await editor.prepareQueueDraft(snapshot)
				if (operationScope !== scopeRef.current) return
				await removeForDraft(item)
				snapshot.queueDraft.phase = "detached"
				const activate =
					operationScope === scopeRef.current && isEqual(previousValue, editor.getValue())
				const result = await editor.restoreQueueDraft(snapshot, activate)
				if (operationScope === scopeRef.current && snapshot.queueDraft.localSource)
					await finalizeLocalRemoval(id)
				if (result === "saved" && operationScope === scopeRef.current)
					MagicModal.info({ content: t("messageQueue.savedToDraftBox"), centered: true })
				await fetchQueueList()
			} catch {
				if (operationScope === scopeRef.current)
					magicToast.error(t("messageQueue.takeOutFailed"))
			} finally {
				if (switching) editor.endDraftSwitch()
				releaseLock(id)
				pendingRef.current = false
				setIsQueueOperationPending(false)
				if (operationScope === scopeRef.current) resumeLocalQueue()
			}
		},
	)

	const retryQueueDraftRemoval = useMemoizedFn(async () => {
		const editor = editorRef.current
		const draft = editor?.getQueueDraft()
		if (!editor || !draft || draft.queueDraft.phase !== "removing" || pendingRef.current) return
		const { sourceId, expectedSyncId, localSource } = draft.queueDraft
		const operationScope = scopeRef.current
		if (!acquireLock(sourceId)) return
		pendingRef.current = true
		setIsQueueOperationPending(true)
		let metadata = draft.queueDraft
		try {
			if (localSource) {
				const item =
					findLocalQueueItem(sourceId) ??
					queueRef.current?.find(
						(message) => !message.syncState && message.clientSyncId === expectedSyncId,
					)
				if (!item) throw new Error("local_queue_source_unconfirmed")
				await removeForDraft(item)
				if (!item.syncState)
					metadata = {
						...metadata,
						sourceId: item.id,
						localSource: false,
						expectedSyncId: item.clientSyncId ?? "",
					}
			} else {
				const result = await SuperMagicApi.deleteQueueMessage({
					messageId: sourceId,
					expectedSyncId,
				})
				if (!result.removed) throw new Error("queue_source_not_removed")
			}
			await editor.restoreQueueDraft({
				...draft,
				queueDraft: { ...metadata, phase: "detached" },
			})
			if (localSource && operationScope === scopeRef.current)
				await finalizeLocalRemoval(sourceId)
			await fetchQueueList()
		} catch {
			if (operationScope === scopeRef.current)
				magicToast.error(t("messageQueue.takeOutFailed"))
		} finally {
			releaseLock(sourceId)
			pendingRef.current = false
			setIsQueueOperationPending(false)
			if (operationScope === scopeRef.current) resumeLocalQueue()
		}
	})

	const finishEditQueueItem = useMemoizedFn(
		async (input: QueueMessageInput): Promise<boolean> => {
			const editor = editorRef.current
			const draft = editor?.getQueueDraft()
			if (
				!editor ||
				!draft ||
				draft.projectId !== projectId ||
				draft.topicId !== topicId ||
				pendingRef.current
			)
				return false
			if (draft.queueDraft.phase === "removing") {
				await retryQueueDraftRemoval()
				return false
			}
			if (getNetworkMonitor().isNetworkOffline()) {
				magicToast.warning(t("messageQueue.requeueNeedsNetwork"))
				return false
			}
			pendingRef.current = true
			setIsQueueOperationPending(true)
			const operationScope = scopeRef.current
			const editorValue = cloneDeep(editor.getValue())
			const metadata = draft.queueDraft
			const submitted =
				metadata.submission ??
				cloneDeep({
					...input,
					dynamicParams: input.dynamicParams ?? metadata.dynamicParams,
				})
			const submitting: QueueDraftSnapshot = {
				...draft,
				queueDraft: { ...metadata, phase: "submitting", submission: submitted },
			}
			try {
				await editor.restoreQueueDraft(submitting, false)
				if (operationScope !== scopeRef.current) return false
				const messageContent = serialize(submitted, metadata.clientSyncId)
				let originalUnavailable = false
				if (metadata.returnPosition === "original" && !metadata.localSource) {
					const result = await SuperMagicApi.restoreQueueMessage({
						messageId: metadata.sourceId,
						project_id: draft.projectId,
						topic_id: draft.topicId,
						message_type: "rich_text",
						message_content: messageContent,
						before_id: metadata.beforeId,
						after_id: metadata.afterId,
						original_index: metadata.originalIndex,
						expected_sync_id: metadata.expectedSyncId,
					})
					originalUnavailable = result.result === "original_unavailable"
				}
				if (
					metadata.returnPosition === "tail" ||
					metadata.localSource ||
					originalUnavailable
				) {
					const result = await SuperMagicApi.addMessageToQueue({
						project_id: draft.projectId,
						topic_id: draft.topicId,
						message_type: "rich_text",
						message_content: messageContent,
						process_immediately: true,
					})
					if (!result.queue_id) throw new Error("queue_submission_unconfirmed")
				}
				if (operationScope !== scopeRef.current) return false
				// 重试旧请求成功时，当前输入可能已修改；只有仍是本次提交原文才允许清空。
				const unchangedSubmission =
					!metadata.submission || isEqual(metadata.submission, input)
				const shouldClear = await editor.completeQueueDraft(
					metadata.clientSyncId,
					unchangedSubmission ? editorValue : undefined,
				)
				magicToast.success(
					originalUnavailable ||
						(metadata.localSource && metadata.returnPosition === "original")
						? t("messageQueue.originalUnavailable")
						: t("messageQueue.addSuccess"),
				)
				void fetchQueueList()
				return shouldClear
			} catch {
				const current = editor.getQueueDraft()
				if (
					operationScope === scopeRef.current &&
					current?.queueDraft.clientSyncId === metadata.clientSyncId
				) {
					try {
						await editor.restoreQueueDraft(
							{
								...current,
								queueDraft: { ...submitting.queueDraft, phase: "unconfirmed" },
							},
							false,
						)
					} catch {
						/* 初始提交快照已保存；保留它用于确认结果，不自动重发。 */
					}
					magicToast.error(t("messageQueue.requeueUnconfirmed"))
				}
				return false
			} finally {
				pendingRef.current = false
				setIsQueueOperationPending(false)
			}
		},
	)

	const cancelEditQueueItem = useMemoizedFn(async () => {
		if (pendingRef.current) return
		try {
			await editorRef.current?.keepQueueDraft()
		} catch {
			magicToast.error(t("messageQueue.draftSaveFailed"))
		}
	})

	const editingQueueItem: QueuedMessage | null = queueDraft
		? {
				...queueDraft.queueDraft,
				id: queueDraft.queueDraft.sourceId,
				content: queueDraft.value ?? { type: "doc", content: [] },
				mentionItems: queueDraft.mentionItems,
				selectedModel: queueDraft.queueDraft.selectedModel ?? undefined,
				selectedImageModel: queueDraft.queueDraft.selectedImageModel ?? undefined,
				selectedVideoModel: queueDraft.queueDraft.selectedVideoModel ?? undefined,
				agentCode: queueDraft.queueDraft.agentCode ?? undefined,
				timestamp: 0,
				status: "pending",
			}
		: null

	return {
		queueDraft,
		editingQueueItem,
		isQueueOperationPending,
		onEditorReady,
		retryQueueDraftRemoval,
		startEditQueueItem: useMemoizedFn((id: string) => takeOutQueueItem(id, "original")),
		withdrawQueueItem: useMemoizedFn((id: string) => takeOutQueueItem(id, "tail")),
		finishEditQueueItem,
		cancelEditQueueItem,
	}
}
