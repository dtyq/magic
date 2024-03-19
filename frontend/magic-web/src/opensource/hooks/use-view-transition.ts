import { useCallback, useRef, useState, useEffect } from "react"
import type { ViewTransitionConfig, ViewTransitionState } from "@/opensource/types/viewTransition"
import { executeViewTransition, isViewTransitionSupported } from "@/opensource/utils/viewTransition"

/**
 * useViewTransition hook 选项
 */
interface UseViewTransitionOptions {
	/** 是否启用调试模式 */
	debug?: boolean
	/** 默认配置 */
	defaultConfig?: ViewTransitionConfig
}

/**
 * useViewTransition hook 返回值
 */
interface UseViewTransitionReturn {
	/** 当前状态 */
	state: ViewTransitionState
	/** 启动过渡 */
	startTransition: (
		callback: () => void | Promise<void>,
		config?: ViewTransitionConfig,
	) => Promise<void>
	/** 跳过当前过渡 */
	skipTransition: () => void
	/** 浏览器是否支持 View Transition API */
	isSupported: boolean
}

/**
 * View Transition Hook
 *
 * @param options - 配置选项
 * @returns View Transition 接口
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { startTransition, isSupported } = useViewTransition()
 *
 *   const handleNavigate = () => {
 *     startTransition(() => {
 *       // 执行导航或状态更新
 *       navigate('/next-page')
 *     }, {
 *       type: 'slide',
 *       direction: 'right'
 *     })
 *   }
 *
 *   return (
 *     <button onClick={handleNavigate}>
 *       Navigate with transition
 *     </button>
 *   )
 * }
 * ```
 */
export function useViewTransition(options: UseViewTransitionOptions = {}): UseViewTransitionReturn {
	const { defaultConfig = {} } = options

	// 当前过渡实例的引用
	const currentTransitionRef = useRef<ViewTransition | null>(null)

	// 过渡状态
	const [state, setState] = useState<ViewTransitionState>({
		isTransitioning: false,
		isReady: false,
		isFinished: false,
	})

	// 检查浏览器支持
	const isSupported = isViewTransitionSupported()

	// 在开发环境下，如果不支持则输出详细信息
	useEffect(() => {
		if (process.env.NODE_ENV === "development" && !isSupported && options.debug) {
			import("@/opensource/utils/viewTransitionDebug").then(
				({ debugViewTransitionSupport }) => {
					debugViewTransitionSupport()
				},
			)
		}
	}, [isSupported, options.debug])

	// 跳过当前过渡
	const skipTransition = useCallback(() => {
		if (currentTransitionRef.current) {
			currentTransitionRef.current.skipTransition()
		}
	}, [])

	// 启动过渡
	const startTransition = useCallback(
		async (callback: () => void | Promise<void>, config: ViewTransitionConfig = {}) => {
			// 合并默认配置
			const finalConfig = { ...defaultConfig, ...config }

			// 如果已有过渡在进行，先跳过它
			if (state.isTransitioning) {
				skipTransition()
			}

			// 更新状态：开始过渡
			setState((prev) => ({
				...prev,
				isTransitioning: true,
				isReady: false,
				isFinished: false,
				type: finalConfig.type,
				name: finalConfig.name,
			}))

			try {
				await executeViewTransition(callback, {
					...finalConfig,
					onStart: () => {
						finalConfig.onStart?.()
					},
					onComplete: () => {
						// 更新状态：过渡完成
						setState((prev) => ({
							...prev,
							isTransitioning: false,
							isFinished: true,
						}))
						finalConfig.onComplete?.()
					},
					onSkip: () => {
						// 更新状态：过渡被跳过
						setState((prev) => ({
							...prev,
							isTransitioning: false,
							isFinished: true,
						}))
						finalConfig.onSkip?.()
					},
					fallback: () => {
						// 降级处理
						setState((prev) => ({
							...prev,
							isTransitioning: false,
							isFinished: true,
						}))
						callback()
						finalConfig.fallback?.()
					},
				})
			} catch (error) {
				console.error("View transition failed:", error)

				// 出错时重置状态
				setState((prev) => ({
					...prev,
					isTransitioning: false,
					isFinished: true,
				}))
			}
		},
		[defaultConfig, state.isTransitioning, skipTransition],
	)

	// 清理函数
	useEffect(() => {
		return () => {
			if (currentTransitionRef.current) {
				currentTransitionRef.current.skipTransition()
			}
		}
	}, [])

	return {
		state,
		startTransition,
		skipTransition,
		isSupported,
	}
}

/**
 * 简化版本的 useViewTransition hook，只返回 startTransition 函数
 *
 * @param config - 默认配置
 * @returns startTransition 函数
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const startTransition = useSimpleViewTransition({
 *     type: 'slide',
 *     direction: 'right'
 *   })
 *
 *   const handleClick = () => {
 *     startTransition(() => navigate('/next-page'))
 *   }
 *
 *   return <button onClick={handleClick}>Navigate</button>
 * }
 * ```
 */
export function useSimpleViewTransition(config?: ViewTransitionConfig) {
	const { startTransition } = useViewTransition({ defaultConfig: config })
	return startTransition
}

/**
 * 用于页面导航的 View Transition hook
 *
 * @param navigateFunction - 导航函数
 * @returns 带有过渡效果的导航函数
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const navigate = useNavigate()
 *   const navigateWithTransition = useNavigationTransition(navigate)
 *
 *   const handleClick = () => {
 *     navigateWithTransition('/next-page', {
 *       type: 'slide',
 *       direction: 'right'
 *     })
 *   }
 *
 *   return <button onClick={handleClick}>Navigate</button>
 * }
 * ```
 */
export function useNavigationTransition(navigateFunction: (path: any, options?: any) => void) {
	const { startTransition } = useViewTransition()

	return useCallback(
		(path: any, navigationOptions: any = {}, transitionConfig?: ViewTransitionConfig) => {
			if (transitionConfig) {
				return startTransition(() => {
					navigateFunction(path, navigationOptions)
				}, transitionConfig)
			} else {
				return navigateFunction(path, navigationOptions)
			}
		},
		[navigateFunction, startTransition],
	)
}

export default useViewTransition
