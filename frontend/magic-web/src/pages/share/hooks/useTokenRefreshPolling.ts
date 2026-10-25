import { useCallback, useEffect, useRef } from "react"
import { SuperMagicApi } from "@/apis"
import { useMemoizedFn } from "ahooks"
import { isEmpty } from "lodash-es"

interface TokenRefreshInfo {
	has_password?: boolean
	temporary_token?: string
	[key: string]: unknown
}

interface useTokenRefreshPollingOptions {
	resourceId: string
	password?: string
	scopeKey?: string
	onTokenRefreshed?: (tokenInfo: TokenRefreshInfo) => void
	onRefreshError?: (error: unknown) => void
	interval?: number
	data: unknown
}

/**
 * Token自动刷新Hook
 * 提供分享页面token管理的React集成
 */
export function useTokenRefreshPolling({
	resourceId,
	password,
	scopeKey,
	onTokenRefreshed,
	onRefreshError,
	interval = 1000 * 60 * 50, // 默认50分钟刷新一次
	data,
}: useTokenRefreshPollingOptions) {
	const timerRef = useRef<NodeJS.Timeout | number | null>(null)
	const lastRefreshedAtRef = useRef<number>(0)
	const refreshSequenceRef = useRef(0)
	const currentScopeRef = useRef({ password, resourceId, scopeKey })
	currentScopeRef.current = { password, resourceId, scopeKey }

	// 创建刷新回调函数
	const refreshToken = useMemoizedFn(async () => {
		const requestSequence = ++refreshSequenceRef.current
		const requestScope = { password, resourceId, scopeKey }
		const isCurrentRequest = () => {
			const currentScope = currentScopeRef.current
			return (
				requestSequence === refreshSequenceRef.current &&
				requestScope.password === currentScope.password &&
				requestScope.resourceId === currentScope.resourceId &&
				requestScope.scopeKey === currentScope.scopeKey
			)
		}

		try {
			if (!resourceId || isEmpty(data)) return

			const result = (await SuperMagicApi.getShareResource({
				resource_id: resourceId,
				password,
			})) as TokenRefreshInfo
			if (!isCurrentRequest()) return

			// 如果需要密码但没有提供密码，抛出错误
			if (result?.has_password && !password) throw new Error("Password required for refresh")
			lastRefreshedAtRef.current = Date.now()
			onTokenRefreshed?.(result)
		} catch (error) {
			if (!isCurrentRequest()) return
			console.error("Token refresh callback failed:", error)
			onRefreshError?.(error)
		}
	})

	const clearTimer = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current as number)
			timerRef.current = null
		}
	}, [])

	const startPolling = useCallback(() => {
		clearTimer()

		// 心跳频率：每分钟检查一次，避免浏览器对长间隔定时器的节流/冻结
		const checkInterval = 60 * 1000
		timerRef.current = setInterval(() => {
			const now = Date.now()
			const elapsed = now - (lastRefreshedAtRef.current || 0)
			if (elapsed >= interval) refreshToken()
		}, checkInterval) as unknown as number
	}, [clearTimer, refreshToken, interval])

	// 页面重新可见或获得焦点时进行补偿刷新
	useEffect(() => {
		const handleVisibilityOrFocus = () => {
			if (document.hidden) return
			const now = Date.now()
			const elapsed = now - (lastRefreshedAtRef.current || 0)
			if (elapsed >= interval) refreshToken()
		}

		document.addEventListener("visibilitychange", handleVisibilityOrFocus)
		window.addEventListener("focus", handleVisibilityOrFocus)
		window.addEventListener("pageshow", handleVisibilityOrFocus)
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityOrFocus)
			window.removeEventListener("focus", handleVisibilityOrFocus)
			window.removeEventListener("pageshow", handleVisibilityOrFocus)
		}
	}, [interval, refreshToken])

	// Freshly loaded share data already has a valid token; start the refresh clock
	// from load time so the first modal/focus does not immediately rotate the token.
	useEffect(() => {
		if (!isEmpty(data) && lastRefreshedAtRef.current === 0) {
			lastRefreshedAtRef.current = Date.now()
		}
	}, [data])

	useEffect(() => {
		// Start the heartbeat interval; the refresh clock is seeded when share
		// data first becomes available (see effect above).
		startPolling()
		return () => {
			refreshSequenceRef.current += 1
			clearTimer()
		}
	}, [clearTimer, startPolling])
}
