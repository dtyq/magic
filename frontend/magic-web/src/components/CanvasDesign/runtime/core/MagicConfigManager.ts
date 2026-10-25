import type { CanvasDesignMethods, MagicConfig } from "../../public/magic-types"
import type { CanvasResourceReferenceResolverSnapshot } from "../../public/resource-reference"
import type { Canvas } from "./Canvas"

function getResolverRevisionParts(revision: unknown): string[] | undefined {
	if (typeof revision !== "string") return undefined
	try {
		const parsed = JSON.parse(revision) as unknown
		return Array.isArray(parsed) && parsed.every((part) => typeof part === "string")
			? parsed
			: undefined
	} catch {
		return undefined
	}
}

function getChangedResourcePaths(
	previousRevision: unknown,
	nextRevision: unknown,
): string[] | undefined {
	const previousParts = getResolverRevisionParts(previousRevision)
	const nextParts = getResolverRevisionParts(nextRevision)
	if (!previousParts || !nextParts || previousParts.length < 5 || nextParts.length < 5) {
		return undefined
	}

	// 项目/画布/基路径/ready 状态变化会改变整个 resolver 语义，无法按附件路径缩小范围。
	if (previousParts.slice(0, 4).some((part, index) => part !== nextParts[index])) {
		return undefined
	}

	const previousEntries = new Set(previousParts[4]?.split("\u0001").filter(Boolean))
	const nextEntries = new Set(nextParts[4]?.split("\u0001").filter(Boolean))
	const changedPaths = new Set<string>()
	const collectChangedEntries = (entries: Set<string>, otherEntries: Set<string>) => {
		entries.forEach((entry) => {
			if (otherEntries.has(entry)) return
			const path = entry.split("\u0000", 1)[0]?.trim() ?? ""
			if (path) changedPaths.add(path.startsWith("/") ? path : `/${path}`)
		})
	}
	collectChangedEntries(previousEntries, nextEntries)
	collectChangedEntries(nextEntries, previousEntries)
	changedPaths.delete("")
	return Array.from(changedPaths)
}

function normalizeResolverSnapshot(
	methods: CanvasDesignMethods | undefined,
): CanvasResourceReferenceResolverSnapshot | undefined {
	if (!methods) return undefined

	const explicitSnapshot = methods.resourceReferenceResolverSnapshot
	if (explicitSnapshot) {
		if (typeof explicitSnapshot.resolve !== "function") {
			throw new Error(
				"MagicConfigManager: resourceReferenceResolverSnapshot.resolve must be a function.",
			)
		}
		if (methods.resolveResourceReference !== explicitSnapshot.resolve) {
			throw new Error(
				"MagicConfigManager: resolveResourceReference must match resourceReferenceResolverSnapshot.resolve.",
			)
		}
		if (
			methods.resourceReferenceResolverVersion !== undefined &&
			methods.resourceReferenceResolverVersion !== explicitSnapshot.revision
		) {
			throw new Error(
				"MagicConfigManager: resourceReferenceResolverVersion must match resourceReferenceResolverSnapshot.revision.",
			)
		}
		return explicitSnapshot
	}

	if (methods.resourceReferenceResolverVersion === undefined) return undefined
	return {
		revision: methods.resourceReferenceResolverVersion,
		resolve: methods.resolveResourceReference,
	}
}

/**
 * MagicConfigManager
 * 统一管理 magic 相关配置(methods 和 permissions)
 */
export class MagicConfigManager {
	public config?: MagicConfig

	constructor(options: { canvas: Canvas; config?: MagicConfig }) {
		const { config } = options
		this.update(config)
	}

	update(config?: MagicConfig): {
		resourceReferenceResolverChanged: boolean
		resourceReferenceChangedPaths?: string[]
	} {
		const methods = config?.methods
		if (methods != null && typeof methods.resolveResourceReference !== "function") {
			throw new Error(
				"MagicConfigManager: methods.resolveResourceReference is required when methods is provided.",
			)
		}
		const previousMethods = this.config?.methods
		const previousSnapshot = previousMethods?.resourceReferenceResolverSnapshot
		const nextSnapshot = normalizeResolverSnapshot(methods)
		const resourceReferenceResolverChanged =
			previousSnapshot || nextSnapshot
				? previousSnapshot?.revision !== nextSnapshot?.revision
				: previousMethods?.resolveResourceReference !== methods?.resolveResourceReference
		this.config =
			config && methods && nextSnapshot
				? {
						...config,
						methods: {
							...methods,
							resolveResourceReference: nextSnapshot.resolve,
							resourceReferenceResolverSnapshot: nextSnapshot,
							resourceReferenceResolverVersion: nextSnapshot.revision,
						},
					}
				: config
		const resourceReferenceChangedPaths = resourceReferenceResolverChanged
			? getChangedResourcePaths(previousSnapshot?.revision, nextSnapshot?.revision)
			: undefined
		return {
			resourceReferenceResolverChanged,
			...(resourceReferenceChangedPaths !== undefined
				? { resourceReferenceChangedPaths }
				: {}),
		}
	}
}
