import { IconPlayerPause, IconPlayerPlay, IconPlus, IconTrash } from "@tabler/icons-react"
import { Search, SquarePen, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"
import magicToast from "@/components/base/MagicToaster/utils"
import { openModal } from "@/utils/react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import useSuperMagicDropdown from "@/pages/superMagic/components/SuperMagicDropdown/useSuperMagicDropdown"
import TaskEmptyState from "@/pages/superMagic/components/SiderTask/components/TaskEmptyState"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ClawScheduledTaskModal } from "./ClawScheduledTaskModal"
import { ClawScheduledTaskItem } from "./ClawScheduledTaskItem"
import type { ClawCronTaskDraft, ClawCronTaskRecord } from "./claw-cron-task-file"
import {
	deleteClawCronTaskFile,
	loadClawCronTaskRecords,
	saveClawCronTaskFile,
} from "./claw-cron-task-file"

interface ClawScheduledTaskPanelProps {
	projectId: string | null
	agentCode?: string | null
	isActive?: boolean
}

interface ClawScheduledTaskModalState {
	open: boolean
	mode: "create" | "edit"
	initialTask?: ClawCronTaskRecord | null
}

const defaultModalState: ClawScheduledTaskModalState = {
	open: false,
	mode: "create",
	initialTask: null,
}

