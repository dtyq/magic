import { useEffect, useMemo, useRef, useState } from "react"
import { useDeepCompareEffect, useMemoizedFn, useUnmount } from "ahooks"
import { SuperMagicApi } from "@/opensource/apis"
import mentionPanelStore from "@/opensource/components/business/MentionPanel/store"
import type { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks"
import type { AttachmentsResponse } from "@/opensource/pages/superMagic/hooks/useAttachmentsPolling"
import type { ProjectListItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { getSuperIdState } from "@/opensource/pages/superMagic/utils/query"
import projectFilesStore from "@/opensource/stores/projectFiles"

interface UseAttachmentsProps {
	interval?: number
	projectId?: string
	selectedProject: ProjectListItem | null
	mode: "create" | "edit"
}

export function useAttachments({
	interval = 5000,
	projectId,
	selectedProject,
	mode,
}: UseAttachmentsProps) {
	const [attachments, setAttachments] = useState<AttachmentItem[]>([])
	const timerRef = useRef<NodeJS.Timeout | null>(null)
	const isMountedRef = useRef(true)

	const updateAttachments = useMemoizedFn(async (id: string) => {
		try {
			const attachmentResponse: AttachmentsResponse =
				await SuperMagicApi.getAttachmentsByProjectId({
					projectId: id,
					// @ts-ignore
					temporaryToken: window.temporary_token || "",
				})

			setAttachments(attachmentResponse?.tree || [])

			if (
				!projectFilesStore.currentSelectedProject ||
				projectFilesStore.currentSelectedProject.id !== id
			) {
				projectFilesStore.setSelectedProject({ id } as ProjectListItem)
			}

			projectFilesStore.setWorkspaceFileTree(attachmentResponse?.tree || [])
			mentionPanelStore.finishLoadAttachmentsPromise(id)
		} catch (error) {
			console.error("Failed to get attachments:", error)
		}
	})

	const getAttachments = useMemoizedFn(async () => {
		if (!projectId || projectId === "0") return
		if (!isMountedRef.current) return
		updateAttachments(projectId)
	})

	const startPolling = useMemoizedFn(() => {
		if (timerRef.current) clearInterval(timerRef.current)
		if (!projectId || projectId === "0") return
		timerRef.current = setInterval(getAttachments, interval)
	})

	const stopPolling = useMemoizedFn(() => {
		if (!timerRef.current) return
		clearInterval(timerRef.current)
		timerRef.current = null
	})

	useEffect(() => {
		getAttachments()
		startPolling()

		return () => {
			stopPolling()
		}
	}, [projectId])

	useUnmount(() => {
		stopPolling()
	})

	const superIdState = getSuperIdState()
	const isAllowSetEmpty = useMemo(() => {
		const inProject = superIdState.projectId && superIdState.topicId
		if (mode === "create") return inProject ? false : true
		return false
	}, [mode, superIdState.projectId, superIdState.topicId])

	useDeepCompareEffect(() => {
		if (!selectedProject && !isAllowSetEmpty) return
		projectFilesStore.setSelectedProject(selectedProject)
	}, [selectedProject, isAllowSetEmpty])

	return {
		attachments,
		updateAttachments,
	}
}
