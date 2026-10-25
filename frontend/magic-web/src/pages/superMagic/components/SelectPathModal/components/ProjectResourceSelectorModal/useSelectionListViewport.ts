import { useLayoutEffect, useState } from "react"

/** 用真实行距裁出下一行的一半；容器负责可用高度，viewport 负责滚动，避免测量自身导致反复缩小。 */
export function useSelectionListViewport(rowSelector: string, itemCount: number, layout?: string) {
	// Dialog Portal 可能晚于父组件 effect 挂载，跟随真实节点建立观察，首次打开也能测量。
	const [container, containerRef] = useState<HTMLDivElement | null>(null)
	const [viewport, viewportRef] = useState<HTMLDivElement | null>(null)
	const [height, setHeight] = useState<number>()
	useLayoutEffect(() => {
		if (!container || !viewport) return
		const measure = () => {
			const available = container.clientHeight
			const rows = viewport.querySelectorAll<HTMLElement>(rowSelector)
			const first = rows[0]
			if (!first || !available || viewport.scrollHeight <= available) {
				setHeight(undefined)
				return
			}
			const firstRect = first.getBoundingClientRect()
			// 入场缩放动画会缩放 DOMRect；用视口比例还原布局像素，不能把动画中的尺寸保存为列表高度。
			const viewportRect = viewport.getBoundingClientRect()
			const scale = viewport.offsetWidth ? viewportRect.width / viewport.offsetWidth : 1
			const next = Array.from(rows).find(
				(row) => row.getBoundingClientRect().top > firstRect.top + 1,
			)
			const stride =
				(next ? next.getBoundingClientRect().top - firstRect.top : firstRect.height) / scale
			const padding = (firstRect.top - viewportRect.top) / scale + viewport.scrollTop
			if (stride <= 0) return
			const halfRow = firstRect.height / scale / 2
			const wholeRows = Math.floor((available - padding - halfRow) / stride)
			setHeight(
				wholeRows >= 0
					? Math.min(available, padding + wholeRows * stride + halfRow)
					: undefined,
			)
		}
		const observer = new ResizeObserver(measure)
		observer.observe(container)
		if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
		measure()
		return () => observer.disconnect()
	}, [container, viewport, rowSelector, itemCount, layout])
	return { containerRef, viewportRef, height }
}
