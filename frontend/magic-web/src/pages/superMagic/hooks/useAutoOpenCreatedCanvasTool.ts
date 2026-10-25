import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { superMagicStore } from "@/pages/superMagic/stores"
import type { MagicProjectAttachmentFile } from "../components/MessageList/components/MessageAttachment/utils"
import type { OpenFileTabRecord } from "../events/openFileTab"
import { waitForNextAttachmentsRefreshForProject } from "../services/attachmentsTopicSync"
import {
	isCreateCanvasToolResult,
	normalizeCanvasProjectPath,
	readToolResultProjectPath,
} from "../utils/canvasToolResult"

const PENDING_INTENT_TTL_MS = 60_000
const MAX_ATTACHMENT_REFRESH_ATTEMPTS = 2
const REFRESH_RETRY_DELAY_MS = 1_000

interface AutoOpenCreatedCanvasToolParams {
	topicId?: string
	projectId?: string
	activeFileId?: string | null
	hasActiveDetailTab?: boolean
	getActiveFileId?: () => string | null | undefined
	attachments?: MagicProjectAttachmentFile[]
	attachmentList?: MagicProjectAttachmentFile[]
	scheduleWhenTabsCacheReady: (callback: () => void, channel?: string) => void
}

interface PendingCanvasOpenIntent {
	key: string
	topicId: string
	projectId: string
	projectPath: string
	expiresAt: number
	refreshAttempts: number
	refreshInFlight: boolean
	scheduledForOpen: boolean
}

export type CreatedCanvasResolution =
	| { status: "ready"; canvasDirectory: MagicProjectAttachmentFile }
	| { status: "missing" | "not-canvas" | "unresolved" }

function normalizeComparablePath(path: unknown): string {
	return typeof path === "string" ? path.trim().replace(/\\/g, "/").replace(/^\/+/, "") : ""
}

function findDirectoryByPath(
	items: MagicProjectAttachmentFile[] | undefined,
	expectedPath: string,
): MagicProjectAttachmentFile | undefined {
	for (const item of items || []) {
		if (
			item.is_directory === true &&
			normalizeComparablePath(item.relative_file_path).replace(/\/+$/, "") === expectedPath
		) {
			return item
		}
		const nested = findDirectoryByPath(item.children, expectedPath)
		if (nested) return nested
	}
	return undefined
}

/** Resolve only file metadata. Canvas files are never read while matching the tool result. */
export function resolveCreatedCanvasDirectory(options: {
	projectPath?: string
	attachmentList?: MagicProjectAttachmentFile[]
	attachments?: MagicProjectAttachmentFile[]
}): CreatedCanvasResolution {
	const expectedPath = normalizeCanvasProjectPath(options.projectPath)
	if (!expectedPath) return { status: "missing" }

	const canvasDirectory =
		findDirectoryByPath(options.attachmentList, expectedPath) ||
		findDirectoryByPath(options.attachments, expectedPath)
	if (!canvasDirectory) return { status: "unresolved" }
	if (
		canvasDirectory.file_id === undefined ||
		canvasDirectory.file_id === null ||
		canvasDirectory.display_config?.type !== "design"
	) {
		return { status: "not-canvas" }
	}
	return { status: "ready", canvasDirectory }
}

function readActiveFileId(
	params: AutoOpenCreatedCanvasToolParams,
	activeFileIdRef: { current: string | null | undefined },
): string | null {
	const latestActiveFileId = params.getActiveFileId?.()
	if (latestActiveFileId !== undefined) return latestActiveFileId
	return activeFileIdRef.current ?? params.activeFileId ?? null
}

function hasActivePreview(
	params: AutoOpenCreatedCanvasToolParams,
	activeFileIdRef: { current: string | null | undefined },
) {
	return Boolean(params.hasActiveDetailTab) || readActiveFileId(params, activeFileIdRef) !== null
}

