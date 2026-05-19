import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import dayjs from "@/lib/dayjs"
import MagicDatePicker from "@/components/base/MagicDatePicker"
import MagicModal from "@/components/base/MagicModal"
import MagicTimePicker from "@/components/base/MagicTimePicker"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { Switch } from "@/components/shadcn-ui/switch"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { TopicMode } from "../../Workspace/TopicMode"
import { useModalStyles } from "@/components/business/AccountSetting/pages/ScheduledTasks/styles"
import ModelSwitchContainer from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/ModelSwitchContainer"
import {
	MessageEditorStore,
	MessageEditorStoreProvider,
} from "@/pages/superMagic/components/MessageEditor/stores"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import {
	CLAW_CRON_RECURRING_CYCLE,
	CLAW_CRON_SCHEDULE_TYPE,
	type ClawCronIntervalParts,
	type ClawCronRecurringCycle,
	type ClawCronScheduleType,
	type ClawCronTaskDraft,
	type ClawCronTaskRecord,
	createClawCronJobId,
	getDefaultClawCronRecurringCycle,
	getDefaultClawCronScheduleType,
	getDefaultClawCronTimezone,
	intervalPartsToMs,
	toClawCronIsoString,
} from "./claw-cron-task-file"

interface ClawScheduledTaskModalProps {
	open: boolean
	mode: "create" | "edit"
	initialTask?: ClawCronTaskRecord | null
	taskRecords?: ClawCronTaskRecord[]
	agentCode?: string | null
	onClose: () => void
	onSubmit: (values: ClawCronTaskDraft) => Promise<void> | void
}

const footerClassName =
	"flex items-center justify-between gap-2.5 border-t border-border px-5 py-3.5"
const scheduleCardClassName = "rounded-lg bg-secondary/60 px-3.5 py-3 text-sm text-foreground"
const fieldLabelClassName = "text-sm font-medium leading-none text-foreground"
const helperTextClassName = "text-sm text-muted-foreground"
const intervalInputClassName = "h-9 w-12 px-3 text-center"

const defaultInterval: ClawCronIntervalParts = {
	days: 0,
	hours: 0,
	minutes: 1,
}
const previewTimeFormat = "MM/DD/YYYY HH:mm"

function getDefaultStartDateTime() {
	return dayjs().add(1, "hour").set("minute", 0).set("second", 0)
}

function getMinimumStartDateTime() {
	const minimumStartAt = dayjs().add(2, "minute")
	if (minimumStartAt.second() === 0 && minimumStartAt.millisecond() === 0) return minimumStartAt

	return minimumStartAt.add(1, "minute").startOf("minute")
}

function getDefaultEndDateTime() {
	return dayjs().add(7, "day").hour(23).minute(59).second(59)
}

function createDateTimeValue(date: string, time: string) {
	return dayjs(`${date} ${time}`)
}

function formatPreviewTime(value: string | dayjs.Dayjs) {
	return dayjs(value).format(previewTimeFormat)
}

function normalizeMinutePrecisionTime(timeValue: string) {
	const nextTime = getPickerTimeValue(timeValue)
	if (!nextTime) return timeValue
	return nextTime.format("HH:mm")
}

function getPickerDateValue(dateValue: string) {
	const nextDate = dayjs(dateValue, "YYYY-MM-DD", true)
	if (!nextDate.isValid()) return null
	return nextDate
}

function getPickerTimeValue(timeValue: string) {
	const normalizedTimeValue = timeValue.length === 8 ? timeValue.slice(0, 5) : timeValue
	const nextTime = dayjs(`2000-01-01 ${normalizedTimeValue}`, "YYYY-MM-DD HH:mm", true)
	if (!nextTime.isValid()) return null
	return nextTime
}

function getDisabledTimeRange(maxExclusive: number) {
	return Array.from({ length: Math.max(0, maxExclusive) }, (_, index) => index)
}

function getMinimumTimeConfig(minTimeValue?: string) {
	if (!minTimeValue) return undefined

	const minimumTime = getPickerTimeValue(minTimeValue)
	if (!minimumTime) return undefined

	const minimumHour = minimumTime.hour()
	const minimumMinute = minimumTime.minute()

	return () => ({
		disabledHours: () => getDisabledTimeRange(minimumHour),
		disabledMinutes: (selectedHour: number) =>
			selectedHour === minimumHour ? getDisabledTimeRange(minimumMinute) : [],
	})
}

