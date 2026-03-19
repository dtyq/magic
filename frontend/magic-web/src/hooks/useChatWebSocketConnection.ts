import { useEffect } from "react"
import { userStore } from "@/models/user"
import chatWebSocket from "@/apis/clients/chatWebSocket"
import { service } from "@/services"
import type { UserService } from "@/services/user/UserService"
import { logger as Logger } from "@/utils/log"
import { useMemoizedFn } from "ahooks"
import ChatBusinessMessageService from "@/services/chat/message/ChatBusinessMessageService"
import type { ShowRecordSummaryNotificationCallback } from "@/services/chat/message/ChatBusinessMessageService"
import {
	RecordSummaryNotificationOptions,
	useRecordSummaryNotification,
} from "@/components/business/RecordingSummary/components/RecordSummaryNotification"

const logger = Logger.createLogger("useWebSocketConnection")

interface UseChatWebSocketConnectionOptions {
	/** Whether to automatically connect when authorized */
	autoConnect?: boolean
	/** Callback when connection starts */
	onConnecting?: () => void
	/** Callback when connection succeeds */
	onConnected?: () => void
	/** Callback when connection fails */
	onError?: (error: unknown) => void
	/** Optional callback for showing record summary notifications */
	showRecordSummaryNotification?: ShowRecordSummaryNotificationCallback
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => { }

/**
 * Custom hook to manage WebSocket connection lifecycle
 * Handles connection, authentication, reconnection, and cleanup
 */
export function useChatWebSocketConnection(options: UseChatWebSocketConnectionOptions = {}) {
	const {
		autoConnect = true,
		onConnecting: _onConnecting = noop,
		onConnected: _onConnected = noop,
		onError: _onError = noop,
	} = options

	const recordSummaryNotification = useRecordSummaryNotification()

	const onConnecting = useMemoizedFn(_onConnecting)
	const onConnected = useMemoizedFn(_onConnected)
	const onError = useMemoizedFn(_onError)
	const showRecordSummaryNotification = useMemoizedFn(
		(params: RecordSummaryNotificationOptions) => {
			recordSummaryNotification?.showRecordSummaryNotification(params)
		},
	)

	useEffect(() => {
		// Track if we initiated the connection
		let didConnect = false

		// Initialize business message service
		ChatBusinessMessageService.init(showRecordSummaryNotification)

		// Setup WebSocket event listeners
		const handleOpen = () => {
			const { authorization: auth, userInfo } = userStore.user

			// Auto-login when connection is established (both initial and reconnect)
			if (auth && userInfo?.user_id) {
				logger.log("WebSocket 连接成功，自动触发登录")
				service
					.get<UserService>("userService")
					.wsLogin()
					.then(() => {
						onConnected?.()
					})
					.catch((error) => {
						logger.error("WebSocket 自动登录失败", error)
						onError?.(error)
					})
			} else {
				logger.log("WebSocket 连接成功，但无有效认证信息，跳过登录")
			}
		}

		const handleReconnecting = () => {
			logger.log("WebSocket 开始重连，清理登录状态")
			service.get<UserService>("userService").clearLastLogin()
		}

		// Register event listeners
		chatWebSocket.on("open", handleOpen)
		chatWebSocket.on("reconnecting", handleReconnecting)

		logger.log("WebSocket 事件监听器已注册")

		// Connect WebSocket if authorized and autoConnect is enabled
		if (autoConnect) {
			const { authorization } = userStore.user

			if (authorization) {
				didConnect = true
				onConnecting?.()
				chatWebSocket
					.connect({ showLoading: false })
					.catch((error) => {
						logger.error("WebSocket 连接失败", error)
						onError?.(error)
					})
					.finally(() => {
						// Connection attempt finished (success or failure)
					})
			}
		}

		// Cleanup function
		return () => {
			// Remove event listeners
			chatWebSocket.off("open", handleOpen)
			chatWebSocket.off("reconnecting", handleReconnecting)
			logger.log("WebSocket 事件监听器已清理")

			// Destroy business message service
			ChatBusinessMessageService.destroy()
			logger.log("ChatBusinessMessageService destroyed")

			// Close connection if we initiated it (autoConnect was true)
			if (didConnect) {
				chatWebSocket.close()
				logger.log("WebSocket 连接已关闭（由 hook 自动管理）")
			}
		}
	}, [autoConnect, onConnected, onConnecting, onError, showRecordSummaryNotification])
}
