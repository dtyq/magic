import type {
	CanvasResourceReferenceInput,
	CanvasResourceReferenceFailureReason,
	CanvasResourceReferenceResolution,
	CanvasResourceReferenceResolveOptions,
	ResolvedCanvasResourceReference,
} from "@/components/CanvasDesign/public/resource-reference"
import {
	buildAssetResourcePath,
	isAssetResourcePath,
	isAssetResourceScheme,
	isRemoteOrSpecialPath,
	normalizePathSeparators,
	parseAssetResourcePath,
	stripPathEdgeSlashes,
} from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import {
	isLegacyBareDesignResourcePath,
	resolveDesignAttachment,
	resolveDesignPathForOperation,
	toDesignDslPathFromWorkspacePath,
	toWorkspaceRelativeCandidates,
	type DesignPathContext,
} from "./designPath"

export interface DesignResourceReferenceResolverContext extends DesignPathContext {
	attachmentsReady?: boolean
}

export interface DesignResourceReferenceResolverRevisionContext {
	projectId?: string
	designProjectId?: string
	designProjectBasePath?: string
	attachmentsReady?: boolean
	resourceReferenceSnapshotKey?: string
}

/** Build the project/canvas-scoped semantic revision used to invalidate Canvas identities. */
export function buildDesignResourceReferenceResolverRevision(
	ctx: DesignResourceReferenceResolverRevisionContext,
): string {
	return JSON.stringify([
		ctx.projectId?.trim() ?? "",
		ctx.designProjectId?.trim() ?? "",
		ctx.designProjectBasePath?.trim() ?? "",
		ctx.attachmentsReady === true ? "ready" : "pending",
		ctx.resourceReferenceSnapshotKey ?? "",
	])
}

const LEGACY_FILE_ID_PATTERN = /^\d{16,}$/

function getRawReference(input: CanvasResourceReferenceInput): string {
	switch (input.namespace) {
		case "attachment":
			return input.fileId
		case "external-url":
			return input.url
		default:
			return input.path
	}
}

function toCanonicalRelativePath(
	path: string,
	missingReason: "missing-workspace-path" | "missing-private-upload-path",
):
	| { status: "valid"; path: string }
	| {
			status: "invalid"
			reason: "missing-workspace-path" | "missing-private-upload-path" | "path-traversal"
	  } {
	const normalized = normalizePathSeparators(path.trim()).replace(/\/{2,}/g, "/")
	const relativePath = stripPathEdgeSlashes(normalized)
	if (!relativePath) return { status: "invalid", reason: missingReason }

	const segments = relativePath.split("/")
	if (segments.some((segment) => segment === "." || segment === ".." || segment.includes("\0"))) {
		return { status: "invalid", reason: "path-traversal" }
	}

	return { status: "valid", path: relativePath }
}

function toCanonicalWorkspacePath(relativePath: string): string {
	return `/${relativePath}`
}

function toCanonicalWorkspaceCandidates(paths: string[]): string[] {
	const candidates = new Set<string>()
	for (const path of paths) {
		const normalized = toCanonicalRelativePath(path, "missing-workspace-path")
		if (normalized.status === "valid") {
			candidates.add(toCanonicalWorkspacePath(normalized.path))
		}
	}
	return Array.from(candidates)
}

function createFailure(
	input: CanvasResourceReferenceInput,
	status: "ambiguous" | "not-found" | "attachments-pending" | "invalid",
	options?: {
		candidates?: string[]
		attachmentIds?: string[]
		reason?: CanvasResourceReferenceFailureReason
	},
): CanvasResourceReferenceResolution {
	return {
		status,
		rawReference: getRawReference(input),
		candidates: options?.candidates ?? [],
		attachmentIds: options?.attachmentIds,
		reason: options?.reason,
	}
}

function isAttachmentSnapshotReady(ctx: DesignResourceReferenceResolverContext): boolean {
	if (ctx.attachmentsReady !== undefined) return ctx.attachmentsReady
	return Array.isArray(ctx.flatAttachments)
}

