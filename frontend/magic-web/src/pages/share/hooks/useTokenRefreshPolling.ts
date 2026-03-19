import { useCallback, useEffect, useRef } from "react"
import { SuperMagicApi } from "@/apis"
import { useMemoizedFn } from "ahooks"
import { isEmpty } from "lodash-es"

interface useTokenRefreshPollingOptions {
	resourceId: string
	password?: string
	onTokenRefreshed?: (tokenInfo: any) => void
	onRefreshError?: (error: any) => void
	interval?: number
	data: any
}

/**
 * Token自动刷新Hook
 * 提供分享页面token管理的React集成
 */
export function useTokenRefreshPolling({
	resourceId,
	password,
	onTokenRefreshed,
	onRefreshError,
	interval = 1000 * 60 * 50, // 默认50分钟刷新一次
	data,
}: useTokenRefreshPollingOptions) {
	const timerRef = useRef<NodeJS.Timeout | number | null>(null)
	const lastRefreshedAtRef = useRef<number>(0)

	// 创建刷新回调函数
	const refreshToken = useMemoizedFn(async () => {
		try {
			if (!resourceId || isEmpty(data)) return

			const result = await SuperMagicApi.getShareResource({
				resource_id: resourceId,
				password,
			})

			// 如果需要密码但没有提供密码，抛出错误
			if (result?.has_password && !password) throw new Error("Password required for refresh")

			// @ts-ignore
			window.temporary_token = result.temporary_token
			lastRefreshedAtRef.current = Date.now()
			onTokenRefreshed?.(result)
		} catch (error) {
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

	useEffect(() => {
		// 初始立即刷新一次
		startPolling()
		return () => clearTimer()
	}, [])
}
