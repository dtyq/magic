import type {
	ElementDetailSource,
	ElementDetailsProvenance,
	GenerateImageRequestProvenance,
} from "../document/elementDetailsProvenance"
import { cloneDeep } from "lodash-es"

export type ElementDetailsProvenanceChangeHandler = (provenance: ElementDetailsProvenance) => void

/**
 * 保存从 sidecar 加载出的来源信息，以及当前会话成功提交的前端任务身份。
 * 数据只存在于 Canvas Runtime，不参与 DSL 导出、历史记录和剪贴板序列化。
 */
export class ElementDetailsRuntimeManager {
	private provenance: ElementDetailsProvenance = {}
	private hasExplicitProvenance = false
	private onChange?: ElementDetailsProvenanceChangeHandler

	constructor(options?: { onChange?: ElementDetailsProvenanceChangeHandler }) {
		this.onChange = options?.onChange
	}

	public replace(provenance?: ElementDetailsProvenance): void {
		this.hasExplicitProvenance = provenance !== undefined
		this.provenance = provenance ? cloneDeep(provenance) : {}
	}

	public setOnChange(onChange?: ElementDetailsProvenanceChangeHandler): void {
		this.onChange = onChange
	}

	public export(): ElementDetailsProvenance {
		return cloneDeep(this.provenance)
	}

	public getGenerateImageRequest(
		elementId: string,
		imageId?: string,
		contentId?: string,
	): GenerateImageRequestProvenance | null {
		const elementEntry = this.provenance[elementId]
		const entry = contentId
			? elementEntry?.contentDetails?.[contentId]?.generateImageRequest
			: Object.values(elementEntry?.contentDetails ?? {})[0]?.generateImageRequest
		if (!entry) return null
		if (imageId && entry.imageId !== imageId) return null
		return entry
	}

	public getGenerateImageRequestImageIdSource(
		elementId: string,
		imageId?: string,
		contentId?: string,
	): ElementDetailSource {
		return (
			this.getGenerateImageRequest(elementId, imageId, contentId)?.imageIdSource ??
			(this.hasExplicitProvenance ? "unknown" : "inline")
		)
	}

	public markGenerateImageRequestAsUser(
		elementId: string,
		imageId: string,
		contentId?: string,
	): void {
		if (!imageId.trim()) return
		this.hasExplicitProvenance = true
		const requestProvenance: GenerateImageRequestProvenance = {
			valueSource: "user",
			imageId,
			imageIdSource: "user",
		}
		const contentProvenance = {
			sidecarSource: "user" as const,
			generateImageRequest: requestProvenance,
		}
		const current = this.provenance[elementId]
		this.provenance = {
			...this.provenance,
			[elementId]: contentId
				? {
						...current,
						contentDetails: {
							...current?.contentDetails,
							[contentId]: contentProvenance,
						},
					}
				: {
						...current,
						contentDetails: {
							...current?.contentDetails,
							unknown: contentProvenance,
						},
					},
		}
		this.onChange?.(this.export())
	}

	public clearElement(elementId: string): void {
		if (!this.provenance[elementId]) return
		const next = { ...this.provenance }
		delete next[elementId]
		this.provenance = next
		this.onChange?.(this.export())
	}

	public clearContent(elementId: string, contentId: string): void {
		const current = this.provenance[elementId]
		if (!current?.contentDetails?.[contentId]) return
		const contentDetails = { ...current.contentDetails }
		delete contentDetails[contentId]
		const nextElement = { ...current }
		if (Object.keys(contentDetails).length > 0) {
			nextElement.contentDetails = contentDetails
		} else {
			delete nextElement.contentDetails
		}
		this.provenance = {
			...this.provenance,
			[elementId]: nextElement,
		}
		this.onChange?.(this.export())
	}

	/** @deprecated 调用方迁移期间的兼容入口，语义已改为 Content。 */
	public clearImageContent(elementId: string, contentId: string): void {
		this.clearContent(elementId, contentId)
	}
}
