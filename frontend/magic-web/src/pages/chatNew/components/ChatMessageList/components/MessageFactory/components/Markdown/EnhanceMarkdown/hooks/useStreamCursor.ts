import { useUpdateEffect } from "ahooks"
import { useStreamStyles } from "../styles/stream.style"
import { RefObject } from "react"

function useStreamCursor(
	isStreaming: boolean,
	content: string,
	markdownRef: RefObject<HTMLDivElement>,
) {
	const { styles: streamStyles } = useStreamStyles()

	// 流式光标效果
	useUpdateEffect(() => {
		// 只有在流式渲染模式下才添加光标
		if (!isStreaming) return

		const markdowns = markdownRef.current?.querySelectorAll(".markdown-content")

		// 添加标记，防止死循环
		let isAddingCursor = false

		// 清除所有现有光标
		const clearCursors = () => {
			if (!markdownRef.current) return
			const existingCursors = markdownRef.current.querySelectorAll(`.${streamStyles.cursor}`)
			existingCursors.forEach((cursor) => cursor.remove())
		}

		// 添加光标到最后一个内容块
		const addCursor = (lastBlock?: Element | null) => {
			// 防止重复调用造成死循环
			if (isAddingCursor || !markdownRef.current) return

			try {
				isAddingCursor = true
				clearCursors()

				lastBlock = lastBlock || markdownRef.current.lastElementChild
				if (lastBlock && lastBlock?.childNodes.length <= 0) {
					lastBlock = lastBlock?.parentElement
				}

				// 找到最后一个文本块
				if (lastBlock) {
					// 找到最后一个文本节点
					const findLastTextNode = (element: Element): Element => {
						const children = element?.childNodes ?? []
						if (children.length === 0) return element.parentElement as Element

						const lastChild = Array.from(children).findLast(
							(child) =>
								child &&
								child.textContent !== "\n" &&
								!(child as Element).classList?.contains(streamStyles.cursor),
						)

						if (!lastChild) {
							return element.parentElement as Element
						}

						return findLastTextNode(lastChild as Element)
					}

					let lastElement = findLastTextNode(lastBlock)

					if (lastElement) {
						// 以下元素不打印光标
						if (
							lastElement.tagName === "CODE" ||
							lastElement.tagName === "TH" ||
							lastElement.tagName === "TD" ||
							lastElement.tagName === "BUTTON" ||
							lastElement?.className?.includes?.("magic-code-copy")
						) {
							return
						}

						if (lastElement.tagName === "SUP" || lastElement.tagName === "STRONG") {
							lastElement = lastElement.parentElement as Element
						}

						if (lastElement.tagName === "UL" || lastElement.tagName === "OL") {
							lastElement = lastElement.lastElementChild as Element
						}

						const cursor = document.createElement("span")
						cursor.className = streamStyles.cursor
						cursor.setAttribute("data-cursor", "true")
						lastElement.appendChild(cursor)
					}
				}
			} finally {
				// 确保始终重置标记
				setTimeout(() => {
					isAddingCursor = false
				}, 0)
			}
		}

		// 配置 MutationObserver
		const observer = new MutationObserver((mutations) => {
			let lastBlock = markdownRef.current?.lastElementChild
			// 过滤掉光标引起的变化
			const realContentChanges = mutations.some((mutation) => {
				// 遍历添加的节点，判断是否只有光标元素
				if (mutation.type === "childList") {
					for (const node of Array.from(mutation.addedNodes)) {
						// 如果添加的不是光标元素，说明有实际内容变化
						if (node.nodeType === Node.ELEMENT_NODE) {
							const elem = node as Element
							if (!elem.getAttribute || elem.getAttribute("data-cursor") !== "true") {
								lastBlock = elem
								return true
							}
						} else if (node.nodeType === Node.TEXT_NODE) {
							// 文本节点变化也是内容变化
							lastBlock = node as Element
							return true
						}
					}
				}
				return false
			})

			// 只有实际内容发生变化时才添加光标
			if (realContentChanges && !isAddingCursor) {
				addCursor(lastBlock)
			}
		})

		if (markdowns && markdowns.length > 0) {
			// 初始添加光标
			addCursor()
			markdowns.forEach((markdown) => {
				// 只观察子节点变化，不观察属性和文字内容变化
				observer.observe(markdown, {
					characterData: true,
					childList: true,
					subtree: true,
				})
			})
		}

		return () => {
			clearCursors()
			observer.disconnect()
		}
	}, [isStreaming, content, streamStyles.cursor])
}

export default useStreamCursor
