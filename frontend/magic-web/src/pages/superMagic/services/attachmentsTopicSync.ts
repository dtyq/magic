import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { SuperMagicUpdateAttachmentsPayload } from "../events/files"

/**
 * Works with the main Update_Attachments -> loadProjectAttachments flow:
 * - 等待方：waitForNext… / registerWaitForNext… 入队
 * - 完成方：拉附件的 Promise 应用 {@link withAttachmentsRefreshWaitersResolved}，在 settled 后统一 resolve
 * 避免各页在 finally/catch 重复调用 resolve，也避免依赖 Update_Attachments_Loading 边沿。
 */

export type SuperMagicUpdateAttachmentsRequest =
	SuperMagicUpdateAttachmentsPayload | (() => void) | undefined

interface WaitEntry {
	projectId: string
	resolve: (didLoad: boolean) => void
	timeoutId: ReturnType<typeof setTimeout>
}

export function requestProjectAttachmentsFullRefresh(payload: SuperMagicUpdateAttachmentsPayload) {
	// Keep the name as "request one full attachment refresh"; the event stays unified.
	pubsub.publish(PubSubEvents.Update_Attachments, payload)
}

export function normalizeUpdateAttachmentsPayload(
	payloadOrCallback: SuperMagicUpdateAttachmentsRequest,
): SuperMagicUpdateAttachmentsPayload {
	// Support legacy pubsub.publish(Update_Attachments, callback) and object payloads.
	if (typeof payloadOrCallback === "function") {
		return { callback: payloadOrCallback }
	}
	return payloadOrCallback ?? {}
}

const waitQueue: WaitEntry[] = []

function removeEntry(entry: WaitEntry) {
	const i = waitQueue.indexOf(entry)
	if (i !== -1) waitQueue.splice(i, 1)
}

function enqueueAttachmentsRefreshWait(
	projectId: string,
	options: { timeoutMs: number; publishRefresh: boolean; signal?: AbortSignal },
): Promise<boolean> {
	const { timeoutMs, publishRefresh, signal } = options
	if (signal?.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"))

	return new Promise<boolean>((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			removeEntry(entry)
			signal?.removeEventListener("abort", onAbort)
			reject(
				new Error(
					`[attachmentsTopicSync] wait timeout after ${timeoutMs}ms for project ${projectId}`,
				),
			)
		}, timeoutMs)

		const entry: WaitEntry = {
			projectId,
			resolve: (didLoad) => {
				clearTimeout(timeoutId)
				signal?.removeEventListener("abort", onAbort)
				resolve(didLoad)
			},
			timeoutId,
		}
		// 用户切换范围或关闭浮窗时，只取消本次等待，不取消已提交上传或共享刷新。
		const onAbort = () => {
			removeEntry(entry)
			clearTimeout(timeoutId)
			signal?.removeEventListener("abort", onAbort)
			reject(new DOMException("Cancelled", "AbortError"))
		}
		signal?.addEventListener("abort", onAbort, { once: true })
		waitQueue.push(entry)
		if (publishRefresh) {
			requestProjectAttachmentsFullRefresh({
				projectId,
				reason: "attachments-topic-sync-wait",
			})
		}
	})
}

export function waitForNextFullAttachmentsRefreshForProject(
	projectId: string | undefined,
	options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<boolean> {
	if (!projectId) return Promise.resolve(false)
	const timeoutMs = options?.timeoutMs ?? 15_000
	return enqueueAttachmentsRefreshWait(projectId, {
		timeoutMs,
		publishRefresh: true,
		signal: options?.signal,
	})
}

/**
 * Wait for the next attachment-tree load and publish an explicit full refresh.
 * 与 fetchRemoteDesignData 等可安全并行；resolve 发生在目标 project 的 getAttachments.finally。
 */
export function waitForNextAttachmentsRefreshForProject(
	projectId: string | undefined,
	options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<boolean> {
	return waitForNextFullAttachmentsRefreshForProject(projectId, options)
}

/**
 * Only wait without publishing a full refresh. Use when another flow already triggered it
 * 的下一次 getAttachments.finally。
 */
export function registerWaitForNextAttachmentsRefreshForProject(
	projectId: string | undefined,
	options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<boolean> {
	if (!projectId) return Promise.resolve(false)
	const timeoutMs = options?.timeoutMs ?? 15_000
	return enqueueAttachmentsRefreshWait(projectId, {
		timeoutMs,
		publishRefresh: false,
		signal: options?.signal,
	})
}

/** 在对应 project 的 getAttachments 进入 finally 后调用（成功或失败均应调用） */
export function resolveAttachmentsRefreshWaitersForProject(projectId: string, didLoad = true) {
	for (let i = waitQueue.length - 1; i >= 0; i--) {
		const w = waitQueue[i]
		if (w.projectId === projectId) {
			waitQueue.splice(i, 1)
			clearTimeout(w.timeoutId)
			w.resolve(didLoad)
		}
	}
}

/**
 * 在整条「拉附件 + 写 store」Promise 链 settled 之后 resolve 等待项。
 * Pass the **full chain** such as `loadProjectAttachments(...).then(...).catch(...).finally(...)`,
 * 勿只包裸 API Promise，否则会在 `.then` 更新树之前 resolve，产生竞态。
 */
export function withAttachmentsRefreshWaitersResolved<T>(
	projectId: string,
	promise: Promise<T>,
): Promise<T> {
	return promise.finally(() => {
		resolveAttachmentsRefreshWaitersForProject(projectId)
	})
}

/**
 * 订阅方未执行拉取（无项目/无话题等）时调用，避免等待方永久 pending。
 * 使用 resolve 而非 reject，便于调用方在「无刷新」时仍决定是否继续业务。
 */
export function releaseAttachmentsRefreshWaitersWithoutFetch() {
	const pending = waitQueue.splice(0, waitQueue.length)
	for (const w of pending) {
		clearTimeout(w.timeoutId)
		w.resolve(false)
	}
}
