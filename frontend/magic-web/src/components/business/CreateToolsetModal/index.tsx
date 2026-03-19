import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { Flex, Form, Input, Button } from "antd"
import { useMemoizedFn } from "ahooks"
import { useForm } from "antd/es/form/Form"
import MagicModal from "@/components/base/MagicModal"
import { FlowTool } from "@/types/flow"
import { useEffect, useMemo, useState } from "react"
import MagicAvatar from "@/components/base/MagicAvatar"
import type { FileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import UploadButton from "@/pages/explore/components/UploadButton"
import { createStyles } from "antd-style"
import defaultToolAvatar from "@/assets/logos/tool-avatar.png"
import { useUpload } from "@/hooks/useUploadFiles"
import { genFileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import { botStore } from "@/stores/bot"
import { FlowApi } from "@/apis"
import { useModalFooterStyles } from "../shared/styles"
import { openCreateToolModal } from "../CreateToolModal/openCreateToolModal"

type CreateToolsetForm = Pick<FlowTool.Tool, "name" | "description"> & {
	icon: string
}

type CreateToolsetModalProps = {
	open: boolean
	onClose: () => void
	onSuccess?: (data: FlowTool.Detail) => void
	/** 是否显示"仅创建"按钮，默认为true */
	showJustCreateButton?: boolean
	/** 是否显示"创建并添加工具"按钮，默认为true */
	showCreateAndAddToolButton?: boolean
	/** 工具创建成功后的回调，用于刷新列表 */
	onToolCreated?: (toolData: unknown) => void
	/** 工具创建模态框的按钮配置 */
	toolModalButtonConfig?: {
		showJustAddButton?: boolean
		showAddAndNextButton?: boolean
	}
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

function CreateToolsetModal({
	open,
	onClose,
	onSuccess,
	showJustCreateButton = true,
	showCreateAndAddToolButton = true,
	onToolCreated,
	toolModalButtonConfig,
}: CreateToolsetModalProps) {
	const { t } = useTranslation()

	const { styles } = useStyles()
	const { styles: footerStyles } = useModalFooterStyles()

	const [imageUrl, setImageUrl] = useState<string>()

	const [form] = useForm<CreateToolsetForm>()

	const { uploading, uploadAndGetFileUrl } = useUpload<FileData>({
		storageType: "public",
	})

	const defaultAvatar = botStore.defaultIcon.icons

	const defaultAvatarIcon = useMemo(() => {
		return <img src={defaultToolAvatar} style={{ width: "100px", borderRadius: 20 }} alt="" />
	}, [])

	const handleCancel = useMemoizedFn(() => {
		form.resetFields()
		setImageUrl("")
		onClose()
	})

	const addToolset = useMemoizedFn((params: FlowTool.SaveToolParams) => {
		return FlowApi.saveTool(params)
	})

	// 仅创建工具集
	const handleJustCreate = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()

			try {
				const data = await addToolset({
					name: res.name.trim(),
					description: res.description,
					icon: res.icon || defaultAvatar.tool_set,
				})

				onSuccess?.(data)
				handleCancel()
				magicToast.success(t("common.createSuccess", { ns: "flow" }))
			} catch (err: unknown) {
				if (err instanceof Error && err.message) {
					magicToast.error(err.message)
				}
			}
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	// 创建并添加工具
	const handleCreateAndAddTool = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()

			try {
				const data = await addToolset({
					name: res.name.trim(),
					description: res.description,
					icon: res.icon || defaultAvatar.tool_set,
				})

				// 显示成功消息
				magicToast.success(t("common.createSuccess", { ns: "flow" }))

				// 关闭当前弹窗
				handleCancel()

				// 立即打开创建工具的弹窗
				openCreateToolModal({
					toolsetId: data.id,
					onSuccess: (toolData) => {
						// 通知父组件工具创建成功，刷新列表
						onToolCreated?.(toolData)
					},
					showJustAddButton: toolModalButtonConfig?.showJustAddButton ?? true,
					showAddAndNextButton: toolModalButtonConfig?.showAddAndNextButton ?? true,
				})

				// 注意：这里不调用 onSuccess，因为整个流程还没完成
			} catch (err: unknown) {
				if (err instanceof Error && err.message) {
					magicToast.error(err.message)
				}
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

	// 生成自定义footer
	const customFooter = useMemo(() => {
		const buttons = []

		// 取消按钮
		buttons.push(
			<Button key="cancel" onClick={handleCancel} className={footerStyles.cancelButton}>
				{t("common.tool.form.cancel", { ns: "agent" })}
			</Button>,
		)

		// 仅创建按钮（可选）
		if (showJustCreateButton) {
			buttons.push(
				<Button
					key="justCreate"
					onClick={handleJustCreate}
					className={footerStyles.secondaryButton}
				>
					{t("common.tool.form.justCreate", { ns: "agent" })}
				</Button>,
			)
		}

		// 创建并添加工具按钮（可选）
		if (showCreateAndAddToolButton) {
			buttons.push(
				<Button
					key="createAndAddTool"
					onClick={handleCreateAndAddTool}
					className={footerStyles.primaryButton}
				>
					{t("common.tool.form.createAndAddTool", { ns: "agent" })}
				</Button>,
			)
		}

		return <div className={footerStyles.footerContainer}>{buttons}</div>
	}, [
		handleCancel,
		handleJustCreate,
		handleCreateAndAddTool,
		footerStyles,
		t,
		showJustCreateButton,
		showCreateAndAddToolButton,
	])

	useEffect(() => {
		if (!open) {
			form.resetFields()
			setImageUrl("")
		}
	}, [open, form])

	return (
		<MagicModal
			title={t("common.createSomething", {
				ns: "flow",
				name: t("common.toolset", { ns: "flow" }),
			})}
			open={open}
			onCancel={handleCancel}
			afterClose={() => form.resetFields()}
			closable
			maskClosable={false}
			centered
			footer={customFooter}
		>
			<Form
				form={form}
				validateMessages={{ required: t("form.required", { ns: "interface" }) }}
				layout="vertical"
				preserve={false}
			>
				<Form.Item name="icon" className={styles.formItem}>
					<Flex vertical align="center" gap={10} className={styles.avatar}>
						{imageUrl ? (
							<MagicAvatar src={imageUrl} size={100} style={{ borderRadius: 20 }} />
						) : (
							defaultAvatarIcon
						)}
						<Form.Item name="icon" noStyle>
							<UploadButton loading={uploading} onFileChange={onFileChange} />
						</Form.Item>
					</Flex>
				</Form.Item>
				<Form.Item
					name="name"
					label={t("common.inputName", {
						ns: "flow",
						name: t("common.toolset", { ns: "flow" }),
					})}
					required
					rules={[{ required: true }]}
					className={styles.formItem}
				>
					<Input
						placeholder={t("common.inputNamePlaceholder", {
							ns: "flow",
							name: t("common.toolset", { ns: "flow" }),
						})}
					/>
				</Form.Item>
				<Form.Item
					name="description"
					label={t("common.inputDesc", {
						ns: "flow",
						name: t("common.toolset", { ns: "flow" }),
					})}
					className={styles.formItem}
				>
					<Input.TextArea
						style={{
							minHeight: "138px",
						}}
						placeholder={t("common.inputDescPlaceholder", {
							ns: "flow",
							name: t("common.toolset", { ns: "flow" }),
						})}
					/>
				</Form.Item>
			</Form>
		</MagicModal>
	)
}

export default CreateToolsetModal
