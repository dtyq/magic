import type { LinkedFrameBinding } from "./video-editor-config.types"
import { getLinkedMediaReferenceIdentity } from "../../../editors/connection/linkedEditorInputs"
import type { ResolveCanvasResourceReference } from "../../../../public/resource-reference"

interface ReconcileLinkedFrameBindingsOptions {
	previous: Array<LinkedFrameBinding | undefined>
	currentFrameImages: Array<string | undefined>
	supportsStartFrame: boolean
	supportsEndFrame: boolean
	resolveResourceReference?: ResolveCanvasResourceReference
}

interface LinkedFrameSourceItem {
	connectionId: string
	kind: string
	path?: string
	fileName?: string
}

export interface LinkedFrameImageUpdate {
	slotIndex: number
	path: string
	fileName: string
}

interface SynchronizeLinkedFrameBindingsOptions extends ReconcileLinkedFrameBindingsOptions {
	linkedMediaItems: LinkedFrameSourceItem[]
}

export interface LinkedFrameBindingSyncResult {
	bindings: Array<LinkedFrameBinding | undefined>
	frameUpdates: LinkedFrameImageUpdate[]
}

export function resolveLinkedFrameRoleForSlotIndex(
	slotIndex: number,
	supportsStartFrame: boolean,
	supportsEndFrame: boolean,
): "start" | "end" {
	if (supportsStartFrame && slotIndex === 0) return "start"
	return supportsEndFrame ? "end" : "start"
}

function areLinkedFrameBindingsEqual(
	left: Array<LinkedFrameBinding | undefined>,
	right: Array<LinkedFrameBinding | undefined>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	if (left.length !== right.length) return false
	// 首尾帧删除会产生稀疏数组，必须显式读取每个索引，不能使用会跳过空位的 every。
	for (let index = 0; index < left.length; index += 1) {
		const leftItem = left[index]
		const rightItem = right[index]
		if (
			getLinkedMediaReferenceIdentity(leftItem?.framePath, resolveResourceReference) !==
			getLinkedMediaReferenceIdentity(rightItem?.framePath, resolveResourceReference)
		) {
			return false
		}
		if (leftItem?.sourceConnectionId !== rightItem?.sourceConnectionId) return false
		if (
			getLinkedMediaReferenceIdentity(leftItem?.sourcePath, resolveResourceReference) !==
			getLinkedMediaReferenceIdentity(rightItem?.sourcePath, resolveResourceReference)
		) {
			return false
		}
		if (leftItem?.sourceKind !== rightItem?.sourceKind) return false
		if (leftItem?.sourceFileName !== rightItem?.sourceFileName) return false
		if (leftItem?.frameRole !== rightItem?.frameRole) return false
	}
	return true
}

/** 根据真实首尾帧槽位同步连线绑定；显式遍历索引，避免稀疏数组跳过已删除槽位。 */
export function reconcileLinkedFrameBindings(
	options: ReconcileLinkedFrameBindingsOptions,
): Array<LinkedFrameBinding | undefined> {
	const {
		previous,
		currentFrameImages,
		supportsStartFrame,
		supportsEndFrame,
		resolveResourceReference,
	} = options
	const frameRoles = [
		...(supportsStartFrame ? (["start"] as const) : []),
		...(supportsEndFrame ? (["end"] as const) : []),
	]
	const usedPreviousBindingIndexes = new Set<number>()
	const next = Array.from({ length: currentFrameImages.length }, (_, index) => {
		const path = currentFrameImages[index]
		if (!path) return undefined
		const pathIdentity = getLinkedMediaReferenceIdentity(path, resolveResourceReference)
		const indexedBinding = previous[index]
		const indexedBindingIdentity = getLinkedMediaReferenceIdentity(
			indexedBinding?.framePath,
			resolveResourceReference,
		)
		let bindingIndex =
			indexedBinding && indexedBindingIdentity === pathIdentity ? index : undefined
		if (bindingIndex === undefined || usedPreviousBindingIndexes.has(bindingIndex)) {
			bindingIndex = previous.findIndex(
				(item, previousIndex) =>
					!usedPreviousBindingIndexes.has(previousIndex) &&
					getLinkedMediaReferenceIdentity(item?.framePath, resolveResourceReference) ===
						pathIdentity,
			)
			if (bindingIndex < 0) {
				// 同一来源允许同时绑定首帧与尾帧；当两个槽位都指向同一路径时，
				// 第二个槽位可以复用同一份历史绑定快照。
				bindingIndex = previous.findIndex(
					(item) =>
						getLinkedMediaReferenceIdentity(
							item?.framePath,
							resolveResourceReference,
						) === pathIdentity,
				)
			}
		}
		if (bindingIndex >= 0) usedPreviousBindingIndexes.add(bindingIndex)
		const binding = bindingIndex >= 0 ? previous[bindingIndex] : undefined
		return binding
			? { ...binding, frameRole: frameRoles[index] ?? binding.frameRole }
			: undefined
	})
	return areLinkedFrameBindingsEqual(previous, next, resolveResourceReference) ? previous : next
}

/** 连接仍存在时让各首尾帧槽位跟随自己的来源图片更新。 */
export function synchronizeLinkedFrameBindings(
	options: SynchronizeLinkedFrameBindingsOptions,
): LinkedFrameBindingSyncResult {
	const { previous, linkedMediaItems, resolveResourceReference } = options
	const reconciled = reconcileLinkedFrameBindings(options)
	const next = [...reconciled]
	const frameUpdates: LinkedFrameImageUpdate[] = []

	next.forEach((binding, slotIndex) => {
		if (!binding) return
		const sourceItem = linkedMediaItems.find(
			(item) =>
				item.connectionId === binding.sourceConnectionId &&
				item.kind === "image" &&
				Boolean(item.path),
		)
		if (!sourceItem?.path) {
			next[slotIndex] = undefined
			return
		}

		const sourceIdentity = getLinkedMediaReferenceIdentity(
			sourceItem.path,
			resolveResourceReference,
		)
		const boundSourceIdentity = getLinkedMediaReferenceIdentity(
			binding.sourcePath,
			resolveResourceReference,
		)
		const sourceFileName = sourceItem.fileName || sourceItem.path
		if (sourceIdentity === boundSourceIdentity) {
			if (binding.sourceFileName !== sourceFileName) {
				next[slotIndex] = { ...binding, sourceFileName }
			}
			return
		}

		next[slotIndex] = {
			...binding,
			framePath: sourceItem.path,
			sourcePath: sourceItem.path,
			sourceFileName,
		}
		frameUpdates.push({
			slotIndex,
			path: sourceItem.path,
			fileName: sourceFileName,
		})
	})

	return {
		bindings: areLinkedFrameBindingsEqual(previous, next, resolveResourceReference)
			? previous
			: next,
		frameUpdates,
	}
}
