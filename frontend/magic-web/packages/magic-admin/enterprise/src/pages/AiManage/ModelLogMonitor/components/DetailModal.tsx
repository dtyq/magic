import { useState } from "react"
import { Descriptions, Flex, Typography } from "antd"
import type { MagicModalProps } from "@admin-components"
import { MagicButton, MagicModal } from "@admin-components"
import type { OpenableProps } from "@admin/hooks/useOpenModal"
import type { AiManage } from "@admin/types/aiManage"
import { useTranslation } from "react-i18next"
import { useStyles } from "../styles"
import { getServiceProviderLabel, getServiceProviderCategoryLabel, getStatusLabel } from "../utils"

export interface DetailModalProps extends OpenableProps<Omit<MagicModalProps, "onOk">> {
	type: "provider" | "model"
	provider?: AiManage.ServiceProviderList | null
	model?: AiManage.ModelInfo | null
	serviceProviderLabel?: string
	onApply?: () => void
}

export default function DetailModal({
	type,
	provider,
	model,
	serviceProviderLabel,
	onApply,
	onClose,
	...props
}: DetailModalProps) {
	const { t } = useTranslation("admin/ai/statistics")
	const { styles } = useStyles()
	const [open, setOpen] = useState(true)

	const handleClose = () => {
		setOpen(false)
		onClose?.()
	}

	const handleApply = () => {
		onApply?.()
		handleClose()
	}

	const title =
		type === "provider" ? t("detail.providerTitle") : t("detail.modelTitle")

	return (
		<MagicModal centered open={open} title={title} footer={null} onCancel={handleClose} {...props}>
			{type === "provider" ? (
				provider ? (
					<Flex vertical gap={16}>
						<Descriptions column={1} bordered size="small">
							<Descriptions.Item label={t("detail.providerName")}>
								<span className={styles.detailValue}>
									{getServiceProviderLabel(provider)}
								</span>
							</Descriptions.Item>
							<Descriptions.Item label={t("detail.alias")}>
								<span className={styles.detailValue}>{provider.alias || "-"}</span>
							</Descriptions.Item>
							<Descriptions.Item label={t("detail.serviceProviderId")}>
								<span className={styles.detailValue}>{provider.id}</span>
							</Descriptions.Item>
							<Descriptions.Item label={t("detail.serviceProviderCategory")}>
								<span className={styles.detailValue}>
									{getServiceProviderCategoryLabel(provider.category, t)}
								</span>
							</Descriptions.Item>
							<Descriptions.Item label={t("detail.status")}>
								{getStatusLabel(provider.status, t)}
							</Descriptions.Item>
						</Descriptions>
						<Flex justify="flex-end">
							<MagicButton type="primary" onClick={handleApply}>
								{t("detail.applyProviderFilter")}
							</MagicButton>
						</Flex>
					</Flex>
				) : (
					<Typography.Text>{t("detail.providerNotFound")}</Typography.Text>
				)
			) : model ? (
				<Flex vertical gap={16}>
					<Descriptions column={1} bordered size="small">
						<Descriptions.Item label={t("detail.modelId")}>
							<span className={styles.detailValue}>{model.model_id}</span>
						</Descriptions.Item>
						<Descriptions.Item label={t("detail.modelName")}>
							<span className={styles.detailValue}>{model.name || "-"}</span>
						</Descriptions.Item>
						<Descriptions.Item label={t("detail.modelVersion")}>
							<span className={styles.detailValue}>{model.model_version || "-"}</span>
						</Descriptions.Item>
						<Descriptions.Item label={t("detail.serviceProviderName")}>
							<span className={styles.detailValue}>
								{serviceProviderLabel || "-"}
							</span>
						</Descriptions.Item>
						<Descriptions.Item label={t("detail.serviceProviderId")}>
							<span className={styles.detailValue}>
								{model.service_provider_config_id}
							</span>
						</Descriptions.Item>
						<Descriptions.Item label={t("detail.status")}>
							{getStatusLabel(model.status, t)}
						</Descriptions.Item>
					</Descriptions>
					<Flex justify="flex-end">
						<MagicButton type="primary" onClick={handleApply}>
							{t("detail.applyModelFilter")}
						</MagicButton>
					</Flex>
				</Flex>
			) : (
				<Typography.Text>{t("detail.modelNotFound")}</Typography.Text>
			)}
		</MagicModal>
	)
}
