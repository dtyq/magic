import { useCallback, useEffect, useMemo, useRef } from "react"
import type { MediaPreviewSource } from "@/components/base/MediaPreview"
import {
	mediaResourceRegistry,
	useMediaResourceSnapshot,
	type MediaResourceRef,
	type MediaResourceResolver,
	type MediaResourceRendition,
	type MediaResourceResolveResult,
} from "@/services/media/MediaResourceRegistry"
import { useFileApi } from "../fileAccess/fileApi"
import { useFileAccess } from "../fileAccess/FileAccessProvider"
import { useFileAccess as useFilePermissions } from "../providers/FileAccessProvider"
import { shouldWaitForShareAccess } from "../fileAccess/fileAccessContext"
import { getFileType, downloadFileWithAnchor } from "../utils/handleFIle"
import { DownloadImageMode } from "../pages/Workspace/types"
import { AttachmentSource } from "../components/TopicFilesButton/hooks/types"
import { parseExpiresAt } from "@/components/CanvasDesign/runtime/resources/offline-cache/ossExpiryUtils"
import { useSharedMediaResourceScope } from "./sharedMediaResourceScope"
import { SHARED_MEDIA_THUMBNAIL_IMAGE_PROCESS } from "./sharedMediaImageProcess"
import {
	SHARED_MEDIA_URL_FALLBACK_TTL_MS,
	SHARED_MEDIA_URL_EXPIRY_SAFETY_WINDOW_MS,
} from "./sharedMediaUrlCache"
import { getFileReferenceIdentityKey, resolveFileReference } from "./userFileReferenceResolver"
import type { FileReferenceSource } from "@/components/business/MentionPanel/utils/fileReferenceMention"

const refreshRequests = new Map<string, Promise<void>>()

/** 只保存文件身份与版本；临时地址和媒体 DOM 不属于文件引用。 */
export interface FileMediaMetadata {
	spaceType: "project" | "user"
	fileId: string
	identity?: string
	projectId?: string
	fileName: string
	fileExtension: string
	fileVersion?: number
	updatedAt?: string
	resourceVersion?: string
	path?: string
	isAIImage?: boolean
	allowDownload?: boolean
}

export function getFileMediaMetadata(
	file: FileReferenceSource & { source?: AttachmentSource },
	projectId?: string,
): FileMediaMetadata | null {
	const reference = file.file_reference
	if (file.is_directory || reference?.is_directory || !file.file_id) return null
	const version = file.resource_version ?? file.version
	return {
		spaceType:
			reference?.space_type === "user" || file.space_type === "user" ? "user" : "project",
		fileId: String(file.file_id),
		projectId: file.project_id || projectId,
		fileName: String(file.file_name || file.filename || ""),
		fileExtension: file.file_extension || "",
		fileVersion: file.file_version,
		updatedAt: file.updated_at,
		resourceVersion: version == null ? undefined : String(version),
		path: file.relative_file_path,
		isAIImage: file.source === AttachmentSource.AI,
	}
}