function findAttachmentByFileId(
	fileId: string,
	ctx: DesignResourceReferenceResolverContext,
): FileItem | undefined {
	const indexed = ctx.attachmentIndex?.byFileId.get(fileId)
	if (indexed && !indexed.is_directory) return indexed
	if (ctx.attachmentIndex) return undefined
	return ctx.flatAttachments?.find((item) => item.file_id === fileId && !item.is_directory)
}

function createExternalResolution(
	input: CanvasResourceReferenceInput,
	rawReference: string,
): CanvasResourceReferenceResolution {
	const value = rawReference.trim()
	if (!value) return createFailure(input, "invalid", { reason: "empty-reference" })
	const assetResolution = resolveAssetPathReference(input, rawReference)
	if (assetResolution) return assetResolution
	if (!isRemoteOrSpecialPath(value)) {
		return createFailure(input, "invalid", { reason: "invalid-external-url" })
	}

	return {
		status: "resolved",
		resourceKind: "external",
		rawReference,
		storagePath: value,
		identity: `external:${value}`,
		candidates: [],
		legacyRecovered: false,
		resolutionSource: "external",
	}
}

function createOpaqueAssetResolution(
	input: CanvasResourceReferenceInput,
	rawReference: string,
): CanvasResourceReferenceResolution {
	const value = rawReference.trim()
	const assetId = parseAssetResourcePath(value)
	if (!value) return createFailure(input, "invalid", { reason: "empty-reference" })
	if (!assetId) {
		return createFailure(input, "invalid", { reason: "invalid-asset-reference" })
	}
	const storagePath = buildAssetResourcePath(assetId)

	return {
		status: "resolved",
		resourceKind: "opaque-asset",
		rawReference,
		storagePath,
		assetId,
		identity: `opaque-asset:${storagePath}`,
		candidates: [],
		legacyRecovered: false,
		resolutionSource: "opaque-asset",
	}
}

function resolveAssetPathReference(
	input: CanvasResourceReferenceInput,
	rawReference: string,
): CanvasResourceReferenceResolution | undefined {
	const value = rawReference.trim()
	if (isAssetResourcePath(value)) return createOpaqueAssetResolution(input, rawReference)
	if (isAssetResourceScheme(value)) {
		return createFailure(input, "invalid", { reason: "invalid-asset-reference" })
	}
	return undefined
}

function resolvePrivateUploadPathReference(
	input: Extract<CanvasResourceReferenceInput, { namespace: "private-upload-path" }>,
): CanvasResourceReferenceResolution {
	const rawPath = input.path.trim()
	if (!rawPath) return createFailure(input, "invalid", { reason: "empty-reference" })
	const assetResolution = resolveAssetPathReference(input, input.path)
	if (assetResolution) return assetResolution
	if (isRemoteOrSpecialPath(rawPath)) return createExternalResolution(input, input.path)

	const normalizedRawPath = normalizePathSeparators(rawPath)
	const pathWithoutCurrentDirectory = normalizedRawPath.startsWith("./")
		? normalizedRawPath.slice(2)
		: normalizedRawPath
	const normalized = toCanonicalRelativePath(
		pathWithoutCurrentDirectory,
		"missing-private-upload-path",
	)
	if (normalized.status === "invalid") {
		return createFailure(input, "invalid", { reason: normalized.reason })
	}

	return {
		status: "resolved",
		resourceKind: "private-upload",
		rawReference: input.path,
		storagePath: normalized.path,
		identity: `private-upload:${normalized.path}`,
		candidates: [normalized.path],
		legacyRecovered: false,
		resolutionSource: "private-upload-path",
	}
}

