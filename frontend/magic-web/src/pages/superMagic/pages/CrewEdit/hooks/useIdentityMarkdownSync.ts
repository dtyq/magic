import { useEffect, useMemo } from "react"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { CrewIdentityStore } from "../store/identity-store"
import {
	findIdentityMarkdownFile,
	getIdentityMarkdownFileSignature,
	parseIdentityMarkdown,
} from "../utils/identity-markdown"

interface UseIdentityMarkdownSyncParams {
	projectId?: string
	files: AttachmentItem[]
	identity: CrewIdentityStore
	isInitialAttachmentsLoaded: boolean
}

export function useIdentityMarkdownSync({
	projectId,
	files,
	identity,
	isInitialAttachmentsLoaded,
}: UseIdentityMarkdownSyncParams): void {
	const identityFile = useMemo(() => findIdentityMarkdownFile(files), [files])
	const identityFileSignature = useMemo(
		() => getIdentityMarkdownFileSignature(identityFile),
		[identityFile],
	)

	useEffect(() => {
		if (!projectId) {
			identity.clearIdentityMarkdownSnapshot()
			identity.clearIdentityMarkdownError()
			return
		}

		if (!isInitialAttachmentsLoaded) {
			identity.clearIdentityMarkdownSnapshot()
			identity.clearIdentityMarkdownError()
			return
		}

		if (!identityFile?.file_id) {
			identity.clearIdentityMarkdownSnapshot()
			identity.clearIdentityMarkdownError()
			return
		}

		let disposed = false
		const identityFileId = identityFile.file_id

		identity.setIdentityMarkdownFileId(identityFileId)

		void (async () => {
			try {
				const content = await getFileContentById(identityFileId)
				if (disposed || typeof content !== "string") return

				identity.setIdentityMarkdownRawContent(content)
				identity.applyIdentityMarkdown(parseIdentityMarkdown(content))
				identity.clearIdentityMarkdownError()
			} catch {
				if (disposed) return

				identity.clearIdentityMarkdownSnapshot()
				identity.setIdentityMarkdownLoadError()
			}
		})()

		return () => {
			disposed = true
		}
	}, [identity, identityFile, identityFileSignature, isInitialAttachmentsLoaded, projectId])
}
