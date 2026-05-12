import { useEffect, useMemo, useState } from "react"
import { fileIconStore } from "@/pages/superMagic/stores/fileIconStore"
import {
	getCustomIcon,
	resolveCustomIconPathToDirectSrc,
	resolveFileByRelativePath,
} from "../../MessageList/components/MessageAttachment/utils"

interface UseCustomFolderIconUrlParams {
	displayConfig?: any
	children?: unknown[]
}

/**
 * 解析 custom display_config 的 icon：支持 http(s)、data URL 直接使用；否则按相对路径解析为 file_id 再取临时下载 URL。
 */
export function useCustomFolderIconUrl({
	displayConfig,
	children,
}: UseCustomFolderIconUrlParams): string | undefined {
	const iconPath = useMemo(() => getCustomIcon(displayConfig), [displayConfig])

	const directSrc = useMemo(
		() => (iconPath ? resolveCustomIconPathToDirectSrc(iconPath) : undefined),
		[iconPath],
	)

	const iconFileId = useMemo(() => {
		if (!iconPath || directSrc !== undefined) return null
		const node = resolveFileByRelativePath(children, iconPath) as { file_id?: string } | null
		return node?.file_id ?? null
	}, [iconPath, children, directSrc])

	const [fetchedUrl, setFetchedUrl] = useState<string | undefined>()

	useEffect(() => {
		if (directSrc) {
			setFetchedUrl(undefined)
			return
		}
		if (!iconFileId) {
			setFetchedUrl(undefined)
			return
		}
		let cancelled = false
		fileIconStore
			.getFileIconUrl(iconFileId)
			.then((u) => {
				if (!cancelled) setFetchedUrl(u)
			})
			.catch(() => {
				if (!cancelled) setFetchedUrl(undefined)
			})
		return () => {
			cancelled = true
		}
	}, [directSrc, iconFileId])

	return directSrc ?? fetchedUrl
}