function createWorkspaceResolution(options: {
	input: CanvasResourceReferenceInput
	workspaceRelativePath: string
	ctx: DesignResourceReferenceResolverContext
	attachment?: FileItem
	candidates?: string[]
	legacyRecovered: boolean
	resolutionSource: ResolvedCanvasResourceReference["resolutionSource"]
}): CanvasResourceReferenceResolution {
	const normalized = toCanonicalRelativePath(
		options.workspaceRelativePath,
		"missing-workspace-path",
	)
	if (normalized.status === "invalid") {
		return createFailure(options.input, "invalid", { reason: normalized.reason })
	}

	const workspacePath = toCanonicalWorkspacePath(normalized.path)
	return {
		status: "resolved",
		resourceKind: "workspace-file",
		rawReference: getRawReference(options.input),
		workspacePath,
		storagePath: toDesignDslPathFromWorkspacePath(workspacePath, options.ctx),
		identity: `workspace:${workspacePath}`,
		attachmentId: options.attachment?.file_id,
		source: options.attachment?.source,
		candidates: options.candidates ?? [workspacePath],
		legacyRecovered: options.legacyRecovered,
		resolutionSource: options.resolutionSource,
	}
}

function resolveKnownWorkspacePath(options: {
	input: CanvasResourceReferenceInput
	workspaceRelativePath: string
	ctx: DesignResourceReferenceResolverContext
	resolveOptions?: CanvasResourceReferenceResolveOptions
	candidates?: string[]
	legacyRecovered: boolean
	resolutionSource: ResolvedCanvasResourceReference["resolutionSource"]
}): CanvasResourceReferenceResolution {
	const normalized = toCanonicalRelativePath(
		options.workspaceRelativePath,
		"missing-workspace-path",
	)
	if (normalized.status === "invalid") {
		return createFailure(options.input, "invalid", { reason: normalized.reason })
	}

	const workspacePath = toCanonicalWorkspacePath(normalized.path)
	const shouldLookupAttachment =
		options.resolveOptions?.requireAttachment === true ||
		Boolean(options.ctx.attachmentIndex || options.ctx.flatAttachments?.length)
	if (!shouldLookupAttachment) {
		return createWorkspaceResolution({
			...options,
			workspaceRelativePath: normalized.path,
		})
	}

	const attachmentResolution = resolveDesignAttachment(workspacePath, options.ctx, {
		mode: "strict-current-canvas",
	})
	if (attachmentResolution.status === "ambiguous") {
		return createFailure(options.input, "ambiguous", {
			candidates: options.candidates ?? [workspacePath],
			attachmentIds: Array.from(
				new Set(attachmentResolution.matches.map((match) => match.fileItem.file_id)),
			),
		})
	}
	if (attachmentResolution.status === "not-found") {
		if (options.resolveOptions?.requireAttachment !== true) {
			return createWorkspaceResolution({
				...options,
				workspaceRelativePath: normalized.path,
			})
		}
		return createFailure(
			options.input,
			isAttachmentSnapshotReady(options.ctx) ? "not-found" : "attachments-pending",
			{ candidates: options.candidates ?? [workspacePath] },
		)
	}

	return createWorkspaceResolution({
		...options,
		workspaceRelativePath: normalized.path,
		attachment: attachmentResolution.fileItem,
	})
}

function resolveAttachmentReference(
	input: Extract<CanvasResourceReferenceInput, { namespace: "attachment" }>,
	ctx: DesignResourceReferenceResolverContext,
): CanvasResourceReferenceResolution {
	const fileId = input.fileId.trim()
	if (!fileId) return createFailure(input, "invalid", { reason: "empty-reference" })

	const attachment = findAttachmentByFileId(fileId, ctx)
	if (!attachment) {
		return createFailure(
			input,
			isAttachmentSnapshotReady(ctx) ? "not-found" : "attachments-pending",
			{ attachmentIds: [fileId] },
		)
	}

	if (!attachment.relative_file_path) {
		return createFailure(input, "invalid", {
			attachmentIds: [fileId],
			reason: "attachment-path-missing",
		})
	}

	const resolution = createWorkspaceResolution({
		input,
		workspaceRelativePath: attachment.relative_file_path,
		ctx,
		attachment,
		legacyRecovered: false,
		resolutionSource: "attachment-id",
	})
	if (resolution.status !== "resolved") return resolution

	return {
		...resolution,
		source: input.source ?? resolution.source,
	}
}

