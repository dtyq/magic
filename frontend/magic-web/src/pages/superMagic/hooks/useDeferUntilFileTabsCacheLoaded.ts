import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"

/**
 * 将逻辑推迟到「当前项目文件 tabs 本地缓存一轮加载结束」之后执行（由 Detail/FilesViewer 的 onFileTabsCacheLoaded 驱动）。
 * 同项目切话题不重置；仅 projectId 变化时重置就绪状态。
 */
export function useDeferUntilFileTabsCacheLoaded(projectId: string | undefined) {
	const readyRef = useRef(false)
	const pendingCallbacksRef = useRef(new Map<string, () => void>())
	const projectIdRef = useRef(projectId)
	projectIdRef.current = projectId

	useEffect(() => {
		readyRef.current = false
		pendingCallbacksRef.current.clear()
	}, [projectId])

	const onFileTabsCacheLoaded = useMemoizedFn((loadedProjectId: string) => {
		const current = projectIdRef.current
		if (!current || loadedProjectId !== current) return
		readyRef.current = true
		const pendingCallbacks = Array.from(pendingCallbacksRef.current.values())
		pendingCallbacksRef.current.clear()
		pendingCallbacks.forEach((callback) => window.setTimeout(callback, 0))
	})

	const scheduleWhenTabsCacheReady = useMemoizedFn((fn: () => void, channel = "default") => {
		if (!projectIdRef.current) {
			window.setTimeout(fn, 0)
			return
		}
		if (readyRef.current) {
			window.setTimeout(fn, 0)
			return
		}
		pendingCallbacksRef.current.set(channel, fn)
	})

	return { onFileTabsCacheLoaded, scheduleWhenTabsCacheReady }
}
