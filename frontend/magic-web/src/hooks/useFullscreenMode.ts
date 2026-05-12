import { useMemo } from "react"
import { useLocation } from "react-router"

/**
 * useFullscreenMode - 检测当前路由是否处于全屏模式
 *
 * @returns {boolean} 如果 URL 参数中 fullscreen=true 则返回 true，否则返回 false
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isFullscreenMode = useFullscreenMode()
 *   return <div className={isFullscreenMode ? 'fullscreen' : 'normal'}>Content</div>
 * }
 * ```
 */
function useFullscreenMode(): boolean {
	const { search } = useLocation()

	const isFullscreenMode = useMemo(() => {
		const urlSearchParams = new URLSearchParams(search)
		return urlSearchParams.get("fullscreen") === "true"
	}, [search])

	return isFullscreenMode
}

export default useFullscreenMode
