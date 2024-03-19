import { memo } from "react"
import { Flex, Space } from "antd"
import { useTranslation } from "react-i18next"
import { PlatformPackage } from "@/types/platformPackage"
import { MagicAvatar, MagicButton, MobileCard, StatusTag } from "components"
import { createStyles } from "antd-style"
import { SYNC_STATUS_MAP } from "./index.page"

export const useStyles = createStyles(({ token, css }) => ({
	desc: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 12px;
	`,
}))

interface OrgCardProps {
	data?: PlatformPackage.Organization
	onClick?: (data: PlatformPackage.Organization) => void
	handleOpenModal: (code?: string) => void
}

function OrgCard({ data, onClick, handleOpenModal }: OrgCardProps) {
	const { t } = useTranslation("admin/platform/organization")
	const { styles } = useStyles()

	if (!data) return null

	return (
		<MobileCard
			title={`${data.name} (${data.magic_organization_code})`}
			onClick={() => onClick?.(data)}
		>
			<Flex vertical gap={6}>
				<Space size="small">
					<MagicAvatar size={32} shape="square" src={data.creator.avatar}>
						{data.creator.name}
					</MagicAvatar>
					<Flex vertical gap={4}>
						<span>{data.creator.name || "-"}</span>
						<span className={styles.desc}>MagicID:{data.creator.magic_id || "-"}</span>
					</Flex>
				</Space>
				<span>
					{t("seats")}: {data.seats}
				</span>
				<span>
					{t("syncTime")}: {data.sync_time || "-"}
				</span>
				<span>
					{t("createdAt")}: {data.created_at || "-"}
				</span>
				<Flex gap={2} align="flex-end">
					<StatusTag
						color={
							data.status === PlatformPackage.OrganizationStatus.Disabled
								? "warning"
								: "success"
						}
						bordered={false}
					>
						{data.status === PlatformPackage.OrganizationStatus.Disabled
							? t("disabled")
							: t("enable")}
					</StatusTag>
					<StatusTag color={SYNC_STATUS_MAP[data.sync_status].color} bordered={false}>
						{t(SYNC_STATUS_MAP[data.sync_status].label)}
					</StatusTag>
				</Flex>
				<Flex justify="end">
					<MagicButton
						type="link"
						onClick={() => handleOpenModal(data.magic_organization_code)}
					>
						{t("edit")}
					</MagicButton>
				</Flex>
			</Flex>
		</MobileCard>
	)
}

export default memo(OrgCard)
