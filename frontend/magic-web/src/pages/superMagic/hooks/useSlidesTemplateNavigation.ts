import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useMemoizedFn } from "ahooks"
import { useEffect, useRef } from "react"
import { useLocation } from "react-router"
import { DetailType } from "../components/Detail/types"
import type { AttachmentItem } from "../components/TopicFilesButton/hooks"
import {
	isSlidesTemplateFolder,
	toSlidesTemplatePreviewItem,
} from "../components/TopicFilesButton/utils/slides-template-folder"

interface SlidesTemplateNavigationOptions {
	selectedProjectId?: string
	attachments: AttachmentItem[]
	openTemplateFile: (templateItem: AttachmentItem) => void
	setUserSelectDetail: (detail: unknown) => void
	openDelay?: number
}

function findAttachmentById(items: AttachmentItem[], targetId: string): AttachmentItem | null {
	for (const item of items) {
		const itemId = item.file_id ?? (item as AttachmentItem & { id?: string }).id
		if (String(itemId ?? "") === targetId) return item

		const matchedChild = findAttachmentById(item.children ?? [], targetId)
		if (matchedChild) return matchedChild
	}

	return null
}

function findTemplateAttachment(item: AttachmentItem): AttachmentItem | null {
	if (item.display_config?.type === "slide-template") return item
	if (isSlidesTemplateFolder(item)) return toSlidesTemplatePreviewItem(item)

	for (const child of item.children ?? []) {
		const templateItem = findTemplateAttachment(child)
		if (templateItem) return templateItem
	}

	return null
}

function getNavigationTarget(state: unknown) {
	if (!state || typeof state !== "object") return null

	const navigationState = state as {
		slidesTemplateProjectId?: unknown
		slidesTemplateDirectoryId?: unknown
	}
	const sourceProjectId =
		typeof navigationState.slidesTemplateProjectId === "string"
			? navigationState.slidesTemplateProjectId
			: null
	const directoryId =
		typeof navigationState.slidesTemplateDirectoryId === "string"
			? navigationState.slidesTemplateDirectoryId
			: null

	return sourceProjectId && directoryId ? { sourceProjectId, directoryId } : null
}

export function useSlidesTemplateNavigation({
	selectedProjectId,
	attachments,
	openTemplateFile,
	setUserSelectDetail,
	openDelay = 100,
}: SlidesTemplateNavigationOptions) {
	const location = useLocation()
	const handledDirectoryRef = useRef<string | null>(null)
	const handleOpenTemplateFile = useMemoizedFn(openTemplateFile)

	useEffect(() => {
		handledDirectoryRef.current = null
	}, [selectedProjectId])

	useEffect(() => {
		const target = getNavigationTarget(location.state)
		if (!target) {
			handledDirectoryRef.current = null
			return
		}
		if (selectedProjectId !== target.sourceProjectId) return

		const directoryItem = findAttachmentById(attachments, target.directoryId)
		const templateItem = directoryItem ? findTemplateAttachment(directoryItem) : null
		if (handledDirectoryRef.current === target.directoryId || !directoryItem || !templateItem) {
			return
		}

		handledDirectoryRef.current = target.directoryId
		const timer = window.setTimeout(() => {
			pubsub.publish(PubSubEvents.Locate_File_In_Tree, target.directoryId)
			handleOpenTemplateFile(templateItem)
			setUserSelectDetail({
				type: DetailType.SlidesTemplate,
				data: {
					...templateItem,
					file_id: templateItem.file_id,
					file_name:
						templateItem.file_name ||
						templateItem.name ||
						templateItem.display_filename,
				},
				currentFileId: templateItem.file_id,
				attachments,
			})
		}, openDelay)

		return () => window.clearTimeout(timer)
	}, [
		attachments,
		handleOpenTemplateFile,
		location.state,
		openDelay,
		selectedProjectId,
		setUserSelectDetail,
	])
}
