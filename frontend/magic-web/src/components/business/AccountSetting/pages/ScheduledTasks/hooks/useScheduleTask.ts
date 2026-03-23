import { useEffect, useState } from "react"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { ScheduledTaskApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { openModal } from "@/utils/react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ScheduledTask } from "@/types/scheduledTask"
import mcpTempStorage from "../store/MCPTempStorage"
import { useScheduledTasksModifyModal } from "./useScheduledTasksModifyModal"

interface UseScheduleTaskProps {
	options?: Partial<ScheduledTask.GetListParams>
	isScroll?: boolean
	siderTaskRef?: React.RefObject<HTMLDivElement>
}

const preloadDeleteDangerModal = () => import("@/components/business/DeleteDangerModal")
const preloadRunningRecordModal = () => import("../components/RunningRecordModal")

export function useScheduleTask({ options, isScroll = false, siderTaskRef }: UseScheduleTaskProps) {
	const { t } = useTranslation("interface")
	const [tasks, setTasks] = useState<ScheduledTask.Task[]>([])
	const [total, setTotal] = useState(0)
	const [params, setParams] = useState<ScheduledTask.GetListParams>({
		page: 1,
		page_size: 10,
		...options,
	})

	const { state, openCreateModal, openEditModal, content } = useScheduledTasksModifyModal()

	const { run, loading } = useRequest(
		(args: ScheduledTask.GetListParams) => ScheduledTaskApi.getScheduledTaskList(args),
		{
			manual: true,
			onSuccess: (response) => {
				if (!isScroll) {
					setTasks(response.list)
					setTotal(response.total)
					return
				}

				if (params.page === 1) setTasks(response.list)
				else setTasks((prevTasks) => [...prevTasks, ...response.list])
				setTotal(response.total)
			},
			onError: (error) => {
				console.error("getScheduledTaskList error:", error, isScroll, params)
			},
		},
	)

	const updateTaskList = useMemoizedFn(() => {
		const nextParams = {
			...params,
			page: 1,
		}

		setParams(nextParams)
		setTimeout(() => {
			run(nextParams)
		}, 1000)

		if (isScroll && siderTaskRef?.current) siderTaskRef.current.scrollTop = 0
	})

	const onSaveTask = useMemoizedFn(
		(taskData: ScheduledTask.UpdateTask, callback?: () => void) => {
			try {
				if (state.mode === "edit" && state.editingTask) {
					ScheduledTaskApi.updateScheduledTask(
						state.editingTask.id as string,
						taskData,
					).then(() => {
						magicToast.success(t("accountPanel.timedTasks.editSuccess"))
						updateTaskList()
						callback?.()
					})
				} else {
					ScheduledTaskApi.createScheduledTask(taskData).then(() => {
						magicToast.success(t("accountPanel.timedTasks.createSuccess"))
						updateTaskList()
						callback?.()
					})
				}
			} catch (error) {
				console.error("onSaveTask error:", error)
			}
		},
	)

	const onTaskDelete = useMemoizedFn(async (task: ScheduledTask.Task) => {
		const { default: DeleteDangerModal } =
			await import("@/components/business/DeleteDangerModal")

		openModal(DeleteDangerModal, {
			content: task.task_name,
			onSubmit: () => {
				return ScheduledTaskApi.deleteScheduledTask(task.id).then(() => {
					if (isScroll)
						setTasks((prevTasks) => prevTasks.filter((item) => item.id !== task.id))
					else run(params)
					magicToast.success(t("accountPanel.timedTasks.taskDeleted"))
				})
			},
		})
	})

	const onTaskEdit = useMemoizedFn(async (task: ScheduledTask.Task) => {
		const detail = await ScheduledTaskApi.getScheduledTaskDetails(task.id)
		if (!detail) return
		mcpTempStorage.saveMCP(detail.plugins?.servers || [])
		openEditModal(detail, onSaveTask)
	})

	const onTaskRunningRecord = useMemoizedFn(async (task: ScheduledTask.Task) => {
		const { default: RunningRecord } = await import("../components/RunningRecordModal")
		openModal(RunningRecord, {
			taskId: task.id,
		})
	})

	const onStatusChange = useMemoizedFn(async (task: ScheduledTask.Task, checked: boolean) => {
		ScheduledTaskApi.updateScheduledTask(task.id, {
			...task,
			enabled: checked ? 1 : 0,
		}).then(() => {
			run(params)
			magicToast.success(
				checked
					? t("accountPanel.timedTasks.taskEnabled")
					: t("accountPanel.timedTasks.taskDisabled"),
			)
		})
	})

	useMount(() => {
		if (!isScroll) {
			run(params)
			return
		}

		if (params.workspace_id && params.project_id) run(params)
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.SCHEDULED_TASK_UPDATED, updateTaskList)
		return () => {
			pubsub.unsubscribe(PubSubEvents.SCHEDULED_TASK_UPDATED, updateTaskList)
		}
	}, [updateTaskList])

	return {
		tasks,
		total,
		params,
		loading,
		content,
		state,
		run,
		onSaveTask,
		onTaskDelete,
		onTaskEdit,
		onTaskRunningRecord,
		onStatusChange,
		openCreateModal,
		openEditModal,
		setParams,
		setTasks,
		preloadDeleteDangerModal,
		preloadRunningRecordModal,
	}
}
