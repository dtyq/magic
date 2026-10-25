import type { Canvas } from "../../core/Canvas"
import { getActiveContent } from "../../document/elementContent"
import { ElementTypeEnum } from "../../document/types"

/**
 * 音频替换旧入口的兼容代理。
 *
 * 真正的运行时状态和上传生命周期统一由 MediaReplaceController 管理；
 * 该类只保留旧组件仍在调用的 API，避免形成第二份替换状态。
 */
export class AudioReplaceController {
	private readonly canvas: Canvas
	private destroyed = false

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	public destroy(): void {
		this.destroyed = true
	}

	public openLocalFilePicker(elementId: string): void {
		if (this.destroyed || !this.canvas.permissionManager.can("document.write")) return
		const element = this.canvas.elementManager.getElementData(elementId)
		const contentId =
			element?.type === ElementTypeEnum.Audio
				? (getActiveContent(element)?.contentId ?? null)
				: null
		this.canvas.mediaReplaceController?.openLocalFilePicker({
			elementId,
			mediaType: ElementTypeEnum.Audio,
			contentId,
		})
	}

	public replaceWithProjectFile(elementId: string, path: string): Promise<boolean> {
		if (this.destroyed || !this.canvas.permissionManager.can("document.write"))
			return Promise.resolve(false)
		return (
			this.canvas.mediaReplaceController?.replaceWithProjectFile({
				elementId,
				mediaType: ElementTypeEnum.Audio,
				contentId: this.getActiveContentId(elementId),
				path,
			}) ?? Promise.resolve(false)
		)
	}

	private getActiveContentId(elementId: string): string | null {
		const element = this.canvas.elementManager.getElementData(elementId)
		return element?.type === ElementTypeEnum.Audio
			? (getActiveContent(element)?.contentId ?? null)
			: null
	}
}
