import pubsub, { PubSubEvents } from "@/utils/pubsub"

/**
 * 与 Update_Attachments → getAttachmentsByProjectId 主链路配合：
 * - 等待方：waitForNext… / registerWaitForNext… 入队
 * - 完成方：拉附件的 Promise 应用 {@link withAttachmentsRefreshWaitersResolved}，在 settled 后统一 resolve
 * 避免各页在 finally/catch 重复调用 resolve，也避免依赖 Update_Attachments_Loading 边沿。
 */

interface WaitEntry {
	projectId: string
	resolve: () => void
	timeoutId: ReturnType<typeof setTimeout>
}

const waitQueue: WaitEntry[] = []

function removeEntry(entry: WaitEntry) {
	const i = waitQueue.indexOf(entry)
	if (i !== -1) waitQueue.splice(i, 1)
}

function enqueueAttachmentsRefreshWait(
	projectId: string,
	options: { timeoutMs: number; publishRefresh: boolean },
): Promise<void> {
	const { timeoutMs, publishRefresh } = options

	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			removeEntry(entry)
			reject(
				new Error(
					`[attachmentsTopicSync] wait timeout after ${timeoutMs}ms for project ${projectId}`,
				),
			)
		}, timeoutMs)

		const entry: WaitEntry = {
			projectId,
			resolve: () => {
				clearTimeout(timeoutId)
				resolve()
			},
			timeoutId,
		}
		waitQueue.push(entry)
		if (publishRefresh) {
			pubsub.publish(PubSubEvents.Update_Attachments)
		}
	})
}

/**
 * 登记对「下一次」附件树拉取完成的等待，并立即发布 Update_Attachments。
 * 与 fetchRemoteDesignData 等可安全并行；resolve 发生在目标 project 的 getAttachments.finally。
 */
export function waitForNextAttachmentsRefreshForProject(
	projectId: string | undefined,
	options?: { timeoutMs?: number },
): Promise<void> {
	if (!projectId) return Promise.resolve()
	const timeoutMs = options?.timeoutMs ?? 15_000
	return enqueueAttachmentsRefreshWait(projectId, { timeoutMs, publishRefresh: true })
}

/**
 * 仅登记等待、不发布 Update_Attachments。适用于外部已触发刷新（如消息撤回），只需等该 project
 * 的下一次 getAttachments.finally。
 */
export function registerWaitForNextAttachmentsRefreshForProject(
	projectId: string | undefined,
	options?: { timeoutMs?: number },
): Promise<void> {
	if (!projectId) return Promise.resolve()
	const timeoutMs = options?.timeoutMs ?? 15_000
	return enqueueAttachmentsRefreshWait(projectId, { timeoutMs, publishRefresh: false })
}

/** 在对应 project 的 getAttachments 进入 finally 后调用（成功或失败均应调用） */
export function resolveAttachmentsRefreshWaitersForProject(projectId: string) {
	for (let i = waitQueue.length - 1; i >= 0; i--) {
		const w = waitQueue[i]
		if (w.projectId === projectId) {
			waitQueue.splice(i, 1)
			clearTimeout(w.timeoutId)
			w.resolve()
		}
	}
}

/**
 * 在整条「拉附件 + 写 store」Promise 链 settled 之后 resolve 等待项。
 * 请传入 **完整链**（例如 `getAttachmentsByProjectId(...).then(...).catch(...).finally(...)`），
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
		w.resolve()
	}
}
