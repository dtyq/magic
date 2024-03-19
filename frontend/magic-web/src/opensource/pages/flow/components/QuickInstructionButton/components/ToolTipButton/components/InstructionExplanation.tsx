import { useTranslation } from "react-i18next"
import { memo, useState } from "react"
import { Flex, Form, Input, Upload } from "antd"
import { useMemoizedFn, useMount } from "ahooks"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import type { FileData } from "@/opensource/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import { genFileData } from "@/opensource/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import MagicButton from "@/opensource/components/base/MagicButton"
import type { InstructionExplanation as InstructionExplanationType } from "@/opensource/types/bot"
import { useStyles } from "../styles"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface InstructionExpriptionProps {
	initialValues?: InstructionExplanationType
	onFinish: (val: InstructionExplanationType) => void
	onClose: () => void
}

export const InstructionExplanation = memo(
	({ initialValues, onFinish, onClose }: InstructionExpriptionProps) => {
		const { t } = useTranslation("interface")
		const { styles } = useStyles()
		const [imageUrl, setImageUrl] = useState<string>("")
		const [form] = Form.useForm<InstructionExplanationType>()

		useMount(() => {
			if (initialValues?.temp_image_url || initialValues?.image) {
				setImageUrl(initialValues?.temp_image_url || initialValues?.image)
			}
		})

		const { uploadAndGetFileUrl, uploading } = useUpload<FileData>({
			storageType: "public",
		})

		const uploadButton = uploading ? (
			<MagicButton type="text" loading size="small" />
		) : (
			<Flex vertical align="center" className={styles.uploadTip}>
				<div>{t("explore.form.instructionExpImgTip1")}</div>
				<div>{t("explore.form.instructionExpImgTip2")}</div>
			</Flex>
		)

		const customRequest = useMemoizedFn(async ({ file }) => {
			const newFiles = genFileData(file)
			const { fullfilled } = await uploadAndGetFileUrl([newFiles])
			if (fullfilled.length) {
				const { url, path: key } = fullfilled[0].value
				setImageUrl(url)
				form.setFieldValue("image", key)
				form.setFieldValue("temp_image_url", url)
			} else {
				magicToast.error(t("file.uploadFail"))
			}
		})

		const handleCancel = useMemoizedFn(() => {
			onClose()
			form.resetFields()
			setImageUrl("")
		})

		const handleSave = useMemoizedFn(async () => {
			const values = form.getFieldsValue()
			onFinish(values)
			handleCancel()
		})

		return (
			<Form
				form={form}
				layout="vertical"
				className={styles.form}
				onFinish={onFinish}
				initialValues={initialValues}
			>
				<Flex vertical gap={8}>
					<Form.Item name="image">
						<Upload
							// name="image"
							listType="picture"
							className={styles.upload}
							showUploadList={false}
							maxCount={1}
							customRequest={customRequest}
						>
							{imageUrl ? (
								<img src={imageUrl} alt="avatar" className={styles.img} />
							) : (
								uploadButton
							)}
						</Upload>
					</Form.Item>
					<Form.Item name="temp_image_url" noStyle />
					<Form.Item name="name" label={t("explore.form.instructionExpName")}>
						<Input
							placeholder={t("explore.form.instructionExpNamePlaceholder")}
							className={styles.input}
						/>
					</Form.Item>
					<Form.Item name="description" label={t("explore.form.instructionExpDesc")}>
						<Input.TextArea
							rows={4}
							showCount
							className={styles.input}
							maxLength={100}
							style={{ resize: "none" }}
							placeholder={t("explore.form.instructionExpDescPlaceholder")}
						/>
					</Form.Item>
					<Flex justify="end" gap={10}>
						<MagicButton
							type="text"
							className={styles.button}
							style={{ width: 80 }}
							onClick={handleCancel}
						>
							{t("button.cancel")}
						</MagicButton>
						<MagicButton type="primary" style={{ width: 80 }} onClick={handleSave}>
							{t("button.save")}
						</MagicButton>
					</Flex>
				</Flex>
			</Form>
		)
	},
)
