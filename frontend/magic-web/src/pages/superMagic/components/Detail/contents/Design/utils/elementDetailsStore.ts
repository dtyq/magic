import type { LayerElement } from "@/components/CanvasDesign/runtime/document/types"
import {
	getContents,
	supportsVisualUnderstanding,
} from "@/components/CanvasDesign/runtime/document/elementContent"
import type {
	ElementDetailSource,
	ElementDetailsProvenance,
	ElementDetailsSidecarSource,
} from "@/components/CanvasDesign/runtime/document/elementDetailsProvenance"

export const ELEMENT_DETAILS_FILENAME = "element-details.json"
export const ELEMENT_DETAILS_USER_FILENAME = "element-details-user.json"
export const ELEMENT_DETAILS_VERSION = "2.0.0"
export const ELEMENT_DETAIL_SOURCE_USER = "user"

export const HEAVY_FIELDS = [
	"generateImageRequest",
	"generateVideoRequest",
	"visualUnderstanding",
	"videoGenerationResultMeta",
] as const

const NON_VISUAL_HEAVY_FIELDS = ["generateImageRequest", "generateVideoRequest"] as const

export type ElementHeavyFields = Record<string, unknown>
export type ContentDetailEntry = ElementHeavyFields
export type ElementDetailEntry = ElementHeavyFields & {
	source?: string
	contentDetails?: Record<string, ContentDetailEntry>
}

export interface ElementDetailsDoc {
	version: string
	elements: Record<string, ElementDetailEntry>
}

/** 未发布图片版本 sidecar，不属于当前 v3 contentDetails 协议。 */
export function hasUnsupportedElementDetailsStructure(raw: unknown): boolean {
	if (!raw || typeof raw !== "object") return false
	const record = raw as Record<string, unknown>
	if (record.imageVersionDetails !== undefined) return true
	const elements = record.elements
	if (!elements || typeof elements !== "object" || Array.isArray(elements)) return false
	return Object.values(elements as Record<string, unknown>).some(
		(entry) =>
			!!entry &&
			typeof entry === "object" &&
			(entry as Record<string, unknown>).imageVersionDetails !== undefined,
	)
}

export function emptyElementDetailsDoc(): ElementDetailsDoc {
	return { version: ELEMENT_DETAILS_VERSION, elements: {} }
}

export function normalizeElementDetailsDoc(raw: unknown): ElementDetailsDoc {
	if (
		!raw ||
		typeof raw !== "object" ||
		typeof (raw as { elements?: unknown }).elements !== "object" ||
		(raw as { elements?: unknown }).elements === null
	) {
		return emptyElementDetailsDoc()
	}
	const data = raw as { version?: unknown; elements: Record<string, ElementDetailEntry> }
	return {
		version: typeof data.version === "string" ? data.version : ELEMENT_DETAILS_VERSION,
		elements: data.elements,
	}
}

type AnyElement = LayerElement & { children?: LayerElement[]; [key: string]: unknown }

function walkElements(
	elements: LayerElement[] | undefined,
	visit: (element: AnyElement) => void,
): void {
	if (!elements?.length) return
	for (const element of elements) {
		const anyElement = element as AnyElement
		visit(anyElement)
		if (Array.isArray(anyElement.children)) walkElements(anyElement.children, visit)
	}
}

export function collectElementIds(elements: LayerElement[] | undefined): Set<string> {
	const ids = new Set<string>()
	walkElements(elements, (element) => {
		if (element.id) ids.add(element.id)
	})
	return ids
}

function getHeavyFieldsForElement(type: string): readonly string[] {
	return supportsVisualUnderstanding(type) ? HEAVY_FIELDS : NON_VISUAL_HEAVY_FIELDS
}

export function stripHeavyFields(elements: LayerElement[] | undefined): void {
	walkElements(elements, (element) => {
		const contents = getContents(element) as unknown as Array<Record<string, unknown>>
		for (const content of contents) {
			for (const field of HEAVY_FIELDS) delete content[field]
		}
		for (const field of HEAVY_FIELDS) delete element[field]
	})
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value)
}

/**
 * 同路径两边都有叶子值时用 agent；仅 user 有的字段补进结果。
 * 数组当叶子处理，不按下标合并。
 */
function deepMergePreferAgent(user: unknown, agent: unknown): unknown {
	if (agent === undefined || agent === null) return user
	if (user === undefined || user === null) return agent
	if (!isPlainObject(user) || !isPlainObject(agent)) return agent
	const merged: Record<string, unknown> = {}
	for (const key of new Set([...Object.keys(user), ...Object.keys(agent)])) {
		merged[key] = deepMergePreferAgent(user[key], agent[key])
	}
	return merged
}

/**
 * 同一 Content 两边都有时深度合并（冲突字段以 agent 为准）。
 * 合并结果仍视为 agent 来源，写回时整条不进 user sidecar。
 */
function resolveWinner(
	userEntry: ElementDetailEntry | undefined,
	agentEntry: ElementDetailEntry | undefined,
): { entry: ElementDetailEntry | undefined; source: ElementDetailSource } {
	if (agentEntry && userEntry) {
		return {
			entry: deepMergePreferAgent(userEntry, agentEntry) as ElementDetailEntry,
			source: "agent",
		}
	}
	if (agentEntry) return { entry: agentEntry, source: "agent" }
	if (userEntry) return { entry: userEntry, source: "user" }
	return { entry: undefined, source: "unknown" }
}

function getRequestImageId(request: unknown): string | undefined {
	if (!request || typeof request !== "object") return undefined
	const imageId = (request as { image_id?: unknown }).image_id
	return typeof imageId === "string" && imageId.trim() ? imageId : undefined
}

