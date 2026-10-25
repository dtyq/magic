import { useEffect, useRef, useState } from "react"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { ScheduledTaskApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { openModal } from "@/utils/react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ScheduledTask } from "@/types/scheduledTask"
import mcpTempStorage from "../store/MCPTempStorage"
import { useScheduledTasksModifyModal } from "./useScheduledTasksModifyModal"
import { prepareScheduledTaskRunNow } from "../utils/runScheduledTaskNow"
import type { ScheduledTasksModifyModalController } from "../types/ScheduledTasksModify"

interface UseScheduleTaskProps {
	options?: Partial<ScheduledTask.GetListParams>
	isScroll?: boolean
	siderTaskRef?: React.RefObject<HTMLDivElement>
}

interface UseScheduleTaskWithModalProps extends UseScheduleTaskProps {
	modifyModal: ScheduledTasksModifyModalController
}

const preloadDeleteDangerModal = () => import("@/components/business/DeleteDangerModal")
const preloadRunningRecordModal = () => import("../components/RunningRecordModal")

export function useScheduleTask({ options, isScroll = false, siderTaskRef }: UseScheduleTaskProps) {
	const modifyModal = useScheduledTasksModifyModal()
	return useScheduleTaskWithModal({ options, isScroll, siderTaskRef, modifyModal })
}

export function useScheduleTaskWithModal({
	options,
	isScroll = false,
	siderTaskRef,
	modifyModal,
}: UseScheduleTaskWithModalProps) {
	const { t } = useTranslation("interface")
	const [tasks, setTasks] = useState<ScheduledTask.Task[]>([])
	const [total, setTotal] = useState(0)
	const [params, setParams] = useState<ScheduledTask.GetListParams>({
		page: 1,
		page_size: 10,
		...options,
	})

	const { state, openCreateModal, openEditModal, content } = modifyModal
	const isSavingRef = useRef(false)

	const { run, loading, data, error } = useRequest(
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
		async (taskData: ScheduledTask.UpdateTask, callback?: () => void) => {
			if (isSavingRef.current) return

			isSavingRef.current = true
			try {
				if (state.mode === "edit" && state.editingTask) {
					await ScheduledTaskApi.updateScheduledTask(
						state.editingTask.id as string,
						taskData,
					)
					magicToast.success(t("accountPanel.timedTasks.editSuccess"))
				} else {
					await ScheduledTaskApi.createScheduledTask(taskData)
					magicToast.success(t("accountPanel.timedTasks.createSuccess"))
				}

				updateTaskList()
				callback?.()
			} catch (error) {
				console.error("onSaveTask error:", error)
			} finally {
				isSavingRef.current = false
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
			setTasks((prevTasks) =>
				prevTasks.map((item) =>
					item.id === task.id ? { ...item, enabled: checked ? 1 : 0 } : item,
				),
			)
			magicToast.success(
				checked
					? t("accountPanel.timedTasks.taskEnabled")
					: t("accountPanel.timedTasks.taskDisabled"),
			)
		})
	})

	const runNow = useMemoizedFn(async (task: ScheduledTask.Task) => {
		const detail = await ScheduledTaskApi.getScheduledTaskDetails(task.id)
		if (!detail) return

		try {
			const payload = await prepareScheduledTaskRunNow(detail)
			if (!payload) {
				magicToast.error(t("accountPanel.timedTasks.promptRequired"))
				return
			}

			pubsub.publish(PubSubEvents.Create_New_Topic, payload)
		} catch (error) {
			console.error("runNow error:", error)
		}
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

	// manual: true starts with loading=false, so callers must not treat "no tasks yet" as empty.
	const hasFetched = data !== undefined || error !== undefined

	return {
		tasks,
		total,
		params,
		loading,
		hasFetched,
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
		runNow,
	}
}
