/**
 * 浏览器的一些事件控制
 */

import { useEffect } from "react"

export default function useMacTouch() {
	useEffect(() => {
		// 组件挂载时添加 overscroll-behavior-x: none
		document.documentElement.style.overscrollBehaviorX = "none"

		// 组件卸载时移除 overscroll-behavior-x
		return () => {
			document.documentElement.style.overscrollBehaviorX = ""
		}
	}, []) // 空依赖数组确保只在组件挂载和卸载时执行
}
