import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicModal from "@/opensource/components/base/MagicModal"
import MagicTable from "@/opensource/components/base/MagicTable"
import { Flow, type ApiKey } from "@/types/flow"
import {
	IconCopy,
	IconEdit,
	IconLock,
	IconRefresh,
	IconTrash,
	IconEye,
	IconEyeOff,
} from "@tabler/icons-react"
import { useAsyncEffect, useMemoizedFn, useResetState, useUpdateEffect } from "ahooks"
import type { TableProps } from "antd"
import { Flex, message, Popconfirm, Switch, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { useMemo, useState } from "react"
import { createStyles } from "antd-style"
import type { Conversation } from "@/types/chat/conversation"
import { pick } from "lodash-es"
import { copyToClipboard } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import { FlowApi } from "@/apis"
import { env } from "@/utils/env"
import NewKeyButton from "./NewKeyButton"

const useKeyManagerStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		emptyTips: css`
			font-size: 16px;
			font-weight: 500;
		`,
		iconLock: css`
			border-radius: 8px;
			height: 40px;
			width: 40px;
			padding: 10px;
			background: #f5f5f5;
		`,
		iconEdit: css`
			padding: 6px 12px;
			border-radius: 8px;
			&:hover {
				background-color: ${isDarkMode
					? token.magicColorScales.grey[8]
					: token.magicColorScales.grey[1]};
			}
		`,
		iconTrash: css`
			padding: 6px 12px;
			border-radius: 8px;
			&:hover {
				background-color: ${isDarkMode
					? token.magicColorScales.grey[8]
					: token.magicColorScales.grey[1]};
			}
		`,
		apiKey: css`
			width: 245px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
	}
})

type KeyManagerProps = {
	conversation?: Partial<Conversation> & Pick<Conversation, "id">
	flowId: string
	open: boolean
	onClose: () => void
	isAgent?: boolean
	type?: Flow.ApiKeyType
}

export default function KeyManagerButton({
	conversation,
	flowId,
	open,
	onClose,
	isAgent = false,
	type,
}: KeyManagerProps) {
	const { t } = useTranslation("interface")
	const { t: globalT } = useTranslation()

	const { styles } = useKeyManagerStyles()

	const [apiKeyList, setApiKeyList] = useState([] as ApiKey[])
	const [visibleKeys, setVisibleKeys, resetVisibleKeys] = useResetState<Record<string, boolean>>(
		{},
	)

	// 暂时只在Mcp处理v1版本的Api key新接口，其余接口后端还没处理
	const isMcp = useMemo(() => {
		return type === Flow.ApiKeyType.Mcp
	}, [type])

	const toggleKeyVisibility = useMemoizedFn((keyId: string) => {
		setVisibleKeys((prev) => ({
			...prev,
			[keyId]: !prev[keyId],
		}))
	})

	useUpdateEffect(() => {
		if (!open) {
			resetVisibleKeys()
		}
	}, [open])

	const onListItemChanged = useMemoizedFn(
		(detail: ApiKey, type: "edit" | "create" | "delete" | "rebuild") => {
			if (type === "delete") {
				setApiKeyList((prevApiKeyList) => {
					return prevApiKeyList.filter((apiKey) => apiKey.id !== detail.id)
				})
				return
			}
			if (type === "create") {
				setApiKeyList([detail, ...apiKeyList])
				return
			}
			setApiKeyList((prevApiKeyList) => {
				const updatedList = prevApiKeyList.map((apiKey) => {
					if (detail.id === apiKey.id) {
						return {
							...apiKey,
							...detail,
						}
					}
					return apiKey // 不符合条件的 apiKey 保持不变
				})
				return updatedList // 返回更新后的列表
			})
		},
	)

	const updateKey = useMemoizedFn(
		async (
			params: Pick<
				ApiKey,
				| "id"
				| "name"
				| "description"
				| "conversation_id"
				| "enabled"
				| "rel_code"
				| "rel_type"
			>,
		) => {
			const data = isMcp
				? await FlowApi.saveApiKeyV1({
						...params,
				  })
				: await FlowApi.saveApiKey(
						{
							...params,
						},
						flowId,
				  )

			onListItemChanged(data, "edit")
			message.success(
				`${params.enabled ? t("flow.apiKey.enable") : t("flow.apiKey.disabled")} ${t(
					"flow.apiKey.success",
				)}`,
			)
		},
	)

	const deleteKey = useMemoizedFn(async (key: ApiKey) => {
		if (isMcp) {
			await FlowApi.deleteApiKeyV1(key.id)
		} else {
			await FlowApi.deleteApiKey(key.id, flowId)
		}
		message.success(`${t("flow.apiKey.deleteKey")} ${t("flow.apiKey.success")}`)
		onListItemChanged(key, "delete")
	})

	const rebuildKey = useMemoizedFn(async (key: ApiKey) => {
		const newKey = isMcp
			? await FlowApi.rebuildApiKeyV1(key.id)
			: await FlowApi.rebuildApiKey(key.id, flowId)
		message.success(`${t("flow.apiKey.resetKey")} ${t("flow.apiKey.success")}`)
		onListItemChanged(newKey, "edit")
	})

	const copyCurl = useMemoizedFn((key: ApiKey) => {
		const endpoint = isAgent ? "/api/chat" : "/api/param-call"

		let curlCommand = ""

		if (isAgent) {
			curlCommand = `curl --location --request POST "${env(
				"MAGIC_SERVICE_BASE_URL",
			)}${endpoint}" \\
