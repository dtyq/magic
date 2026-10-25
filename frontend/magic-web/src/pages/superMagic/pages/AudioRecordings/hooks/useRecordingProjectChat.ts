import { useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import type { MessageHeaderTopicActions } from "@/pages/superMagic/components/MessageHeader"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { normalizeTopicHistoryItem } from "@/pages/superMagic/utils/topicHistory"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { ProjectFilesStore } from "@/stores/projectFiles"
import { analyticsService } from "@/services/analytics"

interface UseRecordingProjectChatInput {
	projectId: string
	attachmentsLoading: boolean
	attachmentTree: AttachmentItem[]
	attachmentList: AttachmentItem[]
}

/** Owns the isolated project-chat resources used by the desktop recording detail page. */
export function useRecordingProjectChat({
	projectId,
	attachmentsLoading,
	attachmentTree,
	attachmentList,
}: UseRecordingProjectChatInput) {
	const [topicsLoading, setTopicsLoading] = useState(false)
	const [project, setProject] = useState<ProjectListItem | null>(null)
	const [workspace, setWorkspace] = useState<Workspace | null>(null)
	const [attachmentsReady, setAttachmentsReady] = useState(false)
	const [topicStore] = useState(() => new TopicStore())
	const [projectFilesStore] = useState(() => new ProjectFilesStore())
	const [mentionPanelStore] = useState(() => createMentionPanelStore(projectFilesStore))

	useProjectAttachmentsChangeRealtime({
		projectId,
		// Apply realtime changes only after the initial detail snapshot has populated the scoped store.
		enabled: Boolean(projectId && attachmentsReady),
		store: projectFilesStore,
	})

	/** Resolves list items that do not yet contain the chat identifiers required by message APIs. */
	const resolveTopic = useMemoizedFn(async (topic: Topic | null): Promise<Topic | null> => {
		if (!topic?.id) return null
		if (topic.chat_topic_id && topic.chat_conversation_id) return topic

		const detail = await SuperMagicApi.getTopicDetail({ id: topic.id })
		return detail ? normalizeTopicHistoryItem(detail as Topic) : topic
	})

	useEffect(() => {
		if (!projectId) return

		let disposed = false
		topicStore.reset()
		projectFilesStore.setSelectedProject(null)
		setProject(null)
		setWorkspace(null)
		setAttachmentsReady(false)
		setTopicsLoading(true)
		// Initialize the editor preload contract before the chat surface can mount and restore drafts.
		mentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
		mentionPanelStore.initLoadAttachments(projectId)

		/** Loads the scoped project and resolves the initial desktop conversation. */
		async function loadChatResources() {
			try {
				const [projectResponse, topicsResponse] = await Promise.all([
					SuperMagicApi.getProjectDetail({ id: projectId }),
					SuperMagicApi.getTopicsByProjectId({ id: projectId, page: 1, page_size: 999 }),
				])
				if (disposed) return

				const nextProject = projectResponse as ProjectListItem
				// Start workspace fetch immediately so message hydration is not blocked on it.
				const workspacePromise = nextProject.workspace_id
					? SuperMagicApi.getWorkspaceDetail({ id: nextProject.workspace_id })
					: Promise.resolve(null)

				let nextTopics = (topicsResponse.list ?? []).map(
					normalizeTopicHistoryItem,
				) as Topic[]

				if (nextTopics.length === 0) {
					analyticsService.report("topic_create_attempted", {
						projectId,
						workspaceId: nextProject.workspace_id,
						sceneOverride: "ai_recording",
					})
					const createdTopic = await SuperMagicApi.createTopic({
						project_id: projectId,
						topic_name: "",
						project_mode: nextProject.project_mode || undefined,
					})
					const resolvedCreatedTopic = await resolveTopic(createdTopic as Topic)
					if (resolvedCreatedTopic) {
						nextTopics = [resolvedCreatedTopic]
					}
				}
				if (disposed) return

				topicStore.setTopics(nextTopics)
				const initialTopic =
					nextTopics.find((topic) => topic.id === nextProject.current_topic_id) ??
					nextTopics[0]
				const resolvedInitialTopic = await resolveTopic(initialTopic ?? null)
				if (disposed) return

				if (resolvedInitialTopic) topicStore.updateTopic(resolvedInitialTopic)
				topicStore.setSelectedTopic(resolvedInitialTopic)
				// Publish project/topic first so chat can mount and hydrate messages without waiting for workspace.
				setProject(nextProject)
				if (!disposed) setTopicsLoading(false)

				const workspaceResponse = await workspacePromise
				if (!disposed) setWorkspace((workspaceResponse as Workspace) ?? null)
			} catch {
				if (disposed) return
				topicStore.reset()
				setProject(null)
				setWorkspace(null)
				setTopicsLoading(false)
			}
		}

		void loadChatResources()

		return () => {
			disposed = true
			// Release any draft restoration still waiting on a project that is no longer active.
			mentionPanelStore.finishLoadAttachmentsPromise(projectId)
			mentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
		}
	}, [mentionPanelStore, projectFilesStore, projectId, resolveTopic, topicStore])

	useEffect(() => {
		if (!projectId || attachmentsLoading || project?.id !== projectId) return

		// Reuse the recording-detail snapshot without copying or deeply observing the attachment graph.
		projectFilesStore.setSelectedProject(project)
		projectFilesStore.setWorkspaceFileTree(attachmentTree, {
			list: attachmentList,
			source: "recording-detail",
		})
		mentionPanelStore.finishLoadAttachmentsPromise(projectId)
		setAttachmentsReady(true)
	}, [
		attachmentList,
		attachmentTree,
		attachmentsLoading,
		mentionPanelStore,
		project,
		projectFilesStore,
		projectId,
	])

	/** Selects a topic only after resolving the identifiers required by message loading and sending. */
	const selectTopic = useMemoizedFn(async (topic: Topic) => {
		const resolvedTopic = await resolveTopic(topic)
		if (!resolvedTopic) return
		topicStore.updateTopic(resolvedTopic)
		topicStore.setSelectedTopic(resolvedTopic)
	})

	/** Creates and selects a complete chat topic inside the scoped recording project. */
	const createTopic = useMemoizedFn(async () => {
		if (!project?.id) return

		analyticsService.report("topic_create_attempted", {
			projectId: project.id,
			workspaceId: project.workspace_id,
			sceneOverride: "ai_recording",
		})
		const response = await SuperMagicApi.createTopic({
			project_id: project.id,
			topic_name: "",
			project_mode: project.project_mode || undefined,
		})
		const createdTopic = await resolveTopic(response as Topic)
		if (!createdTopic) return
		topicStore.setTopics([
			createdTopic,
			...topicStore.topics.filter((topic) => topic.id !== createdTopic.id),
		])
		topicStore.setSelectedTopic(createdTopic)
	})

	/** Persists an explicit topic rename and mirrors the result into the scoped store. */
	const renameTopic = useMemoizedFn(
		async ({ topicId, topicName }: { topicId: string; topicName: string }) => {
			if (!project?.id) return

			const trimmedName = topicName.trim()
			await SuperMagicApi.editTopic({
				id: topicId,
				project_id: project.id,
				topic_name: trimmedName,
			})
			topicStore.updateTopicName(topicId, trimmedName)
		},
	)

	/** Updates only the scoped name after another API, such as smart rename, already persisted it. */
	const updateTopicName = useMemoizedFn((topicId: string, topicName: string) => {
		topicStore.updateTopicName(topicId, topicName.trim())
	})

	/** Applies the requested pin state returned by the project topic API. */
	const setTopicPin = useMemoizedFn(async (topicId: string, pinned: boolean) => {
		const response = pinned
			? await SuperMagicApi.pinTopic(topicId)
			: await SuperMagicApi.unpinTopic(topicId)
		if (response?.topic) {
			topicStore.mergeTopic(topicId, normalizeTopicHistoryItem(response.topic))
		}
	})

	/** Applies the requested archive state returned by the project topic API. */
	const setTopicArchive = useMemoizedFn(async (topicId: string, archived: boolean) => {
		const response = archived
			? await SuperMagicApi.archiveTopic(topicId)
			: await SuperMagicApi.unarchiveTopic(topicId)
		if (response?.topic) {
			topicStore.mergeTopic(topicId, normalizeTopicHistoryItem(response.topic))
		}
	})

	/** Deletes a topic while preserving the project-detail last-topic and fallback behavior. */
	const deleteTopic = useMemoizedFn(async (topicId: string) => {
		if (topicStore.topics.length <= 1) return

		await SuperMagicApi.deleteTopic({ id: topicId })
		topicStore.removeTopic(topicId)
		if (!topicStore.selectedTopic) {
			const fallbackTopic = await resolveTopic(topicStore.topics[0] ?? null)
			topicStore.setSelectedTopic(fallbackTopic)
		}
	})

	const topicActions = useMemo<MessageHeaderTopicActions>(
		() => ({
			createTopic,
			selectTopic,
			renameTopic,
			deleteTopic,
			updateTopicName,
			pinTopic: (topicId) => setTopicPin(topicId, true),
			unpinTopic: (topicId) => setTopicPin(topicId, false),
			archiveTopic: (topicId) => setTopicArchive(topicId, true),
			unarchiveTopic: (topicId) => setTopicArchive(topicId, false),
		}),
		[
			createTopic,
			deleteTopic,
			renameTopic,
			selectTopic,
			setTopicArchive,
			setTopicPin,
			updateTopicName,
		],
	)

	return {
		topicsLoading,
		project,
		workspace,
		selectedTopic: topicStore.selectedTopic,
		topicStore,
		topicActions,
		projectFilesStore,
		mentionPanelStore,
	}
}