function getFirstRecurringExecution(params: {
	startDate: string
	startTime: string
	recurringCycle: ClawCronRecurringCycle
	recurringTime: string
}) {
	const { startDate, startTime, recurringCycle, recurringTime } = params
	const startAt = createDateTimeValue(startDate, startTime)
	if (!startAt.isValid()) return null

	const recurringDate = createDateTimeValue(startDate, recurringTime)
	if (!recurringDate.isValid()) return null

	if (recurringCycle === CLAW_CRON_RECURRING_CYCLE.Daily) {
		if (recurringDate.isBefore(startAt)) return recurringDate.add(1, "day")
		return recurringDate
	}

	return recurringDate
}

interface DateTimeFieldsProps {
	dateValue: string
	timeValue: string
	dateTestId: string
	timeTestId: string
	onDateChange: (value: string) => void
	onTimeChange: (value: string) => void
	minDateValue?: string
	minTimeValue?: string
}

function DateTimeFields({
	dateValue,
	timeValue,
	dateTestId,
	timeTestId,
	onDateChange,
	onTimeChange,
	minDateValue,
	minTimeValue,
}: DateTimeFieldsProps) {
	const { styles } = useModalStyles({ runningRecord: false })

	const pickerClassNames = {
		root: "h-9 w-full",
		popup: {
			root: styles.timepickerPopup,
		},
	}

	const minimumDate = minDateValue ? dayjs(minDateValue, "YYYY-MM-DD", true).startOf("day") : null
	const disabledTime = getMinimumTimeConfig(minTimeValue)

	return (
		<div className="flex gap-2">
			<div className="flex-1" data-testid={dateTestId}>
				<MagicDatePicker
					classNames={pickerClassNames}
					value={getPickerDateValue(dateValue) || undefined}
					onChange={(date) => {
						if (!date) return
						onDateChange(date.format("YYYY-MM-DD"))
					}}
					format="YYYY-MM-DD"
					disabledDate={
						minimumDate ? (current) => current.isBefore(minimumDate) : undefined
					}
					className="w-full"
				/>
			</div>
			<div className="flex-1" data-testid={timeTestId}>
				<MagicTimePicker
					classNames={pickerClassNames}
					value={getPickerTimeValue(timeValue) || undefined}
					onChange={(time) => {
						if (!time) return
						onTimeChange(time.format("HH:mm"))
					}}
					format="HH:mm"
					needConfirm={false}
					changeOnScroll={true}
					disabledTime={disabledTime}
					className="w-full"
				/>
			</div>
		</div>
	)
}

