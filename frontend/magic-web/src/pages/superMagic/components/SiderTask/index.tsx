import {
	IconDatabaseCog,
	IconPlayerPause,
	IconPlayerPlay,
	IconTrash,
	IconPlus,
	IconList,
} from "@tabler/icons-react"
import { ActionButton } from "../Detail/components/CommonHeader/components"
import MagicIcon from "@/components/base/MagicIcon"
import SiderTaskItem from "./SiderTaskItem"
import { TaskEmptyState } from "./components"
import useSuperMagicDropdown from "../SuperMagicDropdown/useSuperMagicDropdown"
import { useTranslation } from "react-i18next"
import { ScheduledTask } from "@/types/scheduledTask"
import { useScheduleTask } from "@/components/business/AccountSetting/pages/ScheduledTasks/hooks/useScheduleTask"
import { useUpdateEffect } from "ahooks"
import { useRef } from "react"

type TaskItemData = ScheduledTask.Task

interface SiderTaskProps {
	selectWorkspaceId?: string
	selectProjectId?: string
	selectTopicId?: string
}

export default function SiderTask({
	selectWorkspaceId,
	selectProjectId,
	selectTopicId,
}: SiderTaskProps) {
	const { t } = useTranslation("super")
	const siderTaskRef = useRef<HTMLDivElement>(null)

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
	} = useScheduleTask({
		options: {
			workspace_id: selectWorkspaceId,
			project_id: selectProjectId,
		},
		isScroll: true,
		siderTaskRef,
	})

	useUpdateEffect(() => {
		const newParams = {
			...params,
			page: 1,
			workspace_id: selectWorkspaceId,
			project_id: selectProjectId,
		}
		setParams(newParams)
		run(newParams)
	}, [selectWorkspaceId, selectProjectId])

	// 滚动加载更多
	const loadMore = () => {
		if (loading || tasks.length >= total) return

		const p = {
			...params,
			page: params.page + 1,
		}
		setParams(p)
		run(p)
	}

	// 处理滚动事件
	const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
		if (scrollHeight - scrollTop <= clientHeight * 1.1) {
			loadMore()
		}
	}

	const { dropdownContent, delegateProps } = useSuperMagicDropdown<TaskItemData>({
		width: 180,
		getMenuItems: (taskItem) => {
			const menuItems = []

			if (taskItem.enabled === 1) {
				menuItems.push({
					key: "pause",
					label: t("scheduleTask.pauseTask"),
					icon: <MagicIcon component={IconPlayerPause} stroke={2} size={18} />,
					onClick: () => onStatusChange(taskItem, false),
				})
			} else {
				menuItems.push({
					key: "play",
					label: t("scheduleTask.playTask"),
					icon: <MagicIcon component={IconPlayerPlay} stroke={2} size={18} />,
					onClick: () => onStatusChange(taskItem, true),
				})
			}

			menuItems.push(
				{ type: "divider" as const },
				{
					key: "config",
					label: t("scheduleTask.configTask"),
					icon: <MagicIcon component={IconDatabaseCog} stroke={2} size={18} />,
					onClick: () => onTaskEdit(taskItem),
					onMouseEnter: () => preloadDeleteDangerModal(),
				},
				{
					key: "runningRecord",
					label: t("scheduleTask.runningRecord"),
					icon: <MagicIcon component={IconList} stroke={2} size={18} />,
					onClick: () => onTaskRunningRecord(taskItem),
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
					onClick: () => onTaskDelete(taskItem),
				},
			)

			return menuItems
		},
	})

	return (
		<div className="flex h-full flex-col gap-0.5">
			<div className="flex h-8 shrink-0 items-center justify-between border-gray-200 py-1.5 pl-4 pr-2">
				<p className="text-xs font-semibold leading-4 text-foreground">
					{t("scheduleTask.title")}
				</p>
				<ActionButton
					onClick={() =>
						openCreateModal(onSaveTask, {
							workspace_id: selectWorkspaceId,
							project_id: selectProjectId,
							topic_id: selectTopicId,
						})
					}
					icon={<IconPlus size={16} />}
					className="rounded stroke-gray-500"
					textClassName="text-gray-700"
					// text={t("topicFiles.createMenu")}
					title={t("topicFiles.createMenu")}
					stroke={2}
					gap={2}
					style={{
						height: "18px",
						borderRadius: "4px",
						padding: "1px 4px",
					}}
				/>
			</div>
			<div
				className="flex h-[calc(100%-32px)] flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 pb-2"
				onScroll={onScroll}
				ref={siderTaskRef}
			>
				{tasks.length ? (
					tasks.map((item) => (
						<SiderTaskItem
							key={item.id}
							data={item}
							onSwitchChange={(enabled) => onStatusChange(item, enabled)}
							{...delegateProps}
						/>
					))
				) : (
					<TaskEmptyState
						onCreateTask={() =>
							openCreateModal(onSaveTask, {
								workspace_id: selectWorkspaceId,
								project_id: selectProjectId,
								topic_id: selectTopicId,
							})
						}
					/>
				)}
			</div>
			{content}
			{dropdownContent}
		</div>
	)
}
