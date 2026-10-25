import type { Canvas } from "../../core/Canvas"
import { getActiveImageContent } from "../../document/elementContent"
import { ElementTypeEnum } from "../../document/types"

/**
 * 图片替换旧入口的兼容代理。
 *
 * MediaReplaceController 是唯一的替换状态源；这里不再维护 input、operation
 * 或 replacingElementId，旧面板调用会被转发到统一媒体入口。
 */
export class ImageReplaceController {
	private readonly canvas: Canvas
	private destroyed = false

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	public destroy(): void {
		this.destroyed = true
	}

	public openLocalFilePicker(elementId: string, contentId: string | null): void {
		if (this.destroyed || !this.canvas.permissionManager.can("document.write")) return
		this.canvas.mediaReplaceController?.openLocalFilePicker({
			elementId,
			mediaType: ElementTypeEnum.Image,
			contentId: this.resolveContentId(elementId, contentId),
		})
	}

	public replaceWithProjectFile(
		elementId: string,
		path: string,
		contentId: string | null,
	): Promise<boolean> {
		if (this.destroyed || !this.canvas.permissionManager.can("document.write"))
			return Promise.resolve(false)
		return (
			this.canvas.mediaReplaceController?.replaceWithProjectFile({
				elementId,
				mediaType: ElementTypeEnum.Image,
				contentId: this.resolveContentId(elementId, contentId),
				path,
			}) ?? Promise.resolve(false)
		)
	}

	private resolveContentId(elementId: string, contentId: string | null): string | null {
		if (contentId) return contentId
		const element = this.canvas.elementManager.getElementData(elementId)
		return element?.type === ElementTypeEnum.Image
			? (getActiveImageContent(element)?.contentId ?? null)
			: null
	}
}
