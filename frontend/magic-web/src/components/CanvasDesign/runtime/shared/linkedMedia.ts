import type { ResolveCanvasResourceReference } from "../../public/resource-reference"
import type { CropConfig } from "../document/types"
import { getCanvasResourceReferenceIdentity } from "./path/canvasResourcePath"

export type LinkedMediaKind = "image" | "video" | "audio"

/** 画布关联媒体在业务层流转的统一资源快照。 */
export interface LinkedMediaReference {
	kind: LinkedMediaKind
	path: string
	sourceCrop?: CropConfig
	/** 本次关联解析命中的图片 Content；仅为运行时快照，不改变连接 DSL。 */
	sourceContentId?: string
}

/** 用于合并连线媒体、手动参考媒体和 @mention 的稳定资源身份。 */
export function getLinkedMediaReferenceIdentity(
	path?: string,
	resolveResourceReference?: ResolveCanvasResourceReference,
): string {
	return getCanvasResourceReferenceIdentity(path, resolveResourceReference)
}

export function mergeLinkedMediaPathsWithResolver(
	resolveResourceReference: ResolveCanvasResourceReference | undefined,
	...pathGroups: string[][]
): string[] {
	const merged: string[] = []
	const seen = new Set<string>()
	for (const paths of pathGroups) {
		for (const path of paths) {
			const identity = getLinkedMediaReferenceIdentity(path, resolveResourceReference)
			if (!identity || seen.has(identity)) continue
			seen.add(identity)
			merged.push(path)
		}
	}
	return merged
}

/** 同一路径优先保留关联媒体元数据，同时维持手动引用的原有顺序。 */
export function mergeLinkedMediaReferences(
	manualReferences: LinkedMediaReference[],
	linkedReferences: LinkedMediaReference[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): LinkedMediaReference[] {
	const merged: LinkedMediaReference[] = []
	const linkedByIdentity = new Map<string, LinkedMediaReference>()
	for (const reference of linkedReferences) {
		const identity = getLinkedMediaReferenceIdentity(reference.path, resolveResourceReference)
		if (!identity || linkedByIdentity.has(identity)) continue
		linkedByIdentity.set(identity, reference)
	}
	const seenPathSet = new Set<string>()

	for (const reference of manualReferences) {
		const identity = getLinkedMediaReferenceIdentity(reference.path, resolveResourceReference)
		if (!identity || seenPathSet.has(identity)) continue
		seenPathSet.add(identity)
		merged.push(linkedByIdentity.get(identity) ?? reference)
	}

	for (const reference of linkedReferences) {
		const identity = getLinkedMediaReferenceIdentity(reference.path, resolveResourceReference)
		if (!identity || seenPathSet.has(identity)) continue
		seenPathSet.add(identity)
		merged.push(reference)
	}

	return merged
}
