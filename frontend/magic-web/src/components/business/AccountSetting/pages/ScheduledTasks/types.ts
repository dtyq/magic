import { ScheduledTask } from "@/types/scheduledTask"

export interface FormValues extends ScheduledTask.UpdateTask {
	project_enabled: boolean
	topic_enabled: boolean
	deadline_enabled: boolean
}

export const enum TaskStatus {
	InProgress = "in-progress",
	Completed = "completed",
	Disabled = "disabled",
}

export const enum Weekday {
	Monday = "0",
	Tuesday = "1",
	Wednesday = "2",
	Thursday = "3",
	Friday = "4",
	Saturday = "5",
	Sunday = "6",
}

export type ScheduleConfig = ScheduledTask.TimeConfig

export interface ScheduleOption {
	label: string
	value: ScheduledTask.ScheduleType
}

export interface WeekdayOption {
	label: string
	value: Weekday
}

export interface DayOption {
	label: string
	value: string
}

export interface ScheduledItemProps {
	value?: ScheduleConfig
	onChange?: (config: ScheduleConfig) => void
	disabled?: boolean
}

export interface ScheduleFormValues {
	scheduleType: ScheduledTask.ScheduleType
	time?: string
	day?: string
}

export interface ScheduledTasksPanelProps {
	onClose?: () => void
}

export interface StatusOption {
	value: TaskStatus
	label: string
}

export interface DropdownMenuItem {
	key: string
	label: string
	danger?: boolean
	onClick?: () => void
}

export interface DropdownDivider {
	type: "divider"
}

export type DropdownItem = DropdownMenuItem | DropdownDivider
