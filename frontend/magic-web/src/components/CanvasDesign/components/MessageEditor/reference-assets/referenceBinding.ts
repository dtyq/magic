import {
	parsePromptPlaceholderTokenMatches,
	type PromptPlaceholderTokenConfig,
	type PromptPlaceholderTokenKind,
} from "./promptPlaceholderTokenConfig"
import { getMatchablePathsFromValue } from "../tiptap/contentUtils"

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

function resolveAssetType(info: ReferenceBindingResourceInfo): PromptPlaceholderTokenKind {
	return info.assetType ?? "image"
}

function buildPromptMatchableItems(referenceFileInfos: ReferenceBindingResourceInfo[]) {
	return referenceFileInfos.map((info) => ({
		name: info.fileName || info.path.split("/").pop() || info.path,
		path: info.path,
	}))
}

export function areOrderedPathsEqual(left: string[], right: string[]): boolean {
	if (left === right) return true
	if (left.length !== right.length) return false
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) return false
	}
	return true
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
}): string[] {
	const { prompt, referenceFileInfos, tokenConfig } = params
	if (!prompt || referenceFileInfos.length === 0) return []

	const explicitPaths = new Set<string>()
	const placeholderMatches = parsePromptPlaceholderTokenMatches(prompt, tokenConfig)
	for (const match of placeholderMatches) {
		const matchingResources = referenceFileInfos.filter(
			(info) => resolveAssetType(info) === match.kind,
		)
		const referencedInfo = matchingResources[match.index - 1]
		if (referencedInfo?.path) {
			explicitPaths.add(referencedInfo.path)
		}
	}

	const mentionPaths = getMatchablePathsFromValue(
		prompt,
		buildPromptMatchableItems(referenceFileInfos),
	)
	for (const path of mentionPaths) {
		explicitPaths.add(path)
	}

	return referenceFileInfos
		.map((info) => info.path)
		.filter((path) => path && explicitPaths.has(path))
}

export function resolveReferenceBindingState(params: {
	prompt: string
	referenceFileInfos: ReferenceBindingResourceInfo[]
	tokenConfig: PromptPlaceholderTokenConfig
}): ReferenceBindingState {
	const { prompt, referenceFileInfos, tokenConfig } = params
	const explicitPromptReferencePaths = resolveExplicitPromptReferencePaths({
		prompt,
		referenceFileInfos,
		tokenConfig,
	})
	const explicitPathSet = new Set(explicitPromptReferencePaths)
	const protectedReferencePaths = referenceFileInfos
		.map((info) => info.path)
		.filter((path) => path && !explicitPathSet.has(path))

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
): string[] {
	const currentPathSet = new Set(currentReferencePaths)
	return protectedReferencePaths.filter((path) => currentPathSet.has(path))
}

export function unprotectPromptBoundReferencePaths(
	protectedReferencePaths: string[],
	explicitPromptReferencePaths: string[],
): string[] {
	if (protectedReferencePaths.length === 0 || explicitPromptReferencePaths.length === 0) {
		return protectedReferencePaths
	}
	const explicitPathSet = new Set(explicitPromptReferencePaths)
	return protectedReferencePaths.filter((path) => !explicitPathSet.has(path))
}
