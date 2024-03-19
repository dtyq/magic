import React, { useState, useRef, useEffect } from "react"
import { Tooltip } from "antd"

interface EllipsisTooltipProps {
	title: React.ReactNode
	children: React.ReactElement
	placement?:
		| "top"
		| "left"
		| "right"
		| "bottom"
		| "topLeft"
		| "topRight"
		| "bottomLeft"
		| "bottomRight"
		| "leftTop"
		| "leftBottom"
		| "rightTop"
		| "rightBottom"
}

/**
 * 只在文本内容超出并被截断时才显示tooltip的组件
 */
const EllipsisTooltip: React.FC<EllipsisTooltipProps> = ({
	title,
	children,
	placement = "topLeft",
	...restProps
}) => {
	const [isEllipsis, setIsEllipsis] = useState(false)
	const textRef = useRef<HTMLDivElement>(null)

	const checkEllipsis = () => {
		const element = textRef.current
		if (element) {
			setIsEllipsis(element.scrollWidth > element.clientWidth)
		}
	}

	useEffect(() => {
		checkEllipsis()

		// 使用ResizeObserver监听元素尺寸变化
		const element = textRef.current
		if (!element) return

		const resizeObserver = new ResizeObserver(() => {
			checkEllipsis()
		})

		resizeObserver.observe(element)

		// 监听窗口大小变化，重新检查是否溢出
		const handleResize = () => checkEllipsis()
		window.addEventListener("resize", handleResize)

		return () => {
			resizeObserver.disconnect()
			window.removeEventListener("resize", handleResize)
		}
	}, [children, title]) // 添加children和title作为依赖

	// 将ref传递给子元素，以便我们可以检查它的宽度
	const childrenWithRef = React.cloneElement(children, {
		ref: textRef,
	})

	return isEllipsis ? (
		<Tooltip title={title} placement={placement} {...restProps}>
			{childrenWithRef}
		</Tooltip>
	) : (
		childrenWithRef
	)
}

export default EllipsisTooltip
