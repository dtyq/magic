import type { ClipboardEvent } from "react"

/** 大文件没有 ProseMirror 文档切片；只清理选区副本，不修改页面或 Markdown 源码。 */
export function copyMarkdownFileLinks(event: ClipboardEvent<HTMLDivElement>): void {
	const selection = window.getSelection()
	if (!selection?.rangeCount || selection.isCollapsed) return
	const fragment = document.createElement("div")
	for (let index = 0; index < selection.rangeCount; index += 1) {
		const range = selection.getRangeAt(index)
		if (!event.currentTarget.contains(range.commonAncestorContainer)) return
		fragment.appendChild(range.cloneContents())
	}
	const links = fragment.querySelectorAll<HTMLAnchorElement>("a[data-file-href]")
	if (!links.length) return
	fragment.querySelectorAll("[data-file-reference-preview-ui]").forEach((node) => node.remove())
	links.forEach((link) => {
		const href = link.getAttribute("data-file-href")
		if (href !== null) link.setAttribute("href", href)
		const title = link.getAttribute("data-file-title")
		if (title !== null) link.setAttribute("title", title)
		link.removeAttribute("data-file-href")
		link.removeAttribute("data-file-title")
		link.removeAttribute("role")
		link.removeAttribute("tabindex")
	})
	event.clipboardData.setData("text/html", fragment.innerHTML)
	event.clipboardData.setData("text/plain", selection.toString())
	event.preventDefault()
}
