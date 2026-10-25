import { ScheduledTask } from "@/types/scheduledTask"
import type { ReactNode } from "react"

export interface ScheduledTasksModifyProps {
	mode: "create" | "edit"
	initialValues?: Partial<ScheduledTask.UpdateTask>
	onSubmit?: (values: ScheduledTask.UpdateTask) => void | Promise<void>
	onClose?: () => void
}

export interface ScheduledTasksModifyRef {
	updateAttachments: (id: string) => Promise<void>
}

export interface ScheduledTasksModifyModalController {
	state: {
		visible: boolean
		mode: "create" | "edit"
		editingTask?: ScheduledTask.UpdateTask
		createTask?: Partial<ScheduledTask.UpdateTask>
		onSubmit?: (task: ScheduledTask.UpdateTask, callback: () => void) => void | Promise<void>
	}
	openCreateModal: (
		onSubmit: (task: ScheduledTask.UpdateTask, callback?: () => void) => void | Promise<void>,
		initialValues?: Partial<ScheduledTask.UpdateTask>,
	) => void
	openEditModal: (
		task: ScheduledTask.UpdateTask,
		onSubmit: (task: ScheduledTask.UpdateTask, callback?: () => void) => void | Promise<void>,
	) => void
	closeModal: () => Promise<void>
	content: ReactNode
}