function resolveCanvasStorageReference(
	input: Extract<CanvasResourceReferenceInput, { namespace: "canvas-storage" }>,
	ctx: DesignResourceReferenceResolverContext,
	resolveOptions?: CanvasResourceReferenceResolveOptions,
): CanvasResourceReferenceResolution {
	const rawPath = input.path.trim()
	if (!rawPath) return createFailure(input, "invalid", { reason: "empty-reference" })
	const assetResolution = resolveAssetPathReference(input, input.path)
	if (assetResolution) return assetResolution
	if (isRemoteOrSpecialPath(rawPath)) return createExternalResolution(input, input.path)

	if (LEGACY_FILE_ID_PATTERN.test(rawPath)) {
		return resolveAttachmentReference({ namespace: "attachment", fileId: rawPath }, ctx)
	}

	const mode = input.mode ?? "strict-current-canvas"
	if (mode === "legacy-recovery" && isLegacyBareDesignResourcePath(rawPath)) {
		const resolution = resolveDesignPathForOperation(rawPath, ctx)
		const candidates = toCanonicalWorkspaceCandidates(
			toWorkspaceRelativeCandidates(rawPath, ctx, { mode: "legacy-recovery" }),
		)
		if (resolution.status !== "found") {
			return createFailure(input, resolution.status, { candidates })
		}

		const workspaceRelativePath =
			resolution.fileItem?.relative_file_path || resolution.resolvedPath
		return createWorkspaceResolution({
			input,
			workspaceRelativePath,
			ctx,
			attachment: resolution.fileItem,
			candidates,
			legacyRecovered: resolution.legacyRecovered,
			resolutionSource: "legacy-recovery",
		})
	}
	if (isLegacyBareDesignResourcePath(rawPath)) {
		return createFailure(input, "invalid", {
			reason: "legacy-path-requires-recovery",
		})
	}

	const workspaceRelativeCandidates = toWorkspaceRelativeCandidates(rawPath, ctx, {
		mode: "strict-current-canvas",
	})
	const workspaceRelativePath = workspaceRelativeCandidates[0]
	const candidates = toCanonicalWorkspaceCandidates(workspaceRelativeCandidates)
	if (!workspaceRelativePath || candidates.length === 0) {
		return createFailure(input, "invalid", {
			candidates,
			reason: ctx.designProjectBasePath ? "missing-workspace-path" : "missing-current-canvas",
		})
	}

	return resolveKnownWorkspacePath({
		input,
		workspaceRelativePath,
		ctx,
		resolveOptions,
		candidates,
		legacyRecovered: false,
		resolutionSource: "strict-path",
	})
}

function resolveWorkspacePathReference(
	input: Extract<CanvasResourceReferenceInput, { namespace: "workspace-path" }>,
	ctx: DesignResourceReferenceResolverContext,
	resolveOptions?: CanvasResourceReferenceResolveOptions,
): CanvasResourceReferenceResolution {
	const rawPath = input.path.trim()
	if (!rawPath) return createFailure(input, "invalid", { reason: "empty-reference" })
	const assetResolution = resolveAssetPathReference(input, input.path)
	if (assetResolution) return assetResolution
	if (isRemoteOrSpecialPath(rawPath)) return createExternalResolution(input, input.path)

	const normalized = toCanonicalRelativePath(rawPath, "missing-workspace-path")
	if (normalized.status === "invalid") {
		return createFailure(input, "invalid", { reason: normalized.reason })
	}

	const workspacePath = toCanonicalWorkspacePath(normalized.path)
	return resolveKnownWorkspacePath({
		input,
		workspaceRelativePath: normalized.path,
		ctx,
		resolveOptions,
		candidates: [workspacePath],
		legacyRecovered: false,
		resolutionSource: "workspace-path",
	})
}

/**
 * Resolves resource references without guessing across namespaces. Strict paths can establish
 * identity without attachment data; legacy bare paths and file IDs require attachment evidence.
 */
