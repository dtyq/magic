import { useRef } from "react"
import { useMemoizedFn, useUnmount } from "ahooks"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"

interface UseWaitForAttachmentsUpdateOptions {
	/** 超时时间（毫秒），默认 2000ms */
	timeout?: number
	/** 文件列表更新完成后的延迟时间（毫秒），确保文件列表已完全更新到 store，默认 100ms */
	delayAfterUpdate?: number
}

interface UseWaitForAttachmentsUpdateReturn {
	/**
	 * 等待文件列表更新完成后执行回调函数
	 * 通过监听 Update_Attachments_Loading 事件来确保文件列表已更新完成
	 * @param callback 文件列表更新完成后要执行的回调函数
	 */
	waitForAttachmentsUpdate: (callback: () => void | Promise<void>) => void
}

function runCallbacksSafely(callbacks: Array<() => void | Promise<void>>): void {
	callbacks.forEach((cb) => {
		Promise.resolve(cb()).catch((err) => {
			console.error("useWaitForAttachmentsUpdate callback error:", err)
		})
	})
}

/**
 * 等待文件列表更新完成的 Hook
 *
 * 使用场景：
 * - 消息撤回/撤销撤回时，需要等待文件列表更新完成后再执行某些操作
 * - 确保文件列表已完全更新到 store 中，避免 getFileInfo 等操作失败
 *
 * 工作原理：
 * 1. 订阅 Update_Attachments_Loading 事件
 * 2. 等待文件列表加载完成（loading 变为 false）
 * 3. 延迟一小段时间确保文件列表已完全更新
 * 4. 执行回调函数
 * 5. 设置超时机制，避免无限等待
 */
export function useWaitForAttachmentsUpdate(
	options: UseWaitForAttachmentsUpdateOptions = {},
): UseWaitForAttachmentsUpdateReturn {
	const { timeout = 2000, delayAfterUpdate = 100 } = options

	const attachmentsLoadingListenerRef = useRef<((loading: boolean) => void) | null>(null)
	const waitAttachmentsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const delayAfterUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
	const pendingCallbacksRef = useRef<Array<() => void | Promise<void>>>([])

	const waitForAttachmentsUpdate = useMemoizedFn((callback: () => void | Promise<void>) => {
		pendingCallbacksRef.current.push(callback)

		const runAllAndCleanup = () => {
			const callbacks = pendingCallbacksRef.current
			pendingCallbacksRef.current = []

			if (waitAttachmentsTimeoutRef.current) {
				clearTimeout(waitAttachmentsTimeoutRef.current)
				waitAttachmentsTimeoutRef.current = null
			}
			if (delayAfterUpdateTimerRef.current) {
				clearTimeout(delayAfterUpdateTimerRef.current)
				delayAfterUpdateTimerRef.current = null
			}
			if (attachmentsLoadingListenerRef.current) {
				pubsub.unsubscribe(
					PubSubEvents.Update_Attachments_Loading,
					attachmentsLoadingListenerRef.current,
				)
				attachmentsLoadingListenerRef.current = null
			}

			if (callbacks.length > 0) {
				runCallbacksSafely(callbacks)
			}
		}

		if (attachmentsLoadingListenerRef.current) {
			return
		}

		const loadingListener = (loading: boolean) => {
			if (!loading) {
				delayAfterUpdateTimerRef.current = setTimeout(() => {
					delayAfterUpdateTimerRef.current = null
					runAllAndCleanup()
				}, delayAfterUpdate)
			}
		}

		attachmentsLoadingListenerRef.current = loadingListener
		pubsub.subscribe(PubSubEvents.Update_Attachments_Loading, loadingListener)

		waitAttachmentsTimeoutRef.current = setTimeout(() => {
			runAllAndCleanup()
		}, timeout)
	})

	useUnmount(() => {
		if (delayAfterUpdateTimerRef.current) {
			clearTimeout(delayAfterUpdateTimerRef.current)
			delayAfterUpdateTimerRef.current = null
		}
		if (waitAttachmentsTimeoutRef.current) {
			clearTimeout(waitAttachmentsTimeoutRef.current)
			waitAttachmentsTimeoutRef.current = null
		}
		if (attachmentsLoadingListenerRef.current) {
			pubsub.unsubscribe(
				PubSubEvents.Update_Attachments_Loading,
				attachmentsLoadingListenerRef.current,
			)
			attachmentsLoadingListenerRef.current = null
		}
		pendingCallbacksRef.current = []
	})

	return {
		waitForAttachmentsUpdate,
	}
}
