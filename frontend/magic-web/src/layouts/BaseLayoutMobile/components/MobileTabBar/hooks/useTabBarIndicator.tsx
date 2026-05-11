import { useEffect, useRef, useState } from "react"

interface SelectedIndicatorStyle {
	left: number
	width: number
}

interface UseTabBarIndicatorOptions {
	activeKey: string
	containerClassName?: string
	indicatorClassName: string
	layoutKey?: string
}

export function useTabBarIndicator({
	activeKey,
	indicatorClassName,
	layoutKey,
}: UseTabBarIndicatorOptions) {
	const tabBarRef = useRef<HTMLDivElement>(null)
	const [selectedIndicatorStyle, setSelectedIndicatorStyle] =
		useState<SelectedIndicatorStyle | null>(null)

	// 更新选中框位置
	useEffect(() => {
		const updateIndicatorPosition = () => {
			if (!tabBarRef.current) return

			// 查找自定义 TabBar 的容器
			const wrapElement = tabBarRef.current.querySelector("[data-tabbar-wrap]") as HTMLElement
			if (!wrapElement) return

			// 查找当前激活的 tab item（通过 data-active 属性）
			const activeTabElement = wrapElement.querySelector(
				`[data-tab-key="${activeKey}"]`,
			) as HTMLElement
			if (!activeTabElement) {
				setSelectedIndicatorStyle(null)
				return
			}

			const wrapRect = wrapElement.getBoundingClientRect()
			const tabRect = activeTabElement.getBoundingClientRect()

			// 计算相对于 wrap 的位置
			const left = tabRect.left - wrapRect.left
			const width = tabRect.width

			setSelectedIndicatorStyle({
				left,
				width,
			})
		}

		// 延迟到本次渲染布局完成后测量，避免接口返回后 tab 数量变化时读取到旧宽度。
		const frameId = window.requestAnimationFrame(updateIndicatorPosition)

		// 监听窗口大小变化
		window.addEventListener("resize", updateIndicatorPosition)

		return () => {
			window.cancelAnimationFrame(frameId)
			window.removeEventListener("resize", updateIndicatorPosition)
		}
	}, [activeKey, layoutKey])

	// 渲染选中框指示器
	const renderIndicator = () => {
		if (!selectedIndicatorStyle) return null

		return (
			<div
				className={indicatorClassName}
				style={{
					left: `${selectedIndicatorStyle.left}px`,
					width: `${selectedIndicatorStyle.width}px`,
				}}
			/>
		)
	}

	return {
		tabBarRef,
		renderIndicator,
	}
}
