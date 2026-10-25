/**
 * Resource paths cross several namespaces in CanvasDesign. Callers must identify the
 * namespace explicitly so a workspace path is never reinterpreted as a canvas DSL path.
 */
export type CanvasResourceReferenceMode = "strict-current-canvas" | "legacy-recovery"

export type CanvasResourceReferenceInput =
	| {
			namespace: "canvas-storage"
			path: string
			mode?: CanvasResourceReferenceMode
	  }
	| {
			namespace: "workspace-path"
			path: string
	  }
	| {
			namespace: "attachment"
			fileId: string
			source?: number
	  }
	| {
			namespace: "private-upload-path"
			path: string
	  }
	| {
			namespace: "external-url"
			url: string
	  }

export interface CanvasResourceReferenceResolveOptions {
	/** Require the resolved workspace resource to exist in the current attachment snapshot. */
	requireAttachment?: boolean
}

export type CanvasResourceReferenceFailureReason =
	| "empty-reference"
	| "invalid-asset-reference"
	| "invalid-external-url"
	| "missing-current-canvas"
	| "missing-workspace-path"
	| "missing-private-upload-path"
	| "legacy-path-requires-recovery"
	| "path-traversal"
	| "attachment-path-missing"

export interface ResolvedCanvasResourceReference {
	status: "resolved"
	resourceKind: "workspace-file" | "private-upload" | "external" | "opaque-asset"
	/** Original value supplied by the caller, retained for diagnostics only. */
	rawReference: string
	/** Canonical logical workspace location. Workspace paths always start with `/`. */
	workspacePath?: string
	/** Value written to Canvas storage / magic.project.js. This is not a resource identity. */
	storagePath: string
	/** Asset service ID when resourceKind is opaque-asset. */
	assetId?: string
	/** Stable comparison and cache key. */
	identity: string
	/** Attachment-tree node identity when attachment evidence is available. */
	attachmentId?: string
	source?: number
	/** Canonical namespace-local candidates considered during resolution. */
	candidates: string[]
	legacyRecovered: boolean
	resolutionSource:
		| "strict-path"
		| "workspace-path"
		| "attachment-id"
		| "legacy-recovery"
		| "private-upload-path"
		| "external"
		| "opaque-asset"
}

export interface UnresolvedCanvasResourceReference {
	status: "ambiguous" | "not-found" | "attachments-pending" | "invalid"
	rawReference: string
	candidates: string[]
	attachmentIds?: string[]
	reason?: CanvasResourceReferenceFailureReason
}

export type CanvasResourceReferenceResolution =
	ResolvedCanvasResourceReference | UnresolvedCanvasResourceReference

export type ResolveCanvasResourceReference = (
	input: CanvasResourceReferenceInput,
	options?: CanvasResourceReferenceResolveOptions,
) => CanvasResourceReferenceResolution

/**
 * Atomic resolver contract. `revision` describes the complete project/canvas-scoped
 * resolution semantics consumed by `resolve`.
 */
export interface CanvasResourceReferenceResolverSnapshot {
	revision: string
	resolve: ResolveCanvasResourceReference
}
