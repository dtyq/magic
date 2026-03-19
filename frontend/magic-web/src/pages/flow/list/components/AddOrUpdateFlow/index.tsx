import { useTranslation } from "react-i18next"
import { Flex, Form, Input, Radio } from "antd"
import { useMemoizedFn } from "ahooks"
import { useForm } from "antd/es/form/Form"
import MagicModal from "@/components/base/MagicModal"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { Flow, FlowTool, FlowRouteType, FlowType } from "@/types/flow"
import { useEffect, useMemo, useState } from "react"
import MagicAvatar from "@/components/base/MagicAvatar"
import type { FileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import UploadButton from "@/pages/explore/components/UploadButton"
import { createStyles } from "antd-style"
import defaultFlowAvatar from "@/assets/logos/flow-avatar.png"
import defaultToolAvatar from "@/assets/logos/tool-avatar.png"
import defaultMCPAvatar from "@/assets/logos/mcp.png"
import { useUpload } from "@/hooks/useUploadFiles"
import { genFileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import { botStore } from "@/stores/bot"
import { FlowApi } from "@/apis"
import type { Knowledge } from "@/types/knowledge"
import magicToast from "@/components/base/MagicToaster/utils"

type AddOrUpdateFlowForm = Pick<MagicFlow.Flow, "name" | "description"> & {
	icon: string
	type?: string
	external_sse_url?: string
}

type AddOrUpdateFlowProps = {
	flowType: FlowRouteType
	title: string
	open: boolean
	flow?: MagicFlow.Flow | Knowledge.KnowledgeItem | Flow.Mcp.Detail
	tool?: FlowTool.Tool | Flow.Mcp.ListItem
	groupId?: string
	onClose: () => void
	updateFlowOrTool: (
		data: MagicFlow.Flow | FlowTool.Detail | Flow.Mcp.Detail,
		isTool: boolean,
		update: boolean,
	) => void
	addNewFlow: (data: MagicFlow.Flow | FlowTool.Detail | Flow.Mcp.Detail) => void
}

const useStyles = createStyles(({ css, token }) => {
	return {
		avatar: css`
			padding-top: 20px;
			padding-bottom: 20px;
			border-radius: 12px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		formItem: css`
			margin-bottom: 10px;
			&:last-child {
				margin-bottom: 0;
			}
		`,
	}
})

function AddOrUpdateFlow({
	flowType,
	title,
	flow,
	open,
	tool,
	groupId,
	onClose,
	updateFlowOrTool,
	addNewFlow,
}: AddOrUpdateFlowProps) {
	const { t } = useTranslation()

	const { styles } = useStyles()

	const [imageUrl, setImageUrl] = useState<string>()

	const [form] = useForm<AddOrUpdateFlowForm>()

	const [isUpdate, setIsUpdate] = useState(false)

	const isTools = useMemo(() => flowType === FlowRouteType.Tools, [flowType])

	const isMcp = useMemo(() => flowType === FlowRouteType.Mcp, [flowType])

	const operationTitle = useMemo(() => {
		return flow?.id || groupId
			? t("common.updateSomething", { ns: "flow", name: title })
			: t("common.createSomething", { ns: "flow", name: title })
	}, [flow?.id, t, groupId, title])

	const innerTitle = useMemo(() => {
		return groupId ? t("tools.name", { ns: "flow" }) : title
	}, [groupId, t, title])

	const { uploading, uploadAndGetFileUrl } = useUpload<FileData>({
		storageType: "public",
	})

	const defaultAvatarIcon = useMemo(() => {
		if (flowType === FlowRouteType.Mcp) {
			return (
				<img
					src={defaultMCPAvatar}
					style={{
						width: "100px",
						background: "#2E2F38",
						borderRadius: 20,
						padding: "10px",
					}}
					alt=""
				/>
			)
		}
		const avatarMap = {
			[FlowRouteType.Tools]: defaultToolAvatar,
			[FlowRouteType.Sub]: defaultFlowAvatar,
			[FlowRouteType.Mcp]: defaultMCPAvatar,
		}
		return (
			<img
				// @ts-ignore
				src={avatarMap[flowType]}
				style={{ width: "100px", borderRadius: 20 }}
				alt=""
			/>
		)
	}, [flowType])

	const handleCancel = useMemoizedFn(() => {
		form.resetFields()
		setImageUrl("")
		setIsUpdate(false)
		onClose()
	})

	const addTool = useMemoizedFn((params: FlowTool.SaveToolParams) => {
		return FlowApi.saveTool(params)
	})

	const addMcp = useMemoizedFn((params: Flow.Mcp.SaveParams) => {
		return FlowApi.saveMcp(params)
	})

	const handleOk = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()
			let data = null

			try {
				if (isTools && !groupId) {
					data = await addTool({
						id: flow?.id,
						name: res.name.trim(),
						description: res.description,
						icon: res.icon || botStore.defaultIcon.icons.tool_set,
					})
				} else if (isMcp) {
					if (groupId) {
						data = await FlowApi.saveMcpTool(
							{
								id: tool?.id,
								name: res.name.trim(),
								description: res.description,
								icon: res.icon || botStore.defaultIcon.icons.mcp,
								source: Flow.Mcp.ToolSource.Toolset,
								rel_code: (tool as Flow.Mcp.ListItem)?.rel_code,
								enabled: (tool as Flow.Mcp.ListItem)?.enabled,
							},
							groupId,
						)
					} else {
						data = await addMcp({
							id: flow?.id,
							name: res.name.trim(),
							description: res.description,
							icon: res.icon || botStore.defaultIcon.icons.mcp,
							type: res.type,
							external_sse_url:
								res.external_sse_url || (flow as Flow.Mcp.Detail)?.external_sse_url,
						})
					}
				} else {
					data = await FlowApi.addOrUpdateFlowBaseInfo({
						id: groupId ? tool?.code : flow?.id,
						name: res.name.trim(),
						description: res.description,
						icon: res.icon || botStore.defaultIcon.icons.flow,
						// @ts-ignore
						type: flowType === FlowRouteType.Sub ? FlowType.Sub : FlowType.Tools,
						tool_set_id: groupId,
					})
				}
				const hasTools = isTools || isMcp

				if (isUpdate) {
					// 更新当前卡片及列表数据
					updateFlowOrTool(data, !!(hasTools && groupId), !!(groupId && tool?.code))
				} else {
					// 列表新增数据
					addNewFlow(data)
				}
				handleCancel()
			} catch (err: any) {
				if (err.message) console.error(err.message)
			}
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	const onFileChange = useMemoizedFn(async (fileList: FileList) => {
		const newFiles = Array.from(fileList).map(genFileData)
		// 先上传文件
		const { fullfilled } = await uploadAndGetFileUrl(newFiles)
		if (fullfilled.length) {
			const { url, path: key } = fullfilled[0].value
			setImageUrl(url)
			form.setFieldsValue({
				icon: key,
			})
		} else {
			magicToast.error(t("file.uploadFail", { ns: "message" }))
		}
	})

	const initialValues = useMemo(() => {
		const extraFields = isMcp
			? {
				type: (flow as Flow.Mcp.ListItem)?.type || "sse",
				external_sse_url: (flow as Flow.Mcp.ListItem)?.external_sse_url || "",
			}
			: {}
		if (open && groupId && tool) {
			return {
				name: tool?.name,
				description: tool?.description,
				icon: tool?.icon,
				...extraFields,
			}
		}
		return {
			name: flow?.name,
			description: flow?.description,
			icon: flow?.icon,
			...extraFields,
		}
	}, [flow, open, tool, groupId])

	useEffect(() => {
		if (open && groupId && tool) {
			form.setFieldsValue(initialValues)
			setImageUrl(tool.icon)
		} else if (open && flow) {
			form.setFieldsValue(initialValues)
			setImageUrl(flow.icon)
		}
	}, [flow, form, open, tool, groupId, initialValues])

	useEffect(() => {
		if (open) {
			if ((groupId && tool?.code) || flow?.id) {
				setIsUpdate(true)
			}
		}
	}, [flow?.id, open, tool?.code, groupId])

	return (
		<MagicModal
			title={operationTitle}
			open={open}
			onOk={handleOk}
			onCancel={handleCancel}
			afterClose={() => form.resetFields()}
			closable
			maskClosable={false}
			okText={t("button.confirm", { ns: "interface" })}
			cancelText={t("button.cancel", { ns: "interface" })}
			centered
		>
			<Form
				form={form}
				validateMessages={{ required: t("form.required", { ns: "interface" }) }}
				layout="vertical"
				preserve={false}
				initialValues={initialValues}
			>
				{!groupId && (
					<Form.Item name="icon" className={styles.formItem}>
						<Flex vertical align="center" gap={10} className={styles.avatar}>
							{imageUrl ? (
								<MagicAvatar
									src={imageUrl}
									size={100}
									style={{ borderRadius: 20 }}
								/>
							) : (
								defaultAvatarIcon
							)}
							<Form.Item name="icon" noStyle>
								<UploadButton loading={uploading} onFileChange={onFileChange} />
							</Form.Item>
						</Flex>
					</Form.Item>
				)}
				<Form.Item
					name="name"
					label={t("common.inputName", { ns: "flow", name: innerTitle })}
					required
					rules={[{ required: true }]}
					className={styles.formItem}
				>
					<Input
						placeholder={t("common.inputNamePlaceholder", {
							ns: "flow",
							name: innerTitle,
						})}
					/>
				</Form.Item>
				<Form.Item
					name="description"
					label={t("common.inputDesc", { ns: "flow", name: innerTitle })}
					className={styles.formItem}
					required={!!groupId}
				>
					<Input.TextArea
						style={{
							minHeight: "138px",
						}}
						placeholder={t("common.inputDescPlaceholder", {
							ns: "flow",
							name: innerTitle,
						})}
					/>
				</Form.Item>
				{isMcp && !groupId && (
					<>
						<Form.Item name="type" label={t("common.mcpType", { ns: "flow" })}>
							<Radio.Group disabled={isUpdate}>
								<Radio value="sse">{t("common.importTools", { ns: "flow" })}</Radio>
								<Radio value="external_sse">
									{t("common.customMCP", { ns: "flow" })}
								</Radio>
							</Radio.Group>
						</Form.Item>
						<Form.Item
							shouldUpdate={(prevValues, currentValues) =>
								prevValues.type !== currentValues.type
							}
							noStyle
						>
							{({ getFieldValue }) => {
								return getFieldValue("type") === "external_sse" ? (
									<Form.Item
										name="external_sse_url"
										label={t("common.mcpSSEUrl", { ns: "flow" })}
									>
										<Input
											placeholder={t("common.inputSSEUrlPlaceholder", {
												ns: "flow",
											})}
										/>
									</Form.Item>
								) : null
							}}
						</Form.Item>
					</>
				)}
			</Form>
		</MagicModal>
	)
}

export default AddOrUpdateFlow
