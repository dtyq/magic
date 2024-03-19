import { useTranslation } from "react-i18next"
import { Form, Input, Flex } from "antd"
import { useMemoizedFn } from "ahooks"
import { useForm } from "antd/es/form/Form"
import MagicModal from "@/opensource/components/base/MagicModal"
import type { Bot } from "@/opensource/types/bot"
import { useEffect, useState, useMemo } from "react"
import { createStyles } from "antd-style"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import defaultAgentAvatar from "@/opensource/assets/logos/agent-avatar.jpg"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { botStore } from "@/opensource/stores/bot"
import { FlowRouteType } from "@/opensource/types/flow"
import { BotApi } from "@/opensource/apis"
import UploadButton from "../UploadButton"
import { genFileData } from "@/opensource/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import type { FileData } from "@/opensource/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import { RouteName } from "@/opensource/routes/constants"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

type AddOrUpdateAgentType = Pick<
	Bot.BotItem,
	"id" | "robot_name" | "robot_description" | "robot_avatar" | "start_page"
>

type AddOrUpdateAgentProps = {
	open: boolean
	close?: () => void
	submit?: (data: Bot.Detail["botEntity"]) => void
	agent?: AddOrUpdateAgentType
}

const useStyles = createStyles(({ prefixCls, token, css }) => {
	return {
		modal: css`
			.${prefixCls}-modal-footer {
				border-top: none;
			}
		`,
		uploadAvatarBox: css`
			padding: 20px 0;
			border: 1px solid ${token.colorBorder};
			border-radius: 12px;
		`,
		avatar: css`
			width: 100px;
			height: 100px;
			border-radius: 12px;
		`,
		formItem: css`
			margin-bottom: 10px;

			&:last-child {
				margin-bottom: 0;
			}
		`,
	}
})

function AddOrUpdateAgent({ agent, open, close, submit }: AddOrUpdateAgentProps) {
	const { t } = useTranslation("interface")
	const { t: globalT } = useTranslation()

	const navigate = useNavigate()

	const { styles } = useStyles()

	const [imageUrl, setImageUrl] = useState<string>()

	const [form] = useForm<AddOrUpdateAgentType>()

	const title = useMemo(() => {
		return agent?.id
			? t("explore.buttonText.updateAssistant")
			: t("explore.buttonText.createAssistant")
	}, [agent?.id, t])

	const okText = useMemo(() => {
		return agent?.id
			? t("button.save", { ns: "interface" })
			: t("button.create", { ns: "interface" })
	}, [agent?.id, t])

	const { uploading, uploadAndGetFileUrl } = useUpload<FileData>({
		storageType: "public",
	})

	const handleOk = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()
			try {
				const data = await BotApi.saveBot({
					id: agent?.id,
					robot_name: res.robot_name.trim(),
					robot_description: res.robot_description,
					robot_avatar: res.robot_avatar || botStore.defaultIcon.icons.bot,
					start_page: agent?.start_page || false,
				})
				magicToast.success(globalT("common.savedSuccess", { ns: "flow" }))

				// 更新
				if (agent?.id) {
					// 更新
					submit?.(data)
				} else {
					// 跳转详情
					navigate({
						name: RouteName.FlowDetail,
						params: {
							id: data.id,
							type: FlowRouteType.Agent,
						},
					})
				}
				form.resetFields()
				close?.()
			} catch (err: any) {
				if (err.message) console.error(err.message)
			}
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		form.resetFields()
		setImageUrl("")
		close?.()
	})

	const onFileChange = useMemoizedFn(async (fileList: FileList) => {
		const newFiles = Array.from(fileList).map(genFileData)
		// 先上传文件
		const { fullfilled } = await uploadAndGetFileUrl(newFiles)
		if (fullfilled.length) {
			const { url, path: key } = fullfilled[0].value
			setImageUrl(url)
			form.setFieldsValue({
				robot_avatar: key,
			})
		} else {
			magicToast.error(t("file.uploadFail", { ns: "message" }))
		}
	})

	useEffect(() => {
		if (open && agent) {
			form.setFieldsValue({
				...agent,
			})
			setImageUrl(agent.robot_avatar)
		}
	}, [agent, form, open])

	return (
		<MagicModal
			className={styles.modal}
			title={title}
			open={open}
			onOk={handleOk}
			onCancel={handleCancel}
			closable
			okText={okText}
			cancelText={t("button.cancel", { ns: "interface" })}
			centered
			afterClose={handleCancel}
		>
			<Form
				form={form}
				validateMessages={{ required: t("form.required", { ns: "interface" }) }}
				layout="vertical"
			>
				<Form.Item name="robot_avatar" className={styles.formItem}>
					<Flex vertical align="center" gap={10} className={styles.uploadAvatarBox}>
						{imageUrl ? (
							<MagicAvatar size={100} src={imageUrl} style={{ borderRadius: 20 }} />
						) : (
							<img
								src={defaultAgentAvatar}
								alt=""
								style={{ width: "100px", borderRadius: 20 }}
							/>
						)}
						<Form.Item name="robot_avatar" noStyle>
							<UploadButton loading={uploading} onFileChange={onFileChange} />
						</Form.Item>
					</Flex>
				</Form.Item>
				<Form.Item
					name="robot_name"
					label={t("explore.form.assistantName", { ns: "interface" })}
					required
					rules={[{ required: true }]}
					className={styles.formItem}
				>
					<Input placeholder={t("explore.form.assistantNamePlaceholder")} />
				</Form.Item>
				<Form.Item
					name="robot_description"
					label={t("explore.form.assistantDesc")}
					rules={[{ required: true }]}
					className={styles.formItem}
				>
					<Input.TextArea
						style={{
							minHeight: "90px",
						}}
						placeholder={t("explore.form.assistantDescPlaceholder")}
					/>
				</Form.Item>
			</Form>
		</MagicModal>
	)
}

export default AddOrUpdateAgent
