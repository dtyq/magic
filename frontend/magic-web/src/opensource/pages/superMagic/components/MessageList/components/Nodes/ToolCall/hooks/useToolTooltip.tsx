import { useState, useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { createPortal } from "react-dom"
import { createStyles } from "antd-style"

interface UseToolTooltipOptions {
	text?: string
	placement?: "top" | "bottom" | "left" | "right"
	/** 是否需要检测溢出，只有溢出时才显示 tooltip */
	checkOverflow?: boolean
}

interface UseToolTooltipReturn {
	tooltipProps: {
		ref: React.RefObject<HTMLDivElement>
		onMouseEnter: () => void
		onMouseLeave: () => void
	}
	renderTooltip: () => React.ReactPortal | null
}

const useStyles = createStyles(({ token }) => {
	return {
		tooltip: {
			position: "fixed",
			// 使用 Antd Tooltip 的默认样式
			backgroundColor: "rgba(0, 0, 0, 0.85)",
			borderRadius: token.borderRadiusSM,
			padding: "4px 6px",
			color: "#fff",
			zIndex: 9999,
			boxShadow:
				"0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)",
			pointerEvents: "none",
			// 处理超长文本
			maxWidth: "310px",
			width: "max-content",
			wordWrap: "break-word",
			wordBreak: "break-word",
			whiteSpace: "pre-wrap",
			fontSize: "12px",
			lineHeight: "16px",
		},
		arrow: {
			position: "absolute",
			width: "8px",
			height: "8px",
			backgroundColor: "rgba(0, 0, 0, 0.85)",
			transform: "rotate(45deg)",
			pointerEvents: "none",
		},
		arrowTop: {
			bottom: "-4px",
			left: "50%",
			marginLeft: "-4px",
		},
		arrowBottom: {
			top: "-4px",
			left: "50%",
			marginLeft: "-4px",
		},
		arrowLeft: {
			right: "-4px",
			top: "50%",
			marginTop: "-4px",
		},
		arrowRight: {
			left: "-4px",
			top: "50%",
			marginTop: "-4px",
		},
	}
})

export function useToolTooltip({
	text,
	placement = "top",
	checkOverflow = true,
}: UseToolTooltipOptions): UseToolTooltipReturn {
	const { styles, cx } = useStyles()
	const targetRef = useRef<HTMLDivElement>(null)
	const [isVisible, setIsVisible] = useState(false)
	const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

	const updateTooltipPosition = useMemoizedFn(() => {
		if (targetRef.current) {
			const rect = targetRef.current.getBoundingClientRect()
			let x = 0
			let y = 0

			switch (placement) {
				case "top":
					x = rect.left + rect.width / 2
					y = rect.top - 8
					break
				case "bottom":
					x = rect.left + rect.width / 2
					y = rect.bottom + 8
					break
				case "left":
					x = rect.left - 8
					y = rect.top + rect.height / 2
					break
				case "right":
					x = rect.right + 8
					y = rect.top + rect.height / 2
					break
			}

			setTooltipPosition({ x, y })
		}
	})

	const handleMouseEnter = useMemoizedFn(() => {
		if (!text) return

		// 如果需要检测溢出
		if (checkOverflow && targetRef.current) {
			const isOverflow = targetRef.current.scrollWidth > targetRef.current.clientWidth
			if (!isOverflow) return
		}

		setIsVisible(true)
		updateTooltipPosition()
	})

	const handleMouseLeave = useMemoizedFn(() => {
		setIsVisible(false)
	})

	// 监听滚动和窗口大小变化，更新 tooltip 位置
	useEffect(() => {
		if (isVisible) {
			const handleUpdate = () => updateTooltipPosition()
			window.addEventListener("scroll", handleUpdate, true)
			window.addEventListener("resize", handleUpdate)
			return () => {
				window.removeEventListener("scroll", handleUpdate, true)
				window.removeEventListener("resize", handleUpdate)
			}
		}
	}, [isVisible, updateTooltipPosition])

	const renderTooltip = useMemoizedFn(() => {
		if (!isVisible || !text) {
			return null
		}

		const getTransform = () => {
			switch (placement) {
				case "top":
					return "translate(-50%, -100%)"
				case "bottom":
					return "translate(-50%, 0)"
				case "left":
					return "translate(-100%, -50%)"
				case "right":
					return "translate(0, -50%)"
				default:
					return "translate(-50%, -100%)"
			}
		}

		const getArrowClass = () => {
			switch (placement) {
				case "top":
					return styles.arrowTop
				case "bottom":
					return styles.arrowBottom
				case "left":
					return styles.arrowLeft
				case "right":
					return styles.arrowRight
				default:
					return styles.arrowTop
			}
		}

		return createPortal(
			<div
				className={styles.tooltip}
				style={{
					left: `${tooltipPosition.x}px`,
					top: `${tooltipPosition.y}px`,
					transform: getTransform(),
				}}
			>
				{text}
				<div className={cx(styles.arrow, getArrowClass())} />
			</div>,
			document.body,
		)
	})

	return {
		tooltipProps: {
			ref: targetRef,
			onMouseEnter: handleMouseEnter,
			onMouseLeave: handleMouseLeave,
		},
		renderTooltip,
	}
}
