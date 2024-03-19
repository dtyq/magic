import { useTranslation } from "react-i18next"
import type { TableProps } from "antd"
import { Flex, Avatar } from "antd"
import { useBoolean, useMemoizedFn } from "ahooks"
import EmptyIcon from "@/opensource/assets/logos/empty.svg"
import MagicModal from "@/opensource/components/base/MagicModal"
import type { Bot } from "@/opensource/types/bot"
import { useEffect, useState, useMemo } from "react"
import { createStyles } from "antd-style"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import MagicTable from "@/opensource/components/base/MagicTable"
import { BotApi } from "@/opensource/apis"
import { ApprovalStatusMap, Approvaltatus, EntrepriseStatusMap } from "../../constants"

type VersionProps = {
	open: boolean
	agentId?: string
	close?: () => void
}

const useStyles = createStyles(({ css }) => {
	return {
		wrapper: css`
			flex: 1;
			padding: 0 20px;
			height: 500px;
			overflow-y: auto;
			::-webkit-scrollbar {
				display: none;
			}
		`,
		isEmptyList: css`
			display: flex;
			justify-content: center;
			align-items: center;
		`,
	}
})

function PublishAgent({ agentId, open, close }: VersionProps) {
	const { t } = useTranslation("interface")

	const { styles, cx } = useStyles()

	const [isLoading, { setTrue, setFalse }] = useBoolean(false)

	const [versionList, setVersionList] = useState<Bot.BotVersion[]>([])

	const getVersionList = useMemoizedFn(async () => {
		setTrue()
		const res = await BotApi.getBotVersionList(agentId as string)
		setVersionList(res)
		setFalse()
	})

	useEffect(() => {
		if (open && agentId) {
			getVersionList()
		}
	}, [agentId, getVersionList, open])

	const columns = useMemo<TableProps<Bot.BotVersion>["columns"]>(() => {
		return [
			{
				dataIndex: "version_number",
				title: t("explore.form.version"),
			},
			{
				dataIndex: "version_description",
				title: t("explore.form.publishRecord"),
			},
			{
				dataIndex: "release_scope",
				title: t("explore.form.publishScope"),
				render: (_, record) => {
					return (
						<div>
							{record.release_scope === 1
								? t("agent.organization")
								: t("explore.assistantMarket")}
						</div>
					)
				},
			},
			{
				dataIndex: "approval_status",
				title: t("flow.apiKey.status"),
				render: (_, { approval_status, enterprise_release_status }) => {
					return approval_status !== Approvaltatus.pass
						? ApprovalStatusMap[approval_status]
						: EntrepriseStatusMap[enterprise_release_status]
				},
			},
			{
				dataIndex: "created_at",
				title: t("explore.form.submitTime"),
			},
			{
				dataIndex: "updated_at",
				title: t("explore.form.passTime"),
			},
		]
	}, [t])

	return (
		<MagicModal
			width={1000}
			title={t("agent.versionManagement")}
			open={open}
			footer={null}
			onCancel={close}
			closable
			centered
		>
			<MagicSpin section spinning={isLoading}>
				<div
					className={cx(styles.wrapper, {
						[styles.isEmptyList]: versionList.length === 0,
					})}
				>
					{!isLoading && versionList.length === 0 && (
						<Flex vertical align="center" justify="center">
							<Avatar src={EmptyIcon} size={140} />
						</Flex>
					)}
					{versionList.length !== 0 && (
						<MagicTable<Bot.BotVersion> columns={columns} dataSource={versionList} />
					)}
				</div>
			</MagicSpin>
		</MagicModal>
	)
}

export default PublishAgent