export function ClawScheduledTaskPanel({
	projectId,
	agentCode,
	isActive = false,
}: ClawScheduledTaskPanelProps) {
	const { t } = useTranslation("interface")
	const { t: tSuper } = useTranslation("super")
	const searchInputRef = useRef<HTMLInputElement>(null)
	const [taskRecords, setTaskRecords] = useState<ClawCronTaskRecord[]>([])
	const [modalState, setModalState] = useState<ClawScheduledTaskModalState>(defaultModalState)
	const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
	const [statusUpdatingTaskId, setStatusUpdatingTaskId] = useState<string | null>(null)
	const [isSearchVisible, setIsSearchVisible] = useState(false)
	const [searchKeyword, setSearchKeyword] = useState("")
	const [hasActivatedOnce, setHasActivatedOnce] = useState(isActive)
	const isTaskContextReady = Boolean(projectId)
	const shouldLoadTasks = isTaskContextReady && hasActivatedOnce

	const filteredTaskRecords = useMemo(() => {
		const normalizedKeyword = searchKeyword.trim().toLowerCase()
		if (!normalizedKeyword) return taskRecords

		return taskRecords.filter((task) => task.taskName.toLowerCase().includes(normalizedKeyword))
	}, [searchKeyword, taskRecords])

	const refreshTasks = useMemoizedFn(async () => {
		if (!projectId) {
			setTaskRecords([])
			return
		}

		try {
			const records = await loadClawCronTaskRecords(projectId)
			setTaskRecords(records)
		} catch (error) {
			console.error("Failed to load claw cron tasks:", error)
		}
	})

	useEffect(() => {
		if (!isActive) return
		setHasActivatedOnce(true)
	}, [isActive])

	useEffect(() => {
		if (!isTaskContextReady) {
			setTaskRecords([])
			return
		}

		if (!shouldLoadTasks || !isActive) return
		void refreshTasks()
	}, [isActive, isTaskContextReady, projectId, refreshTasks, shouldLoadTasks])

	useEffect(() => {
		if (!isActive || !isSearchVisible) return

		searchInputRef.current?.focus()
	}, [isActive, isSearchVisible])

	useEffect(() => {
		if (!shouldLoadTasks || !isActive) return

		function handleAttachmentUpdate() {
			void refreshTasks()
		}

		pubsub.subscribe(PubSubEvents.Update_Attachments, handleAttachmentUpdate)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Attachments, handleAttachmentUpdate)
		}
	}, [isActive, refreshTasks, shouldLoadTasks])

	const handleOpenCreateModal = useMemoizedFn(() => {
		if (!isTaskContextReady) return
		setModalState({
			open: true,
			mode: "create",
			initialTask: null,
		})
	})

	const handleCloseModal = useMemoizedFn(() => {
		setModalState(defaultModalState)
	})

	const handleOpenEditModal = useMemoizedFn((task: ClawCronTaskRecord) => {
		setModalState({
			open: true,
			mode: "edit",
			initialTask: task,
		})
	})

	const handleSaveTask = useMemoizedFn(async (draft: ClawCronTaskDraft) => {
		if (!projectId) return

		try {
			await saveClawCronTaskFile({
				projectId,
				draft,
				currentTask: modalState.initialTask,
			})
			pubsub.publish(PubSubEvents.Update_Attachments)
			magicToast.success(
				modalState.mode === "edit"
					? t("accountPanel.timedTasks.editSuccess")
					: t("accountPanel.timedTasks.createSuccess"),
			)
			handleCloseModal()
		} catch (error) {
			if ((error as Error).message === "clawCronTaskAlreadyExists") {
				magicToast.error(t("accountPanel.timedTasks.taskFileAlreadyExists"))
				return
			}

			console.error("Failed to save claw scheduled task:", error)
		}
	})

	const handleDeleteTask = useMemoizedFn(async (task: ClawCronTaskRecord) => {
		const { default: DeleteDangerModal } =
			await import("@/components/business/DeleteDangerModal")

		openModal(DeleteDangerModal, {
			content: task.taskName,
			onSubmit: async () => {
				await deleteClawCronTaskFile(task.fileId)
				pubsub.publish(PubSubEvents.Update_Attachments)
				magicToast.success(t("accountPanel.timedTasks.taskDeleted"))
			},
		})
	})

	const handleStatusChange = useMemoizedFn(async (task: ClawCronTaskRecord, enabled: boolean) => {
		if (!projectId) return
		if (statusUpdatingTaskId === task.fileId) return

		try {
			setStatusUpdatingTaskId(task.fileId)
			await saveClawCronTaskFile({
				projectId,
				draft: {
					...task,
					enabled,
				},
				currentTask: task,
			})
			pubsub.publish(PubSubEvents.Update_Attachments)
			magicToast.success(
				enabled
					? t("accountPanel.timedTasks.taskEnabled")
					: t("accountPanel.timedTasks.taskDisabled"),
			)
		} catch (error) {
			console.error("Failed to update claw scheduled task status:", error)
		} finally {
			setStatusUpdatingTaskId((currentTaskId) =>
				currentTaskId === task.fileId ? null : currentTaskId,
			)
		}
	})

	const handleSearchToggle = useMemoizedFn(() => {
		if (isSearchVisible) {
			setIsSearchVisible(false)
			setSearchKeyword("")
			return
		}

		setIsSearchVisible(true)
	})

	const { dropdownContent, delegateProps } = useSuperMagicDropdown<ClawCronTaskRecord>({
		width: 148,
		onOpenChange: (open, task) => {
			setActiveTaskId(open && task ? task.fileId : null)
		},
		getMenuItems: (task) => {
			const menuItems = []
			const isStatusUpdating = statusUpdatingTaskId === task.fileId

			if (task.enabled) {
				menuItems.push({
					key: "pause",
					label: tSuper("scheduleTask.disableTask"),
					icon: <MagicIcon component={IconPlayerPause} stroke={2} size={18} />,
					disabled: isStatusUpdating,
					onClick: () => handleStatusChange(task, false),
				})
			} else {
				menuItems.push({
					key: "play",
					label: tSuper("scheduleTask.enableTask"),
					icon: <MagicIcon component={IconPlayerPlay} stroke={2} size={18} />,
					disabled: isStatusUpdating,
					onClick: () => handleStatusChange(task, true),
				})
			}

			menuItems.push(
				{ type: "divider" as const },
				{
					key: "edit",
					label: tSuper("scheduleTask.editTask"),
					icon: <SquarePen size={16} />,
					onClick: () => void handleOpenEditModal(task),
				},
				{ type: "divider" as const },
				{
					key: "delete",
					danger: true,
					label: tSuper("scheduleTask.deleteTask"),
					icon: <IconTrash stroke={2} size={18} className="stroke-red-500" />,
					onClick: () => void handleDeleteTask(task),
				},
			)

			return menuItems
		},
	})

	return (
		<>
			<div className="flex h-full flex-col gap-0.5" data-testid="claw-scheduled-task-panel">
				<div className="flex h-8 shrink-0 items-center justify-between px-2 py-1.5">
					<p className="text-sm font-medium leading-none text-foreground">
						{tSuper("scheduleTask.title")}
					</p>
					<div className="flex items-center gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-6"
							onClick={handleSearchToggle}
							aria-label={tSuper("scheduleTask.searchTasks")}
							data-testid="claw-scheduled-task-search-button"
						>
							<Search className="size-4" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-6"
							onClick={handleOpenCreateModal}
							aria-label={tSuper("scheduleTask.createTask")}
							data-testid="claw-scheduled-task-create-button"
						>
							<IconPlus size={16} />
						</Button>
					</div>
				</div>

				{isSearchVisible ? (
					<div
						className="shrink-0 px-1.5 pb-1"
						data-testid="claw-scheduled-task-search-bar"
					>
						<div className="relative">
							<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								ref={searchInputRef}
								value={searchKeyword}
								onChange={(event) => setSearchKeyword(event.target.value)}
								placeholder={tSuper("scheduleTask.searchTasksPlaceholder")}
								className="h-8 rounded-md bg-background pl-8 pr-8 text-sm"
								aria-label={tSuper("scheduleTask.searchTasks")}
								data-testid="claw-scheduled-task-search-input"
							/>
							{searchKeyword ? (
								<button
									type="button"
									className="absolute right-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground"
									onClick={() => setSearchKeyword("")}
									aria-label={tSuper("scheduleTask.clearSearch")}
									data-testid="claw-scheduled-task-search-clear-button"
								>
									<X className="size-4" />
								</button>
							) : null}
						</div>
					</div>
				) : null}

				<div
					className="flex h-[calc(100%-32px)] flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1.5 pb-2"
					data-testid="claw-scheduled-task-list"
				>
					{taskRecords.length ? (
						filteredTaskRecords.length ? (
							filteredTaskRecords.map((task) => (
								<ClawScheduledTaskItem
									key={task.fileId}
									task={task}
									isActive={activeTaskId === task.fileId}
									isStatusUpdating={statusUpdatingTaskId === task.fileId}
									onSwitchChange={(enabled) =>
										void handleStatusChange(task, enabled)
									}
									{...delegateProps}
								/>
							))
						) : (
							<div
								className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground"
								data-testid="claw-scheduled-task-search-empty"
							>
								{tSuper("scheduleTask.searchTasksEmpty")}
							</div>
						)
					) : (
						<TaskEmptyState onCreateTask={handleOpenCreateModal} />
					)}
				</div>
			</div>

			<ClawScheduledTaskModal
				open={modalState.open}
				mode={modalState.mode}
				initialTask={modalState.initialTask}
				taskRecords={taskRecords}
				agentCode={agentCode}
				onClose={handleCloseModal}
				onSubmit={handleSaveTask}
			/>
			{dropdownContent}
		</>
	)
}
