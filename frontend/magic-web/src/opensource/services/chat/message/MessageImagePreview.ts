/* eslint-disable class-methods-use-this */
import MessageImagePreviewStore from "@/opensource/stores/chatNew/messagePreview/ImagePreviewStore"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import { isFunction } from "lodash-es"
import { magic } from "@/enhance/magicElectron"
import { ImagePreviewInfo } from "@/types/chat/preview"
import { safeBtoa } from "@/utils/encoding"

class MessageImagePreview {
	setPreviewInfo(info: ImagePreviewInfo) {
		if (!info.messageId || !info.url) return
		info.conversationId = ConversationStore.currentConversation?.id

		if (isFunction(magic?.media?.previewMedia)) {
			magic?.media?.previewMedia(info)
		} else {
			MessageImagePreviewStore.setPreviewInfo(info)
		}
	}

	clearPreviewInfo() {
		MessageImagePreviewStore.clearPreviewInfo()
	}

	/**
	 * 复制文件
	 */
	copy(dom: HTMLImageElement | HTMLCanvasElement) {
		const ext = MessageImagePreviewStore.previewInfo?.ext?.ext
		switch (ext) {
			case "svg":
			case "svg+xml":
				if (MessageImagePreviewStore.previewInfo?.url) {
					this.copySvg(MessageImagePreviewStore.previewInfo?.url)
				}
				break
			default:
				this.copyImage(dom)
				break
		}
	}

	/**
	 * 复制图片
	 * @param imgDom 图片元素
	 */
	copyImage(dom: HTMLImageElement | HTMLCanvasElement) {
		try {
			// 处理HTMLImageElement类型
			if (dom instanceof HTMLImageElement) {
				// 创建一个临时canvas
				const canvas = document.createElement("canvas")
				canvas.width = dom.naturalWidth || dom.width
				canvas.height = dom.naturalHeight || dom.height

				// 创建新图像避免跨域问题
				const img = new Image()
				img.crossOrigin = "anonymous"
				img.onload = () => {
					const ctx = canvas.getContext("2d")
					if (ctx) {
						ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
						this.copyCanvasToClipboard(canvas)
					}
				}
				img.src = dom.src
				return
			}

			// 处理HTMLCanvasElement类型
			if (dom instanceof HTMLCanvasElement) {
				this.copyCanvasToClipboard(dom)
				return
			}
		} catch (error) {
			console.error("Failed to copy image:", error)
		}
	}

	/**
	 * 将Canvas内容复制到剪贴板
	 * @param canvas Canvas元素
	 */
	private copyCanvasToClipboard(canvas: HTMLCanvasElement) {
		// 尝试使用标准Clipboard API
		canvas.toBlob((blob) => {
			if (!blob) return

			// 尝试使用标准Clipboard API
			this.tryClipboardWrite(blob).catch((error) => {
				console.warn("Standard clipboard API failed:", error)
			})
		})
	}

	/**
	 * 尝试使用标准Clipboard API
	 */
	private async tryClipboardWrite(blob: Blob): Promise<void> {
		// 确保页面有焦点
		if (document.hasFocus()) {
			await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
			return
		}
		throw new Error("Document does not have focus")
	}

	/**
	 * 复制 svg
	 * @param svgDom svg 元素
	 */
	copySvg(svgText: string) {
		// 把 svg 转换为 base64
		const base64 = safeBtoa(svgText)
		if (base64) {
			navigator.clipboard.write([new ClipboardItem({ "image/svg+xml": base64 })])
		}
	}
}

export default new MessageImagePreview()
