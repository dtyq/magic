import { getContents } from "./elementContent"
import type { ElementContentBase, LayerElement } from "./types"

export type ElementDetailSource = "agent" | "user" | "inline" | "unknown"

/** Content 重字段落盘目标：仅 agent / user 两个 sidecar 文件。 */
export type ElementDetailsSidecarSource = "agent" | "user"

export interface GenerateImageRequestProvenance {
	valueSource: ElementDetailSource
	imageId?: string
	imageIdSource: ElementDetailSource
}

export interface ElementContentDetailProvenance {
	/**
	 * 该 Content 重字段是从哪个 sidecar 读出的。
	 * 写回时按此路由；缺失时视为画布新建，写入 user 文件。
	 */
	sidecarSource?: ElementDetailsSidecarSource
	generateImageRequest?: GenerateImageRequestProvenance
}

export interface ElementDetailProvenance {
	contentDetails?: Record<string, ElementContentDetailProvenance>
}

export type ElementDetailsProvenance = Record<string, ElementDetailProvenance>

type ElementWithChildren = LayerElement & { children?: LayerElement[] }

function walkElements(
	elements: LayerElement[] | undefined,
	visit: (element: LayerElement) => void,
): void {
	if (!elements?.length) return
	for (const element of elements) {
		visit(element)
		const children = (element as ElementWithChildren).children
		if (Array.isArray(children)) walkElements(children, visit)
	}
}

export function buildInlineElementDetailsProvenance(
	elements: LayerElement[] | undefined,
): ElementDetailsProvenance {
	const provenance: ElementDetailsProvenance = {}
	walkElements(elements, (element) => {
		const contentDetails: Record<string, ElementContentDetailProvenance> = {}
		for (const content of getContents(element) as unknown as Array<
			ElementContentBase & Record<string, unknown>
		>) {
			const imageId = getRequestImageId(content.generateImageRequest)
			if (!imageId) continue
			contentDetails[content.contentId] = {
				generateImageRequest: {
					valueSource: "inline",
					imageId,
					imageIdSource: "inline",
				},
			}
		}
		if (Object.keys(contentDetails).length > 0) provenance[element.id] = { contentDetails }
	})
	return provenance
}

export function reconcileElementDetailsProvenance(
	elements: LayerElement[] | undefined,
	...candidates: Array<ElementDetailsProvenance | null | undefined>
): ElementDetailsProvenance {
	const result: ElementDetailsProvenance = {}
	walkElements(elements, (element) => {
		const contentDetails: Record<string, ElementContentDetailProvenance> = {}
		for (const content of getContents(element) as unknown as Array<
			ElementContentBase & Record<string, unknown>
		>) {
			const contentId = content.contentId
			const sidecarSource = chooseSidecarSource(
				candidates.map(
					(candidate) =>
						candidate?.[element.id]?.contentDetails?.[contentId]?.sidecarSource,
				),
			)
			const imageId = getRequestImageId(content.generateImageRequest)
			const entry: ElementContentDetailProvenance = {}
			if (sidecarSource) entry.sidecarSource = sidecarSource
			if (imageId) {
				const matches = candidates
					.map(
						(candidate) =>
							candidate?.[element.id]?.contentDetails?.[contentId]
								?.generateImageRequest,
					)
					.filter(
						(item): item is GenerateImageRequestProvenance => item?.imageId === imageId,
					)
				const requestProvenance = chooseProvenance(matches) ?? unknownProvenance(imageId)
				entry.generateImageRequest = requestProvenance
				if (!entry.sidecarSource) {
					const derived = sidecarSourceFromDetailSource(requestProvenance.imageIdSource)
					if (derived) entry.sidecarSource = derived
				}
			}
			if (entry.sidecarSource || entry.generateImageRequest) contentDetails[contentId] = entry
		}
		if (Object.keys(contentDetails).length > 0) result[element.id] = { contentDetails }
	})
	return result
}

function chooseSidecarSource(
	candidates: Array<ElementDetailsSidecarSource | undefined>,
): ElementDetailsSidecarSource | undefined {
	// 画布新建会标成 user；user 一旦确立优先保留，避免被旧的 agent 快照盖回。
	return (
		candidates.find((entry) => entry === "user") ??
		candidates.find((entry) => entry === "agent")
	)
}

function sidecarSourceFromDetailSource(
	source: ElementDetailSource | undefined,
): ElementDetailsSidecarSource | undefined {
	if (source === "agent" || source === "user") return source
	return undefined
}

function getRequestImageId(request: unknown): string | undefined {
	if (!request || typeof request !== "object") return undefined
	const imageId = (request as { image_id?: unknown }).image_id
	return typeof imageId === "string" && imageId.trim() ? imageId : undefined
}

function chooseProvenance(
	matches: GenerateImageRequestProvenance[],
): GenerateImageRequestProvenance | undefined {
	return (
		matches.find((entry) => entry.imageIdSource === "agent") ??
		matches.find((entry) => entry.imageIdSource === "user") ??
		matches.find((entry) => entry.imageIdSource === "inline") ??
		matches[0]
	)
}

function unknownProvenance(imageId: string): GenerateImageRequestProvenance {
	return { valueSource: "unknown", imageId, imageIdSource: "unknown" }
}
