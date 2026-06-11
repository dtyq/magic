import { useCallback, useEffect, useState } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	hasKnowledgeBaseTabTarget,
	type SuperMagicOpenKnowledgeBaseTabPayload,
} from "@/pages/superMagic/events/openFileTab"
import type { KnowledgeBaseTabData } from "@/pages/superMagic/components/Detail/components/FilesViewer/hooks/useKnowledgeBaseTab"

function normalizeFileExtension(extension?: string) {
	const normalized = extension?.trim().replace(/^\./, "").toLowerCase()
	return normalized || ""
}

function inferExtensionFromPath(path?: string) {
	const normalizedPath = path?.trim().split(/[?#]/)[0] || ""
	const fileName = normalizedPath.split("/").pop() || ""
	const extensionStartIndex = fileName.lastIndexOf(".")

	if (extensionStartIndex <= 0 || extensionStartIndex === fileName.length - 1) {
		return ""
	}

	return normalizeFileExtension(fileName.slice(extensionStartIndex + 1))
}

function normalizeKnowledgeBasePreviewData(
	payload: Partial<SuperMagicOpenKnowledgeBaseTabPayload>,
): KnowledgeBaseTabData | null {
	const knowledgeBaseId = payload.knowledgeBaseId?.trim()
	if (!knowledgeBaseId) return null

	if (
		!hasKnowledgeBaseTabTarget({
			knowledgeBaseId,
			documentCode: payload.documentCode,
			fileKey: payload.fileKey,
		})
	) {
		return null
	}

	const title = payload.title?.trim() || payload.fileKey?.split("/").pop() || ""
	if (!title) return null

	const fileExtension =
		normalizeFileExtension(payload.fileExtension) || inferExtensionFromPath(payload.fileKey)

	return {
		knowledgeBaseId,
		documentCode: payload.documentCode,
		fileKey: payload.fileKey,
		title,
		knowledgeBaseName: payload.knowledgeBaseName,
		fileExtension,
	}
}

export function useMobileKnowledgeBasePreview() {
	const [visible, setVisible] = useState(false)
	const [previewData, setPreviewData] = useState<KnowledgeBaseTabData | null>(null)

	const close = useCallback(() => {
		setVisible(false)
	}, [])

	useEffect(() => {
		const handleOpenKnowledgeBasePreview = (data: unknown) => {
			const nextData = normalizeKnowledgeBasePreviewData(
				data as Partial<SuperMagicOpenKnowledgeBaseTabPayload>,
			)
			if (!nextData) return

			setPreviewData(nextData)
			setVisible(true)
		}

		pubsub.subscribe(PubSubEvents.Open_Knowledge_Base_Tab, handleOpenKnowledgeBasePreview)

		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Open_Knowledge_Base_Tab,
				handleOpenKnowledgeBasePreview,
			)
		}
	}, [])

	return {
		visible,
		previewData,
		close,
	}
}

export type UseMobileKnowledgeBasePreviewReturn = ReturnType<typeof useMobileKnowledgeBasePreview>
