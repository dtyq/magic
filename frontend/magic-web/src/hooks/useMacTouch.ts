/**
 * 浏览器的一些事件控制
 */

import { useEffect } from "react"

export default function useMacTouch() {
	useEffect(() => {
		// 阻止Mac触摸板滚动
		document.documentElement.style.overscrollBehaviorX = "none"

		// 组件卸载时移除阻止Mac触摸板滚动
		return () => {
			document.documentElement.style.overscrollBehaviorX = ""
		}
	}, [])
}
