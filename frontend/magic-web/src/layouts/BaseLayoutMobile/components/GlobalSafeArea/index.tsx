import { interfaceStore } from "@/stores/interface"
import { cn } from "@/utils/cn"
import { observer } from "mobx-react-lite"
import { toJS } from "mobx"
import { useLocation } from "react-router"
import { shouldDisableGlobalSafeArea } from "./utils"

// 导出常量供外部使用
export { NO_GLOBAL_SAFE_AREA_ROUTES_NAMES } from "./utils"

// Native insets are synchronized to these CSS variables by GlobalSafeAreaSync.
const directionClassNames = {
	top: "h-[var(--safe-area-inset-top,env(safe-area-inset-top))]",
	bottom: "h-[var(--safe-area-inset-bottom,env(safe-area-inset-bottom))]",
	left: "w-[var(--safe-area-inset-left,env(safe-area-inset-left))]",
	right: "w-[var(--safe-area-inset-right,env(safe-area-inset-right))]",
}

function GlobalSafeArea({
	direction,
}: {
	direction: keyof typeof interfaceStore.globalSafeAreaStyle
}) {
	const { globalSafeAreaStyle } = interfaceStore
	const location = useLocation()

	// 使用通用函数判断是否不使用全局安全边距（直接通过 URL 路径和查询参数判断，避免状态延迟）
	const shouldDisable = shouldDisableGlobalSafeArea(location.pathname, location.search)

	if (shouldDisable) {
		return null
	}

	// 始终渲染 DOM，但通过 CSS 控制高度，避免布局闪烁
	return (
		<div
			className={cn("w-full bg-mobile-background", directionClassNames[direction])}
			style={toJS(globalSafeAreaStyle[direction])}
		/>
	)
}

export default observer(GlobalSafeArea)
