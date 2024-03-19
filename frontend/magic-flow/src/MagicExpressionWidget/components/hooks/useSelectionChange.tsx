import { useMemoizedFn } from "ahooks"
import { useEffect } from "react"

export default function useSelectionChange(editRef: any) {
	const handleSelectionChange = useMemoizedFn(() => {
		const selection = window.getSelection()
		if (!selection) return
		if (!selection.rangeCount) return

		// 获取选中的范围
		const range = selection.getRangeAt(0)

		// console.log("selectionChange", range)

		// 查找选中范围内的表达式块
		const expressionBlocks = (editRef?.current?.querySelectorAll?.(".expression-block") ||
			[]) as NodeListOf<Element>
		// console.log("expressionBlocks", editRef?.current?.querySelectorAll?.(".expression-block"))
		// console.log("editRef", editRef)
		expressionBlocks.forEach((block) => {
			if (range.intersectsNode(block)) {
				block.classList.add("selected")
			} else {
				block.classList.remove("selected")
			}
		})
	})

	useEffect(() => {
		document.addEventListener("selectionchange", handleSelectionChange)

		return () => {
			document.removeEventListener("selectionchange", handleSelectionChange)
		}
	}, [])
}
