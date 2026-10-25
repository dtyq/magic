import { ScheduledTaskApi } from "@/apis"
import ScheduledTaskDialog from "./ScheduledTaskDialog"
import { PageParams } from "@/types/other"
import { ScheduledTask } from "@/types/scheduledTask"
import { useMount, useRequest } from "ahooks"
import { Flex } from "antd"
import { IconExternalLink, IconLoader } from "@tabler/icons-react"
import { colorUsages } from "@/providers/ThemeProvider/colors"
import dayjs from "@/infrastructure/vendors/dayjs"
import { SHARE_WORKSPACE_ID } from "@/pages/superMagic/constants"
import { StatusTag } from "@dtyq/magic-admin/components"
import InfiniteList from "@/components/base/InfiniteList"
import { useStyles } from "../styles"
import { useTranslation } from "react-i18next"
import { useState, type ReactNode } from "react"
import { generateProjectTopicUrl } from "@/pages/superMagic/utils/project"
import { useIsMobile } from "@/hooks/useIsMobile"

interface RunningRecordProps {
	taskId: string
	onClose?: () => void
}

interface RecordRowProps {
	item: ScheduledTask.RunningRecord
	workspacePath: string
	statusNode: ReactNode
	workspaceUrl?: string
}

/** Builds the workspace / project / topic breadcrumb shown on each running record. */
function buildWorkspacePath(
	item: ScheduledTask.RunningRecord,
	tSuper: (key: string) => string,
): string {
	const workspaceName =
		item.workspace_id && item.workspace_id !== "0"
			? (item.workspace_id === SHARE_WORKSPACE_ID
					? tSuper("workspace.teamSharedWorkspace")
					: item.workspace_name) || tSuper("workspace.unnamedWorkspace")
			: tSuper("workspace.unnamedWorkspace")

	return [workspaceName, item.project_name, item.topic_name].filter(Boolean).join(" / ")
}

interface PathContainerProps {
	className: string
	href?: string
	layout: "chip" | "bar"
	children: ReactNode
}

/**
 * Renders a real link only when a target exists. Records without a valid
 * project have no URL, so they fall back to a static span (no pointer cursor).
 */
function PathContainer({ className, href, layout, children }: PathContainerProps) {
	if (!href)
		return (
			<span className={className} data-testid="running-record-path" data-path-layout={layout}>
				{children}
			</span>
		)

	return (
		<a
			className={className}
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			data-testid="running-record-path"
			data-path-layout={layout}
		>
			{children}
		</a>
	)
}

/** Renders the workspace breadcrumb; it opens the related project/topic when a URL exists. */
function WorkspacePathTag({
	workspacePath,
	workspaceUrl,
}: Pick<RecordRowProps, "workspacePath" | "workspaceUrl">) {
	const { styles } = useStyles()

	return (
		<PathContainer className={styles.tag} href={workspaceUrl} layout="chip">
			<span className={styles.ellipsisText}>{workspacePath}</span>
			{workspaceUrl && (
				<span className={styles.tagIcon}>
					<IconExternalLink size={14} color={colorUsages.text[2]} />
				</span>
			)}
		</PathContainer>
	)
}

/** Full-width mobile path bar that keeps the breadcrumb on one truncated line. */
function MobileWorkspacePath({
	workspacePath,
	workspaceUrl,
}: Pick<RecordRowProps, "workspacePath" | "workspaceUrl">) {
	const { styles } = useStyles()

	return (
		<PathContainer className={styles.mobilePath} href={workspaceUrl} layout="bar">
			<span className={styles.mobilePathText}>{workspacePath}</span>
			{workspaceUrl && (
				<span className={styles.tagIcon}>
					<IconExternalLink size={16} color={colorUsages.text[2]} />
				</span>
			)}
		</PathContainer>
	)
}

/** Desktop table row: time, info, and status stay in dedicated columns without overlapping. */
function DesktopRecordRow({ item, workspacePath, statusNode, workspaceUrl }: RecordRowProps) {
	const { styles } = useStyles()

	return (
		<Flex
			className={styles.itemWrapper}
			align="center"
			data-testid="running-record-item"
			data-layout="table"
		>
			<div className={styles.timeCol}>
				{dayjs(item.executed_at).format("YYYY/MM/DD HH:mm")}
			</div>
			<Flex vertical gap={4} className={styles.infoCol}>
				<span className={styles.taskName}>{item.task_name}</span>
				<WorkspacePathTag workspacePath={workspacePath} workspaceUrl={workspaceUrl} />
			</Flex>
			<div className={styles.resultCol}>{statusNode}</div>
		</Flex>
	)
}

/**
 * Mobile stacked row: time and status share the first line, then title and path
 * occupy full width so the status badge cannot overlap the breadcrumb.
 */
