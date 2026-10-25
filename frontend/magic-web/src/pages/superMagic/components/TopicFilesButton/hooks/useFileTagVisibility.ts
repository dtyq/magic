import { useEffect, type RefObject } from "react"

/**
 * 文件名与完整标签都放得下才显示标签。每个列表只观察容器及已挂载行，虚拟树不扫描未渲染数据。
 * 测量时不改变排版，避免列表高度临时缩小导致底部滚动位置上移；隐藏标签同时退出键盘焦点。
 */
export function useFileTagVisibility(containerRef: RefObject<HTMLElement>) {
	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		let frame = 0
		let disposed = false
		const measure = () => {
			frame = 0
			const rows = [...container.querySelectorAll<HTMLElement>("[data-file-label-row]")]
			const entries = rows.flatMap((row) => {
				const tag = row.querySelector<HTMLElement>("[data-file-tag]")
				const region = row.querySelector<HTMLElement>("[data-file-name-container]")
				const name = row.querySelector<HTMLElement>("[data-file-name]")
				if (!tag || !region || !name) return []
				return [{ row, tag, region, name }]
			})
			const visibility = entries.map(({ row, tag, region, name }) => {
				const range = document.createRange()
				const textNodes = document.createTreeWalker(name, NodeFilter.SHOW_TEXT)
				let textWidth = 0
				while (textNodes.nextNode()) {
					range.selectNodeContents(textNodes.currentNode)
					textWidth += range.getBoundingClientRect().width
				}
				const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0
				const tagStyle = getComputedStyle(tag)
				const tagSpace =
					tag.getBoundingClientRect().width +
					gap +
					(Number.parseFloat(tagStyle.marginLeft) || 0) +
					(Number.parseFloat(tagStyle.marginRight) || 0)
				// 显示时加回标签占用的空间，隐藏时名称容器已得到这部分空间，不能重复加回。
				// 两种状态使用同一可用宽度，既不反复切换，也不计入移动端右侧选择按钮的空间。
				const available =
					region.getBoundingClientRect().right -
					name.getBoundingClientRect().left +
					(tagStyle.position === "absolute" || tagStyle.display === "none" ? 0 : tagSpace)
				return textWidth + tagSpace <= available
			})
			// 全部读取结束后只写入变化的状态；帮助浮窗引起的重复测量不应改动文件行。
			entries.forEach(({ tag }, index) => {
				const visible = visibility[index]
				const position = visible ? "" : "absolute"
				const visibilityValue = visible ? "" : "hidden"
				if (tag.style.position !== position) tag.style.position = position
				if (tag.style.visibility !== visibilityValue) tag.style.visibility = visibilityValue
				if (tag.inert !== !visible) tag.inert = !visible
			})
		}
		const schedule = () => {
			if (!disposed && !frame) frame = requestAnimationFrame(measure)
		}
		const resize = new ResizeObserver(schedule)
		const mutation = new MutationObserver(schedule)
		resize.observe(container)
		mutation.observe(container, { childList: true, subtree: true, characterData: true })
		document.fonts.ready.then(schedule)
		schedule()
		return () => {
			disposed = true
			resize.disconnect()
			mutation.disconnect()
			cancelAnimationFrame(frame)
		}
	}, [containerRef])
}
