import { memo } from "react"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { MobileCard } from "components"
import type { PlatformPackage } from "@/types/platformPackage"

interface PointsCardProps {
	data?: PlatformPackage.OrgPointsList
	onClick?: (data: PlatformPackage.OrgPointsList) => void
	getButtons: (data: PlatformPackage.OrgPointsList) => React.ReactNode
}

function PointsCard({ data, onClick, getButtons }: PointsCardProps) {
	const { t } = useTranslation("admin/platform/points")

	if (!data) return null

	return (
		<MobileCard
			title={`${data.organization_name} (${data.organization_code})`}
			onClick={() => onClick?.(data)}
		>
			<Flex vertical gap={6}>
				<span>
					{t("organizationPointsPage.columns.creator")}: {data.creator_name}
				</span>
				<span>
					{t("organizationPointsPage.columns.currentPlan")}: {data.current_plan}
				</span>
				<span>
					{t("organizationPointsPage.columns.balance")}: {data.balance}
				</span>
				<span>
					{t("organizationPointsPage.columns.usedPoints")}: {data.used_points}
				</span>
				<span>
					{t("organizationPointsPage.columns.invitationCode")}: {data.invitation_code}
				</span>
			</Flex>
			<Flex justify="end">{getButtons(data)}</Flex>
		</MobileCard>
	)
}

export default memo(PointsCard)
