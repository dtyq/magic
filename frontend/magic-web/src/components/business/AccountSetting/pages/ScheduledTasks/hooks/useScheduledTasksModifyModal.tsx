import ScheduledTaskDialog from "@/components/business/AccountSetting/pages/ScheduledTasks/components/ScheduledTaskDialog"
import { ScheduledTask } from "@/types/scheduledTask"
import { ScheduledTasksModifyRef } from "../types/ScheduledTasksModify"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import mentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { getSuperIdState } from "@/pages/superMagic/utils/query"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import projectFilesStore from "@/stores/projectFiles"
import mcpTempStorage from "../store/MCPTempStorage"
import type { FormValues } from "../types"

const ScheduledTasksModify = lazy(async () => {
	const module = await import("../components/ScheduledTasksModify")
	return { default: module.ScheduledTasksModify }
})

export interface ScheduledTasksModifyModalState {
	visible: boolean
	mode: "create" | "edit"
	editingTask?: ScheduledTask.UpdateTask
	createTask?: Partial<ScheduledTask.UpdateTask>
	onSubmit?: (task: ScheduledTask.UpdateTask, callback: () => void) => void
}

export function useScheduledTasksModifyModal() {
	const { t } = useTranslation("interface")
	const modifyRef = useRef<ScheduledTasksModifyRef>(null)
	const rawProjectRef = useRef<ProjectListItem | null>(null)
	const superIdState = getSuperIdState()
	const [state, setState] = useState<ScheduledTasksModifyModalState>({
		visible: false,
		mode: "create",
	})

	useEffect(() => {
		if (state.visible) rawProjectRef.current = mentionPanelStore.currentSelectedProject
	}, [state.visible])

	function openCreateModal(
		onSubmit: (task: ScheduledTask.UpdateTask, callback?: () => void) => void | Promise<void>,
		initialValues?: Partial<ScheduledTask.UpdateTask>,
	) {
		setState({
			visible: true,
			mode: "create",
			createTask: initialValues,
			onSubmit,
		})
	}

	function openEditModal(
		task: ScheduledTask.UpdateTask,
		onSubmit: (task: ScheduledTask.UpdateTask, callback?: () => void) => void | Promise<void>,
	) {
		setState({
			visible: true,
			mode: "edit",
			editingTask: task,
			onSubmit,
		})
	}

	function restoreProject() {
		mcpTempStorage.saveMCP([])
		if (superIdState.projectId && superIdState.topicId && rawProjectRef.current) {
			projectFilesStore.setSelectedProject(rawProjectRef.current)
			modifyRef.current?.updateAttachments(rawProjectRef.current.id)
		}
	}

	async function closeModal() {
		await restoreProject()
		setState({
			visible: false,
			mode: "create",
			editingTask: undefined,
			onSubmit: undefined,
		})
	}

	function handleFormSubmit(values: ScheduledTask.UpdateTask) {
		return state.onSubmit?.(values, closeModal)
	}

	function getInitialValues(): Partial<FormValues> {
		if (state.mode === "edit" && state.editingTask) return state.editingTask
		if (state.createTask) return state.createTask
		return {}
	}

	const content = (
		<ScheduledTaskDialog
			open={state.visible}
			onClose={closeModal}
			title={
				state.mode === "edit"
					? t("chat.timedTask.editTimedTask")
					: t("chat.timedTask.createTask")
			}
		>
			<Suspense
				fallback={
					<div className="flex h-[300px] items-center justify-center">
						<Spinner size={20} className="animate-spin" />
					</div>
				}
			>
				<ScheduledTasksModify
					ref={modifyRef}
					initialValues={getInitialValues()}
					onSubmit={handleFormSubmit}
					onClose={closeModal}
					mode={state.mode}
				/>
			</Suspense>
		</ScheduledTaskDialog>
	)

	return {
		state,
		openCreateModal,
		openEditModal,
		closeModal,
		content,
	}
}
