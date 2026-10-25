import {
	IconCalendarEvent,
	IconDatabaseCog,
	IconList,
	IconPlayerPause,
	IconPlayerPlay,
	IconPlayerRecord,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react"
import { useUpdateEffect } from "ahooks"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicIcon from "@/components/base/MagicIcon"
import { ScheduledTask } from "@/types/scheduledTask"
import { useScheduleTaskWithModal } from "@/components/business/AccountSetting/pages/ScheduledTasks/hooks/useScheduleTask"
import useSuperMagicDropdown from "@/pages/superMagic/components/SuperMagicDropdown/useSuperMagicDropdown"
import {
	PROJECT_PANEL_HEADER_CLASSNAME,
	PROJECT_PANEL_TITLE_CLASSNAME,
} from "@/pages/superMagic/components/ProjectSider/panelChrome"

import MicroAppScheduledTaskItem from "./MicroAppScheduledTaskItem"
import { useMicroAppScheduledTasksModifyModal } from "./useMicroAppScheduledTasksModifyModal"

interface MicroAppScheduledTasksPanelProps {
	selectWorkspaceId?: string
	selectProjectId?: string
	selectTopicId?: string
	workspaceName?: string
	projectName?: string
	className?: string
	microAppId?: string
	microAppName?: string
	compact?: boolean
}

export default function MicroAppScheduledTasksPanel({
	selectWorkspaceId,
	selectProjectId,
	selectTopicId,
	workspaceName,
	projectName,
	className,
	microAppId,
	microAppName,
	compact = false,
}: MicroAppScheduledTasksPanelProps) {
	const { t } = useTranslation("super")
	const taskListRef = useRef<HTMLDivElement>(null)
	const contextReady = Boolean(selectWorkspaceId && selectProjectId)
	const modifyModal = useMicroAppScheduledTasksModifyModal({
		workspaceId: selectWorkspaceId || "",
		projectId: selectProjectId || "",
		workspaceName,
		projectName,
		topicId: selectTopicId,
		microAppId,
		microAppName,
	})
	const {
		tasks,
		total,
		params,
		setParams,
		run,
		loading,
		openCreateModal,
		content,
		onSaveTask,
		onTaskDelete,
		onTaskRunningRecord,
		onTaskEdit,
		onStatusChange,
		preloadDeleteDangerModal,
		preloadRunningRecordModal,
		runNow,
	} = useScheduleTaskWithModal({
		options: {
			page_size: 20,
			workspace_id: selectWorkspaceId,
			project_id: selectProjectId,
		},
		isScroll: true,
		siderTaskRef: taskListRef,
		modifyModal,
	})

	useUpdateEffect(() => {
		const nextParams = {
			...params,
			page: 1,
			workspace_id: selectWorkspaceId,
			project_id: selectProjectId,
		}
		setParams(nextParams)
		run(nextParams)
	}, [selectWorkspaceId, selectProjectId])

	const loadMore = () => {
		if (loading || tasks.length >= total) return
		const nextParams = { ...params, page: params.page + 1 }
		setParams(nextParams)
		run(nextParams)
	}

	const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
		if (scrollHeight - scrollTop <= clientHeight * 1.1) loadMore()
	}

	const handleCreateTask = () => {
		if (!contextReady) return
		openCreateModal(onSaveTask, {
			workspace_id: selectWorkspaceId,
			project_id: selectProjectId,
			topic_id: selectTopicId,
		})
	}

	const { dropdownContent, delegateProps } = useSuperMagicDropdown<ScheduledTask.Task>({
		width: 180,
		getMenuItems: (task) => {
			const menuItems = [
				{
					key: "run",
					label: t("scheduleTask.runTask"),
					icon: <MagicIcon component={IconPlayerRecord} stroke={2} size={18} />,
					onClick: () => runNow(task),
				},
			]

			menuItems.push(
				task.enabled === 1
					? {
							key: "pause",
							label: t("scheduleTask.pauseTask"),
							icon: <MagicIcon component={IconPlayerPause} stroke={2} size={18} />,
							onClick: () => onStatusChange(task, false),
						}
					: {
							key: "play",
							label: t("scheduleTask.playTask"),
							icon: <MagicIcon component={IconPlayerPlay} stroke={2} size={18} />,
							onClick: () => onStatusChange(task, true),
						},
			)

			menuItems.push(
				{ type: "divider" as const },
				{
					key: "config",
					label: t("scheduleTask.configTask"),
					icon: <MagicIcon component={IconDatabaseCog} stroke={2} size={18} />,
					onClick: () => onTaskEdit(task),
					onMouseEnter: () => preloadDeleteDangerModal(),
				},
				{
					key: "runningRecord",
					label: t("scheduleTask.runningRecord"),
					icon: <MagicIcon component={IconList} stroke={2} size={18} />,
					onClick: () => onTaskRunningRecord(task),
					onMouseEnter: () => preloadRunningRecordModal(),
				},
				{ type: "divider" as const },
				{
					key: "delete",
					danger: true,
					label: t("scheduleTask.deleteTask"),
					icon: (
						<MagicIcon
							component={IconTrash}
							stroke={2}
							size={18}
							className="stroke-red-500"
						/>
					),
					onClick: () => {
						window.setTimeout(() => void onTaskDelete(task), 0)
					},
				},
			)

			return menuItems
		},
	})

	return (
		<div className={"flex h-full flex-col bg-muted/20 " + (className || "")}>
			<header
				className={
					compact
						? PROJECT_PANEL_HEADER_CLASSNAME
						: "flex h-[72px] shrink-0 items-center justify-between border-b border-border px-8"
				}
				data-slot={compact ? "project-panel-header" : undefined}
			>
				{compact ? (
					<h2 className={PROJECT_PANEL_TITLE_CLASSNAME} data-slot="project-panel-title">
						{t("scheduleTask.title")}
					</h2>
				) : (
					<div className="flex min-w-0 flex-col gap-1">
						<h2 className="truncate text-lg font-semibold leading-6 text-foreground">
							{t("scheduleTask.title")}
						</h2>
						<p className="text-sm leading-5 text-muted-foreground">
							{t("scheduleTask.workspaceDescription")}
						</p>
					</div>
				)}
				<Button
					size={compact ? "icon-sm" : "sm"}
					variant={compact ? "ghost" : "default"}
					onClick={handleCreateTask}
					className={compact ? undefined : "shadow-sm"}
					disabled={!contextReady}
					aria-label={t("scheduleTask.createScheduleTask")}
				>
					<IconPlus size={16} stroke={2} />
					{compact ? null : t("scheduleTask.createScheduleTask")}
				</Button>
			</header>

			<ScrollArea
				viewportRef={taskListRef}
				viewportProps={{
					onScroll: handleScroll,
					"data-testid": "micro-app-scheduled-tasks-list",
				}}
				className="min-h-0 flex-1"
				viewportClassName={compact ? "px-2 pb-2" : "px-8 py-6"}
			>
				<div className="flex min-h-full flex-col items-center gap-4">
					{!contextReady || (loading && !tasks.length) ? (
						<div
							className="flex h-full w-full max-w-5xl items-center justify-center rounded-xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground"
							data-testid="micro-app-scheduled-tasks-context-loading"
						>
							{t("scheduleTask.contextLoading")}
						</div>
					) : tasks.length > 0 ? (
						tasks.map((task) => (
							<MicroAppScheduledTaskItem
								key={task.id}
								data={task}
								onClick={() => onTaskEdit(task)}
								onSwitchChange={(enabled) => onStatusChange(task, enabled)}
								{...delegateProps}
							/>
						))
					) : (
						<div className="flex h-full w-full max-w-5xl flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/60 p-8 text-center">
							<div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<IconCalendarEvent size={24} stroke={1.8} />
							</div>
							<h3 className="mt-4 text-lg font-medium leading-7 text-foreground">
								{t("scheduleTask.emptyTitle")}
							</h3>
							<p className="mt-2 text-sm leading-5 text-muted-foreground">
								{t("scheduleTask.emptyDescription")}
							</p>
							<Button
								onClick={handleCreateTask}
								className="mt-6"
								disabled={!contextReady}
							>
								{t("scheduleTask.createTask")}
							</Button>
						</div>
					)}
				</div>
			</ScrollArea>
			{content}
			{dropdownContent}
		</div>
	)
}
