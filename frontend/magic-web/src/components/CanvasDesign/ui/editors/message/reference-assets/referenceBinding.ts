import {
	parsePromptPlaceholderTokenMatches,
	type PromptPlaceholderTokenConfig,
	type PromptPlaceholderTokenKind,
} from "./promptPlaceholderTokenConfig"
import {
	getCanvasResourceFileName,
	getCanvasResourceReferenceIdentity,
} from "../../../../runtime/shared/path/canvasResourcePath"
import type { ResolveCanvasResourceReference } from "../../../../public/resource-reference"
import {
	getMatchablePathsFromValue,
	promptContainsMentionForFile,
	type MentionPathBinding,
} from "../tiptap/contentUtils"
import { createReferenceResourceDescriptor } from "./referenceResourceDescriptor"

export type ReferenceBindingMode = "prompt-linked" | "detached-legacy" | "mixed"

export interface ReferenceBindingResourceInfo {
	path: string
	fileName?: string
	assetType?: PromptPlaceholderTokenKind
}

export interface ReferenceBindingState {
	mode: ReferenceBindingMode
	explicitPromptReferencePaths: string[]
	protectedReferencePaths: string[]
}

function resolveAssetType(
	info: ReferenceBindingResourceInfo,
	defaultAssetType?: PromptPlaceholderTokenKind,
): PromptPlaceholderTokenKind | undefined {
	return info.assetType ?? defaultAssetType
}

function buildPromptMatchableItems(referenceFileInfos: ReferenceBindingResourceInfo[]) {
	return referenceFileInfos.map((info) => ({
		name: info.fileName || getCanvasResourceFileName(info.path) || info.path,
		path: info.path,
	}))
}

