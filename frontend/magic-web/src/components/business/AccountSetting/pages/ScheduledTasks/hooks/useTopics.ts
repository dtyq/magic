import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { analyticsService } from "@/services/analytics"

/** Loads topics for the selected project while isolating responses by project context. */
export function useTopics(workspaceId?: string, projectId?: string) {
	const { t } = useTranslation("super")
	const [topics, setTopics] = useState<Topic[]>([])
	const [loadedContextKey, setLoadedContextKey] = useState("")
	const contextKey = `${workspaceId ?? ""}:${projectId ?? ""}`
	const contextKeyRef = useRef(contextKey)

	const fetchTopics = useMemoizedFn(async () => {
		if (!workspaceId || !projectId) return
		const requestContextKey = contextKey

		try {
			const response = await SuperMagicApi.getTopicsByProjectId({
				id: projectId,
				page: 1,
				page_size: 999,
			})
			if (contextKeyRef.current !== requestContextKey) return
			setTopics(response?.list ?? [])
			setLoadedContextKey(requestContextKey)
		} catch (error) {
			console.error("获取工作区列表失败:", error)
		}
	})

	const handleAddTopic = useMemoizedFn(async (topicName: string) => {
		try {
			if (!workspaceId || !projectId) {
				magicToast.error(t("topic.pleaseSelectWorkspaceAndProject"))
				return
			}

			analyticsService.report("topic_create_attempted", { projectId, workspaceId })
			const response = await SuperMagicApi.createTopic({
				topic_name: topicName,
				project_id: projectId,
			})

			if (response?.id) {
				fetchTopics()
				return response
			}
		} catch (error) {
			console.error("创建话题失败:", error)
		}
	})

	const topicOptions = useMemo(() => {
		if (loadedContextKey !== contextKey) return []

		return topics.map((topic) => ({
			...topic,
			label: topic.topic_name || t("topic.unnamedTopic"),
			value: topic.id,
		}))
	}, [contextKey, loadedContextKey, topics, t])

	useEffect(() => {
		// Reset options before loading a new project to prevent cross-project defaults.
		contextKeyRef.current = contextKey
		setTopics([])
		setLoadedContextKey("")
		if (workspaceId && projectId) fetchTopics()
	}, [contextKey, fetchTopics, projectId, workspaceId])

	return {
		topics,
		topicOptions,
		fetchTopics,
		handleAddTopic,
	}
}
