import { useTranslation } from "react-i18next"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { Flex } from "antd"
import MagicButton from "@/opensource/components/base/MagicButton"
import { useMemoizedFn } from "ahooks"
import type { UserTask } from "@/opensource/types/chat/task"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import ConversationTaskService from "@/opensource/services/chat/conversation/ConversationTaskService"
import chatTopicService from "@/opensource/services/chat/topic"
import { observer } from "mobx-react-lite"
import { useStyles } from "./styles"
import TaskItem from "../TaskItem"

interface TaskListProps {
	openEdit: () => void
	updateTask: (data: UserTask) => void
}

const TaskList = observer(({ openEdit, updateTask }: TaskListProps) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const currentTaskList = conversationStore.conversationTaskList

	const editTask = useMemoizedFn((data: UserTask) => {
		updateTask(data)
		openEdit()
	})

	const deleteTask = useMemoizedFn((id: string) => {
		ConversationTaskService.deleteTask(id)
		magicToast.success(`${t("button.delete")}${t("flow.apiKey.success")}`)
	})

	const menuItems = useMemoizedFn((data: UserTask) => {
		return (
			<>
				<MagicButton
					justify="flex-start"
					size="large"
					type="text"
					block
					onClick={() => editTask(data)}
				>
					{t("chat.timedTask.editTask")}
				</MagicButton>
				<MagicButton
					justify="flex-start"
					size="large"
					type="text"
					block
					onClick={() => chatTopicService.setCurrentConversationTopic(data.topic_id)}
				>
					{t("chat.timedTask.changeTopic")}
				</MagicButton>
				<MagicButton
					justify="flex-start"
					size="large"
					type="text"
					block
					danger
					onClick={() => deleteTask(data.id)}
				>
					{t("chat.timedTask.deleteTask")}
				</MagicButton>
			</>
		)
	})

	return (
		<Flex vertical gap={10} className={styles.taskList}>
			<div className={styles.title}>{t("chat.timedTask.title")}</div>
			<Flex vertical gap={4} className={styles.content}>
				{currentTaskList.map((task) => (
					<TaskItem key={task.id} data={task} menuItems={menuItems} />
				))}
			</Flex>
			<MagicButton type="text" block className={styles.button} onClick={openEdit}>
				{t("chat.timedTask.addTask")}
			</MagicButton>
		</Flex>
	)
})

export default TaskList
