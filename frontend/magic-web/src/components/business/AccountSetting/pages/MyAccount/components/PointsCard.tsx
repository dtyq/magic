import { memo, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { IconAlertCircle } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { userStore } from "@/models/user"
import { formatTime } from "@/utils/string"
import { useStyles } from "../styles"

const PointsCard = observer(() => {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("accountSetting")
	const { isPersonalOrganization, organizationPoints, organizationPointsInfo } = userStore.user

	const expiringInfo = useMemo(() => {
		if (!organizationPointsInfo?.expiring_quota_details?.length) return null

		const now = new Date()
		const validQuotas = organizationPointsInfo.expiring_quota_details.filter(
			(quota) => quota.remaining_points > 0,
		)

		if (!validQuotas.length) return null

		const nearestQuota = validQuotas.reduce((nearest, current) => {
			const nearestDate = new Date(nearest.expires_at)
			const currentDate = new Date(current.expires_at)
			return currentDate < nearestDate ? current : nearest
		})

		const expiresAt = new Date(nearestQuota.expires_at)
		const daysRemaining = Math.ceil(
			(expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
		)

		return {
			points: nearestQuota.remaining_points,
			days: daysRemaining > 0 ? daysRemaining : 0,
		}
	}, [organizationPointsInfo?.expiring_quota_details])

	const nextCycleInfo = useMemo(() => {
		if (!organizationPointsInfo?.next_cycle_grant?.scheduled_at) return null

		const scheduledAt = new Date(organizationPointsInfo.next_cycle_grant.scheduled_at)
		return {
			date: formatTime(scheduledAt, "YYYY/MM/DD"),
			points: organizationPointsInfo.next_cycle_grant.points,
		}
	}, [organizationPointsInfo?.next_cycle_grant])

	return (
		<div data-testid="account-setting-points-card">
			<div className={cx(styles.card, styles.borderLess, styles.borderTop)}>
				<div className={styles.sectionHeader}>
					<div className={styles.sectionLeft}>
						<div className={styles.sectionTitle}>{t("availablePoints")}</div>
						<div className={styles.sectionSubtitle}>{t("allPointsIncluded")}</div>
					</div>
					<div className={styles.sectionRight}>
						<div className={styles.pointsInfo}>
							<div className={styles.subscriptionRow}>
								<div className={styles.pointsValue}>
									{organizationPoints.toLocaleString()}
								</div>
							</div>
							{expiringInfo && expiringInfo.points > 0 && expiringInfo.days > 0 ? (
								<div className={styles.warningRow}>
									<div className={styles.warningIcon}>
										<IconAlertCircle size={16} />
									</div>
									<div className={styles.warningText}>
										{t("pointsExpiring", {
											days: expiringInfo.days,
											points: expiringInfo.points.toLocaleString(),
										})}
									</div>
								</div>
							) : null}
						</div>
					</div>
				</div>
			</div>
			{isPersonalOrganization && nextCycleInfo ? (
				<div className={styles.nextCycleInfoContainer}>
					<div className={styles.sectionLeft}>
						<div className={styles.sectionTitle}>{t("nextCycleDistribution")}</div>
						<div className={styles.sectionSubtitle}>
							{t("nextCycleDistributionInfo")}
						</div>
					</div>
					<div className={styles.sectionRight}>
						<div className={styles.nextCycleInfo}>
							<div className={styles.nextCycleText}>
								<div className={styles.nextCycleDate}>{nextCycleInfo.date}</div>
								<div className={styles.nextCycleHint}>
									{t("willBeDistributed", {
										points: nextCycleInfo.points.toLocaleString(),
									})}
								</div>
							</div>
						</div>
					</div>
				</div>
			) : null}
		</div>
	)
})

PointsCard.displayName = "PointsCard"

export default memo(PointsCard)