export function areOrderedPathsEqual(
	left: string[],
	right: string[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	if (left === right) return true
	if (left.length !== right.length) return false
	for (let index = 0; index < left.length; index += 1) {
		if (
			getCanvasResourceReferenceIdentity(left[index], resolveResourceReference) !==
			getCanvasResourceReferenceIdentity(right[index], resolveResourceReference)
		) {
			return false
		}
	}
	return true
}

function promptContainsReferenceMention(
	prompt: string | undefined,
	info: ReferenceBindingResourceInfo,
): boolean {
	if (!prompt) return false
	const candidateNames = new Set([info.fileName, info.path].filter(Boolean))
	return Array.from(candidateNames).some((name) => promptContainsMentionForFile(prompt, name))
}

/**
 * Preserve detached references during prompt reconciliation without masking explicit user deletion.
 *
 * Existing protected references remain detached unless a user edit removes a mention that was
 * present in the previous prompt. Opaque resources are identified by the shared resource
 * descriptor rather than by filename/extension assumptions.
 */
export function reconcileProtectedReferencePaths(params: {
	referenceFileInfos: ReferenceBindingResourceInfo[]
	protectedReferencePaths: string[]
	currentPrompt?: string
	previousPrompt?: string
	source?: "user" | "sync"
	resolveResourceReference?: ResolveCanvasResourceReference
}): string[] {
	const {
		referenceFileInfos,
		protectedReferencePaths,
		currentPrompt,
		previousPrompt,
		source = "sync",
		resolveResourceReference,
	} = params
	const infoByIdentity = new Map(
		referenceFileInfos.map((info) => [
			getCanvasResourceReferenceIdentity(info.path, resolveResourceReference),
			info,
		]),
	)
	const protectedIdentities = new Set<string>()
	const nextProtectedPaths: string[] = []

	for (const path of protectedReferencePaths) {
		const identity = getCanvasResourceReferenceIdentity(path, resolveResourceReference)
		const info = infoByIdentity.get(identity)
		const wasMentioned =
			source === "user" &&
			Boolean(previousPrompt) &&
			Boolean(info && promptContainsReferenceMention(previousPrompt, info))
		const isStillMentioned =
			Boolean(currentPrompt) &&
			Boolean(info && promptContainsReferenceMention(currentPrompt, info))
		if (wasMentioned && !isStillMentioned) continue
		if (!identity || protectedIdentities.has(identity)) continue
		protectedIdentities.add(identity)
		nextProtectedPaths.push(path)
	}

	for (const info of referenceFileInfos) {
		const descriptor = createReferenceResourceDescriptor({
			path: info.path,
			fileName: info.fileName,
			assetType: info.assetType,
			resolveResourceReference,
		})
		if (!descriptor || descriptor.resourceKind !== "opaque-asset") continue
		const identity = descriptor.identity
		if (!identity || protectedIdentities.has(identity)) continue
		const wasMentioned = Boolean(
			previousPrompt && promptContainsReferenceMention(previousPrompt, info),
		)
		const isCurrentlyMentioned = Boolean(
			currentPrompt && promptContainsReferenceMention(currentPrompt, info),
		)
		if (isCurrentlyMentioned || !wasMentioned || source !== "user") {
			protectedIdentities.add(identity)
			nextProtectedPaths.push(info.path)
		}
	}

	return nextProtectedPaths
}

/**
 * Reference binding standard shared by image and video editors:
 * - Placeholder tokens and parsed @mentions are explicit prompt bindings.
 * - Restored references that are not explicitly bound in the prompt are protected legacy references.
 * - Protected references must survive normal prompt edits; only explicit deletion or a new mention
 *   for the same path moves them back into the prompt-bound lifecycle.
 */
export function resolveExplicitPromptReferencePaths(params: {
	prompt: string
	referenceFileInfos: ReferenceBindingResourceInfo[]
	tokenConfig: PromptPlaceholderTokenConfig
	defaultAssetType?: PromptPlaceholderTokenKind
	resolveResourceReference?: ResolveCanvasResourceReference
	/** 恢复期间由编辑器保存的有序 mention identity；优先于同名文本推断。 */
	mentionBindings?: MentionPathBinding[]
}): string[] {
	const {
		prompt,
		referenceFileInfos,
		tokenConfig,
		defaultAssetType,
		resolveResourceReference,
		mentionBindings,
	} = params
	if (!prompt || referenceFileInfos.length === 0) return []

	const explicitPathIdentities = new Set<string>()
	const placeholderMatches = parsePromptPlaceholderTokenMatches(prompt, tokenConfig)
	for (const match of placeholderMatches) {
		const matchingResources = referenceFileInfos.filter(
			(info) => resolveAssetType(info, defaultAssetType) === match.kind,
		)
		const referencedInfo = matchingResources[match.index - 1]
		if (referencedInfo?.path) {
			explicitPathIdentities.add(
				getCanvasResourceReferenceIdentity(referencedInfo.path, resolveResourceReference),
			)
		}
	}

	if (mentionBindings?.length) {
		for (const binding of mentionBindings) {
			if (!binding.path) continue
			explicitPathIdentities.add(
				getCanvasResourceReferenceIdentity(binding.path, resolveResourceReference),
			)
		}
	} else {
		const mentionPaths = getMatchablePathsFromValue(
			prompt,
			buildPromptMatchableItems(referenceFileInfos),
		)
		for (const path of mentionPaths) {
			explicitPathIdentities.add(
				getCanvasResourceReferenceIdentity(path, resolveResourceReference),
			)
		}
	}

	return referenceFileInfos
		.map((info) => info.path)
		.filter(
			(path) =>
				path &&
				explicitPathIdentities.has(
					getCanvasResourceReferenceIdentity(path, resolveResourceReference),
				),
		)
}

export function resolveReferenceBindingState(params: {
	prompt: string
	referenceFileInfos: ReferenceBindingResourceInfo[]
	tokenConfig: PromptPlaceholderTokenConfig
	defaultAssetType?: PromptPlaceholderTokenKind
	resolveResourceReference?: ResolveCanvasResourceReference
	/** 恢复期间由编辑器保存的有序 mention identity；优先于同名文本推断。 */
	mentionBindings?: MentionPathBinding[]
}): ReferenceBindingState {
	const {
		prompt,
		referenceFileInfos,
		tokenConfig,
		defaultAssetType,
		resolveResourceReference,
		mentionBindings,
	} = params
	const explicitPromptReferencePaths = resolveExplicitPromptReferencePaths({
		prompt,
		referenceFileInfos,
		tokenConfig,
		defaultAssetType,
		resolveResourceReference,
		mentionBindings,
	})
	const explicitPathIdentities = new Set(
		explicitPromptReferencePaths.map((path) =>
			getCanvasResourceReferenceIdentity(path, resolveResourceReference),
		),
	)
	const protectedReferencePaths = referenceFileInfos
		.map((info) => info.path)
		.filter(
			(path) =>
				path &&
				!explicitPathIdentities.has(
					getCanvasResourceReferenceIdentity(path, resolveResourceReference),
				),
		)

	if (protectedReferencePaths.length === 0) {
		return {
			mode: "prompt-linked",
			explicitPromptReferencePaths,
			protectedReferencePaths,
		}
	}

	if (explicitPromptReferencePaths.length === 0) {
		return {
			mode: "detached-legacy",
			explicitPromptReferencePaths,
			protectedReferencePaths,
		}
	}

	return {
		mode: "mixed",
		explicitPromptReferencePaths,
		protectedReferencePaths,
	}
}

export function pruneProtectedReferencePaths(
	currentReferencePaths: string[],
	protectedReferencePaths: string[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): string[] {
	const currentPathIdentities = new Set(
		currentReferencePaths.map((path) =>
			getCanvasResourceReferenceIdentity(path, resolveResourceReference),
		),
	)
	return protectedReferencePaths.filter((path) =>
		currentPathIdentities.has(
			getCanvasResourceReferenceIdentity(path, resolveResourceReference),
		),
	)
}

export function unprotectPromptBoundReferencePaths(
	protectedReferencePaths: string[],
	explicitPromptReferencePaths: string[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): string[] {
	if (protectedReferencePaths.length === 0 || explicitPromptReferencePaths.length === 0) {
		return protectedReferencePaths
	}
	const explicitPathIdentities = new Set(
		explicitPromptReferencePaths.map((path) =>
			getCanvasResourceReferenceIdentity(path, resolveResourceReference),
		),
	)
	return protectedReferencePaths.filter(
		(path) =>
			!explicitPathIdentities.has(
				getCanvasResourceReferenceIdentity(path, resolveResourceReference),
			),
	)
}
