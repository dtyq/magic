import { useCallback } from "react"
import { useViewTransition } from "@/opensource/hooks/use-view-transition"
import type {
	EnhancedNavigateOptions,
	ViewTransitionConfig,
} from "@/opensource/types/viewTransition"
import { useIsMobile } from "../../hooks/useIsMobile"
import type { RouteParams } from "@/opensource/routes/history/types"
import { history } from "@/opensource/routes/history"
import { RouteName } from "@/opensource/routes/constants"

const isHistoryLengthEnough = (path: number) => {
	// // iOS Safari 的历史记录长度不可靠，需要更保守的检查
	// const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
	//
	// if (isIOS) {
	// 	// iOS 下更严格的检查：至少需要 3 个历史记录才允许返回
	// 	return window.history.length > 3 && window.history.length > Math.abs(path) + 1
	// }

	return window.history.length > 2 && window.history.length > Math.abs(path)
}

export type MagicNavigateParams = Partial<RouteParams> &
	EnhancedNavigateOptions & {
		/** history.go */
		delta?: number
	}

/**
 * Custom Navigate hook
 * Enhanced with View Transition support
 * @returns Enhanced navigate function with viewTransition support
 */
export const useNavigate = ({ fallbackRoute }: { fallbackRoute?: MagicNavigateParams } = {}) => {
	const { startTransition } = useViewTransition()
	const isMobile = useIsMobile()

	// Get default route name based on device type
	const defaultRouteName = isMobile ? RouteName.MobileTabs : RouteName.Super

	return useCallback(
		(props: MagicNavigateParams) => {
			const { name, params, query, state, delta, viewTransition, ...navigateOptions } = props

			// Handle View Transition
			if (viewTransition || (viewTransition !== false && isMobile)) {
				let transitionConfig: ViewTransitionConfig | undefined

				// Parse viewTransition configuration
				if (typeof viewTransition === "boolean") {
					// If it's boolean, use default configuration
					transitionConfig = {
						type: "slide",
						direction: "left",
						duration: 300,
					}
				} else {
					// If it's an object, use it directly
					transitionConfig = {
						type: "slide",
						direction: "left",
						duration: 300,
						...viewTransition,
					}
				}

				// Execute navigation with View Transition
				return startTransition(() => {
					// Execute navigation directly
					if (delta) {
						if (isHistoryLengthEnough(delta)) {
							history.go(delta)
							return
						}
						history.push({
							name: fallbackRoute?.name ?? defaultRouteName,
							params,
							query,
							state,
						})
					} else {
						if (navigateOptions?.replace) {
							history.replace({
								name: name ?? defaultRouteName,
								params,
								query,
								state,
							})
						} else {
							history.push({
								name: name ?? defaultRouteName,
								params,
								query,
								state,
							})
						}
					}
				}, transitionConfig)
			}

			// Regular navigation without View Transition
			// Execute navigation directly
			if (delta) {
				if (isHistoryLengthEnough(delta)) {
					history.go(delta)
					return
				}
				history.push({
					name: fallbackRoute?.name ?? defaultRouteName,
					params,
					query,
					state,
				})
			} else {
				if (navigateOptions?.replace) {
					history.replace({
						name: name ?? defaultRouteName,
						params,
						query,
						state,
					})
				} else {
					history.push({
						name: name ?? defaultRouteName,
						params,
						query,
						state,
					})
				}
			}
		},
		[fallbackRoute?.name, isMobile, startTransition, defaultRouteName],
	)
}

export default useNavigate
