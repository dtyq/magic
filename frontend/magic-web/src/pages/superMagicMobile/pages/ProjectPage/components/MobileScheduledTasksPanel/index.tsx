import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { CirclePlay, List, Pause, Play, Plus, Settings2, Trash2 } from "lucide-react"

import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import { useScheduleTask } from "@/components/business/AccountSetting/pages/ScheduledTasks/hooks/useScheduleTask"
import { cn } from "@/utils/cn"
import useSuperMagicDropdown from "@/pages/superMagic/components/SuperMagicDropdown/useSuperMagicDropdown"
import { ScheduledTask } from "@/types/scheduledTask"

import TaskEmptyState from "@/pages/superMagic/components/SiderTask/components/TaskEmptyState"
import MobileScheduledTaskCard from "./MobileScheduledTaskCard"

interface MobileScheduledTasksPanelProps {
	selectWorkspaceId?: string
	selectProjectId?: string
	selectTopicId?: string
	className?: string
}

type TaskItemData = ScheduledTask.Task

/** Renders the project-scoped scheduled-task list and delegates business actions to the shared hook. */
export default function MobileScheduledTasksPanel({
	selectWorkspaceId,
	selectProjectId,
	selectTopicId,
	className,
}: MobileScheduledTasksPanelProps) {
	const { t } = useTranslation("super")
	const taskListRef = useRef<HTMLDivElement>(null)
	const contextReady = Boolean(selectWorkspaceId && selectProjectId)

	const {
		tasks,
		total,
		params,
		setParams,
		run,
		loading,
		hasFetched,
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
	} = useScheduleTask({
		options: {
			page_size: 20,
			workspace_id: selectWorkspaceId,
			project_id: selectProjectId,
		},
		isScroll: true,
		siderTaskRef: taskListRef,
	})

	// Show a spinner until the first request settles; empty must not flash during that window.
	const isInitialLoading = contextReady && !hasFetched
	const isEmpty = contextReady && hasFetched && tasks.length === 0
	const pullToRefreshStretchClassName =
		"[&_.adm-pull-to-refresh]:flex [&_.adm-pull-to-refresh]:h-full [&_.adm-pull-to-refresh]:min-h-0 [&_.adm-pull-to-refresh]:flex-col [&_.adm-pull-to-refresh-content]:flex [&_.adm-pull-to-refresh-content]:min-h-0 [&_.adm-pull-to-refresh-content]:flex-1 [&_.adm-pull-to-refresh-content]:flex-col"

	/** Reloads the first page whenever the project context changes. */
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

	/** Reloads page 1 from pull-to-refresh without unmounting the current list. */
	const handleRefresh = useMemoizedFn(async () => {
		if (!contextReady) return

		const nextParams = {
			...params,
			page: 1,
			workspace_id: selectWorkspaceId,
			project_id: selectProjectId,
		}
		setParams(nextParams)
		await run(nextParams)
	})

	/** Loads the next page when more tasks are available. */
	const loadMore = () => {
		if (loading || tasks.length >= total) return

		const nextParams = { ...params, page: params.page + 1 }
		setParams(nextParams)
		run(nextParams)
	}

	/** Triggers pagination near the bottom edge of the mobile scroll area. */
	const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
		if (scrollHeight - scrollTop <= clientHeight * 1.1) loadMore()
	}

	/** Opens the shared task form with the current project context prefilled. */
	const handleCreateTask = () => {
		if (!contextReady) return

		openCreateModal(onSaveTask, {
			workspace_id: selectWorkspaceId,
			project_id: selectProjectId,
			topic_id: selectTopicId,
		})
	}

	const { dropdownContent, delegateProps } = useSuperMagicDropdown<TaskItemData>({
		width: 180,
		getMenuItems: (task) => {
			const menuItems = [
				{
					key: "run",
					label: t("scheduleTask.runTask"),
					icon: <CirclePlay className="size-4" />,
					onClick: () => runNow(task),
				},
			]

			menuItems.push(
				task.enabled === 1
					? {
							key: "pause",
							label: t("scheduleTask.pauseTask"),
							icon: <Pause className="size-4" />,
							onClick: () => onStatusChange(task, false),
						}
					: {
							key: "play",
							label: t("scheduleTask.playTask"),
							icon: <Play className="size-4" />,
							onClick: () => onStatusChange(task, true),
						},
			)

			menuItems.push(
				{ type: "divider" as const },
				{
					key: "config",
					label: t("scheduleTask.configTask"),
					icon: <Settings2 className="size-4" />,
					onClick: () => onTaskEdit(task),
					onMouseEnter: () => preloadDeleteDangerModal(),
				},
				{
					key: "runningRecord",
					label: t("scheduleTask.runningRecord"),
					icon: <List className="size-4" />,
					onClick: () => onTaskRunningRecord(task),
					onMouseEnter: () => preloadRunningRecordModal(),
				},
				{ type: "divider" as const },
				{
					key: "delete",
					danger: true,
					label: t("scheduleTask.deleteTask"),
					icon: <Trash2 className="size-4" />,
					onClick: () => {
						// Let the mobile ActionDrawer finish closing before opening confirmation.
						window.setTimeout(() => void onTaskDelete(task), 0)
					},
				},
			)

			return menuItems
		},
	})

	return (
		<div className={cn("relative flex h-full min-h-0 flex-col", className)}>
			<ScrollEdgeFadeContainer
				fadeColor="mobile-background"
				className="min-h-0 flex-1"
				scrollClassName="scrollbar-y-thin px-3 pt-3"
				scrollPortRef={taskListRef}
				onScroll={handleScroll}
				contentDeps={[
					tasks.length,
					total,
					loading,
					hasFetched,
					isEmpty,
					isInitialLoading,
					contextReady,
					selectProjectId,
				]}
			>
				<MagicPullToRefresh
					embedInParentScroll
					onRefresh={handleRefresh}
					showSuccessMessage={false}
					disabled={!contextReady}
					containerClassName={cn(
						"relative min-h-0 w-full flex-1",
						(isEmpty || isInitialLoading) &&
							cn("!overflow-hidden", pullToRefreshStretchClassName),
					)}
				>
					<div
						className={cn(
							"flex min-h-full flex-col gap-3",
							// Keep the last card clear of the FAB after scrolling to the bottom.
							tasks.length > 0 && "pb-24",
						)}
						data-testid="mobile-scheduled-tasks-list"
					>
						{!contextReady ? (
							<div
								className="flex min-h-full items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground"
								data-testid="mobile-scheduled-tasks-context-loading"
							>
								{t("scheduleTask.contextLoading")}
							</div>
						) : isInitialLoading ? (
							<div
								className="flex min-h-full items-center justify-center"
								data-testid="mobile-scheduled-tasks-loading"
							>
								<Spinner size={24} className="animate-spin" />
							</div>
						) : tasks.length > 0 ? (
							tasks.map((task) => (
								<MobileScheduledTaskCard
									key={task.id}
									data={task}
									onClick={() => onTaskEdit(task)}
									onSwitchChange={(enabled) => onStatusChange(task, enabled)}
									{...delegateProps}
								/>
							))
						) : (
							<div
								className="flex min-h-full items-center justify-center"
								data-testid="mobile-scheduled-tasks-empty"
							>
								<TaskEmptyState onCreateTask={handleCreateTask} />
							</div>
						)}
					</div>
				</MagicPullToRefresh>
			</ScrollEdgeFadeContainer>

			{/* Match the project-detail files FAB: 48px black circle, 22px plus, no extra shadow. */}
			<Button
				type="button"
				size="icon"
				className="absolute bottom-4 right-5 z-30 h-12 w-12 rounded-full bg-foreground text-background hover:bg-foreground/90"
				onClick={handleCreateTask}
				disabled={!contextReady}
				aria-label={t("scheduleTask.createTask")}
				data-testid="mobile-scheduled-tasks-create-button"
			>
				<Plus className="size-[22px]" strokeWidth={2} aria-hidden="true" />
			</Button>

			{content}
			{dropdownContent}
		</div>
	)
}