export function resolveDesignResourceReference(
	input: CanvasResourceReferenceInput,
	ctx: DesignResourceReferenceResolverContext,
	options?: CanvasResourceReferenceResolveOptions,
): CanvasResourceReferenceResolution {
	switch (input.namespace) {
		case "canvas-storage":
			return resolveCanvasStorageReference(input, ctx, options)
		case "workspace-path":
			return resolveWorkspacePathReference(input, ctx, options)
		case "attachment":
			return resolveAttachmentReference(input, ctx)
		case "private-upload-path":
			return resolvePrivateUploadPathReference(input)
		case "external-url":
			return createExternalResolution(input, input.url)
	}
}

/** Resolve a Canvas-stored path while keeping strict and legacy recovery semantics explicit. */
export function resolveDesignCanvasResourceReference(
	path: string,
	ctx: DesignResourceReferenceResolverContext,
	options?: CanvasResourceReferenceResolveOptions,
): CanvasResourceReferenceResolution {
	return resolveDesignResourceReference(
		{
			namespace: "canvas-storage",
			path,
			mode: isLegacyBareDesignResourcePath(path)
				? "legacy-recovery"
				: "strict-current-canvas",
		},
		ctx,
		options,
	)
}

/** API file paths use the resolver's canonical workspace location. */
export function resolveDesignCanvasResourceWorkspacePath(
	path: string,
	ctx: DesignResourceReferenceResolverContext,
): string | undefined {
	const resolution = resolveDesignCanvasResourceReference(path, ctx)
	return resolution.status === "resolved" && resolution.resourceKind === "workspace-file"
		? resolution.workspacePath
		: undefined
}

/** Resolve a Canvas-stored resource to the URI accepted by generation APIs. */
export function resolveDesignCanvasResourceApiUri(
	path: string,
	ctx: DesignResourceReferenceResolverContext,
): string | undefined {
	const resolution = resolveDesignCanvasResourceReference(path, ctx)
	if (resolution.status !== "resolved") return undefined
	if (resolution.resourceKind === "opaque-asset") return resolution.storagePath
	return resolution.resourceKind === "workspace-file" ? resolution.workspacePath : undefined
}

/** Resolve an output directory to the canonical workspace API path. */
export function resolveDesignWorkspaceDirectoryApiPath(
	path: string,
	ctx: DesignResourceReferenceResolverContext,
): string | undefined {
	const resolution = resolveDesignResourceReference({ namespace: "workspace-path", path }, ctx)
	if (resolution.status !== "resolved" || resolution.resourceKind !== "workspace-file") {
		return undefined
	}
	return `${resolution.workspacePath.replace(/\/+$/, "")}/`
}

/** Persist a known workspace path using the same resolver that owns resource identity. */
export function resolveDesignWorkspaceStoragePath(
	workspacePath: string,
	ctx: DesignResourceReferenceResolverContext,
): string | undefined {
	const resolution = resolveDesignResourceReference(
		{ namespace: "workspace-path", path: workspacePath },
		ctx,
	)
	return resolution.status === "resolved" && resolution.resourceKind === "workspace-file"
		? resolution.storagePath
		: undefined
}

/** Resolve a reference and return its exact attachment node without adding a second path matcher. */
export function resolveDesignResourceFileItem(
	input: CanvasResourceReferenceInput,
	ctx: DesignResourceReferenceResolverContext,
): FileItem | undefined {
	const resolution = resolveDesignResourceReference(input, ctx, { requireAttachment: true })
	if (resolution.status !== "resolved" || !resolution.attachmentId) return undefined
	return findAttachmentByFileId(resolution.attachmentId, ctx)
}

/** Resolve a Canvas-stored path directly to its exact attachment node. */
export function resolveDesignCanvasResourceFileItem(
	path: string,
	ctx: DesignResourceReferenceResolverContext,
): FileItem | undefined {
	const resolution = resolveDesignCanvasResourceReference(path, ctx, {
		requireAttachment: true,
	})
	if (resolution.status !== "resolved" || !resolution.attachmentId) return undefined
	return findAttachmentByFileId(resolution.attachmentId, ctx)
}
