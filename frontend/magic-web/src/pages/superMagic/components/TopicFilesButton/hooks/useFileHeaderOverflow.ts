import { useLayoutEffect, useRef, useState } from "react"

/** 按完整工具栏测量，低频按钮移入菜单后仍保留测量节点，宽度恢复时不会反复切换。 */
export function useFileHeaderOverflow(compactActions = false) {
	const rowRef = useRef<HTMLDivElement>(null)
	const labelRef = useRef<HTMLSpanElement>(null)
	const actionsRef = useRef<HTMLDivElement>(null)
	const [overflow, setOverflow] = useState(false)

	useLayoutEffect(() => {
		const row = rowRef.current
		const label = labelRef.current
		const actions = actionsRef.current
		if (!row || !label || !actions) return
		const update = () => {
			if (!row.clientWidth) return
			const rowStyle = getComputedStyle(row)
			const actionGap = Number.parseFloat(getComputedStyle(actions).columnGap) || 0
			const rowGap = Number.parseFloat(rowStyle.columnGap) || 0
			const buttons = Array.from(actions.children).filter((node) =>
				compactActions
					? node.hasAttribute("data-toolbar-divider") ||
						node.getAttribute("aria-hidden") !== "true"
					: !node.hasAttribute("data-overflow-trigger"),
			)
			const actionWidth = buttons.reduce(
				(width, node) =>
					width +
					(node.hasAttribute("data-toolbar-divider")
						? Number.parseFloat(getComputedStyle(node).minWidth) || 0
						: node.getBoundingClientRect().width),
				0,
			)
			// 窄布局允许标题折行；测量完整文字，避免用折行后的宽度反复切换布局。
			const previousWhiteSpace = label.style.whiteSpace
			if (compactActions) label.style.whiteSpace = "nowrap"
			const labelWidth = label.getBoundingClientRect().width
			label.style.whiteSpace = previousWhiteSpace
			const actionsStyle = getComputedStyle(actions)
			const leading = row.querySelector<HTMLElement>("[data-header-leading]")
			const chevron = row.querySelector<HTMLElement>("[data-header-chevron]")
			const requiredWidth =
				labelWidth +
				actionWidth +
				(Number.parseFloat(actionsStyle.paddingLeft) || 0) +
				(Number.parseFloat(actionsStyle.paddingRight) || 0) +
				actionGap * Math.max(0, buttons.length - 1) +
				(leading?.parentElement
					? leading.getBoundingClientRect().width +
						(Number.parseFloat(getComputedStyle(leading.parentElement).columnGap) || 0)
					: 0) +
				(chevron?.getBoundingClientRect().width ?? 0) +
				rowGap * Math.max(0, row.children.length - 1) +
				(Number.parseFloat(rowStyle.paddingLeft) || 0) +
				(Number.parseFloat(rowStyle.paddingRight) || 0)
			setOverflow(requiredWidth > row.clientWidth)
		}
		update()
		const observer = new ResizeObserver(update)
		observer.observe(row)
		observer.observe(label)
		observer.observe(actions)
		return () => observer.disconnect()
	})

	return { rowRef, labelRef, actionsRef, overflow }
}
