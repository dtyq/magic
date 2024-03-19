import { ScheduledTaskApi } from "@/opensource/apis"
import MagicModal, { MagicModalProps } from "@/opensource/components/base/MagicModal"
import { PageParams } from "@/opensource/types/other"
import { ScheduledTask } from "@/opensource/types/scheduledTask"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { Flex } from "antd"
import { IconExternalLink, IconLoader } from "@tabler/icons-react"
import { colorUsages } from "@/opensource/providers/ThemeProvider/colors"
import dayjs from "@/opensource/lib/dayjs"
import { SHARE_WORKSPACE_ID } from "@/opensource/pages/superMagic/constants"
import { StatusTag } from "@dtyq/magic-admin/components"
import InfiniteList from "@/opensource/components/base/InfiniteList"
import { useModalStyles, useStyles } from "../styles"
import { useTranslation } from "react-i18next"
import { useState } from "react"
import { generateProjectTopicUrl } from "@/opensource/pages/superMagic/utils/project"

interface RunningRecordProps extends MagicModalProps {
	taskId: string
	onClose?: () => void
}

function RunningRecordModal({ taskId, onClose, ...props }: RunningRecordProps) {
	const { t } = useTranslation("interface")
	const { t: tSuper } = useTranslation("super")
	const { styles } = useStyles()
	const { styles: modalStyles } = useModalStyles({ runningRecord: true })
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

	const goToWorkspace = useMemoizedFn((record: ScheduledTask.RunningRecord) => {
		const projectId = record.project_id && record.project_id !== "0" ? record.project_id : null
		const topicId = record.topic_id && record.topic_id !== "0" ? record.topic_id : null

		if (!projectId) return

		const url = generateProjectTopicUrl(projectId, topicId)
		window.open(url, "_blank")
	})

	useMount(() => {
		getData(taskId, params)
	})

	function loadMore() {
		if (list.length >= total) return
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
		<MagicModal
			className={modalStyles.modal}
			title={t("accountPanel.timedTasks.runningRecord")}
			centered
			open={open}
			onCancel={onCancel}
			width={700}
			height={500}
			footer={null}
			destroyOnClose
			{...props}
		>
			<Flex vertical>
				<Flex className={styles.headerWrapper} align="center">
					<span style={{ width: "25%" }}>{t("accountPanel.timedTasks.runningTime")}</span>
					<span style={{ width: "60%" }}>{t("accountPanel.timedTasks.runningInfo")}</span>
					<span style={{ width: "15%" }}>
						{t("accountPanel.timedTasks.runningResult")}
					</span>
				</Flex>
				<InfiniteList<ScheduledTask.RunningRecord>
					list={list}
					hasMore={list.length < total}
					isLoading={loading}
					grid={{ column: 1 }}
					loadMore={loadMore}
					itemClassName={styles.listItem}
					wrapperClassName={styles.listWrapper}
					loadingComponent={
						<Flex justify="center" align="center" gap={4} className={styles.footer}>
							<IconLoader size={20} />
							<span>{t("accountPanel.timedTasks.loading")}...</span>
						</Flex>
					}
					endMessageComponent={
						<Flex justify="center" align="center" gap={10} className={styles.footer}>
							<span>——————</span>
							<span>{t("accountPanel.timedTasks.noMore")}</span>
							<span>——————</span>
						</Flex>
					}
					renderItem={(item) => {
						const workspace = [
							item.workspace_id && item.workspace_id !== "0"
								? (item.workspace_id === SHARE_WORKSPACE_ID
										? tSuper("workspace.teamSharedWorkspace")
										: item.workspace_name) ||
									tSuper("workspace.unnamedWorkspace")
								: tSuper("workspace.unnamedWorkspace"),
							item.project_name,
							item.topic_name,
						]
							.filter(Boolean)
							.join(" / ")

						return (
							<Flex
								className={styles.itemWrapper}
								justify="space-between"
								align="center"
								gap={16}
								key={`${item.task_name}-${workspace}`}
							>
								<div style={{ width: "25%" }}>
									{dayjs(item.executed_at).format("YYYY/MM/DD HH:mm")}
								</div>
								<Flex vertical gap={4} style={{ width: "60%" }}>
									<span>{item.task_name}</span>
									<Flex
										gap={4}
										align="center"
										className={styles.tag}
										onClick={() => goToWorkspace(item)}
									>
										<span className={styles.ellipsisText}>{workspace}</span>
										<IconExternalLink size={14} color={colorUsages.text[2]} />
									</Flex>
								</Flex>
								<div style={{ width: "15%" }}>{renderStatus(item.status)}</div>
							</Flex>
						)
					}}
				/>
			</Flex>
		</MagicModal>
	)
}

export default RunningRecordModal
