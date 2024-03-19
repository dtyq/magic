import { IconEdit, IconExternalLink, IconList, IconPlus, IconTrash } from "@tabler/icons-react"
import { Flex, Segmented, Tooltip, type TableColumnType } from "antd"
import { memo, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import MagicButton from "@/opensource/components/base/MagicButton"
import { MagicSwitch } from "@/opensource/components/base/MagicSwitch"
import MagicTable from "@/opensource/components/base/MagicTable"
import IconNoData from "@/opensource/components/icons/IconNoData"
import { colorUsages } from "@/opensource/providers/ThemeProvider/colors"
import OperateMenu from "@/opensource/pages/flow/components/OperateMenu"
import { SHARE_WORKSPACE_ID } from "@/opensource/pages/superMagic/constants"
import { getSuperIdState } from "@/opensource/pages/superMagic/utils/query"
import { ScheduledTask } from "@/opensource/types/scheduledTask"
import { useScheduleTask } from "./hooks/useScheduleTask"
import { useStyles } from "./styles"
import { TaskStatus } from "./types"
import { formatMultipleSchedules } from "./utils"
import { projectStore } from "@/opensource/pages/superMagic/stores/core"
import { generateProjectTopicUrl } from "@/opensource/pages/superMagic/utils/project"

function ScheduledTasks() {
	const { t } = useTranslation("interface")
	const { t: tSuper } = useTranslation("super")
	const { styles, cx } = useStyles()
	const superIdState = getSuperIdState()
	const {
		tasks,
		total,
		params,
		loading,
		content,
		run,
		onSaveTask,
		onTaskDelete,
		onTaskRunningRecord,
		onTaskEdit,
		onStatusChange,
		openCreateModal,
		setParams,
	} = useScheduleTask({
		options: {
			enabled: 1,
			completed: 0,
		},
	})
	const [statusFilter, setStatusFilter] = useState<TaskStatus>(TaskStatus.InProgress)

	const statusOptions = useMemo(
		() => [
			{ value: TaskStatus.InProgress, label: t("accountPanel.timedTasks.inProgress") },
			{ value: TaskStatus.Completed, label: t("accountPanel.timedTasks.completed") },
			{ value: TaskStatus.Disabled, label: t("accountPanel.timedTasks.disabled") },
		],
		[t],
	)

	const onChangeStatus = useMemoizedFn((value: TaskStatus) => {
		if (value === statusFilter) return
		setStatusFilter(value)
		const nextParams: ScheduledTask.GetListParams = { page: 1, page_size: params.page_size }

		switch (value) {
			case TaskStatus.Disabled:
				nextParams.enabled = 0
				break
			case TaskStatus.Completed:
				nextParams.enabled = 1
				nextParams.completed = 1
				break
			default:
				nextParams.enabled = 1
				nextParams.completed = 0
		}

		setParams(nextParams)
		run(nextParams)
	})

	const handleTaskAction = useMemoizedFn((action: string, info: ScheduledTask.Task) => {
		if (action === "edit") onTaskEdit(info)
		if (action === "delete") onTaskDelete(info)
		if (action === "list") onTaskRunningRecord(info)
	})

	const getDropdownItems = useMemoizedFn((task: ScheduledTask.Task) => {
		return (
			<>
				<MagicButton
					justify="flex-start"
					size="large"
					type="text"
					block
					icon={<IconEdit size={16} />}
					onClick={() => handleTaskAction("edit", task)}
				>
					{t("chat.timedTask.editTask")}
				</MagicButton>
				<MagicButton
					justify="flex-start"
					size="large"
					type="text"
					block
					icon={<IconList size={16} />}
					onClick={() => handleTaskAction("list", task)}
				>
					{t("accountPanel.timedTasks.runningRecord")}
				</MagicButton>
				<MagicButton
					justify="flex-start"
					size="large"
					type="text"
					block
					danger
					icon={<IconTrash size={16} />}
					onClick={() => handleTaskAction("delete", task)}
				>
					{t("chat.timedTask.deleteTask")}
				</MagicButton>
			</>
		)
	})

	const goToWorkspace = useMemoizedFn((record: ScheduledTask.Task) => {
		const projectId = record.project_id && record.project_id !== "0" ? record.project_id : null
		const topicId = record.topic_id && record.topic_id !== "0" ? record.topic_id : null

		if (!projectId) return

		const url = generateProjectTopicUrl(projectId, topicId)
		window.open(url, "_blank")
	})

	const columns: TableColumnType<ScheduledTask.Task>[] = useMemo(
		() => [
			{
				title: t("accountPanel.timedTasks.name"),
				dataIndex: "task_name",
				width: "40%",
				ellipsis: { showTitle: true },
				render: (name, record) => {
					const workspace = [
						record.workspace_id && record.workspace_id !== "0"
							? (record.workspace_id === SHARE_WORKSPACE_ID
									? tSuper("workspace.teamSharedWorkspace")
									: record.workspace_name) || tSuper("workspace.unnamedWorkspace")
							: tSuper("workspace.unnamedWorkspace"),
						record.project_name,
						record.topic_name,
					]
						.filter(Boolean)
						.join(" / ")

					return (
						<Flex vertical gap={4}>
							<Tooltip title={name}>
								<span className={styles.ellipsisText}>{name}</span>
							</Tooltip>
							<Flex
								gap={4}
								align="center"
								className={styles.tag}
								onClick={() => goToWorkspace(record)}
							>
								<span className={styles.ellipsisText}>{workspace}</span>
								<IconExternalLink size={14} color={colorUsages.text[1]} />
							</Flex>
						</Flex>
					)
				},
			},
			{
				title: t("accountPanel.timedTasks.planAt"),
				dataIndex: "time_config",
				width: "30%",
				render: (timeConfig: ScheduledTask.TimeConfig) => {
					const formatted = formatMultipleSchedules(timeConfig, t)
					return (
						<Tooltip title={formatted}>
							<span style={{ fontSize: "12px" }}>
								{formatted.length > 50
									? `${formatted.substring(0, 50)}...`
									: formatted}
							</span>
						</Tooltip>
					)
				},
			},
			{
				title: t("accountPanel.timedTasks.enabled"),
				dataIndex: "enabled",
				width: "20%",
				render: (enabled, record) => (
					<MagicSwitch
						checked={enabled === 1}
						onChange={(checked) => onStatusChange(record, checked)}
						size="small"
					/>
				),
			},
			{
				title: "",
				align: "center",
				width: "10%",
				render: (_, record) => <OperateMenu menuItems={getDropdownItems(record)} useIcon />,
			},
		],
		[
			getDropdownItems,
			goToWorkspace,
			onStatusChange,
			styles.ellipsisText,
			styles.tag,
			t,
			tSuper,
		],
	)

	return (
		<>
			{content}
			<div className={cx(styles.containerWrapper)}>
				<div className={styles.containerHeader}>
					<Segmented<TaskStatus>
						value={statusFilter}
						className={styles.segmented}
						onChange={onChangeStatus}
						options={statusOptions}
					/>
					<MagicButton
						icon={<IconPlus size={16} />}
						type="primary"
						ghost
						onClick={() =>
							openCreateModal(onSaveTask, {
								workspace_id:
									projectStore.selectedProject?.workspace_id ??
									superIdState.workspaceId,
								project_id: superIdState.projectId,
								topic_id: superIdState.topicId,
							})
						}
					>
						{t("chat.timedTask.createTask")}
					</MagicButton>
				</div>
				<div className={styles.containerBody}>
					{!loading && tasks.length === 0 ? (
						<div className={styles.noData}>
							<IconNoData />
							<div className={styles.noDataText}>
								{t("accountPanel.timedTasks.noData")}
							</div>
						</div>
					) : (
						<MagicTable
							loading={loading}
							columns={columns}
							dataSource={tasks}
							rowKey="id"
							className={styles.table}
							scroll={{ y: 370 }}
							pagination={{
								position: ["bottomRight"],
								current: params.page,
								pageSize: params.page_size,
								total,
								showSizeChanger: true,
								onChange: (page, pageSize) => {
									const nextParams =
										pageSize !== params.page_size
											? { ...params, page: 1, page_size: pageSize }
											: { ...params, page }

									setParams(nextParams)
									run(nextParams)
								},
							}}
						/>
					)}
				</div>
			</div>
		</>
	)
}

export default memo(ScheduledTasks)
