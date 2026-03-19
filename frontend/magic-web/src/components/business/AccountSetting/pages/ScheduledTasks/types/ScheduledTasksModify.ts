import { ScheduledTask } from "@/types/scheduledTask"

export interface ScheduledTasksModifyProps {
	mode: "create" | "edit"
	initialValues?: Partial<ScheduledTask.UpdateTask>
	onSubmit?: (values: ScheduledTask.UpdateTask) => void
	onClose?: () => void
}

export interface ScheduledTasksModifyRef {
	updateAttachments: (id: string) => Promise<void>
}
