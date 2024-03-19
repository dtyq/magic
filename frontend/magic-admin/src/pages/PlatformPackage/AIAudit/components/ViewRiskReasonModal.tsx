import { Modal, Form, Input, Space, Spin, Alert, message } from "antd"
import { createStyles } from "antd-style"
import { useMemoizedFn } from "ahooks"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { MagicButton } from "components"
import type { UsageData } from "@/types/aiAudit"
import { useApis } from "@/apis"
import type { OpenableProps } from "@/hooks/useOpenModal"

const { TextArea } = Input

interface RiskReasonData {
	risk_reason?: string
	risk_level?: number
	status?: number
	create_time?: string
	update_time?: string
}

interface ViewRiskReasonModalProps extends OpenableProps {
	info: UsageData
	onFetchData: () => Promise<void>
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
	content: {
		marginBottom: token.marginLG,
	},
	topicInfo: {
		marginBottom: token.marginMD,
		padding: token.paddingSM,
		backgroundColor: token.colorFillAlter,
		borderRadius: token.borderRadius,
		border: `1px solid ${token.colorBorder}`,
	},
	riskReasonDisplay: {
		marginBottom: token.marginMD,
		padding: token.paddingSM,
		backgroundColor: token.colorBgLayout,
		borderRadius: token.borderRadius,
		border: `1px solid ${token.colorBorder}`,
		minHeight: "80px",
		whiteSpace: "pre-wrap",
		wordBreak: "break-word",
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
		justifyContent: "space-between",
		alignItems: "center",
		gap: token.marginSM,
	},
	editingState: {
		marginTop: token.marginMD,
	},
}))

