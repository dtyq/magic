import { useBoolean, useMemoizedFn } from "ahooks"
import { memo, useState } from "react"
import type { UserTask } from "@/types/chat/task"
import TaskList from "../TaskList"
import CreateTask from "../CreateTask"

const TaskContent = memo(function TaskContent({ conversationId }: { conversationId?: string }) {
	const [edit, { setTrue, setFalse }] = useBoolean(false)
	const [task, setTask] = useState<UserTask | null>(null)

	const updateTask = useMemoizedFn((data: UserTask) => {
		setTask(data)
	})

	const onClose = useMemoizedFn(() => {
		setFalse()
		setTask(null)
	})

	return edit ? (
		<CreateTask conversationId={conversationId} reBack={onClose} currentTask={task} />
	) : (
		<TaskList openEdit={setTrue} updateTask={updateTask} />
	)
})

export default TaskContent
