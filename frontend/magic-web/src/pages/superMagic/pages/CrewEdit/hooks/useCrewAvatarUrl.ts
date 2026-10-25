import { useEffect, useState } from "react"
import { resolveCrewIconUrl, type CrewIconObject } from "@/apis/modules/crew"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { findWorkspaceAvatarFile } from "../utils/publish-avatar"
import { getFileContentById } from "@/pages/superMagic/utils/api"

/**
 * Hook to resolve display URL for crew avatar:
 * 1. If it has a remote HTTP/HTTPS URL, uses that.
 * 2. If it is a workspace-relative file (e.g. .magic/logo.png), finds the matching workspace file and fetches a blob URL.
 */
export function useCrewAvatarUrl(
	icon: CrewIconObject | null | undefined,
	workspaceFiles?: AttachmentItem[],
): string {
	const remoteUrl = resolveCrewIconUrl(icon)
	const [blobUrl, setBlobUrl] = useState<string>("")

	const iconValue = icon?.value?.trim() ?? ""
	const isLocalPath =
		!remoteUrl &&
		(iconValue.startsWith(".magic/") ||
			iconValue.includes("logo.") ||
			iconValue.startsWith("avatars/"))

	useEffect(() => {
		if (remoteUrl) {
			setBlobUrl("")
			return
		}

		if (!isLocalPath && !iconValue && (!workspaceFiles || workspaceFiles.length === 0)) {
			setBlobUrl("")
			return
		}

		const avatarFile = findWorkspaceAvatarFile(workspaceFiles || [], iconValue)
		if (!avatarFile?.file_id) {
			setBlobUrl("")
			return
		}

		let disposed = false
		void (async () => {
			try {
				const blob = await getFileContentById(avatarFile.file_id, { responseType: "blob" })
				if (disposed) return
				if (blob instanceof Blob) {
					const objectUrl = URL.createObjectURL(blob)
					setBlobUrl(objectUrl)
				}
			} catch {
				if (!disposed) setBlobUrl("")
			}
		})()

		return () => {
			disposed = true
			if (blobUrl) {
				URL.revokeObjectURL(blobUrl)
			}
		}
	}, [remoteUrl, iconValue, isLocalPath, workspaceFiles])

	return remoteUrl || blobUrl
}
