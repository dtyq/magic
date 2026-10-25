import { clipboard } from "@/utils/clipboard-helpers"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	IconX,
	IconPencil,
	IconTrash,
	IconRefresh,
	IconCopy,
	IconEye,
	IconEyeOff,
} from "@tabler/icons-react"
import { Button, Table, Switch, Tooltip, Popconfirm } from "antd"
import { type AgentCommonModalChildrenProps, openAgentCommonModal } from "../../AgentCommonModal"
import { useMemo, useState } from "react"
import { useMemoizedFn, useRequest, useThrottleEffect } from "ahooks"
import { FlowApi } from "@/apis"
import { ColumnsType } from "antd/es/table/interface"
import AuthorizationToolsForm from "./AuthorizationToolsForm"
import { useTranslation } from "react-i18next"
import { env } from "@/utils/env"
import MagicIcon from "@/components/base/MagicIcon"

interface AgentAuthorizationTools extends AgentCommonModalChildrenProps {
	id?: string
}

function ToggleCell(props: { value: string }) {
	const [hidden, setHidden] = useState(true)

	if (!props?.value) {
		return <div />
	}
	return (
		<div className="flex items-center gap-2">
			<span className="text-center leading-5">
				{hidden ? Array.from({ length: props?.value.length }, () => "*") : props?.value}
			</span>
			<div className="inline-flex size-5 cursor-pointer">
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
						<div className="flex gap-2.5">
							<Tooltip title={t("common.auth.editKey")}>
								<div
									className="flex size-6 cursor-pointer items-center justify-center rounded-[4px] text-foreground/80 hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]"
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
									<div className="flex size-6 cursor-pointer items-center justify-center rounded-[4px] text-foreground/80 hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]">
										<MagicIcon component={IconRefresh} size={18} />
									</div>
								</Tooltip>
							</Popconfirm>
							<Tooltip title={t("common.auth.copyCurl")}>
								<div
									className="flex size-6 cursor-pointer items-center justify-center rounded-[4px] text-foreground/80 hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]"
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
									<div className="flex size-6 cursor-pointer items-center justify-center rounded-[4px] text-foreground/80 hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]">
										<MagicIcon component={IconTrash} size={18} />
									</div>
								</Tooltip>
							</Popconfirm>
						</div>
					)
				},
			},
		]
	}, [])

	const dataSource = data?.list || []
	return (
		<div className="w-full overflow-hidden rounded-[12px]">
			<div className="flex w-full items-center justify-between gap-2.5 border-b border-border px-5 py-2.5 text-base font-semibold not-italic leading-[22px] text-foreground/80 backdrop-blur-[12px]">
				{t("common.auth.title")}
				<div
					className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] transition-all duration-100 ease-linear hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]"
					onClick={onClose}
				>
					<IconX size={24} />
				</div>
			</div>
			<div className="flex max-h-[60vh] w-full flex-col gap-2.5 p-2.5">
				<div className="flex h-10 w-full items-center justify-between">
					<div className="flex items-center">
						<span className="text-sm font-normal not-italic leading-5 text-foreground/80">
							{t("common.auth.desc")}
						</span>
					</div>
					<Button
						className="dark:!bg-primary dark:!text-primary-foreground dark:hover:!bg-primary/90"
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
				</div>
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
