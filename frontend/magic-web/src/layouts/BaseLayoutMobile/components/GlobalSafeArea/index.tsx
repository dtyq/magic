import { interfaceStore } from "@/stores/interface"
import { createStyles } from "antd-style"
import { observer } from "mobx-react-lite"
import { toJS } from "mobx"
import { useLocation } from "react-router"
import { shouldDisableGlobalSafeArea } from "./utils"

// 导出常量供外部使用
export { NO_GLOBAL_SAFE_AREA_ROUTES_NAMES } from "./utils"

const useStyles = createStyles(({ css, token }) => {
	return {
		safeArea: css`
			width: 100%;

			&.top {
				height: ${token.safeAreaInsetTop};
			}

			&.bottom {
				height: ${token.safeAreaInsetBottom};
			}

			&.left {
				width: ${token.safeAreaInsetLeft};
			}

			&.right {
				width: ${token.safeAreaInsetRight};
			}
		`,
	}
})

function GlobalSafeArea({
	direction,
}: {
	direction: keyof typeof interfaceStore.globalSafeAreaStyle
}) {
	const { globalSafeAreaStyle } = interfaceStore
	const { styles, cx } = useStyles()
	const location = useLocation()

	// 使用通用函数判断是否不使用全局安全边距（直接通过 URL 路径和查询参数判断，避免状态延迟）
	const shouldDisable = shouldDisableGlobalSafeArea(location.pathname, location.search)

	if (shouldDisable) {
		return null
	}

	// 始终渲染 DOM，但通过 CSS 控制高度，避免布局闪烁
	return (
		<div
			className={cx(styles.safeArea, direction)}
			style={toJS(globalSafeAreaStyle[direction])}
		/>
	)
}

export default observer(GlobalSafeArea)
