export type MediaResourceProvider = "canvas" | "project-file" | "user-file" | "upload-file"

export type MediaResourceRendition = "thumbnail" | "preview"

export type MediaResourceStatus =
	"idle" | "loading" | "ready" | "expired" | "deleted" | "forbidden" | "unsupported" | "error"

export interface MediaResourceRef {
	identity: string
	provider: MediaResourceProvider
	/** Permission namespace for runtime-only resources; prevents cross-account reuse. */
	scope?: string
	projectId?: string
	fileId?: string
	fileVersion?: number
	updatedAt?: string
	resourceVersion?: string
	path?: string
	file?: File | null
	fileName: string
	mediaType: "image" | "video" | "audio"
}

export interface MediaResourceSnapshot {
	identity: string
	status: MediaResourceStatus
	thumbnailUrl?: string
	previewUrl?: string
	audioUrl?: string
	posterUrl?: string
	previewSize?: { width: number; height: number }
	duration?: number
	expiresAt?: string | number
	errorCode?: string
}

export interface MediaResourceResolveResult extends Partial<
	Omit<MediaResourceSnapshot, "identity" | "status">
> {
	status?: Exclude<MediaResourceStatus, "idle" | "loading">
}

export type MediaResourceResolver = (
	ref: MediaResourceRef,
	rendition: MediaResourceRendition,
	signal: AbortSignal,
) => Promise<MediaResourceResolveResult | null>
