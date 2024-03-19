import type { MagicModalProps } from "components"
import { MagicModal } from "components"
import { useTranslation } from "react-i18next"
import { Button, Form, Input, InputNumber, message } from "antd"
import { useState } from "react"
import { useApis } from "@/apis"
import type { PlatformPackage } from "@/types/platformPackage"
import type { OpenableProps } from "@/hooks/useOpenModal"

interface AddPointsModalProps extends OpenableProps<MagicModalProps> {
	selectedOrganization: PlatformPackage.OrgPointsList | null
	afterClose?: () => void
}

const AddPointsModal = ({
	selectedOrganization,
	onClose,
	afterClose,
	...props
}: AddPointsModalProps) => {
	const { t } = useTranslation("admin/platform/points")
	const [form] = Form.useForm()

	const { PlatformPackageApi } = useApis()
	const [open, setOpen] = useState(true)
	const [loading, setLoading] = useState(false)

	const handlePointsSubmit = async (values: {
		points: number
		description?: string
		type?: "add" | "subtract"
	}) => {
		if (!selectedOrganization || loading) return

		MagicModal.confirm({
			centered: true,
			title: t("organizationPointsPage.modal.confirmAddPointsTitle"),
			content: t("organizationPointsPage.modal.confirmAddPointsContent", {
				action:
					values.points > 0
						? t("organizationPointsPage.modal.add")
						: t("organizationPointsPage.modal.subtractAction"),
				organization: selectedOrganization.organization_name,
				points: values.points > 0 ? values.points : -values.points,
				user: selectedOrganization.creator_name,
			}),
			onOk: async () => {
				try {
					if (loading) return
					setLoading(true)
					// 调用增加积分的API
					await PlatformPackageApi.addOrganizationPoints({
						organization_code: selectedOrganization.organization_code,
						point_amount: values.points,
						description: values.description || "",
					})

					message.success(t("organizationPointsPage.message.addPointsSuccess"))
					setOpen(false)
					onClose?.()
					// 重新获取数据
					afterClose?.()
				} catch (error) {
					// console.error(t("organizationPointsPage.message.operationFailed"), error)
					message.error(t("organizationPointsPage.message.operationFailed"))
				} finally {
					setLoading(false)
					setOpen(false)
					onClose?.()
				}
			},
		})
	}

	const onCancel = () => {
		setOpen(false)
		onClose?.()
	}

	return (
		<MagicModal
			centered
			title={t("organizationPointsPage.modal.pointsOperationTitle")}
			footer={null}
			width={500}
			open={open}
			onCancel={onCancel}
			{...props}
		>
			{selectedOrganization && (
				<div style={{ marginBottom: 16 }}>
					<p>
						<strong>{t("organizationPointsPage.modal.organizationNameLabel")}</strong>
						{selectedOrganization.organization_name}
					</p>
					<p>
						<strong>{t("organizationPointsPage.modal.organizationCodeLabel")}</strong>
						{selectedOrganization.organization_code}
					</p>
					<p>
						<strong>{t("organizationPointsPage.modal.currentBalanceLabel")}</strong>
						{selectedOrganization.balance.toLocaleString()}
					</p>
				</div>
			)}

			<Form form={form} layout="vertical" onFinish={handlePointsSubmit}>
				<Form.Item
					name="points"
					label={t("organizationPointsPage.modal.pointsAmountLabel")}
					rules={[
						{
							required: true,
							message: "",
						},
					]}
				>
					<InputNumber
						style={{ width: "100%" }}
						placeholder={t("organizationPointsPage.modal.pointsAmountPlaceholder")}
					/>
				</Form.Item>

				<Form.Item name="description" label={t("organizationPointsPage.modal.remarkLabel")}>
					<Input.TextArea
						style={{ width: "100%" }}
						placeholder={t("organizationPointsPage.modal.remarkPlaceholder")}
						rows={3}
						maxLength={200}
						showCount
					/>
				</Form.Item>

				<Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
					<Button onClick={onCancel} style={{ marginRight: 8 }}>
						{t("organizationPointsPage.modal.cancelButton")}
					</Button>
					<Button type="primary" htmlType="submit">
						{t("organizationPointsPage.modal.confirmButton")}
					</Button>
				</Form.Item>
			</Form>
		</MagicModal>
	)
}

export default AddPointsModal