function MobileRecordRow({ item, workspacePath, statusNode, workspaceUrl }: RecordRowProps) {
	const { styles } = useStyles()

	return (
		<div
			className={styles.mobileItemWrapper}
			data-testid="running-record-item"
			data-layout="stacked"
		>
			<div className={styles.mobileMetaRow}>
				<span className={styles.mobileTime}>
					{dayjs(item.executed_at).format("YYYY/MM/DD HH:mm")}
				</span>
				<div className={styles.mobileStatus}>{statusNode}</div>
			</div>
			<span className={styles.mobileTaskName}>{item.task_name}</span>
			<MobileWorkspacePath workspacePath={workspacePath} workspaceUrl={workspaceUrl} />
		</div>
	)
}

function RunningRecordModal({ taskId, onClose }: RunningRecordProps) {
	const { t } = useTranslation("interface")
	const { t: tSuper } = useTranslation("super")
	const { styles } = useStyles()
	const isMobile = useIsMobile()
	const [open, setOpen] = useState(true)
	const [total, setTotal] = useState(30)
	const [list, setList] = useState<ScheduledTask.RunningRecord[]>([])
	const [params, setParams] = useState<Required<PageParams>>({
		page: 1,
		page_size: 10,
	})

	function onCancel() {
		setOpen(false)
		onClose?.()
	}

	const { runAsync: getData, loading } = useRequest(
		ScheduledTaskApi.getScheduledTaskRunningRecord,
		{
			manual: true,
			onSuccess: (response) => {
				setTotal(response.total)
				if (params.page === 1) setList(response.list)
				else setList((prevList) => [...prevList, ...response.list])
			},
		},
	)

	useMount(() => {
		getData(taskId, params)
	})

	function loadMore() {
		if (loading || list.length >= total) return
		const nextParams = {
			...params,
			page: params.page + 1,
		}
		setParams(nextParams)
		getData(taskId, nextParams)
	}

	function renderStatus(status: ScheduledTask.RunningRecordStatus) {
		switch (status) {
			case ScheduledTask.RunningRecordStatus.Success:
				return (
					<StatusTag color="success" className={styles.statusTag}>
						{t("accountPanel.timedTasks.success")}
					</StatusTag>
				)
			case ScheduledTask.RunningRecordStatus.Failed:
				return (
					<StatusTag color="error" className={styles.statusTag}>
						{t("accountPanel.timedTasks.failed")}
					</StatusTag>
				)
			default:
				return (
					<StatusTag color="processing" className={styles.statusTag}>
						{t("accountPanel.timedTasks.running")}
					</StatusTag>
				)
		}
	}

	return (
		<ScheduledTaskDialog
			open={open}
			onClose={onCancel}
			title={t("accountPanel.timedTasks.runningRecord")}
			records
		>
			<Flex vertical>
				{isMobile ? null : (
					<Flex
						className={styles.headerWrapper}
						align="center"
						data-testid="running-record-header"
					>
						<span className={styles.timeCol}>
							{t("accountPanel.timedTasks.runningTime")}
						</span>
						<span className={styles.infoCol}>
							{t("accountPanel.timedTasks.runningInfo")}
						</span>
						<span className={styles.resultCol}>
							{t("accountPanel.timedTasks.runningResult")}
						</span>
					</Flex>
				)}
				{/* Reserve the same viewport before and after the initial request completes. */}
				<div className={isMobile ? styles.mobileListWrapper : styles.listWrapper}>
					<InfiniteList<ScheduledTask.RunningRecord>
						list={list}
						hasMore={list.length < total}
						isLoading={loading && list.length === 0}
						grid={{ column: 1 }}
						loadMore={loadMore}
						itemClassName={isMobile ? styles.mobileListItem : styles.listItem}
						loadingComponent={
							<Flex justify="center" align="center" gap={4} className={styles.footer}>
								<IconLoader size={20} />
								<span>{t("accountPanel.timedTasks.loading")}...</span>
							</Flex>
						}
						endMessageComponent={
							<Flex
								justify="center"
								align="center"
								gap={10}
								className={styles.footer}
							>
								<span>——————</span>
								<span>{t("accountPanel.timedTasks.noMore")}</span>
								<span>——————</span>
							</Flex>
						}
						renderItem={(item) => {
							const workspacePath = buildWorkspacePath(item, tSuper)
							const rowProps: RecordRowProps = {
								item,
								workspacePath,
								statusNode: renderStatus(item.status),
								workspaceUrl:
									item.project_id && item.project_id !== "0"
										? generateProjectTopicUrl(
												item.project_id,
												item.topic_id && item.topic_id !== "0"
													? item.topic_id
													: null,
											)
										: undefined,
							}

							return isMobile ? (
								<MobileRecordRow
									key={`${item.task_name}-${workspacePath}`}
									{...rowProps}
								/>
							) : (
								<DesktopRecordRow
									key={`${item.task_name}-${workspacePath}`}
									{...rowProps}
								/>
							)
						}}
					/>
				</div>
			</Flex>
		</ScheduledTaskDialog>
	)
}

export default RunningRecordModal