export default function ViewRiskReasonModal({
	info,
	onClose,
	onFetchData,
}: ViewRiskReasonModalProps) {
	const { t } = useTranslation("admin/platform/audit")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()
	const [form] = Form.useForm()

	const { topic_id: topicId, topic_name: topicName } = info

	const { AiAuditApi } = useApis()

	// 状态管理
	const [open, setOpen] = useState(true)
	const [loading, setLoading] = useState(false)
	const [editLoading, setEditLoading] = useState(false)
	const [revokeLoading, setRevokeLoading] = useState(false)
	const [isEditing, setIsEditing] = useState(false)
	const [riskData, setRiskData] = useState<RiskReasonData | null>(null)
	const [error, setError] = useState<string | null>(null)

	// 获取风险原因数据
	const fetchRiskData = useMemoizedFn(async () => {
		if (!topicId) return

		setLoading(true)
		setError(null)
		try {
			const data = await AiAuditApi.getTopicRisk(topicId)
			setRiskData(data?.risk || null)
			if (data?.risk?.risk_reason) {
				form.setFieldsValue({
					riskReason: data.risk.risk_reason,
				})
			}
		} catch (err) {
			console.error("获取风险原因失败:", err)
			setError(t("getError"))
		} finally {
			setLoading(false)
		}
	})

	// Modal显示时获取数据
	useEffect(() => {
		if (topicId) {
			fetchRiskData()
		}
	}, [topicId, fetchRiskData])

	// 开始编辑
	const handleStartEdit = useMemoizedFn(() => {
		setIsEditing(true)
		form.setFieldsValue({
			riskReason: riskData?.risk_reason || "",
		})
	})

	// 取消编辑
	const handleCancelEdit = useMemoizedFn(() => {
		setIsEditing(false)
		form.resetFields()
	})

	// 确认修改
	const handleConfirmEdit = useMemoizedFn(async () => {
		if (!topicId) return

		try {
			const values = await form.validateFields()
			setEditLoading(true)

			// await onEditRisk(values.riskReason)
			await AiAuditApi.identifyRisk(topicId, values.riskReason)
			message.success(t("updateRiskReason", { topicName }))

			// 更新本地数据
			setRiskData((prev) =>
				prev
					? {
							...prev,
							risk_reason: values.riskReason,
						}
					: null,
			)

			setIsEditing(false)
			form.resetFields()
			onFetchData()
		} catch (err) {
			console.error("修改风险原因失败:", err)
		} finally {
			setEditLoading(false)
		}
	})

	// 关闭Modal
	const handleCancel = useMemoizedFn(() => {
		setIsEditing(false)
		setRiskData(null)
		setError(null)
		form.resetFields()
		setOpen(false)
		onClose?.()
	})

	// 取消风险标记
	const handleRevokeRisk = useMemoizedFn(async () => {
		if (!topicId) return

		try {
			setRevokeLoading(true)
			await AiAuditApi.revokeRisk(topicId)
			message.success(t("cancelRisk", { topicName }))
			onFetchData()
			// 取消风险标记后关闭弹窗
			handleCancel()
		} catch (errors) {
			console.error("取消风险标记失败:", error)
		} finally {
			setRevokeLoading(false)
		}
	})

	// 格式化时间
	const formatTime = (timeStr?: string) => {
		if (!timeStr) return "-"
		return timeStr.replace("T", " ").split(".")[0]
	}

	return (
		<Modal
			centered
			title={t("checkRiskReason")}
			open={open}
			onCancel={handleCancel}
			footer={null}
			width={700}
			className={styles.modal}
			destroyOnHidden
		>
			<div className={styles.content}>
				{/* 话题信息 */}
				{topicName && (
					<div className={styles.topicInfo}>
						<strong>{t("topicName")}：</strong>
						{topicName}
					</div>
				)}

				{/* 加载状态 */}
				{loading && (
					<div style={{ textAlign: "center", padding: "40px 0" }}>
						<Spin size="large" />
						<div style={{ marginTop: 16 }}>{t("getRiskReason")}</div>
					</div>
				)}

				{/* 错误状态 */}
				{error && !loading && (
					<Alert
						message={t("getError")}
						description={error}
						type="error"
						showIcon
						style={{ marginBottom: 16 }}
						action={
							<MagicButton size="small" onClick={fetchRiskData}>
								{t("retry")}
							</MagicButton>
						}
					/>
				)}

				{/* 显示风险原因 */}
				{!loading && !error && riskData && !isEditing && (
					<>
						<div style={{ marginBottom: 12 }}>
							<strong>{t("riskReason")}：</strong>
						</div>
						<div className={styles.riskReasonDisplay}>
							{riskData.risk_reason || t("noRiskReason")}
						</div>

						{riskData.create_time && (
							<div style={{ marginBottom: 8, color: "#666", fontSize: "12px" }}>
								{t("markTime")}：{formatTime(riskData.create_time)}
							</div>
						)}

						{riskData.update_time && riskData.update_time !== riskData.create_time && (
							<div style={{ marginBottom: 16, color: "#666", fontSize: "12px" }}>
								{t("updateTime")}：{formatTime(riskData.update_time)}
							</div>
						)}

						<div className={styles.footer}>
							<div>
								<MagicButton
									danger
									onClick={handleRevokeRisk}
									loading={revokeLoading}
									disabled={editLoading}
								>
									{t("cancelRiskMark")}
								</MagicButton>
							</div>
							<Space>
								<MagicButton onClick={handleCancel}>
									{tCommon("button.close")}
								</MagicButton>
								<MagicButton type="primary" onClick={handleStartEdit}>
									{t("modifyRiskReason")}
								</MagicButton>
							</Space>
						</div>
					</>
				)}

				{/* 编辑状态 */}
				{!loading && !error && isEditing && (
					<div className={styles.editingState}>
						<Form form={form} layout="vertical" className={styles.form}>
							<Form.Item
								label={t("modifyRiskReason")}
								name="riskReason"
								rules={[
									{ required: true, message: t("riskReasonPlaceholder") },
									{ max: 500, message: t("riskReasonMaxLength") },
								]}
							>
								<TextArea
									placeholder={t("modifyRiskReasonPlaceholder")}
									className={styles.textArea}
									showCount
									maxLength={500}
								/>
							</Form.Item>

							<div className={styles.footer}>
								<div />
								<Space>
									<MagicButton onClick={handleCancelEdit} disabled={editLoading}>
										{t("cancelModify")}
									</MagicButton>
									<MagicButton
										type="primary"
										onClick={handleConfirmEdit}
										loading={editLoading}
									>
										{t("confirmModify")}
									</MagicButton>
								</Space>
							</div>
						</Form>
					</div>
				)}

				{/* 无数据状态 */}
				{!loading && !error && !riskData && (
					<Alert
						message={t("noRiskInfo")}
						description={t("noRiskInfoDesc")}
						type="info"
						showIcon
						style={{ marginBottom: 16 }}
					/>
				)}
			</div>
		</Modal>
	)
}
