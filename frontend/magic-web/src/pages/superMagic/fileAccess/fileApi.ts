import { useMemo } from "react"
import { useFileAccess } from "./FileAccessProvider"
import { getFileAccessIdentityKey, type FileAccessContext } from "./fileAccessContext"
import {
	getFileContentById,
	getFileContentsByIds,
	getTemporaryDownloadUrl,
} from "@/pages/superMagic/utils/api"
import { requestSharedMediaUrls } from "@/pages/superMagic/services/sharedMediaUrlCache"

/**
 * A file request client whose identity is closed over once, at the boundary
 * where we know whether we are in a host session or a share preview. Every leaf
 * call forwards the captured access unless the call site deliberately overrides
 * it. React leaves should obtain one via `useFileApi()`; non-React managers and
 * iframe services receive one injected via `createFileApi(access)`.
 *
 * Never keep a module-level singleton: a host tree and a published micro-app tab
 * coexist in one process and each needs its own bound client.
 */
export interface FileApi {
	/** Stable cache namespace for the bound session/share identity. */
	readonly identityKey: string
	getTemporaryDownloadUrl: typeof getTemporaryDownloadUrl
	getFileContentById: typeof getFileContentById
	getFileContentsByIds: typeof getFileContentsByIds
	requestSharedMediaUrls: typeof requestSharedMediaUrls
}

export function createFileApi(access?: FileAccessContext | null): FileApi {
	const boundAccess = access ?? undefined
	const identityKey = getFileAccessIdentityKey(boundAccess)
	return {
		identityKey,
		getTemporaryDownloadUrl: (params) =>
			getTemporaryDownloadUrl({
				...params,
				access:
					boundAccess?.kind === "recycle-bin"
						? boundAccess
						: (params.access ?? boundAccess),
			}),
		getFileContentById: (fileId, options) =>
			getFileContentById(fileId, {
				...options,
				access:
					boundAccess?.kind === "recycle-bin"
						? boundAccess
						: (options?.access ?? boundAccess),
			}),
		getFileContentsByIds: (fileIds, options) =>
			getFileContentsByIds(fileIds, {
				...options,
				access:
					boundAccess?.kind === "recycle-bin"
						? boundAccess
						: (options?.access ?? boundAccess),
			}),
		requestSharedMediaUrls: (fileIds, options) => {
			const requestAccess =
				boundAccess?.kind === "recycle-bin" ? boundAccess : (options?.access ?? boundAccess)
			if (requestAccess?.kind === "recycle-bin") {
				if (options?.fileVersions)
					return Promise.reject(
						new Error("Recycle bin preview does not allow file versions"),
					)
				return getTemporaryDownloadUrl({
					file_ids: fileIds,
					download_mode: options?.downloadMode,
					is_download: options?.isDownload,
					access: requestAccess,
				})
			}
			return requestSharedMediaUrls(fileIds, {
				...options,
				identityKey: options?.identityKey ?? getFileAccessIdentityKey(requestAccess),
				access: requestAccess,
			})
		},
	}
}

/**
 * React boundary binding: derive a FileApi from the ambient FileAccessProvider.
 * The memo key is the access identity, not the object reference, so equal-but-new
 * access objects do not reset every consuming leaf.
 */
export function useFileApi(): FileApi {
	const access = useFileAccess()
	const identityKey = getFileAccessIdentityKey(access)
	// createFileApi is a pure factory over `access`; identityKey uniquely captures
	// its semantic value, so `access` itself is intentionally absent from deps.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	return useMemo(() => createFileApi(access), [identityKey])
}
