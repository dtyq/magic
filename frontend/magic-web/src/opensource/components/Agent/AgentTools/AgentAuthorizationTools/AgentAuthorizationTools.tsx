import { useStyles } from "./styles"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import {
	IconX,
	IconPencil,
	IconTrash,
	IconRefresh,
	IconCopy,
	IconEye,
	IconEyeOff,
} from "@tabler/icons-react"
import { Flex, Button, Table, Switch, Tooltip, Popconfirm } from "antd"
import { type AgentCommonModalChildrenProps, openAgentCommonModal } from "../../AgentCommonModal"
import { useMemo, useState } from "react"
import { useMemoizedFn, useRequest, useThrottleEffect } from "ahooks"
import { FlowApi } from "@/opensource/apis"
import { ColumnsType } from "antd/es/table/interface"
import AuthorizationToolsForm from "./AuthorizationToolsForm"
import { useTranslation } from "react-i18next"
import { env } from "@/opensource/utils/env"
import MagicIcon from "@/opensource/components/base/MagicIcon"

interface AgentAuthorizationTools extends AgentCommonModalChildrenProps {
	id?: string
}

function ToggleCell(props: { value: string }) {
	const { styles } = useStyles()

	const [hidden, setHidden] = useState(true)

	if (!props?.value) {
		return <div />
	}
	return (
		<div className={styles.toggleCell}>
			<span>
				{hidden ? Array.from({ length: props?.value.length }, () => "*") : props?.value}
			</span>
			<div>
				{hidden ? (
					<IconEye size={20} strokeWidth={1.5} onClick={() => setHidden(false)} />
				) : (
					<IconEyeOff size={20} strokeWidth={1.5} onClick={() => setHidden(true)} />
				)}
			</div>
		</div>
	)
}

export default function AgentAuthorizationTools(props: AgentAuthorizationTools) {
	const { id, onClose } = props

	const { styles } = useStyles()
	const { t } = useTranslation("agent")

	const { data, run, loading, refresh } = useRequest(
		(id) => FlowApi.getApiKeyListV1({ rel_code: id, rel_type: 2 }),
		{
			manual: true,
		},
	)

	useThrottleEffect(
		() => {
			if (id) {
				run(id)
			}
		},
		[id],
		{ wait: 500, leading: false },
	)

	const triggerAgentToolsEdit = useMemoizedFn(async (record) => {
		openAgentCommonModal({
			width: 460,
			footer: null,
			closable: false,
			children: (
				<AuthorizationToolsForm id={record?.id} mcpCode={id} onSuccessCallback={refresh} />
			),
		})
	})

	const triggerAgentToolsEnable = useMemoizedFn(async (record) => {
		await FlowApi.saveApiKeyV1({
			...record,
			enabled: !record.enabled,
		})
		magicToast.success(
			record.enabled
				? t("mcp.page.switch.disable", { name: record?.name })
				: t("mcp.page.switch.enable", { name: record?.name }),
		)
		refresh()
	})

	const triggerAgentToolsRebuild = useMemoizedFn(async (record) => {
		await FlowApi.rebuildApiKeyV1(record?.id)
		magicToast.success(t("common.auth.resetSuccess"))
		refresh()
	})

	const triggerAgentToolsCopy = useMemoizedFn(async (record) => {
		const sseURL = `${env("MAGIC_SERVICE_BASE_URL")}/api/v1/mcp/sse/${id}?key=${
			record.secret_key
		}`
		await clipboard.writeText(sseURL)
		magicToast.success(t("common.auth.copySuccess"))
	})

	const triggerAgentToolsDelete = useMemoizedFn(async (record) => {
		await FlowApi.deleteApiKeyV1(record?.id)
		refresh()
		magicToast.success(t("common.auth.deleteSuccess"))
	})

	const columns = useMemo<ColumnsType>(() => {
		return [
			{
				title: t("common.auth.name"),
				key: "name",
				dataIndex: "name",
			},
			{
				title: t("common.auth.secret"),
				width: 300,
				key: "secret_key",
				dataIndex: "secret_key",
				render(value) {
					return <ToggleCell value={value} />
				},
			},
			{
				title: t("common.auth.status"),
				key: "enabled",
				dataIndex: "enabled",
				render(value, record) {
					return (
						<div onClick={() => triggerAgentToolsEnable(record)}>
							<Switch size="small" checked={value} />
						</div>
					)
				},
			},
			{
				title: t("common.auth.lastUsed"),
				key: "last_used",
				dataIndex: "last_used",
			},
			{
				title: t("common.auth.operate"),
				render(_, record) {
					return (
						<Flex gap="10px">
							<Tooltip title={t("common.auth.editKey")}>
								<div
									className={styles.button}
									onClick={() => triggerAgentToolsEdit(record)}
								>
									<MagicIcon component={IconPencil} size={18} />
								</div>
							</Tooltip>
							<Popconfirm
								title={t("common.auth.confirmToReset")}
								onConfirm={() => triggerAgentToolsRebuild(record)}
								okText={t("common.auth.confirm")}
								cancelText={t("common.auth.cancel")}
							>
								<Tooltip title={t("common.auth.resetKey")}>
									<div className={styles.button}>
										<MagicIcon component={IconRefresh} size={18} />
									</div>
								</Tooltip>
							</Popconfirm>
							<Tooltip title={t("common.auth.copyCurl")}>
								<div
									className={styles.button}
									onClick={() => triggerAgentToolsCopy(record)}
								>
									<MagicIcon component={IconCopy} size={18} />
								</div>
							</Tooltip>
							<Popconfirm
								title={t("common.auth.confirmToDelete")}
								onConfirm={() => triggerAgentToolsDelete(record)}
								okText={t("common.auth.confirm")}
								cancelText={t("common.auth.cancel")}
							>
								<Tooltip title={t("common.auth.deleteKey")}>
									<div className={styles.button}>
										<MagicIcon component={IconTrash} size={18} />
									</div>
								</Tooltip>
							</Popconfirm>
						</Flex>
					)
				},
			},
		]
	}, [])

	const dataSource = data?.list || []
	return (
		<div className={styles.layout}>
			<div className={styles.header}>
				{t("common.auth.title")}
				<div className={styles.close} onClick={onClose}>
					<IconX size={24} />
				</div>
			</div>
			<div className={styles.body}>
				<Flex align="center" justify="space-between" className={styles.bodyWrapper}>
					<Flex align="center">
						<span className={styles.bodyTitle}>{t("common.auth.desc")}</span>
					</Flex>
					<Button
						type="primary"
						onClick={() =>
							openAgentCommonModal({
								width: 460,
								footer: null,
								closable: false,
								children: (
									<AuthorizationToolsForm
										mcpCode={id}
										onSuccessCallback={refresh}
									/>
								),
							})
						}
					>
						{t("common.auth.create")}
					</Button>
				</Flex>
				{/*<Flex align="center" className={styles.bodyMenu}>*/}
				{/*	<Form layout="inline">*/}
				{/*		<Form.Item label="接入方式">*/}
				{/*			<Select></Select>*/}
				{/*		</Form.Item>*/}
				{/*		<Form.Item label="状态">*/}
				{/*			<Select></Select>*/}
				{/*		</Form.Item>*/}
				{/*		<Form.Item label="接入方名称">*/}
				{/*			<Input />*/}
				{/*		</Form.Item>*/}
				{/*	</Form>*/}
				{/*</Flex>*/}
				<div>
					<Table
						loading={loading}
						rowKey="id"
						columns={columns}
						dataSource={dataSource}
					/>
				</div>
			</div>
		</div>
	)
}