export function rehydrateHeavyFields(
	elements: LayerElement[] | undefined,
	userDoc: ElementDetailsDoc,
	agentDoc: ElementDetailsDoc,
): ElementDetailsProvenance {
	const provenance: ElementDetailsProvenance = {}
	walkElements(elements, (rawElement) => {
		const element = rawElement as AnyElement
		const heavyFields = getHeavyFieldsForElement(element.type)
		const userEntry = userDoc.elements[element.id]
		const agentEntry = agentDoc.elements[element.id]
		const contentProvenance: NonNullable<ElementDetailsProvenance[string]["contentDetails"]> =
			{}
		const { entry: legacyWinner, source: legacyWinnerSource } = resolveWinner(
			userEntry,
			agentEntry,
		)
		const firstContent = getContents(element)[0] as unknown as
			Record<string, unknown> | undefined
		let legacyFieldsAppliedToFirstContent = false
		if (legacyWinner && firstContent) {
			for (const field of heavyFields) {
				if (firstContent[field] === undefined && legacyWinner[field] !== undefined) {
					firstContent[field] = legacyWinner[field]
					legacyFieldsAppliedToFirstContent = true
				}
			}
		}

		for (const content of getContents(element) as unknown as Array<
			Record<string, unknown> & { contentId: string }
		>) {
			const userContent = userEntry?.contentDetails?.[content.contentId]
			const agentContent = agentEntry?.contentDetails?.[content.contentId]
			const { entry: winner, source: winnerSource } = resolveWinner(
				userContent ? { ...userContent, source: userEntry?.source } : undefined,
				agentContent ? { ...agentContent, source: agentEntry?.source } : undefined,
			)
			if (winner) {
				for (const field of heavyFields) {
					if (winner[field] !== undefined && winner[field] !== null)
						content[field] = winner[field]
				}
			}
			const appliedSource = winner
				? winnerSource
				: content === firstContent && legacyFieldsAppliedToFirstContent
					? legacyWinnerSource
					: undefined
			const sidecarSource = toSidecarSource(appliedSource)
			const imageId = getRequestImageId(content.generateImageRequest)
			if (sidecarSource || imageId) {
				contentProvenance[content.contentId] = {
					...(sidecarSource ? { sidecarSource } : {}),
					...(imageId
						? {
								generateImageRequest: {
									valueSource: appliedSource ?? "inline",
									imageId,
									imageIdSource: appliedSource ?? "inline",
								},
							}
						: {}),
				}
			}
		}

		if (Object.keys(contentProvenance).length > 0)
			provenance[element.id] = { contentDetails: contentProvenance }
	})
	return provenance
}

function toSidecarSource(
	source: ElementDetailSource | undefined,
): ElementDetailsSidecarSource | undefined {
	if (source === "agent" || source === "user") return source
	return undefined
}

/**
 * 前端只写 user sidecar。agent 来源的 Content 排除，画布新建走 user。
 * 磁盘上已在 agent 文件中的 Content 也排除，避免 provenance 丢失时抄进 user。
 */
export function isAgentOwnedContent(options: {
	provenance?: ElementDetailsProvenance
	agentDoc?: ElementDetailsDoc
	elementId: string
	contentId: string
	isFirstContent: boolean
}): boolean {
	const contentProv = options.provenance?.[options.elementId]?.contentDetails?.[options.contentId]
	if (contentProv?.sidecarSource === "agent") return true
	if (contentProv?.generateImageRequest?.imageIdSource === "agent") return true
	if (contentProv?.generateImageRequest?.valueSource === "agent") return true
	if (contentProv?.sidecarSource === "user") return false

	const agentEntry = options.agentDoc?.elements[options.elementId]
	if (!agentEntry) return false
	if (agentEntry.contentDetails?.[options.contentId]) return true
	if (!options.isFirstContent) return false
	return HEAVY_FIELDS.some(
		(field) => agentEntry[field] !== undefined && agentEntry[field] !== null,
	)
}

/**
 * 只收集应写入 element-details-user.json 的 Content。
 * 前端永不写 element-details.json。
 */
export function buildUserElementDetailsDoc(
	elements: LayerElement[] | undefined,
	provenance?: ElementDetailsProvenance,
	agentDoc?: ElementDetailsDoc,
): ElementDetailsDoc {
	const userElements: Record<string, ElementDetailEntry> = {}
	walkElements(elements, (rawElement) => {
		const element = rawElement as AnyElement
		const heavyFields = getHeavyFieldsForElement(element.type)
		const userContentDetails: Record<string, ContentDetailEntry> = {}
		const contents = getContents(element) as unknown as Array<
			Record<string, unknown> & { contentId: string }
		>
		contents.forEach((content, index) => {
			const detail: ContentDetailEntry = {}
			for (const field of heavyFields) {
				const value = content[field]
				if (value !== undefined && value !== null) detail[field] = value
			}
			if (Object.keys(detail).length === 0) return
			if (
				isAgentOwnedContent({
					provenance,
					agentDoc,
					elementId: element.id,
					contentId: content.contentId,
					isFirstContent: index === 0,
				})
			)
				return
			userContentDetails[content.contentId] = detail
		})
		if (Object.keys(userContentDetails).length > 0) {
			userElements[element.id] = {
				contentDetails: userContentDetails,
				source: ELEMENT_DETAIL_SOURCE_USER,
			}
		}
	})
	return { version: ELEMENT_DETAILS_VERSION, elements: userElements }
}
