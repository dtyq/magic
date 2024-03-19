import { useCallback, useEffect, useState } from "react"

export type SlideDirection = "left" | "right" | "up" | "down"
export type AnimationState = "entering" | "entered" | "exiting" | "exited"

interface UseSlideAnimationOptions {
	/** 滑动方向 */
	direction?: SlideDirection
	/** 动画持续时间 (ms) */
	duration?: number
	/** 缓动函数 */
	easing?: string
	/** 动画完成回调 */
	onEntered?: () => void
	/** 退出动画完成回调 */
	onExited?: () => void
}

interface UseSlideAnimationReturn {
	/** 当前动画状态 */
	animationState: AnimationState
	/** 是否显示中 */
	isVisible: boolean
	/** 是否正在动画中 */
	isAnimating: boolean
	/** 触发进入动画 */
	enter: () => void
	/** 触发退出动画 */
	exit: () => void
	/** 获取动画样式 */
	getAnimationStyles: () => React.CSSProperties
	/** 获取动画类名 */
	getAnimationClassName: (baseClassName?: string) => string
}

const getTransformByDirection = (direction: SlideDirection): string => {
	switch (direction) {
		case "left":
			return "translateX(-100%)"
		case "right":
			return "translateX(100%)"
		case "up":
			return "translateY(-100%)"
		case "down":
			return "translateY(100%)"
		default:
			return "translateX(100%)"
	}
}

export function useSlideAnimation(
	visible: boolean,
	options: UseSlideAnimationOptions = {},
): UseSlideAnimationReturn {
	const {
		direction = "right",
		duration = 300,
		easing = "cubic-bezier(0.4, 0, 0.2, 1)",
		onEntered,
		onExited,
	} = options

	const [animationState, setAnimationState] = useState<AnimationState>(
		visible ? "entered" : "exited",
	)

	const enter = useCallback(() => {
		setAnimationState("entering")
		// Force reflow to ensure the entering state is applied before transitioning
		requestAnimationFrame(() => {
			setAnimationState("entered")
		})
	}, [])

	const exit = useCallback(() => {
		setAnimationState("exiting")
	}, [])

	// Handle visibility changes
	useEffect(() => {
		if (visible && animationState === "exited") {
			enter()
		} else if (!visible && (animationState === "entered" || animationState === "entering")) {
			exit()
		}
	}, [visible, animationState, enter, exit])

	// Handle animation end events
	useEffect(() => {
		if (animationState === "entering") {
			const timer = setTimeout(() => {
				setAnimationState("entered")
				onEntered?.()
			}, duration)
			return () => clearTimeout(timer)
		}

		if (animationState === "exiting") {
			const timer = setTimeout(() => {
				setAnimationState("exited")
				onExited?.()
			}, duration)
			return () => clearTimeout(timer)
		}
	}, [animationState, duration, onEntered, onExited])

	const getAnimationStyles = useCallback((): React.CSSProperties => {
		const baseStyles: React.CSSProperties = {
			transition: `transform ${duration}ms ${easing}`,
			willChange: "transform",
		}

		switch (animationState) {
			case "entering":
			case "exiting":
				return {
					...baseStyles,
					transform: getTransformByDirection(direction),
				}
			case "entered":
				return {
					...baseStyles,
					transform: "translate(0, 0)",
				}
			case "exited":
				return {
					...baseStyles,
					transform: getTransformByDirection(direction),
				}
			default:
				return baseStyles
		}
	}, [animationState, direction, duration, easing])

	const getAnimationClassName = useCallback(
		(baseClassName?: string): string => {
			const classes = [baseClassName].filter(Boolean)

			switch (animationState) {
				case "entering":
					classes.push("slide-entering")
					break
				case "entered":
					classes.push("slide-entered")
					break
				case "exiting":
					classes.push("slide-exiting")
					break
				case "exited":
					classes.push("slide-exited")
					break
			}

			return classes.join(" ")
		},
		[animationState],
	)

	return {
		animationState,
		isVisible: animationState === "entering" || animationState === "entered",
		isAnimating: animationState === "entering" || animationState === "exiting",
		enter,
		exit,
		getAnimationStyles,
		getAnimationClassName,
	}
}
