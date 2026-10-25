import ScheduledTaskDialog from "@/components/business/AccountSetting/pages/ScheduledTasks/components/ScheduledTaskDialog"
import { lazy, Suspense, useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { Spinner } from "@/components/shadcn-ui/spinner"
import mcpTempStorage from "@/components/business/AccountSetting/pages/ScheduledTasks/store/MCPTempStorage"
import type { FormValues } from "@/components/business/AccountSetting/pages/ScheduledTasks/types"
import type { ScheduledTasksModifyModalController } from "@/components/business/AccountSetting/pages/ScheduledTasks/types/ScheduledTasksModify"
import type { ScheduledTask } from "@/types/scheduledTask"
import type { MicroAppScheduledTaskContext } from "./types"

const MicroAppScheduledTasksModify = lazy(async () => {
	const module = await import("./MicroAppScheduledTasksModify")
	return { default: module.MicroAppScheduledTasksModify }
})

interface ModalState {
	visible: boolean
	mode: "create" | "edit"
	editingTask?: ScheduledTask.UpdateTask
	createTask?: Partial<ScheduledTask.UpdateTask>
	onSubmit?: (task: ScheduledTask.UpdateTask, callback: () => void) => void
}

export function useMicroAppScheduledTasksModifyModal(
	context: MicroAppScheduledTaskContext,
): ScheduledTasksModifyModalController {
	const { t } = useTranslation("interface")
	const [state, setState] = useState<ModalState>({ visible: false, mode: "create" })

	function openCreateModal(
		onSubmit: (task: ScheduledTask.UpdateTask) => void,
		initialValues?: Partial<ScheduledTask.UpdateTask>,
	) {
		setState({ visible: true, mode: "create", createTask: initialValues, onSubmit })
	}

	function openEditModal(
		task: ScheduledTask.UpdateTask,
		onSubmit: (task: ScheduledTask.UpdateTask) => void,
	) {
		if (task.workspace_id !== context.workspaceId || task.project_id !== context.projectId) {
			magicToast.error(t("accountPanel.timedTasks.microAppContextMismatch"))
			return
		}
		setState({ visible: true, mode: "edit", editingTask: task, onSubmit })
	}

	async function closeModal() {
		await mcpTempStorage.saveMCP([])
		setState({
			visible: false,
			mode: "create",
			editingTask: undefined,
			createTask: undefined,
			onSubmit: undefined,
		})
	}

	function handleFormSubmit(values: ScheduledTask.UpdateTask) {
		state.onSubmit?.(values, closeModal)
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
				<MicroAppScheduledTasksModify
					context={context}
					initialValues={getInitialValues()}
					onSubmit={handleFormSubmit}
					onClose={closeModal}
					mode={state.mode}
				/>
			</Suspense>
		</ScheduledTaskDialog>
	)

	return { state, openCreateModal, openEditModal, closeModal, content }
}
