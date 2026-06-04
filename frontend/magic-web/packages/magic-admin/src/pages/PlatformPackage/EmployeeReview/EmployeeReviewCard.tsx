import { memo } from "react"
import { Flex, Button } from "antd"
import { useTranslation } from "react-i18next"
import { MobileCard, StatusTag } from "@admin-components"
import type { PlatformPackage } from "@admin/types/platformPackage"

interface EmployeeReviewCardProps {
	data?: PlatformPackage.AgentVersionReview
	onClick?: (data: PlatformPackage.AgentVersionReview) => void
	reviewStatusMap: Record<string, { text: string; color: string }>
	publishStatusMap: Record<string, { text: string; color: string }>
	publishTargetTypeMap: Record<string, string>
	reviewLoading: boolean
	reviewingId: string
	reviewingAction?: PlatformPackage.ReviewSkillAction
	canReview: (record: PlatformPackage.AgentVersionReview) => boolean
	openApproveModal: (record: PlatformPackage.AgentVersionReview) => void
	handleReject: (record: PlatformPackage.AgentVersionReview) => void
	getLocalizedText: (value?: PlatformPackage.NameI18N | string) => string
}

function EmployeeReviewCard({
	data,
	onClick,
	reviewStatusMap,
	publishStatusMap,
	publishTargetTypeMap,
	reviewLoading,
	reviewingId,
	reviewingAction,
	canReview,
	openApproveModal,
	handleReject,
	getLocalizedText,
}: EmployeeReviewCardProps) {
	const { t } = useTranslation("admin/platform/employeeReview")

	if (!data) return null

	const disabled = !canReview(data)
	const rowLoading = reviewLoading && reviewingId === data.id
	const reviewInfo = reviewStatusMap[data.review_status]
	const publishInfo = publishStatusMap[data.publish_status]

	return (
		<MobileCard title={getLocalizedText(data.name_i18n)} onClick={() => onClick?.(data)}>
			<Flex vertical gap={6}>
				<span>
					{t("organization")}: {data.organization?.name || "-"}
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
				<span>
					{t("publishTargetType")}:{" "}
					{publishTargetTypeMap[data.publish_target_type] ||
						data.publish_target_type ||
						"-"}
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

export default memo(EmployeeReviewCard)
