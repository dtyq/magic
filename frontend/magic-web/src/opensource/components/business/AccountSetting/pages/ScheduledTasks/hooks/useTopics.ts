import { useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/opensource/apis"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import type { Topic } from "@/opensource/pages/superMagic/pages/Workspace/types"

export function useTopics(workspaceId?: string, projectId?: string) {
	const { t } = useTranslation("super")
	const [topics, setTopics] = useState<Topic[]>([])

	const fetchTopics = useMemoizedFn(async () => {
		if (!workspaceId || !projectId) return

		try {
			const response = await SuperMagicApi.getTopicsByProjectId({
				id: projectId,
				page: 1,
				page_size: 999,
			})
			if (response?.list) setTopics(response.list)
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
		return topics.map((topic) => ({
			...topic,
			label: topic.topic_name || t("topic.unnamedTopic"),
			value: topic.id,
		}))
	}, [topics, t])

	useEffect(() => {
		if (workspaceId && projectId) fetchTopics()
	}, [fetchTopics, projectId, workspaceId])

	return {
		topics,
		topicOptions,
		fetchTopics,
		handleAddTopic,
	}
}
