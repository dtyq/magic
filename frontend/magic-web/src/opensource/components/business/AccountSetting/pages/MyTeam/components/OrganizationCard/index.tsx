import { memo } from "react"
import { Button } from "antd"
import { useTranslation } from "react-i18next"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import type { MyOrganization } from "@/opensource/types/contact"
import { useStyles } from "./styles"

interface OrganizationCardProps {
	organization: MyOrganization
}

function OrganizationCard({ organization }: OrganizationCardProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("accountSetting")

	function getRoleName() {
		if (organization.is_creator) return t("creator")
		if (organization.is_admin) return t("admin")
		return t("member")
	}

	return (
		<div className={styles.card} data-testid="account-setting-organization-card">
			<div className={styles.avatar}>
				<MagicAvatar
					src={organization.logo}
					alt={organization.name}
					className={styles.logo}
				>
					{organization.name}
				</MagicAvatar>
			</div>

			<div className={styles.content}>
				<div className={styles.header}>
					<span className={styles.name}>{organization.name}</span>
				</div>

				<div className={styles.tags}>
					<span className={styles.tag}>{getRoleName()}</span>
					{organization.product_name ? (
						<span className={styles.tag}>{organization.product_name}</span>
					) : null}
					{organization.seats !== undefined ? (
						<span className={styles.tag}>
							{t("teamMemberCount", { count: organization.seats })}
						</span>
					) : null}
				</div>
			</div>

			{organization.is_current ? (
				<Button type="text" disabled className={styles.currentButton}>
					{t("currentTeam")}
				</Button>
			) : null}
		</div>
	)
}

export default memo(OrganizationCard)
