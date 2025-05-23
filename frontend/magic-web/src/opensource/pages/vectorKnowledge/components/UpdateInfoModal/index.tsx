import { useTranslation } from "react-i18next"
import { Flex, Form, Input, message } from "antd"
import { useMemoizedFn } from "ahooks"
import { useForm } from "antd/es/form/Form"
import MagicModal from "@/opensource/components/base/MagicModal"
import { useEffect, useState } from "react"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import type { FileData } from "@/opensource/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import UploadButton from "../Upload/UploadButton"
import { createStyles } from "antd-style"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import { genFileData } from "@/opensource/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import { KnowledgeApi } from "@/apis"
import type { Knowledge } from "@/types/knowledge"
import type { FlowWithTools } from "@/opensource/pages/flow/list/hooks/useFlowList"
import DEFAULT_KNOWLEDGE_ICON from "@/assets/logos/knowledge-avatar.png"
import { Flow } from "@/types/flow"

type UpdateInfoModalForm = {
	name: string
	description: string
}

type UpdateInfoModalProps = {
	title: string
	open: boolean
	details: Knowledge.KnowledgeItem | FlowWithTools | Flow.Mcp.Detail
	onClose: () => void
	updateList: (data: Knowledge.Detail) => void
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

function UpdateInfoModal({ details, open, onClose, updateList }: UpdateInfoModalProps) {
	const { t } = useTranslation()
	const { t: flowT } = useTranslation("flow")

	const { styles } = useStyles()

	const [imagePreviewUrl, setImagePreviewUrl] = useState<string>()
	const [imageUploadUrl, setImageUploadUrl] = useState<string>(details?.icon || "")

	const [form] = useForm<UpdateInfoModalForm>()

	const { uploading, uploadAndGetFileUrl } = useUpload<FileData>({
		storageType: "private",
	})

	const handleCancel = useMemoizedFn(() => {
		form.resetFields()
		setImagePreviewUrl("")
		onClose()
	})

	const handleOk = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()
			try {
				const data = await KnowledgeApi.updateKnowledge({
					code: details?.code,
					name: res.name,
					description: res.description,
					icon: imageUploadUrl,
					enabled: true,
				})
				if (data) {
					updateList(data)
					message.success(flowT("knowledgeDatabase.savedSuccess"))
					handleCancel()
				}
			} catch (err: any) {
				if (err.message) console.error(err.message)
			}
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	const onFileChange = useMemoizedFn(async (fileList: FileList) => {
		// 创建本地URL用于预览
		const localPreviewUrl = URL.createObjectURL(fileList[0])
		const newFiles = Array.from(fileList).map(genFileData)
		// 先上传文件
		const { fullfilled } = await uploadAndGetFileUrl(newFiles)
		if (fullfilled.length) {
			const { path } = fullfilled[0].value
			setImagePreviewUrl(localPreviewUrl)
			setImageUploadUrl(path)
		} else {
			message.error(t("file.uploadFail", { ns: "message" }))
		}
	})

	useEffect(() => {
		if (details) {
			// requestAnimationFrame 将表单更新推迟到下一个浏览器绘制帧，确保所有 DOM 元素都已完全渲染，表单字段已完成初始化。
			requestAnimationFrame(() => {
				form.setFieldsValue({
					name: details.name,
					description: details.description,
				})
				setImagePreviewUrl(details.icon)
			})
		}
	}, [details, form, open])

	return (
		<MagicModal
			title={flowT("knowledgeDatabase.updateKnowledge")}
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
			>
				<Form.Item name="icon" className={styles.formItem}>
					<Flex vertical align="center" gap={10} className={styles.avatar}>
						<MagicAvatar
							src={imagePreviewUrl || DEFAULT_KNOWLEDGE_ICON}
							size={100}
							style={{ borderRadius: 20 }}
						/>
						<Form.Item name="icon" noStyle>
							<UploadButton loading={uploading} onFileChange={onFileChange} />
						</Form.Item>
					</Flex>
				</Form.Item>

				<Form.Item
					name="name"
					label={flowT("knowledgeDatabase.knowledgeName")}
					required
					rules={[{ required: true }]}
					className={styles.formItem}
				>
					<Input placeholder={flowT("knowledgeDatabase.namePlaceholder")} />
				</Form.Item>
				<Form.Item
					name="description"
					label={flowT("knowledgeDatabase.description")}
					className={styles.formItem}
				>
					<Input.TextArea
						style={{
							minHeight: "138px",
						}}
						placeholder={flowT("knowledgeDatabase.descriptionPlaceholder")}
					/>
				</Form.Item>
			</Form>
		</MagicModal>
	)
}

export default UpdateInfoModal
