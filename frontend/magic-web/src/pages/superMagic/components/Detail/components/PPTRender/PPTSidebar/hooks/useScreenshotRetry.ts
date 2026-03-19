import { useState, useRef, useEffect, useCallback } from "react"

interface UseScreenshotRetryOptions {
	/** 是否有错误 */
	hasError: boolean
	/** 是否正在加载 */
	isLoading: boolean
	/** 是否有缩略图 */
	hasThumbnail: boolean
	/** 重试回调 */
	onRetry: () => void
	/** 最大重试次数，默认 3 */
	maxRetries?: number
	/** 基础重试延迟（毫秒），默认 2000ms */
	baseRetryDelay?: number
}

interface UseScreenshotRetryReturn {
	/** 当前重试次数 */
	retryCount: number
	/** 手动重试 */
	manualRetry: () => void
	/** 是否可以重试 */
	canRetry: boolean
}

/**
 * 截图自动重试 Hook
 *
 * 功能：
 * - 当截图失败时自动重试（带指数退避）
 * - 最多重试 maxRetries 次
 * - 提供手动重试功能
 * - 自动清理定时器
 */
export function useScreenshotRetry({
	hasError,
	isLoading,
	hasThumbnail,
	onRetry,
	maxRetries = 3,
	baseRetryDelay = 2000,
}: UseScreenshotRetryOptions): UseScreenshotRetryReturn {
	const [retryCount, setRetryCount] = useState(0)
	const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// 清理定时器
	const clearRetryTimeout = useCallback(() => {
		if (retryTimeoutRef.current) {
			clearTimeout(retryTimeoutRef.current)
			retryTimeoutRef.current = null
		}
	}, [])

	// 手动重试
	const manualRetry = useCallback(() => {
		clearRetryTimeout()
		setRetryCount(0)
		onRetry()
	}, [onRetry, clearRetryTimeout])

	// 自动重试逻辑（带指数退避）
	useEffect(() => {
		// 如果有错误且未超过最大重试次数，则自动重试
		if (hasError && !isLoading && retryCount < maxRetries) {
			// 指数退避：2s, 4s, 8s
			const delay = baseRetryDelay * Math.pow(2, retryCount)

			clearRetryTimeout()
			retryTimeoutRef.current = setTimeout(() => {
				setRetryCount((prev) => prev + 1)
				onRetry()
			}, delay)
		}

		return clearRetryTimeout
	}, [hasError, isLoading, retryCount, maxRetries, baseRetryDelay, onRetry, clearRetryTimeout])

	// 成功生成缩略图后重置重试计数
	useEffect(() => {
		if (hasThumbnail) {
			setRetryCount(0)
			clearRetryTimeout()
		}
	}, [hasThumbnail, clearRetryTimeout])

	// 组件卸载时清理
	useEffect(() => {
		return clearRetryTimeout
	}, [clearRetryTimeout])

	const canRetry = hasError && retryCount >= maxRetries

	return {
		retryCount,
		manualRetry,
		canRetry,
	}
}