export function ClawScheduledTaskModal({
	open,
	mode,
	initialTask,
	taskRecords = [],
	agentCode,
	onClose,
	onSubmit,
}: ClawScheduledTaskModalProps) {
	const { t } = useTranslation("interface")
	const { styles } = useModalStyles({ runningRecord: false })

	const pickerClassNames = {
		root: "h-9 w-full",
		popup: {
			root: styles.timepickerPopup,
		},
	}

	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [editorStore] = useState(() => new MessageEditorStore())
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isInitializing, setIsInitializing] = useState(false)
	const [scheduleType, setScheduleType] = useState<ClawCronScheduleType>(
		getDefaultClawCronScheduleType(),
	)
	const [taskName, setTaskName] = useState("")
	const [messageContent, setMessageContent] = useState("")
	const [startDate, setStartDate] = useState(getDefaultStartDateTime().format("YYYY-MM-DD"))
	const [startTime, setStartTime] = useState(getDefaultStartDateTime().format("HH:mm"))
	const [minimumStartAt, setMinimumStartAt] = useState(() => getMinimumStartDateTime())
	const [interval, setInterval] = useState<ClawCronIntervalParts>(defaultInterval)
	const [recurringCycle, setRecurringCycle] = useState<ClawCronRecurringCycle>(
		getDefaultClawCronRecurringCycle(),
	)
	const [recurringTime, setRecurringTime] = useState(getDefaultStartDateTime().format("HH:mm"))
	const [isEndTimeEnabled, setIsEndTimeEnabled] = useState(false)
	const [endDate, setEndDate] = useState(getDefaultEndDateTime().format("YYYY-MM-DD"))
	const [endTime, setEndTime] = useState(getDefaultEndDateTime().format("HH:mm"))
	const [isEnabled, setIsEnabled] = useState(true)
	const [nameError, setNameError] = useState("")
	const [messageError, setMessageError] = useState("")
	const existingTaskJobIdSet = useMemo(
		() =>
			new Set(
				taskRecords
					.filter((task) => task.fileId !== initialTask?.fileId)
					.map((task) => task.jobId || createClawCronJobId(task.taskName))
					.filter(Boolean),
			),
		[initialTask?.fileId, taskRecords],
	)
	const scheduleOptions = useMemo(
		() => [
			{
				value: CLAW_CRON_SCHEDULE_TYPE.OneTime,
				label: t("accountPanel.timedTasks.oneTimeSchedule"),
			},
			{
				value: CLAW_CRON_SCHEDULE_TYPE.IntervalLoop,
				label: t("accountPanel.timedTasks.intervalLoop"),
			},
			{
				value: CLAW_CRON_SCHEDULE_TYPE.Recurring,
				label: t("accountPanel.timedTasks.recurringSchedule"),
			},
		],
		[t],
	)
	const scheduleDescription = useMemo(() => {
		if (scheduleType === CLAW_CRON_SCHEDULE_TYPE.OneTime)
			return t("accountPanel.timedTasks.oneTimeScheduleDescription")
		if (scheduleType === CLAW_CRON_SCHEDULE_TYPE.Recurring)
			return t("accountPanel.timedTasks.recurringScheduleDescription")
		return t("accountPanel.timedTasks.intervalLoopDescription")
	}, [scheduleType, t])
	const minimumStartDate = minimumStartAt.format("YYYY-MM-DD")
	const minimumStartTime =
		startDate === minimumStartDate ? minimumStartAt.format("HH:mm") : undefined
	const previewExecutionTimes = useMemo(() => {
		if (!startDate || !startTime) return []

		if (scheduleType === CLAW_CRON_SCHEDULE_TYPE.OneTime) {
			const executeAt = createDateTimeValue(startDate, startTime)
			if (!executeAt.isValid()) return []
			return [formatPreviewTime(executeAt)]
		}

		if (scheduleType === CLAW_CRON_SCHEDULE_TYPE.IntervalLoop) {
			const intervalMs = intervalPartsToMs(interval)
			if (intervalMs <= 0) return []

			const firstExecution = createDateTimeValue(startDate, startTime)
			if (!firstExecution.isValid()) return []

			return [0, 1, 2].map((step) =>
				formatPreviewTime(firstExecution.add(intervalMs * step, "millisecond")),
			)
		}

		const firstRecurringExecution = getFirstRecurringExecution({
			startDate,
			startTime,
			recurringCycle,
			recurringTime,
		})
		if (!firstRecurringExecution?.isValid()) return []

		if (recurringCycle === CLAW_CRON_RECURRING_CYCLE.Daily) {
			return [0, 1, 2].map((step) =>
				formatPreviewTime(firstRecurringExecution.add(step, "day")),
			)
		}

		return [formatPreviewTime(firstRecurringExecution)]
	}, [interval, recurringCycle, recurringTime, scheduleType, startDate, startTime])

	useEffect(() => {
		return () => {
			editorStore.dispose()
		}
	}, [editorStore])

	useEffect(() => {
		if (!open) return

		let isMounted = true

		async function initializeModal() {
			const defaultStartAt = getDefaultStartDateTime()
			const defaultEndAt = getDefaultEndDateTime()

			setIsInitializing(true)
			setMinimumStartAt(getMinimumStartDateTime())
			setNameError("")
			setMessageError("")
			setScheduleType(initialTask?.scheduleType || getDefaultClawCronScheduleType())
			setTaskName(initialTask?.taskName || "")
			setMessageContent(initialTask?.prompt || "")
			setIsEnabled(initialTask?.enabled ?? true)
			setInterval(initialTask?.interval || defaultInterval)
			setRecurringCycle(initialTask?.recurringCycle || getDefaultClawCronRecurringCycle())
			setIsEndTimeEnabled(
				initialTask?.scheduleType === CLAW_CRON_SCHEDULE_TYPE.OneTime
					? false
					: Boolean(initialTask?.endAt),
			)

			const startAt = dayjs(initialTask?.startAt || defaultStartAt)
			setStartDate(startAt.format("YYYY-MM-DD"))
			setStartTime(normalizeMinutePrecisionTime(startAt.format("HH:mm")))
			setRecurringTime(
				normalizeMinutePrecisionTime(initialTask?.recurringTime || startAt.format("HH:mm")),
			)

			const endAt = initialTask?.endAt ? dayjs(initialTask.endAt) : defaultEndAt
			setEndDate(endAt.format("YYYY-MM-DD"))
			setEndTime(normalizeMinutePrecisionTime(endAt.format("HH:mm")))
			editorStore.topicModelStore.setCurrentContext(
				undefined,
				undefined,
				TopicMode.Default,
				agentCode ?? null,
			)

			try {
				editorStore.topicModelStore.setSelectedLanguageModel(null)
				editorStore.topicModelStore.setSelectedImageModel(null)
				await superMagicTopicModelService.fetchTopicModel(
					editorStore.topicModelStore.currentTopicId,
					editorStore.topicModelStore.currentProjectId,
					TopicMode.Default,
					editorStore.topicModelStore,
				)
				if (!isMounted) return
				const models =
					superMagicModeService.getModelListByMode(
						TopicMode.Default,
						agentCode ?? null,
					) || []
				const imageModels =
					superMagicModeService.getImageModelListByMode(
						TopicMode.Default,
						agentCode ?? null,
					) || []
				const matchedModel = models.find((item) => item.model_id === initialTask?.modelId)
				const matchedImageModel = imageModels.find(
					(item) => item.model_id === initialTask?.imageModelId,
				)
				if (initialTask) {
					editorStore.topicModelStore.setSelectedLanguageModel(matchedModel || null)
					editorStore.topicModelStore.setSelectedImageModel(matchedImageModel || null)
				}
			} catch (error) {
				console.error("Failed to load claw scheduled task models:", error)
				if (!isMounted) return
				if (initialTask) {
					editorStore.topicModelStore.setSelectedLanguageModel(null)
					editorStore.topicModelStore.setSelectedImageModel(null)
				}
			} finally {
				if (isMounted) setIsInitializing(false)
			}
		}

		void initializeModal()

		return () => {
			isMounted = false
		}
	}, [agentCode, editorStore, initialTask, open])

	async function handleClose() {
		onClose()
	}

	const handleSubmit = useMemoizedFn(async () => {
		const prompt = messageContent.trim()
		const nextTaskJobId = taskName.trim() ? createClawCronJobId(taskName) : ""
		const nextIntervalMs = intervalPartsToMs(interval)
		const nextStartAt = createDateTimeValue(startDate, startTime)
		const nextEndAt = createDateTimeValue(endDate, endTime)
		const nextRecurringFirstExecution = getFirstRecurringExecution({
			startDate,
			startTime,
			recurringCycle,
			recurringTime,
		})
		const nextNameError = taskName.trim()
			? ""
			: t("accountPanel.timedTasks.pleaseInputName", {
					name: t("accountPanel.timedTasks.name"),
				})
		const duplicateNameError =
			nextTaskJobId && existingTaskJobIdSet.has(nextTaskJobId)
				? t("accountPanel.timedTasks.taskNameAlreadyExists")
				: ""
		const nextMessageError = prompt ? "" : t("accountPanel.timedTasks.promptRequired")

		setNameError(nextNameError || duplicateNameError)
		setMessageError(nextMessageError)

		if (nextNameError) {
			magicToast.error(nextNameError)
			return
		}

		if (duplicateNameError) {
			magicToast.error(duplicateNameError)
			return
		}

		if (nextMessageError) {
			magicToast.error(nextMessageError)
			return
		}

		if (!nextStartAt.isValid()) {
			magicToast.error(t("accountPanel.timedTasks.planRequired"))
			return
		}

		if (nextStartAt.isBefore(getMinimumStartDateTime())) {
			magicToast.error(t("accountPanel.timedTasks.startTimeTooEarly"))
			return
		}

		if (scheduleType === CLAW_CRON_SCHEDULE_TYPE.IntervalLoop && nextIntervalMs <= 0) {
			magicToast.error(t("accountPanel.timedTasks.planRequired"))
			return
		}

		if (
			scheduleType === CLAW_CRON_SCHEDULE_TYPE.Recurring &&
			!nextRecurringFirstExecution?.isValid()
		) {
			magicToast.error(t("accountPanel.timedTasks.planRequired"))
			return
		}

		const endTimeCompareTarget =
			scheduleType === CLAW_CRON_SCHEDULE_TYPE.Recurring
				? nextRecurringFirstExecution
				: nextStartAt
		if (
			scheduleType !== CLAW_CRON_SCHEDULE_TYPE.OneTime &&
			isEndTimeEnabled &&
			(!nextEndAt.isValid() ||
				!endTimeCompareTarget ||
				!nextEndAt.isAfter(endTimeCompareTarget))
		) {
			magicToast.error(t("chat.timedTask.deadline"))
			return
		}

		try {
			setIsSubmitting(true)
			await onSubmit({
				taskName: taskName.trim(),
				prompt,
				enabled: isEnabled,
				timezone: getDefaultClawCronTimezone(),
				scheduleType,
				startAt: toClawCronIsoString(nextStartAt),
				interval: scheduleType === CLAW_CRON_SCHEDULE_TYPE.IntervalLoop ? interval : null,
				recurringCycle:
					scheduleType === CLAW_CRON_SCHEDULE_TYPE.Recurring ? recurringCycle : null,
				recurringTime:
					scheduleType === CLAW_CRON_SCHEDULE_TYPE.Recurring ? recurringTime : null,
				endAt:
					scheduleType !== CLAW_CRON_SCHEDULE_TYPE.OneTime && isEndTimeEnabled
						? toClawCronIsoString(nextEndAt)
						: null,
				agentCode: agentCode || initialTask?.agentCode || null,
				modelId:
					editorStore.topicModelStore.selectedLanguageModel?.model_id ||
					initialTask?.modelId ||
					null,
				imageModelId:
					editorStore.topicModelStore.selectedImageModel?.model_id ||
					initialTask?.imageModelId ||
					null,
			})
			await handleClose()
		} catch (error) {
			console.error("Failed to submit claw scheduled task:", error)
		} finally {
			setIsSubmitting(false)
		}
	})

	function handleIntervalChange(key: keyof ClawCronIntervalParts, value: string) {
		const parsedValue = Number(value.replace(/[^\d]/g, ""))
		setInterval((currentValue) => ({
			...currentValue,
			[key]: Number.isNaN(parsedValue) ? 0 : parsedValue,
		}))
	}

	return (
		<MessageEditorStoreProvider store={editorStore}>
			<MagicModal
				centered
				className={styles.modal}
				open={open}
				onCancel={() => void handleClose()}
				footer={null}
				width={460}
				title={
					mode === "edit"
						? t("chat.timedTask.editTimedTask")
						: t("chat.timedTask.createTask")
				}
				destroyOnHidden
				classNames={{ content: "p-0" }}
			>
				<div className="relative flex max-h-[65vh] flex-col">
					<div className="scrollbar-y-thin space-y-4 overflow-y-auto px-5 py-5">
						<div className="space-y-2">
							<div className={fieldLabelClassName}>
								{t("accountPanel.timedTasks.name")}{" "}
								<span className="text-destructive">*</span>
							</div>
							<Input
								value={taskName}
								onChange={(event) => {
									setTaskName(event.target.value)
									if (nameError) setNameError("")
								}}
								placeholder={t("accountPanel.timedTasks.namePlaceholder")}
								className="h-9"
								data-testid="claw-scheduled-task-name-input"
							/>
							{nameError ? (
								<div className="text-xs text-destructive">{nameError}</div>
							) : null}
						</div>

						<div className="space-y-2">
							<div className={fieldLabelClassName}>
								{t("accountPanel.timedTasks.prompt")}{" "}
								<span className="text-destructive">*</span>
							</div>
							<div className="rounded-xl border border-border bg-background p-2 shadow-xs">
								<Textarea
									ref={textareaRef}
									value={messageContent}
									onChange={(event) => {
										setMessageContent(event.target.value)
										if (messageError) setMessageError("")
									}}
									placeholder={t("accountPanel.timedTasks.clawPromptPlaceholder")}
									className="min-h-20 resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
									data-testid="claw-scheduled-task-message-textarea"
								/>
								<div className="mt-2 flex items-center justify-between">
									<ModelSwitchContainer
										size="default"
										agentCode={agentCode}
										autoFetch={false}
										topicMode={TopicMode.Default}
										showBorder={false}
										placement="bottomLeft"
										className="min-w-[108px] px-3"
									/>
								</div>
							</div>
							{messageError ? (
								<div className="text-xs text-destructive">{messageError}</div>
							) : null}
						</div>

						<div className="space-y-2">
							<div className={fieldLabelClassName}>
								{t("accountPanel.timedTasks.plan")}{" "}
								<span className="text-destructive">*</span>
							</div>
							<Select
								value={scheduleType}
								onValueChange={(value) =>
									setScheduleType(value as ClawCronScheduleType)
								}
							>
								<SelectTrigger
									className="h-9 w-full"
									data-testid="claw-scheduled-task-schedule-select"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{scheduleOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<div className={helperTextClassName}>{scheduleDescription}</div>

							<div className={scheduleCardClassName}>
								<div className="space-y-3">
									{scheduleType === CLAW_CRON_SCHEDULE_TYPE.OneTime ? (
										<div className="space-y-2">
											<div className="text-sm font-medium">
												{t("accountPanel.timedTasks.setTimeLabel")}
											</div>
											<DateTimeFields
												dateValue={startDate}
												timeValue={startTime}
												dateTestId="claw-scheduled-task-once-date-input"
												timeTestId="claw-scheduled-task-once-time-input"
												onDateChange={setStartDate}
												onTimeChange={setStartTime}
												minDateValue={minimumStartDate}
												minTimeValue={minimumStartTime}
											/>
										</div>
									) : null}

									{scheduleType === CLAW_CRON_SCHEDULE_TYPE.IntervalLoop ? (
										<>
											<div className="space-y-2">
												<div className="text-sm font-medium">
													{t("accountPanel.timedTasks.startTimeLabel")}
												</div>
												<DateTimeFields
													dateValue={startDate}
													timeValue={startTime}
													dateTestId="claw-scheduled-task-start-date-input"
													timeTestId="claw-scheduled-task-start-time-input"
													onDateChange={setStartDate}
													onTimeChange={setStartTime}
													minDateValue={minimumStartDate}
													minTimeValue={minimumStartTime}
												/>
											</div>

											<div className="space-y-2">
												<div className="text-sm font-medium">
													{t("accountPanel.timedTasks.intervalFrequency")}
												</div>
												<div className="flex flex-wrap items-center gap-2">
													<Input
														value={interval.days}
														onChange={(event) =>
															handleIntervalChange(
																"days",
																event.target.value,
															)
														}
														className={intervalInputClassName}
														data-testid="claw-scheduled-task-interval-days-input"
													/>
													<span>
														{t("accountPanel.timedTasks.daysLabel")}
													</span>
													<Input
														value={interval.hours}
														onChange={(event) =>
															handleIntervalChange(
																"hours",
																event.target.value,
															)
														}
														className={intervalInputClassName}
														data-testid="claw-scheduled-task-interval-hours-input"
													/>
													<span>
														{t("accountPanel.timedTasks.hoursLabel")}
													</span>
													<Input
														value={interval.minutes}
														onChange={(event) =>
															handleIntervalChange(
																"minutes",
																event.target.value,
															)
														}
														className={intervalInputClassName}
														data-testid="claw-scheduled-task-interval-minutes-input"
													/>
													<span>
														{t("accountPanel.timedTasks.minutesLabel")}
													</span>
												</div>
											</div>
										</>
									) : null}

									{scheduleType === CLAW_CRON_SCHEDULE_TYPE.Recurring ? (
										<>
											<div className="space-y-2">
												<div className="text-sm font-medium">
													{t("accountPanel.timedTasks.startTimeLabel")}
												</div>
												<DateTimeFields
													dateValue={startDate}
													timeValue={startTime}
													dateTestId="claw-scheduled-task-recurring-start-date-input"
													timeTestId="claw-scheduled-task-recurring-start-time-input"
													onDateChange={setStartDate}
													onTimeChange={setStartTime}
													minDateValue={minimumStartDate}
													minTimeValue={minimumStartTime}
												/>
											</div>

											<div className="space-y-2">
												<div className="text-sm font-medium">
													{t(
														"accountPanel.timedTasks.scheduleCycleLabel",
													)}
												</div>
												<div className="flex gap-2">
													<Select
														value={recurringCycle}
														onValueChange={(value) =>
															setRecurringCycle(
																value as ClawCronRecurringCycle,
															)
														}
													>
														<SelectTrigger
															className="h-9 flex-1"
															data-testid="claw-scheduled-task-recurring-cycle-select"
														>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem
																value={
																	CLAW_CRON_RECURRING_CYCLE.Daily
																}
															>
																{t(
																	"accountPanel.timedTasks.dailyCycleLabel",
																)}
															</SelectItem>
														</SelectContent>
													</Select>
													<div
														className="flex-1"
														data-testid="claw-scheduled-task-recurring-time-input"
													>
														<MagicTimePicker
															classNames={pickerClassNames}
															value={
																getPickerTimeValue(recurringTime) ||
																undefined
															}
															onChange={(time) => {
																if (!time) return
																setRecurringTime(
																	time.format("HH:mm"),
																)
															}}
															format="HH:mm"
															needConfirm={false}
															changeOnScroll={true}
															className="w-full"
														/>
													</div>
												</div>
											</div>
										</>
									) : null}

									{scheduleType !== CLAW_CRON_SCHEDULE_TYPE.OneTime ? (
										<div className="space-y-2">
											<div className="flex items-center gap-3">
												<Switch
													checked={isEndTimeEnabled}
													onCheckedChange={setIsEndTimeEnabled}
													data-testid="claw-scheduled-task-end-time-switch"
												/>
												<span className="text-sm font-medium">
													{t("accountPanel.timedTasks.endTimeLabel")}
												</span>
											</div>
											{isEndTimeEnabled ? (
												<DateTimeFields
													dateValue={endDate}
													timeValue={endTime}
													dateTestId="claw-scheduled-task-end-date-input"
													timeTestId="claw-scheduled-task-end-time-input"
													onDateChange={setEndDate}
													onTimeChange={setEndTime}
												/>
											) : (
												<div className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground shadow-xs">
													{t("accountPanel.timedTasks.neverEnd")}
												</div>
											)}
										</div>
									) : null}

									<div className="rounded-md bg-background px-3 py-2.5">
										<div className="text-xs font-medium text-foreground">
											{t("accountPanel.timedTasks.executionTimeCalculation")}
										</div>
										<div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
											{previewExecutionTimes.length ? (
												<>
													<div>
														{scheduleType ===
														CLAW_CRON_SCHEDULE_TYPE.OneTime
															? t(
																	"accountPanel.timedTasks.firstTime",
																	{
																		time: previewExecutionTimes[0],
																	},
																)
															: t(
																	"accountPanel.timedTasks.firstExecution",
																	{
																		time: previewExecutionTimes[0],
																	},
																)}
													</div>
													{previewExecutionTimes[1] ? (
														<div>
															{t(
																"accountPanel.timedTasks.secondExecution",
																{
																	time: previewExecutionTimes[1],
																},
															)}
														</div>
													) : null}
													{previewExecutionTimes[2] ? (
														<div>
															{t(
																"accountPanel.timedTasks.thirdExecution",
																{
																	time: previewExecutionTimes[2],
																},
															)}
														</div>
													) : null}
													{previewExecutionTimes.length > 1 ? (
														<div>...</div>
													) : null}
												</>
											) : (
												<div>
													{t("accountPanel.timedTasks.planRequired")}
												</div>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className={footerClassName}>
						<div className="flex items-center gap-3">
							<Switch
								checked={isEnabled}
								onCheckedChange={setIsEnabled}
								data-testid="claw-scheduled-task-enabled-switch"
							/>
							<span className="text-sm font-medium text-foreground">
								{t("accountPanel.timedTasks.enabled")}
							</span>
						</div>
						<div className="flex gap-1.5">
							<Button
								variant="outline"
								onClick={() => void handleClose()}
								data-testid="claw-scheduled-task-cancel"
							>
								{t("accountPanel.timedTasks.cancel")}
							</Button>
							<Button
								onClick={handleSubmit}
								disabled={isSubmitting || isInitializing}
								data-testid="claw-scheduled-task-submit"
							>
								{mode === "create"
									? t("accountPanel.timedTasks.create")
									: t("accountPanel.timedTasks.save")}
							</Button>
						</div>
					</div>

					{isInitializing ? (
						<div
							className="absolute inset-0 flex items-center justify-center bg-background/50"
							data-testid="claw-scheduled-task-modal-loading"
						>
							<Spinner size={20} className="animate-spin" />
						</div>
					) : null}
				</div>
			</MagicModal>
		</MessageEditorStoreProvider>
	)
}
