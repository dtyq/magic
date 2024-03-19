import { Modal, Form, Input, message } from "antd"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import type { OpenableProps } from "@/hooks/useOpenModal"
import { useState } from "react"
import { useApis } from "@/apis"
import type { UsageData } from "@/types/aiAudit"

const { TextArea } = Input

interface RiskMarkModalProps extends OpenableProps {
	onFetchData: () => Promise<void>
	info: UsageData
}

const useStyles = createStyles(({ token }) => ({
	modal: {
		".ant-modal-header": {
			borderBottom: `1px solid ${token.colorBorder}`,
			marginBottom: token.marginLG,
		},
		".ant-modal-footer": {
			borderTop: `1px solid ${token.colorBorder}`,
			marginTop: token.marginLG,
		},
	},
	form: {
		".ant-form-item-label": {
			fontWeight: 500,
		},
	},
	textArea: {
		minHeight: "120px",
		resize: "vertical",
	},
	footer: {
		display: "flex",
		justifyContent: "flex-end",
		gap: token.marginSM,
	},
}))

export default function RiskMarkModal({ onClose, onFetchData, info }: RiskMarkModalProps) {
	const { t } = useTranslation("admin/platform/audit")
	const { styles } = useStyles()

	const { topic_id, topic_name } = info

	const [form] = Form.useForm()

	const { AiAuditApi } = useApis()

	const [saving, setSaving] = useState(false)
	const [open, setOpen] = useState(true)

	const handleCancel = () => {
		form.resetFields()
		setOpen(false)
		onClose?.()
	}

	const handleConfirm = async () => {
		try {
			if (saving) return
			setSaving(true)
			const riskReason = await form.validateFields()

			await AiAuditApi.identifyRisk(topic_id, riskReason.riskReason)
			message.success(t("markAsRiskSuccess", { topicName: topic_name }))
			onFetchData()
		} catch (error) {
			// console.error("表单验证失败:", error)
		} finally {
			setSaving(false)
			handleCancel()
		}
	}

	return (
		<Modal
			centered
			title={t("markAsRisk")}
			open={open}
			width={600}
			className={styles.modal}
			destroyOnHidden
			okText={t("confirmMark")}
			okButtonProps={{ danger: true, loading: saving }}
			onCancel={handleCancel}
			onOk={handleConfirm}
		>
			<Form form={form} layout="vertical" className={styles.form}>
				{topic_name && (
					<div
						style={{
							marginBottom: 16,
							padding: 12,
							backgroundColor: "#f5f5f5",
							borderRadius: 6,
						}}
					>
						<strong>{t("topicName")}：</strong>
						{topic_name}
					</div>
				)}

				<Form.Item
					label={t("riskReason")}
					name="riskReason"
					rules={[
						{ required: true, message: t("riskReasonPlaceholder") },
						{ max: 500, message: t("riskReasonMaxLength") },
					]}
				>
					<TextArea
						placeholder={t("markAsRiskReasonPlaceholder")}
						className={styles.textArea}
						showCount
						maxLength={500}
					/>
				</Form.Item>
			</Form>
		</Modal>
	)
}
