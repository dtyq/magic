/**
 * 剪贴板工具函数 - 提供跨平台兼容的剪贴板操作
 *
 * 核心策略：
 * - clipboard.writeText / clipboard.write：优先使用 Clipboard API，
 *   HTTP 环境或权限被拒绝时自动降级到 execCommand
 * - copyWithMetadata：将元数据 Base64 编码后嵌入 HTML data 属性（移动端兼容方案）
 * - 粘贴：优先从 HTML data 属性读取，降级到自定义 MIME 类型
 *
 * 用法：
 *   import { clipboard } from "@/utils/clipboard-helpers"
 *   await clipboard.writeText("hello")
 *   await clipboard.write([new ClipboardItem({ ... })])
 */

/**
 * 写入纯文本到剪贴板
 * HTTP 环境或权限被拒绝时自动降级到 execCommand
 */
async function _writeText(text: string): Promise<void> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text)
			return
		} catch {
			// 降级到 execCommand
		}
	}
	fallbackWriteText(text)
}

/**
 * 写入 ClipboardItem 列表到剪贴板
 * 降级时依次尝试从 text/plain、text/html 提取内容
 */
async function _write(items: ClipboardItem[]): Promise<void> {
	if (navigator.clipboard?.write) {
		try {
			await navigator.clipboard.write(items)
			return
		} catch {
			// 降级到 execCommand
		}
	}

	// 降级：从 ClipboardItem 中提取可用格式
	for (const item of items) {
		if (item.types.includes("text/plain")) {
			const blob = await item.getType("text/plain")
			fallbackWriteText(await blob.text())
			return
		}
		if (item.types.includes("text/html")) {
			const blob = await item.getType("text/html")
			fallbackWriteHtml(await blob.text())
			return
		}
	}
}

/**
 * navigator.clipboard 的兼容替代，自动处理 HTTP 降级。
 * 接口与原生 Clipboard API 保持一致，调用方语义清晰。
 */
export const clipboard = {
	writeText: _writeText,
	write: _write,
}

/** 纯文本 execCommand 降级方案 */
function fallbackWriteText(text: string): void {
	const textarea = document.createElement("textarea")
	textarea.value = text
	textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none"
	textarea.setAttribute("readonly", "")
	document.body.appendChild(textarea)
	textarea.select()
	textarea.setSelectionRange(0, text.length)
	document.execCommand("copy")
	document.body.removeChild(textarea)
}

/** HTML 富文本 execCommand 降级方案（保留富文本格式） */
function fallbackWriteHtml(html: string): void {
	const div = document.createElement("div")
	div.contentEditable = "true"
	div.style.cssText =
		"position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;width:1px;height:1px"
	div.innerHTML = html
	document.body.appendChild(div)

	const range = document.createRange()
	range.selectNodeContents(div)
	const selection = window.getSelection()
	selection?.removeAllRanges()
	selection?.addRange(range)
	div.focus()

	let handled = false
	const onCopy = (e: ClipboardEvent) => {
		e.preventDefault()
		e.stopPropagation()
		handled = true
		e.clipboardData?.setData("text/html", html)
		e.clipboardData?.setData("text/plain", div.innerText)
		document.removeEventListener("copy", onCopy)
	}
	document.addEventListener("copy", onCopy)

	try {
		document.execCommand("copy")
	} finally {
		selection?.removeAllRanges()
		document.removeEventListener("copy", onCopy)
		document.body.removeChild(div)
	}

	// copy 事件未触发时，降级为纯文本复制
	if (!handled) fallbackWriteText(div.innerText)
}

export interface MagicClipboardMetadata {
	richText?: string
	mentions?: unknown[]
	type?: string
	messageId?: string
	[key: string]: unknown
}

/**
 * 从剪贴板数据中提取元数据
 * 优先级: HTML data属性 > 自定义MIME类型 > null
 */
export function extractClipboardMetadata(
	clipboardData: DataTransfer | null,
): MagicClipboardMetadata | null {
	if (!clipboardData) return null

	try {
		// 方案1: 从HTML的data属性中提取元数据(移动端兼容方案,优先级最高)
		const html = clipboardData.getData("text/html")
		if (html) {
			const metadata = extractMetadataFromHTML(html)
			if (metadata) {
				console.log("✅ Extracted metadata from HTML data attribute")
				return metadata
			}
		}

		// 方案2: 尝试读取自定义MIME类型(桌面端浏览器可能支持)
		const richTextCustom = clipboardData.getData("text/x-magic-message-rich-text")
		const mentionsCustom = clipboardData.getData("text/x-magic-message-mentions")

		if (richTextCustom || mentionsCustom) {
			console.log("✅ Extracted metadata from custom MIME types")
			return {
				richText: richTextCustom || undefined,
				mentions: mentionsCustom ? JSON.parse(mentionsCustom) : undefined,
			}
		}

		// 方案3: 如果都没有,返回null(表示是普通粘贴)
		return null
	} catch (error) {
		console.error("❌ Error extracting clipboard metadata:", error)
		return null
	}
}

/**
 * 从HTML字符串中提取元数据
 */
export function extractMetadataFromHTML(html: string): MagicClipboardMetadata | null {
	try {
		// 使用正则表达式提取data-magic-clipboard属性(避免DOMParser在某些环境下的问题)
		const match = html.match(/data-magic-clipboard=["']([^"']+)["']/)
		if (!match) return null

		const metadataBase64 = match[1]
		const metadataJson = decodeURIComponent(atob(metadataBase64))
		return JSON.parse(metadataJson)
	} catch (err) {
		console.warn("⚠️ Failed to parse clipboard metadata from HTML:", err)
		return null
	}
}

