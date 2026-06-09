import { memo } from "react"
import { Flex, Button } from "antd"
import { useTranslation } from "react-i18next"
import { MobileCard, StatusTag } from "@admin-components"
import type { PlatformPackage } from "@admin/types/platformPackage"

interface SkillManagementCardProps {
	data?: PlatformPackage.SkillVersion
	onClick?: (data: PlatformPackage.SkillVersion) => void
	reviewStatusMap: Record<string, { text: string; color: string }>
	publishStatusMap: Record<string, { text: string; color: string }>
	reviewLoading: boolean
	reviewingId: string
	reviewingAction?: PlatformPackage.ReviewSkillAction
	canReview: (record: PlatformPackage.SkillVersion) => boolean
	openApproveModal: (record: PlatformPackage.SkillVersion) => void
	handleReject: (record: PlatformPackage.SkillVersion) => void
	getLocalizedText: (value?: PlatformPackage.NameI18N) => string
}

function SkillManagementCard({
	data,
	onClick,
	reviewStatusMap,
	publishStatusMap,
	reviewLoading,
	reviewingId,
	reviewingAction,
	canReview,
	openApproveModal,
	handleReject,
	getLocalizedText,
}: SkillManagementCardProps) {
	const { t } = useTranslation("admin/platform/skill")

	if (!data) return null

	const disabled = !canReview(data)
	const rowLoading = reviewLoading && reviewingId === data.id
	const reviewInfo = reviewStatusMap[data.review_status]
	const publishInfo = publishStatusMap[data.publish_status]

	return (
		<MobileCard title={getLocalizedText(data.name_i18n)} onClick={() => onClick?.(data)}>
			<Flex vertical gap={6}>
				<span>
					{t("packageName")}: {data.package_name || "-"}
				</span>
				<span>
					{t("version")}: {data.version || "-"}
				</span>
				<span>
					{t("publisher")}: {data.publisher?.nickname || "-"}
				</span>
				<span>
					{t("createdAt")}: {data.created_at || "-"}
				</span>
				<Flex gap={8} wrap="wrap">
					{reviewInfo && (
						<StatusTag color={reviewInfo.color} bordered={false}>
							{reviewInfo.text}
						</StatusTag>
					)}
					{publishInfo && (
						<StatusTag color={publishInfo.color} bordered={false}>
							{publishInfo.text}
						</StatusTag>
					)}
				</Flex>
				<Flex justify="end" gap={8}>
					<Button
						type="link"
						disabled={disabled || rowLoading}
						loading={rowLoading && reviewingAction === "APPROVED"}
						onClick={() => openApproveModal(data)}
					>
						{t("approve")}
					</Button>
					<Button
						type="link"
						danger
						disabled={disabled || rowLoading}
						loading={rowLoading && reviewingAction === "REJECTED"}
						onClick={() => handleReject(data)}
					>
						{t("reject")}
					</Button>
				</Flex>
			</Flex>
		</MobileCard>
	)
}

export default memo(SkillManagementCard)