export function useFileMediaSource(
	file: FileMediaMetadata | null | undefined,
	{ enabled = true, loadThumbnail = true }: { enabled?: boolean; loadThumbnail?: boolean } = {},
): MediaPreviewSource | null {
	const fileApi = useFileApi()
	const access = useFileAccess()
	const { permissions } = useFilePermissions()
	const previewEnabled = enabled && permissions.preview
	// 分享页必须由宿主明确允许下载，不能凭已有预览 URL 推定权限。
	// 上层拒绝下载时，具体文件的 allowDownload=true 也不能恢复权限。
	const downloadAllowed =
		permissions.download && (file?.allowDownload ?? access?.kind !== "share")
	const sharedScope = useSharedMediaResourceScope()
	const userIdentity = getFileReferenceIdentityKey()
	const type = getFileType(file?.fileExtension || file?.fileName.split(".").pop() || "")
	const mediaType = type === "image" || type === "video" || type === "audio" ? type : null
	const spaceType = file?.spaceType
	const fileId = file?.fileId
	const identity = file?.identity || fileId
	const projectId = file?.projectId
	const fileName = file?.fileName || ""
	const fileVersion = file?.fileVersion
	const updatedAt = file?.updatedAt
	const resourceVersion = file?.resourceVersion
	const path = file?.path
	// 分享权限与登录权限可以同时存在于不同子树，不能只用当前账号隔离媒体。
	const scope = [sharedScope, fileApi.identityKey, spaceType === "user" ? userIdentity : ""].join(
		"|",
	)
	const actionKey = [scope, fileId, fileVersion, updatedAt, resourceVersion].join("|")
	const activeRef = useRef({ actionKey, enabled: previewEnabled, downloadAllowed })
	activeRef.current = { actionKey, enabled: previewEnabled, downloadAllowed }
	useEffect(() => {
		activeRef.current.enabled = previewEnabled
		return () => {
			activeRef.current.enabled = false
		}
	}, [actionKey, previewEnabled])
	const canLoad =
		previewEnabled &&
		!shouldWaitForShareAccess(access) &&
		(spaceType !== "user" || (Boolean(userIdentity) && access?.kind !== "share"))
	// Depend on primitive fields only — TipTap may pass a new attrs.data object each update.
	const ref = useMemo<MediaResourceRef | null>(() => {
		if (!canLoad || !fileId || !identity || !mediaType) return null
		return {
			identity,
			provider: spaceType === "user" ? "user-file" : "project-file",
			scope,
			projectId,
			fileId,
			fileName,
			fileVersion,
			updatedAt,
			resourceVersion,
			path,
			mediaType,
		}
	}, [
		canLoad,
		fileId,
		identity,
		mediaType,
		spaceType,
		scope,
		projectId,
		fileName,
		fileVersion,
		updatedAt,
		resourceVersion,
		path,
	])

	const resolveResource = useCallback(
		async (
			target: MediaResourceRef,
			rendition: MediaResourceRendition,
			signal: AbortSignal,
			forceRefresh = false,
			originalImage = false,
		): Promise<MediaResourceResolveResult | null> => {
			if (!target.fileId || signal.aborted) return null
			if (target.provider === "user-file") {
				const result = await resolveFileReference({ file_id: target.fileId }, signal)
				if (
					result.status !== "resolved" ||
					result.reference.space_type !== "user" ||
					userIdentity !== getFileReferenceIdentityKey()
				)
					return { status: "forbidden" }
			}
			const isImage = target.mediaType === "image"
			const items = await fileApi.requestSharedMediaUrls([target.fileId], {
				scope: sharedScope,
				fileVersions:
					target.fileVersion === undefined
						? undefined
						: { [target.fileId]: target.fileVersion },
				fileUpdatedAtMap:
					target.updatedAt === undefined
						? undefined
						: { [target.fileId]: target.updatedAt },
				fileResourceVersionMap:
					target.resourceVersion === undefined
						? undefined
						: { [target.fileId]: target.resourceVersion },
				allowAttachmentListUrl:
					!originalImage && !forceRefresh && isImage && target.provider !== "user-file",
				forceRefresh,
				imageProcess:
					isImage && !originalImage ? SHARED_MEDIA_THUMBNAIL_IMAGE_PROCESS : undefined,
			})
			if (
				signal.aborted ||
				(target.provider === "user-file" && userIdentity !== getFileReferenceIdentityKey())
			)
				return null
			const item = items.find((row) => String(row.file_id) === target.fileId)
			if (!item?.url) return { status: "error", errorCode: "url-unavailable" }
			return {
				status: "ready",
				thumbnailUrl: rendition === "thumbnail" ? item.url : undefined,
				previewUrl: rendition === "preview" || isImage ? item.url : undefined,
				audioUrl:
					target.mediaType === "audio" && rendition === "preview" ? item.url : undefined,
				expiresAt:
					parseExpiresAt(item.expires_at) ??
					Date.now() + SHARED_MEDIA_URL_FALLBACK_TTL_MS,
			}
		},
		[fileApi, sharedScope, userIdentity],
	)
	const resolver = useCallback<MediaResourceResolver>(
		(target, rendition, signal) => resolveResource(target, rendition, signal),
		[resolveResource],
	)
	const resource = useMediaResourceSnapshot(ref, {
		enabled: canLoad,
		loadThumbnail: loadThumbnail && mediaType === "image",
		resolver,
	})
	const { key: resourceKey, snapshot } = resource
	const expiresAt =
		typeof snapshot.expiresAt === "number"
			? snapshot.expiresAt
			: (parseExpiresAt(snapshot.expiresAt) ?? undefined)
	const loadPreview = useCallback(
		() => (ref ? mediaResourceRegistry.ensurePreview(ref, resolver) : Promise.resolve()),
		[ref, resolver],
	)
	const refreshSource = useCallback(
		async (rendition: MediaResourceRendition) => {
			if (!ref?.fileId) return
			const key = resourceKey
			const pending = refreshRequests.get(key)
			if (pending) return pending
			mediaResourceRegistry.prime(ref, mediaResourceRegistry.getSnapshot(ref), {
				cancelPending: true,
			})
			// 续期时保留已挂载播放器和旧地址；新地址到达后原位绑定，避免丢失播放位置。
			const controller = new AbortController()
			const request = resolveResource(ref, rendition, controller.signal, true)
				.then((result) => {
					if (!result) return
					const previous = mediaResourceRegistry.getSnapshot(ref)
					mediaResourceRegistry.prime(ref, {
						...previous,
						...result,
						thumbnailUrl: result.thumbnailUrl ?? previous.thumbnailUrl,
						previewUrl: result.previewUrl ?? previous.previewUrl,
						audioUrl: result.audioUrl ?? previous.audioUrl,
					})
				})
				.catch(() => {
					mediaResourceRegistry.prime(ref, {
						...mediaResourceRegistry.getSnapshot(ref),
						status: "error",
						errorCode: "refresh-failed",
					})
				})
				.finally(() => refreshRequests.delete(key))
			refreshRequests.set(key, request)
			await request
		},
		[ref, resourceKey, resolveResource],
	)
	const imageActions = useMemo(() => {
		if (!ref?.fileId || mediaType !== "image") return undefined
		const targetFileId = ref.fileId
		return {
			load: async ({
				signal,
				forceRefresh,
			}: {
				signal: AbortSignal
				forceRefresh: boolean
			}) => {
				if (activeRef.current.actionKey !== actionKey || !activeRef.current.enabled)
					return null
				const result = await resolveResource(ref, "preview", signal, forceRefresh, true)
				if (
					signal.aborted ||
					activeRef.current.actionKey !== actionKey ||
					!activeRef.current.enabled ||
					result?.status !== "ready" ||
					!result.previewUrl
				)
					return null
				const expiry =
					typeof result.expiresAt === "number"
						? result.expiresAt
						: parseExpiresAt(result.expiresAt ?? undefined)
				return {
					url: result.previewUrl,
					refreshAt: expiry
						? expiry - SHARED_MEDIA_URL_EXPIRY_SAFETY_WINDOW_MS
						: undefined,
				}
			},
			isAIImage: file?.isAIImage,
			onDownload: downloadAllowed
				? async (mode?: DownloadImageMode) => {
						if (
							activeRef.current.actionKey !== actionKey ||
							!activeRef.current.enabled ||
							!activeRef.current.downloadAllowed
						)
							return
						if (ref.provider === "user-file") {
							const resolved = await resolveFileReference({ file_id: targetFileId })
							if (
								resolved.status !== "resolved" ||
								resolved.reference.space_type !== "user" ||
								userIdentity !== getFileReferenceIdentityKey()
							)
								throw new Error("File access unavailable")
						}
						const rows = await fileApi.getTemporaryDownloadUrl({
							file_ids: [targetFileId],
							is_download: true,
							download_mode: mode,
							file_versions:
								ref.fileVersion === undefined
									? undefined
									: { [targetFileId]: ref.fileVersion },
						})
						if (
							activeRef.current.actionKey !== actionKey ||
							!activeRef.current.enabled ||
							!activeRef.current.downloadAllowed
						)
							return
						const url = rows.find((row) => row.file_id === ref.fileId)?.url
						if (!url) throw new Error("Download URL unavailable")
						await downloadFileWithAnchor(url, fileName)
					}
				: undefined,
		}
	}, [
		ref,
		mediaType,
		actionKey,
		resolveResource,
		downloadAllowed,
		file?.isAIImage,
		fileApi,
		fileName,
		userIdentity,
	])

	return useMemo(() => {
		if (!ref || !mediaType) return null
		return {
			mediaType,
			resourceKey,
			imageActions,
			thumbnailUrl: snapshot.thumbnailUrl,
			previewUrl: snapshot.previewUrl ?? snapshot.thumbnailUrl,
			audioUrl: mediaType === "audio" ? (snapshot.audioUrl ?? snapshot.previewUrl) : null,
			posterUrl: snapshot.posterUrl,
			previewSize: snapshot.previewSize,
			expiresAt,
			refreshAt:
				expiresAt === undefined
					? undefined
					: expiresAt - SHARED_MEDIA_URL_EXPIRY_SAFETY_WINDOW_MS,
			isLoading: snapshot.status === "loading",
			hasError: ["error", "forbidden", "deleted"].includes(snapshot.status),
			loadPreview,
			refreshSource,
		}
	}, [ref, mediaType, resourceKey, snapshot, expiresAt, loadPreview, refreshSource, imageActions])
}
