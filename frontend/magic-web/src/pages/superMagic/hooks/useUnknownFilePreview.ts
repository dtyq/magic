import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useLocation } from "react-router"
import { fetchBoundedBlob } from "@/utils/fetch-bounded-blob"
import { useFileAccess } from "../fileAccess/FileAccessProvider"
import { useFileApi } from "../fileAccess/fileApi"
import { shouldWaitForShareAccess } from "../fileAccess/fileAccessContext"
import {
	classifyFileContent,
	getFileContentKey,
	UNKNOWN_TEXT_PREVIEW_MAX_BYTES,
	type FileContentMetadata,
	type UnknownFilePreviewResult,
} from "../utils/fileContentType"
import { getFileType } from "../utils/handleFIle"
import {
	getSharedMediaResourceScope,
	useSharedMediaResourceScope,
} from "../services/sharedMediaResourceScope"
import { useLatestAbortableRequest } from "./useLatestAbortableRequest"
import { fileIconStore } from "../stores/fileIconStore"

type PreviewState = UnknownFilePreviewResult | { status: "idle" | "loading" | "error" }

interface UnknownFilePreview {
	state: PreviewState
	refresh: () => Promise<void>
}

export function useUnknownFilePreview(
	file: FileContentMetadata,
	isActive: boolean,
): UnknownFilePreview {
	const fileAccess = useFileAccess()
	const fileApi = useFileApi()
	const resourceScope = useSharedMediaResourceScope()
	const { pathname } = useLocation()
	const scope = JSON.stringify([resourceScope, pathname])
	const key = getFileContentKey(scope, file)
	const enabled = Boolean(
		isActive &&
		!shouldWaitForShareAccess(fileAccess) &&
		file.file_id &&
		!file.is_directory &&
		file.type !== "directory" &&
		!file.display_config?.type &&
		getFileType(file.file_extension || "") === "notSupport",
	)
	// A published preview can change share identity without changing the host URL.
	const requestKey = JSON.stringify([
		key,
		fileApi.identityKey,
		file.file_name,
		file.file_size,
		enabled,
	])
	const currentRequestKey = useRef(requestKey)
	currentRequestKey.current = requestKey
	const [snapshot, setSnapshot] = useState<{ key: string; state: PreviewState }>()
	const { startRequest, cancelCurrent } = useLatestAbortableRequest()

	const load = useMemoizedFn(async (forceRefresh = false) => {
		if (!enabled || !file.file_id) return
		const request = startRequest()
		const isCurrent = () =>
			request.isCurrent() &&
			currentRequestKey.current === requestKey &&
			resourceScope === getSharedMediaResourceScope()
		const publish = (state: PreviewState) => {
			if (!isCurrent()) return
			setSnapshot({ key: requestKey, state })
			if (state.status === "text" || state.status === "binary") {
				fileIconStore.setContentKind(key, state.status)
			}
		}
		fileIconStore.invalidateContentKind(key)
		publish({ status: "loading" })
		try {
			if (
				typeof file.file_size === "number" &&
				file.file_size > UNKNOWN_TEXT_PREVIEW_MAX_BYTES
			) {
				publish({ status: "too-large" })
				return
			}
			const urls = await fileApi.getTemporaryDownloadUrl({
				file_ids: [file.file_id],
				file_versions: file.file_version
					? { [file.file_id]: file.file_version }
					: undefined,
				cache: forceRefresh ? false : undefined,
				enableErrorMessagePrompt: false,
			})
			// URL 入口暂不接受 signal；取消后不再发起正文 GET，也不写回旧结果。
			if (!isCurrent()) return
			const url = urls.find((item) => String(item.file_id) === file.file_id)?.url
			if (!url) throw new Error("File URL unavailable")
			const result = await fetchBoundedBlob(url, {
				maxBytes: UNKNOWN_TEXT_PREVIEW_MAX_BYTES,
				signal: request.signal,
				cache: forceRefresh ? "no-cache" : undefined,
			})
			if (!isCurrent()) return
			publish(result.status === "too-large" ? result : await classifyFileContent(result.blob))
		} catch {
			publish({ status: "error" })
		} finally {
			request.release()
		}
	})

	useEffect(() => {
		void load()
		return cancelCurrent
	}, [requestKey, load, cancelCurrent])

	const refresh = useMemoizedFn(() => load(true))
	const state: PreviewState =
		snapshot?.key === requestKey ? snapshot.state : { status: enabled ? "loading" : "idle" }
	return { state, refresh }
}