--header 'api-key: ${key.secret_key}' \\
--header 'Content-Type: application/json' \\
--data-raw '{
    "message": "你是谁",
    "conversation_id": ""
}'`
		} else {
			curlCommand = `curl --location --request POST "${env(
				"MAGIC_SERVICE_BASE_URL",
			)}${endpoint}" \\
--header 'api-key: ${key.secret_key}' \\
--header 'Content-Type: application/json' \\
--data-raw '{
    "params": {
    
    }
}'`
		}

		copyToClipboard(curlCommand)
		message.success(`${t("flow.apiKey.copyCurl")} ${t("flow.apiKey.success")}`)
	})

	const copySSEURL = useMemoizedFn((key: ApiKey) => {
		const sseURL = `${env("MAGIC_SERVICE_BASE_URL")}/api/v1/mcp/sse/${flowId}?key=${
			key.secret_key
		}`
		copyToClipboard(sseURL)
		message.success(`${globalT("mcp.copySSEURLSuccess", { ns: "flow" })}`)
	})

	const columns = useMemo<TableProps<ApiKey>["columns"]>(() => {
		return [
			{
				dataIndex: "name",
				title: t("flow.apiKey.keyName"),
			},
			{
				dataIndex: "secret_key",
				title: t("flow.apiKey.keyValue"),
				render: (_, record) => {
					const isVisible = visibleKeys[record.id] || false

					return (
						<Flex align="center">
							<Tooltip title={t("flow.apiKey.clickToCopy")}>
								<div
									onClick={() => {
										copyToClipboard(_)
										message.success(
											`${t("flow.apiKey.copy")} ${t("flow.apiKey.success")}`,
										)
									}}
									className={styles.apiKey}
								>
									{isVisible ? _ : "•••••••••••••••••••••••••••••••••"}
								</div>
							</Tooltip>
							<Tooltip
								title={
									isVisible ? t("flow.apiKey.hideKey") : t("flow.apiKey.showKey")
								}
							>
								<Flex
									className={styles.iconEdit}
									align="center"
									justify="center"
									onClick={() => toggleKeyVisibility(record.id)}
									style={{ marginLeft: "8px", cursor: "pointer" }}
								>
									<MagicIcon
										component={isVisible ? IconEyeOff : IconEye}
										size={18}
										stroke={1}
									/>
								</Flex>
							</Tooltip>
						</Flex>
					)
				},
			},
			{
				dataIndex: "enabled",
				title: t("flow.apiKey.status"),
				render: (_, record) => {
					const params = isMcp
						? pick(record, ["id", "name", "description", "rel_type", "rel_code"])
						: pick(record, ["conversation_id", "id", "name", "description"])
					return (
						<Switch
							defaultValue={_}
							onChange={(checked) =>
								updateKey({
									conversation_id: "",
									...params,
									enabled: checked,
								})
							}
						/>
					)
				},
			},
			{
				dataIndex: "last_used",
				title: t("flow.apiKey.lastUsed"),
				render: (_) => {
					return _ ?? t("flow.apiKey.neverUsed")
				},
			},
			{
				dataIndex: "operation",
				width: 40,
				render: (_, record) => {
					return (
						<Flex>
							<NewKeyButton
								isMcp={isMcp}
								flowId={flowId}
								conversation={conversation!}
								detail={record}
								IconComponent={({ onClick }: any) => {
									return (
										<Tooltip title={t("flow.apiKey.editKey")}>
											<Flex
												className={styles.iconEdit}
												align="center"
												justify="center"
												onClick={onClick}
											>
												<MagicIcon
													component={IconEdit}
													size={18}
													stroke={1}
												/>
											</Flex>
										</Tooltip>
									)
								}}
								onListItemChanged={onListItemChanged}
							/>
							<Tooltip title={t("flow.apiKey.deleteKey")}>
								<Popconfirm
									title={t("flow.apiKey.confirmToDelete")}
									onConfirm={() => deleteKey(record)}
									okText={t("button.confirm")}
									cancelText={t("button.cancel")}
								>
									<Flex
										className={styles.iconTrash}
										align="center"
										justify="center"
									>
										<MagicIcon component={IconTrash} size={18} stroke={1} />
									</Flex>
								</Popconfirm>
							</Tooltip>

							<Tooltip title={t("flow.apiKey.resetKey")}>
								<Popconfirm
									title={t("flow.apiKey.confirmToRebuild")}
									onConfirm={() => rebuildKey(record)}
									okText={t("button.confirm")}
									cancelText={t("button.cancel")}
								>
									<Flex
										className={styles.iconTrash}
										align="center"
										justify="center"
									>
										<MagicIcon component={IconRefresh} stroke={1} size={18} />
									</Flex>
								</Popconfirm>
							</Tooltip>

							{!isMcp && (
								<Tooltip title={t("flow.apiKey.copyCurl")}>
									<Flex
										className={styles.iconTrash}
										align="center"
										justify="center"
										onClick={() => copyCurl(record)}
									>
										<MagicIcon component={IconCopy} stroke={1} size={18} />
									</Flex>
								</Tooltip>
							)}
							{isMcp && (
								<Tooltip title={globalT("mcp.copySSEURL", { ns: "flow" })}>
									<Flex
										className={styles.iconTrash}
										align="center"
										justify="center"
										onClick={() => copySSEURL(record)}
									>
										<MagicIcon component={IconCopy} stroke={1} size={18} />
									</Flex>
								</Tooltip>
							)}
						</Flex>
					)
				},
			},
		]
	}, [
		t,
		visibleKeys,
		styles.apiKey,
		styles.iconEdit,
		styles.iconTrash,
		toggleKeyVisibility,
		isMcp,
		updateKey,
		flowId,
		conversation,
		onListItemChanged,
		deleteKey,
		rebuildKey,
		copyCurl,
		copySSEURL,
	])

	useAsyncEffect(async () => {
		if (open && flowId) {
			const data = isMcp
				? await FlowApi.getApiKeyListV1({
						rel_type: Flow.ApiKeyType.Mcp,
						rel_code: flowId,
				  })
				: await FlowApi.getApiKeyList(flowId)
			if (data?.list) {
				setApiKeyList(data.list)
			}
		}
	}, [open, flowId])

	return (
		<MagicModal
			title={t("flow.apiKey.keyManager")}
			open={open}
			footer={null}
			closable
			okText={t("button.confirm", { ns: "interface" })}
			cancelText={t("button.cancel", { ns: "interface" })}
			centered
			onCancel={onClose}
			width={900}
			modalRender={(modal) => (
				<div onClick={(e) => e.stopPropagation()}>{modal}</div> // 阻止最外层的事件冒泡
			)}
		>
			{apiKeyList.length !== 0 && (
				<Flex justify="end">
					<NewKeyButton
						conversation={conversation!}
						onListItemChanged={onListItemChanged}
						flowId={flowId}
						isMcp={isMcp}
					/>
				</Flex>
			)}
			{apiKeyList.length === 0 && (
				<Flex vertical gap={20} align="center">
					<Flex className={styles.iconLock} align="center" justify="center">
						<IconLock />
					</Flex>
					<div className={styles.emptyTips}>{t("flow.apiKey.emptyTips")}</div>

					<NewKeyButton
						conversation={conversation!}
						onListItemChanged={onListItemChanged}
						flowId={flowId}
						isMcp={isMcp}
					/>
				</Flex>
			)}
			{apiKeyList.length !== 0 && (
				<MagicTable<ApiKey> columns={columns} dataSource={apiKeyList} />
			)}
		</MagicModal>
	)
}
