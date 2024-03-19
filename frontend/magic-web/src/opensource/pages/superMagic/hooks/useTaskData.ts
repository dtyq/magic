import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { reaction } from "mobx"
import { useEffect, useState } from "react"
import { TaskData, Topic } from "@/opensource/pages/superMagic/pages/Workspace/types"

interface UseTaskDataParams {
	selectedTopic?: Topic | null
}

export function useTaskData({ selectedTopic }: UseTaskDataParams) {
	const [taskData, setTaskData] = useState<TaskData | null>(null)
	// 当消息列表变化时，查找最后一条有task且task.process长度不为0的消息
	useEffect(() => {
		return reaction(
			() => superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || [],
			(topicMessage) => {
				if (topicMessage && topicMessage.length > 0) {
					// 从后往前遍历找到第一个符合条件的消息
					let foundTaskData = false
					for (let i = topicMessage.length - 1; i >= 0; i -= 1) {
						const node = superMagicStore.getMessageNode(topicMessage[i]?.app_message_id)
						if (node?.steps && node?.steps?.length > 0) {
							// 设置为当前任务数据
							setTaskData({
								process: node.steps,
								topic_id: node.topic_id,
							})
							foundTaskData = true
							break
						}
					}
					// 如果没有找到符合条件的消息，清空TaskData
					if (!foundTaskData) {
						setTaskData(null)
					}
				} else {
					// 如果消息列表为空，也清空TaskData
					setTaskData(null)
				}
			},
		)
	}, [selectedTopic?.chat_topic_id])

	return {
		taskData,
	}
}