/** Open a newly created Canvas tool result while no project detail tab is active. */
export function useAutoOpenCreatedCanvasTool({
	topicId,
	projectId,
	activeFileId,
	hasActiveDetailTab,
	getActiveFileId,
	attachments,
	attachmentList,
	scheduleWhenTabsCacheReady,
}: AutoOpenCreatedCanvasToolParams) {
	const paramsRef = useRef<AutoOpenCreatedCanvasToolParams>({
		topicId,
		projectId,
		activeFileId,
		hasActiveDetailTab,
		getActiveFileId,
		attachments,
		attachmentList,
		scheduleWhenTabsCacheReady,
	})
	paramsRef.current = {
		topicId,
		projectId,
		activeFileId,
		hasActiveDetailTab,
		getActiveFileId,
		attachments,
		attachmentList,
		scheduleWhenTabsCacheReady,
	}

	const activeFileIdRef = useRef<string | null | undefined>(activeFileId)
	activeFileIdRef.current = activeFileId
	const pendingIntentRef = useRef<PendingCanvasOpenIntent | null>(null)
	const intentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const abortControllerRef = useRef<AbortController | null>(null)
	const reconcileRef = useRef<() => void>(() => undefined)

	const isCurrentIntent = useMemoizedFn(
		(intent: PendingCanvasOpenIntent) => pendingIntentRef.current === intent,
	)

	const clearPendingIntent = useMemoizedFn((key?: string) => {
		const intent = pendingIntentRef.current
		if (!intent || (key && intent.key !== key)) return
		if (intentTimerRef.current) clearTimeout(intentTimerRef.current)
		intentTimerRef.current = null
		pendingIntentRef.current = null
	})

	const isSameProjectScope = useMemoizedFn((intent: PendingCanvasOpenIntent) => {
		const currentParams = paramsRef.current
		return (
			currentParams.topicId === intent.topicId && currentParams.projectId === intent.projectId
		)
	})

	const openIntent = useMemoizedFn((intent: PendingCanvasOpenIntent) => {
		const currentParams = paramsRef.current
		if (
			!isCurrentIntent(intent) ||
			intent.expiresAt <= Date.now() ||
			!isSameProjectScope(intent)
		) {
			clearPendingIntent(intent.key)
			return
		}
		if (hasActivePreview(currentParams, activeFileIdRef)) {
			clearPendingIntent(intent.key)
			return
		}

		const resolution = resolveCreatedCanvasDirectory({
			projectPath: intent.projectPath,
			attachmentList: currentParams.attachmentList,
			attachments: currentParams.attachments,
		})
		if (resolution.status !== "ready") {
			intent.scheduledForOpen = false
			reconcileRef.current()
			return
		}
		if (hasActivePreview(currentParams, activeFileIdRef)) {
			clearPendingIntent(intent.key)
			return
		}

		const target = resolution.canvasDirectory
		pubsub.publish(PubSubEvents.Switch_Detail_Mode, "files")
		pubsub.publish(PubSubEvents.Open_File_Tab, {
			fileId: String(target.file_id),
			fileData: target as OpenFileTabRecord,
		})
		clearPendingIntent(intent.key)
	})

	const scheduleReconcile = useMemoizedFn((delayMs = 0) => {
		if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current)
		reconcileTimerRef.current = setTimeout(() => {
			reconcileTimerRef.current = null
			reconcileRef.current()
		}, delayMs)
	})

	const requestRefresh = useMemoizedFn((intent: PendingCanvasOpenIntent) => {
		if (
			!isCurrentIntent(intent) ||
			intent.refreshInFlight ||
			intent.refreshAttempts >= MAX_ATTACHMENT_REFRESH_ATTEMPTS
		) {
			return
		}
		intent.refreshInFlight = true
		intent.refreshAttempts += 1
		const abortController = abortControllerRef.current
		void waitForNextAttachmentsRefreshForProject(intent.projectId, {
			signal: abortController?.signal,
		})
			.then(() => {
				if (!isCurrentIntent(intent) || abortController?.signal.aborted) return
				intent.refreshInFlight = false
				if (intent.refreshAttempts < MAX_ATTACHMENT_REFRESH_ATTEMPTS) {
					scheduleReconcile(REFRESH_RETRY_DELAY_MS)
				}
			})
			.catch(() => {
				if (!isCurrentIntent(intent) || abortController?.signal.aborted) return
				intent.refreshInFlight = false
				if (intent.refreshAttempts < MAX_ATTACHMENT_REFRESH_ATTEMPTS) {
					scheduleReconcile(REFRESH_RETRY_DELAY_MS)
				}
			})
	})

	const reconcilePendingIntent = useMemoizedFn(() => {
		const intent = pendingIntentRef.current
		if (!intent) return
		const currentParams = paramsRef.current
		const resolution = resolveCreatedCanvasDirectory({
			projectPath: intent.projectPath,
			attachmentList: currentParams.attachmentList,
			attachments: currentParams.attachments,
		})
		if (
			intent.expiresAt <= Date.now() ||
			!isSameProjectScope(intent) ||
			hasActivePreview(currentParams, activeFileIdRef)
		) {
			clearPendingIntent(intent.key)
			return
		}
		if (intent.scheduledForOpen) return

		if (resolution.status !== "ready") {
			requestRefresh(intent)
			return
		}

		intent.scheduledForOpen = true
		currentParams.scheduleWhenTabsCacheReady(
			() => openIntent(intent),
			`auto-open-created-canvas-${intent.key}`,
		)
	})
	reconcileRef.current = reconcilePendingIntent

	useEffect(() => {
		reconcilePendingIntent()
	}, [
		activeFileId,
		attachmentList,
		attachments,
		hasActiveDetailTab,
		projectId,
		reconcilePendingIntent,
		topicId,
	])

	useEffect(() => {
		if (!topicId || !projectId) return
		const abortController = new AbortController()
		abortControllerRef.current = abortController
		const handledToolKeys = new Set<string>()
		const unsubscribe = superMagicStore.subscribe(
			"toolCall.settled",
			(event) => {
				const eligible = isCreateCanvasToolResult(event)
				const activePreview = hasActivePreview(paramsRef.current, activeFileIdRef)
				if (!eligible || activePreview) {
					return
				}
				const projectPath = readToolResultProjectPath(event)
				const toolCallId = event.payload.toolCall.id.trim()
				if (!projectPath || !toolCallId) return

				const key = `${topicId}:${toolCallId}`
				if (handledToolKeys.has(key)) return
				handledToolKeys.add(key)

				clearPendingIntent()
				const intent: PendingCanvasOpenIntent = {
					key,
					topicId,
					projectId,
					projectPath,
					expiresAt: Date.now() + PENDING_INTENT_TTL_MS,
					refreshAttempts: 0,
					refreshInFlight: false,
					scheduledForOpen: false,
				}
				pendingIntentRef.current = intent
				intentTimerRef.current = setTimeout(
					() => clearPendingIntent(key),
					PENDING_INTENT_TTL_MS,
				)
				reconcilePendingIntent()
			},
			{ scope: { topicId } },
		)

		return () => {
			abortController.abort()
			unsubscribe()
			if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current)
			reconcileTimerRef.current = null
			clearPendingIntent()
			abortControllerRef.current = null
		}
	}, [clearPendingIntent, projectId, reconcilePendingIntent, scheduleReconcile, topicId])
}
