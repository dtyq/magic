import { useCallback, useEffect, useState } from "react"

export type ModalAnimationType = "fade" | "scale" | "slideUp" | "slideDown"

interface UseModalAnimationOptions {
	/** 动画类型 */
	type?: ModalAnimationType
	/** 动画持续时间 (ms) */
	duration?: number
	/** 缓动函数 */
	easing?: string
	/** 进入完成回调 */
	onEntered?: () => void
	/** 退出完成回调 */
	onExited?: () => void
}

interface UseModalAnimationReturn {
	/** 是否应该渲染 */
	shouldRender: boolean
	/** 是否正在动画中 */
	isAnimating: boolean
	/** 获取模态框样式 */
	getModalStyles: () => React.CSSProperties
	/** 获取背景遮罩样式 */
	getBackdropStyles: () => React.CSSProperties
	/** 获取模态框类名 */
	getModalClassName: (baseClassName?: string) => string
}

const getModalTransform = (type: ModalAnimationType, isVisible: boolean): string => {
	if (isVisible) return "translate(0, 0) scale(1)"

	switch (type) {
		case "scale":
			return "translate(0, 0) scale(0.8)"
		case "slideUp":
			return "translateY(100%)"
		case "slideDown":
			return "translateY(-100%)"
		case "fade":
		default:
			return "translate(0, 0) scale(1)"
	}
}

const getModalOpacity = (type: ModalAnimationType, isVisible: boolean): number => {
	if (type === "slideUp" || type === "slideDown") return 1
	return isVisible ? 1 : 0
}

export function useModalAnimation(
	visible: boolean,
	options: UseModalAnimationOptions = {},
): UseModalAnimationReturn {
	const {
		type = "fade",
		duration = 200,
		easing = "cubic-bezier(0.4, 0, 0.2, 1)",
		onEntered,
		onExited,
	} = options

	const [isOpen, setIsOpen] = useState(visible)
	const [isAnimating, setIsAnimating] = useState(false)

	useEffect(() => {
		if (visible && !isOpen) {
			setIsOpen(true)
			setIsAnimating(true)

			const timer = setTimeout(() => {
				setIsAnimating(false)
				onEntered?.()
			}, duration)

			return () => clearTimeout(timer)
		}

		if (!visible && isOpen) {
			setIsAnimating(true)

			const timer = setTimeout(() => {
				setIsOpen(false)
				setIsAnimating(false)
				onExited?.()
			}, duration)

			return () => clearTimeout(timer)
		}
	}, [visible, isOpen, duration, onEntered, onExited])

	const getModalStyles = useCallback((): React.CSSProperties => {
		const isVisible = visible && isOpen

		return {
			opacity: getModalOpacity(type, isVisible),
			transform: getModalTransform(type, isVisible),
			transition: `all ${duration}ms ${easing}`,
			pointerEvents: isVisible ? "auto" : "none",
		}
	}, [visible, isOpen, type, duration, easing])

	const getBackdropStyles = useCallback((): React.CSSProperties => {
		const isVisible = visible && isOpen

		return {
			opacity: isVisible ? 1 : 0,
			transition: `opacity ${duration}ms ${easing}`,
			pointerEvents: isVisible ? "auto" : "none",
		}
	}, [visible, isOpen, duration, easing])

	const getModalClassName = useCallback(
		(baseClassName?: string): string => {
			const classes = [baseClassName].filter(Boolean)

			if (isAnimating) {
				classes.push("modal-animating")
			}

			if (visible && isOpen) {
				classes.push("modal-open")
			}

			return classes.join(" ")
		},
		[visible, isOpen, isAnimating],
	)

	return {
		shouldRender: isOpen || isAnimating,
		isAnimating,
		getModalStyles,
		getBackdropStyles,
		getModalClassName,
	}
}
