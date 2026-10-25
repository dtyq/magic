import type { ClipboardEvent } from "react"
import {
	createCanonicalWorkspaceHref,
	createReferencedProjectHref,
	createUserFileHref,
	parseMarkdownFileHref,
} from "@/pages/superMagic/utils/filePathMention"
import { htmlToClipboardMarkdown } from "./clipboardMarkdown"

const FILE_REFERENCE_SELECTOR = "[data-file-reference]"

function closestFileReference(node: Node): Element | null {
	const element = node instanceof Element ? node : node.parentElement
	return element?.closest(FILE_REFERENCE_SELECTOR) ?? null
}

export function copySelectedFileReferences(event: ClipboardEvent<HTMLDivElement>): void {
	if (event.defaultPrevented || !event.clipboardData) return
	const root = event.currentTarget
	const selection = root.ownerDocument.getSelection()
	if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return

	const range = selection.getRangeAt(0).cloneRange()
	if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return

	// 文件标签与编辑器 Mention 一样按整体复制，不扩大标签外的正文选区。
	const startReference = closestFileReference(range.startContainer)
	const endReference = closestFileReference(range.endContainer)
	if (startReference) range.setStartBefore(startReference)
	if (endReference) range.setEndAfter(endReference)

	const container = root.ownerDocument.createElement("div")
	let fragment: Node = range.cloneContents()
	let ancestor =
		range.commonAncestorContainer instanceof Element
			? range.commonAncestorContainer
			: range.commonAncestorContainer.parentElement
	// cloneContents 不含公共祖先；保留其格式和列表上下文，但不复制祖先中的其他正文。
	while (ancestor && ancestor !== root && root.contains(ancestor)) {
		const wrapper = ancestor.cloneNode(false) as Element
		if (ancestor.tagName === "OL") {
			const index = Array.from(ancestor.children).findIndex((item) =>
				range.intersectsNode(item),
			)
			const start = Number(ancestor.getAttribute("start") || 1)
			if (index >= 0) wrapper.setAttribute("start", String(start + index))
		}
		wrapper.appendChild(fragment)
		fragment = wrapper
		ancestor = ancestor.parentElement
	}
	container.append(fragment)
	const references = container.querySelectorAll<HTMLElement>(FILE_REFERENCE_SELECTOR)
	if (references.length === 0) return

	let linkCount = 0
	for (const reference of references) {
		const target = parseMarkdownFileHref(reference.dataset.fileReference || "")
		if (!target) continue
		const href =
			target.scope === "user"
				? createUserFileHref(
						target.relativePath,
						reference.dataset.fileReference?.endsWith("/"),
					)
				: target.scope === "workspace"
					? createCanonicalWorkspaceHref(target.relativePath)
					: createReferencedProjectHref(target.projectId, target.relativePath)
		const label = reference.querySelector("[data-file-reference-label]")?.textContent || ""
		if (!href || !label) continue

		const anchor = root.ownerDocument.createElement("a")
		anchor.setAttribute("href", href)
		anchor.textContent = label
		// 沿用消息节点的身份属性，站内粘贴按原 ID 鉴权；外部仍得到普通链接。
		const attrs = reference.dataset.magicNodeAttrs
		if (attrs) {
			anchor.dataset.magicNodeType = "mention"
			anchor.dataset.magicNodeAttrs = attrs
		}
		reference.replaceWith(anchor)
		linkCount++
	}
	if (linkCount === 0) return

	const html = container.innerHTML
	const text = htmlToClipboardMarkdown(container)
	event.clipboardData.setData("text/plain", text)
	event.clipboardData.setData("text/html", html)
	event.preventDefault()
}
