import { useEffect, useLayoutEffect, useRef } from "react"
import { findLastElement, manageCursor } from "../utils"
import { globalCursorManager } from "../utils/cursor"
import { domCache } from "../utils/cache"

interface CursorManagerProps {
	content?: string
	isStreaming: boolean
	classNameRef: React.MutableRefObject<string>
	cursorClassName: string
}

/**
 * 处理流式渲染时的光标管理
 */
export const useCursorManager = (props: CursorManagerProps) => {
	const { content, isStreaming, classNameRef, cursorClassName } = props
	const cursorAddedRef = useRef<boolean>(false)
	const previousStreamingRef = useRef<boolean>(false)
	const contentRef = useRef<string | undefined>("")
	const finalCleanupRef = useRef<boolean>(false)

	// 初始化光标管理器（全局单例）
	useEffect(() => {
		if (!globalCursorManager.instance) {
			globalCursorManager.instance = manageCursor(cursorClassName)
		}
	}, [cursorClassName])

	// 内容变化或流式状态变化时处理光标
	useLayoutEffect(() => {
		// 只在内容真正变化时添加光标，避免不必要的DOM操作
		if (!isStreaming || !content || content === contentRef.current) return

		contentRef.current = content

		// 使用缓存获取父节点，避免重复查询
		const parentSelector = `.${classNameRef.current}`
		const parent =
			domCache.getNode(parentSelector) ||
			(document.querySelector(parentSelector) as HTMLElement)

		if (!parent) return

		// 更新缓存
		if (!domCache.nodes.has(parentSelector)) {
			domCache.nodes.set(parentSelector, parent)
		}

		// 流式渲染时，每次内容更新都需要重新定位光标
		if (isStreaming) {
			// 标记需要进行最终清理
			finalCleanupRef.current = true

			// 首先清除现有光标
			globalCursorManager.instance?.clearAllCursors()

			// 获取最后一个子元素节点
			const lastChild = parent.lastElementChild

			if (!lastChild) return

			let targetElement = lastChild as HTMLElement

			// 使用requestAnimationFrame优化DOM操作，确保在浏览器空闲时进行
			requestAnimationFrame(() => {
				// 根据不同标签类型处理
				if (targetElement.tagName === "PRE") {
					// 代码块
					const codeElement = targetElement.querySelector("code")
					if (codeElement) {
						targetElement = findLastElement(codeElement)
					}
				} else if (targetElement.tagName === "OL" || targetElement.tagName === "UL") {
					// 列表
					const lastLi = targetElement.lastElementChild as HTMLElement
					if (lastLi) {
						targetElement = findLastElement(lastLi)
					}
				} else if (targetElement.tagName === "TABLE") {
					// 表格
					const lastCell = targetElement.querySelector(
						"tr:last-child td:last-child, tr:last-child th:last-child",
					) as HTMLElement
					if (lastCell) {
						targetElement = findLastElement(lastCell)
					}
				} else if (targetElement.className === "table-container") {
					// 处理表格容器
					const table = targetElement.querySelector("table")
					if (table) {
						const lastCell = table.querySelector(
							"tr:last-child td:last-child, tr:last-child th:last-child",
						) as HTMLElement
						if (lastCell) {
							targetElement = findLastElement(lastCell)
						}
					}
				} else if (targetElement.tagName === "BLOCKQUOTE") {
					// 引用块
					targetElement = findLastElement(targetElement)
				} else {
					// 其他元素（div, span, p等）
					targetElement = findLastElement(targetElement)
				}

				// 添加光标
				if (targetElement) {
					globalCursorManager.instance?.addCursorToElement(targetElement)
					cursorAddedRef.current = true
				}
			})
		}
	}, [content, isStreaming, classNameRef])

	// 监听流式渲染状态变化
	useEffect(() => {
		// 记录先前的流式状态
		const wasStreaming = previousStreamingRef.current
		previousStreamingRef.current = isStreaming

		// 流式渲染结束时，清除所有光标并重置标记
		if (wasStreaming && !isStreaming) {
			setTimeout(() => {
				globalCursorManager.instance?.clearAllCursors()
				cursorAddedRef.current = false
				finalCleanupRef.current = false
			}, 100)
		}
	}, [isStreaming])

	// 增加一个额外的useEffect，确保在所有内容完成后检查是否需要清理光标
	useEffect(() => {
		// 当内容不再变化且已经添加过光标，并且流式渲染已结束时，执行最终清理
		if (finalCleanupRef.current && !isStreaming) {
			// 使用requestAnimationFrame替代固定时间延迟，确保在下一帧渲染时进行清理
			const cleanupFrame = requestAnimationFrame(() => {
				// 检查内容是否还是最新的，避免潜在的竞态条件
				if (content === contentRef.current) {
					globalCursorManager.instance?.clearAllCursors()
					cursorAddedRef.current = false
					finalCleanupRef.current = false
				}
			})

			return () => cancelAnimationFrame(cleanupFrame)
		}

		// 添加一个空的返回函数，确保所有条件分支都有返回值
		return () => {}
	}, [content, isStreaming])

	// 组件卸载时清理资源
	useEffect(() => {
		return () => {
			if (contentRef.current) {
				// 清理光标和DOM缓存
				globalCursorManager.instance?.clearAllCursors()
				domCache.clearCache()
			}
		}
	}, [])
}
