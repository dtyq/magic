import { useSlideAnimation, type SlideDirection } from "./useSlideAnimation"

interface UseConversationAnimationOptions {
	/** 滑动方向，默认从右侧进入 */
	direction?: SlideDirection
	/** 动画持续时间，默认300ms */
	duration?: number
	/** 进入完成回调 */
	onEntered?: () => void
	/** 退出完成回调 */
	onExited?: () => void
}

interface UseConversationAnimationReturn {
	/** 是否应该渲染组件 */
	shouldRender: boolean
	/** 是否正在动画中 */
	isAnimating: boolean
	/** 获取容器的动画样式 */
	getContainerStyles: () => React.CSSProperties
	/** 获取容器的动画类名 */
	getContainerClassName: (baseClassName: string) => string
}

export function useConversationAnimation(
	visible: boolean,
	options: UseConversationAnimationOptions = {},
): UseConversationAnimationReturn {
	const { direction = "right", duration = 300, onEntered, onExited } = options

	const slideAnimation = useSlideAnimation(visible, {
		direction,
		duration,
		easing: "cubic-bezier(0.4, 0, 0.2, 1)",
		onEntered,
		onExited,
	})

	const getContainerStyles = (): React.CSSProperties => {
		const animationStyles = slideAnimation.getAnimationStyles()

		return {
			position: "fixed",
			top: 0,
			right: 0,
			height: "100%",
			width: "100vw",
			zIndex: 1000,
			...animationStyles,
		}
	}

	const getContainerClassName = (baseClassName: string): string => {
		return slideAnimation.getAnimationClassName(baseClassName)
	}

	return {
		shouldRender: slideAnimation.isVisible || slideAnimation.isAnimating,
		isAnimating: slideAnimation.isAnimating,
		getContainerStyles,
		getContainerClassName,
	}
}