/**
 * 将内容和元数据复制到剪贴板(兼容移动端和iOS)
 * @param plainText 纯文本内容
 * @param htmlContent HTML内容(可选,如果为空则使用转义后的plainText)
 * @param metadata 元数据对象
 */
export function copyWithMetadata(
	plainText: string,
	metadata: MagicClipboardMetadata,
	htmlContent?: string,
): void {
	// 构建包含元数据的HTML
	const metadataBase64 = btoa(encodeURIComponent(JSON.stringify(metadata)))

	// 如果提供了HTML内容,将元数据嵌入到外层div
	// 如果没有,则创建一个包含转义文本的div
	const htmlWithMetadata = htmlContent
		? `<div data-magic-clipboard="${metadataBase64}">${htmlContent}</div>`
		: `<div data-magic-clipboard="${metadataBase64}">${escapeHtml(plainText)}</div>`

	// 方案1: 尝试使用现代 Clipboard API (iOS 13.4+, Android Chrome 63+)
	if (navigator.clipboard && window.isSecureContext) {
		// 创建 ClipboardItem (支持多种格式)
		const items: Record<string, Blob> = {
			"text/plain": new Blob([plainText], { type: "text/plain" }),
			"text/html": new Blob([htmlWithMetadata], { type: "text/html" }),
		}

		navigator.clipboard
			.write([new ClipboardItem(items)])
			.then(() => {
				console.log("✅ Clipboard API copy success")
			})
			.catch((err) => {
				console.warn("⚠️ Clipboard API failed, fallback to execCommand:", err)
				// 降级到传统方案
				fallbackCopyWithExecCommand(plainText, htmlWithMetadata, metadata)
			})
	} else {
		// 方案2: 降级到传统 execCommand 方案
		fallbackCopyWithExecCommand(plainText, htmlWithMetadata, metadata)
	}
}

/**
 * 使用传统 execCommand 方式复制(兼容iOS低版本)
 */
function fallbackCopyWithExecCommand(
	plainText: string,
	htmlWithMetadata: string,
	metadata: MagicClipboardMetadata,
): void {
	// 创建一个隐藏的可编辑div (iOS需要实际可选中的元素)
	const container = document.createElement("div")
	container.contentEditable = "true"
	container.style.position = "fixed"
	container.style.top = "-9999px"
	container.style.left = "-9999px"
	container.style.opacity = "0"
	container.style.pointerEvents = "none"
	// iOS需要一定的尺寸才能选中
	container.style.width = "1px"
	container.style.height = "1px"

	// 设置HTML内容
	container.innerHTML = htmlWithMetadata

	document.body.appendChild(container)

	// 创建选区并选中内容 (iOS必需)
	const range = document.createRange()
	range.selectNodeContents(container)
	const selection = window.getSelection()
	if (selection) {
		selection.removeAllRanges()
		selection.addRange(range)
	}

	// 设置焦点 (iOS必需)
	container.focus()

	// 设置copy事件监听器
	let copyHandled = false
	const handleCopy = (e: ClipboardEvent) => {
		e.preventDefault()
		e.stopPropagation()
		copyHandled = true

		// 1. 设置纯文本(所有应用都支持)
		e.clipboardData?.setData("text/plain", plainText)

		// 2. 设置HTML(移动端支持,可嵌入元数据)
		e.clipboardData?.setData("text/html", htmlWithMetadata)

		// 3. 尝试设置自定义格式(仅桌面端部分浏览器支持)
		try {
			if (metadata.richText) {
				e.clipboardData?.setData("text/x-magic-message-rich-text", metadata.richText)
			}
			if (metadata.mentions) {
				e.clipboardData?.setData(
					"text/x-magic-message-mentions",
					JSON.stringify(metadata.mentions),
				)
			}
		} catch (err) {
			console.warn("⚠️ Custom MIME type not supported (expected on mobile):", err)
		}

		// 移除事件监听
		document.removeEventListener("copy", handleCopy)
	}

	// 添加事件监听
	document.addEventListener("copy", handleCopy)

	// 执行复制命令
	let success = false
	try {
		success = document.execCommand("copy")
		console.log(`📋 execCommand('copy') result: ${success}, copyHandled: ${copyHandled}`)
	} catch (err) {
		console.error("❌ execCommand failed:", err)
	} finally {
		// 清理
		if (selection) {
			selection.removeAllRanges()
		}
		document.removeEventListener("copy", handleCopy)
		document.body.removeChild(container)
	}

	// iOS即使返回false,实际可能已经复制成功(如果触发了copy事件)
	if (!success && !copyHandled) {
		console.warn("⚠️ Copy may have failed, execCommand returned false and no copy event fired")
		throw new Error("Copy operation failed")
	}
}

/**
 * 转义HTML特殊字符
 */
function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;",
	}
	return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * 检查是否是来自Magic应用的剪贴板数据
 */
export function isMagicClipboard(clipboardData: DataTransfer | null): boolean {
	if (!clipboardData) return false

	// 检查HTML中是否有data-magic-clipboard属性
	const html = clipboardData.getData("text/html")
	if (html && html.includes("data-magic-clipboard")) {
		return true
	}

	// 检查是否有自定义MIME类型(桌面端)
	const types = Array.from(clipboardData.types || [])
	if (types.includes("text/x-magic-message-rich-text")) {
		return true
	}

	return false
}
