import { useEffect } from "react"
import { getNativePort } from "@/opensource/platform/native"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { getRoutePath } from "@/opensource/routes/history/helpers"
import { RouteName } from "@/opensource/routes/constants"

/**
 * @description 使用原生返回
 */
function useNativeBack() {
	const navigate = useNavigate()
	useEffect(() => {
		const destroy = getNativePort().navigation.observeGoBack(() => {
			const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
			const chatPath = getRoutePath({ name: RouteName.Chat })

			// iOS 下更严格的返回条件检查
			const cannotGoBack = isIOS
				? window.location.pathname === chatPath || window.history.length <= 2
				: window.location.pathname === chatPath || window.history.length <= 1

			if (cannotGoBack) {
				return {
					canGoBack: false,
				}
			} else {
				navigate({
					delta: -1,
					viewTransition: { type: "slide", direction: "right" },
				})

				return {
					canGoBack: true,
				}
			}
		})

		return () => {
			destroy?.(true)
		}
	}, [navigate])
}

export default useNativeBack
