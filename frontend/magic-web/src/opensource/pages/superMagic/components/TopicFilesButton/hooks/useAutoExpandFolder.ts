import { useRef, useCallback } from "react"

interface UseAutoExpandFolderOptions {
	/** 延迟时间（毫秒），默认2000ms */
	delay?: number
	/** 是否启用自动展开 */
	enabled?: boolean
	/** 调试模式 */
	debug?: boolean
}

/**
 * useAutoExpandFolder - 拖拽时自动展开文件夹的hook
 * 当拖拽悬浮到文件夹项超过指定时间时，自动展开该文件夹
 */
export function useAutoExpandFolder(options: UseAutoExpandFolderOptions = {}) {
	const { delay = 2000, enabled = true, debug = false } = options

	// 当前悬浮的文件夹ID和定时器
	const hoverStateRef = useRef<{
		folderId: string | null
		timer: NodeJS.Timeout | null
		expandCallback: (() => void) | null
	}>({
		folderId: null,
		timer: null,
		expandCallback: null,
	})

	// 处理拖拽进入文件夹
	const handleDragEnter = useCallback(
		(folderId: string, expandCallback: () => void) => {
			if (!enabled) return

			console.log("悬浮到文件夹", folderId, hoverStateRef.current.folderId)

			// 如果进入的是同一个文件夹，不重置定时器
			if (hoverStateRef.current.folderId === folderId) {
				return
			}

			// 清除之前的定时器
			if (hoverStateRef.current.timer) {
				clearTimeout(hoverStateRef.current.timer)
			}

			// 设置新的悬浮状态
			hoverStateRef.current.folderId = folderId
			hoverStateRef.current.expandCallback = expandCallback

			// 设置定时器
			hoverStateRef.current.timer = setTimeout(() => {
				console.log(
					"悬浮到文件夹2秒钟后，执行展开操作",
					folderId,
					hoverStateRef.current.folderId,
				)
				if (
					hoverStateRef.current.folderId === folderId &&
					hoverStateRef.current.expandCallback === expandCallback
				) {
					// 执行展开操作
					expandCallback()

					// 清除状态
					hoverStateRef.current.folderId = null
					hoverStateRef.current.timer = null
					hoverStateRef.current.expandCallback = null

					if (debug) {
						console.log("🗂️ 自动展开文件夹:", folderId)
					}
				}
			}, delay)

			if (debug) {
				console.log("⏰ 开始文件夹展开倒计时:", folderId, `${delay}ms`)
			}
		},
		[enabled, delay, debug],
	)

	// 处理拖拽离开文件夹
	const handleDragLeave = useCallback(() => {
		if (!enabled) return

		// 清除定时器和状态
		if (hoverStateRef.current.timer) {
			clearTimeout(hoverStateRef.current.timer)
		}

		if (debug && hoverStateRef.current.folderId) {
			console.log("❌ 取消文件夹展开倒计时:", hoverStateRef.current.folderId)
		}

		hoverStateRef.current.folderId = null
		hoverStateRef.current.timer = null
		hoverStateRef.current.expandCallback = null
	}, [enabled, debug])

	// 清理函数
	const cleanup = useCallback(() => {
		if (hoverStateRef.current.timer) {
			clearTimeout(hoverStateRef.current.timer)
		}
		hoverStateRef.current.folderId = null
		hoverStateRef.current.timer = null
		hoverStateRef.current.expandCallback = null
	}, [])

	return {
		handleDragEnter,
		handleDragLeave,
		cleanup,
	}
}
