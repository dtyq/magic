import { memo } from "react"
import { observer } from "mobx-react-lite"
import { IconArrowRight } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { userStore } from "@/models/user"
import { formatTime } from "@/utils/string"
import { useStyles } from "../styles"

function isValidExpiryDate(date?: string) {
	if (!date) return false

	const endDateYear = new Date(date).getFullYear()
	const currentYear = new Date().getFullYear()

	return endDateYear >= currentYear && endDateYear - currentYear < 99
}

const SubscriptionCard = observer(() => {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("accountSetting")
	const { isAdmin, isPersonalOrganization, organizationSubscriptionInfo } = userStore.user
	const pendingSubscriptions = organizationSubscriptionInfo?.pending_subscriptions || []

	function formatExpiryDate(date?: string) {
		if (!date) return ""

		return t("expiresOn", {
			date: formatTime(new Date(date), "YYYY/MM/DD HH:mm:ss"),
		})
	}

	function formatEffectiveDate(date?: string) {
		if (!date) return ""
		return formatTime(new Date(date), "YYYY/MM/DD\nHH:mm:ss")
	}

	if (!isPersonalOrganization) {
		return (
			<div
				className={cx(styles.card, styles.borderLess)}
				data-testid="account-setting-team-subscription-card"
			>
				<div className={styles.sectionHeader}>
					<div className={styles.sectionLeft}>
						<div className={styles.sectionTitle}>{t("teamSubscription")}</div>
						<div className={styles.sectionSubtitle}>{t("activeSubscriptionInfo")}</div>
					</div>
					<div className={styles.sectionRight}>
						<div className={styles.subscriptionName}>
							{organizationSubscriptionInfo?.name || t("freeVersion")}
						</div>
						{isAdmin ? null : null}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div data-testid="account-setting-subscription-card">
			<div className={cx(styles.card, styles.borderLess)}>
				<div className={styles.sectionHeader}>
					<div className={styles.sectionLeft}>
						<div className={styles.sectionTitle}>{t("currentSubscription")}</div>
						<div className={styles.sectionSubtitle}>{t("activeSubscriptionInfo")}</div>
					</div>
					<div className={styles.sectionRight}>
						<div className={styles.subscriptionInfo}>
							<div className={styles.subscriptionRow}>
								<div className={styles.subscriptionName}>
									{organizationSubscriptionInfo?.name || t("freeVersion")}
								</div>
							</div>
							{isValidExpiryDate(organizationSubscriptionInfo?.end_date) ? (
								<div className={styles.expiryText}>
									{formatExpiryDate(organizationSubscriptionInfo?.end_date)}
								</div>
							) : null}
						</div>
					</div>
				</div>
			</div>
			{pendingSubscriptions.length > 0 ? (
				<div className={styles.pendingSubscriptions}>
					<div className={styles.sectionLeft}>
						<div className={styles.sectionTitle}>{t("pendingSubscription")}</div>
						<div className={styles.sectionSubtitle}>{t("pendingSubscriptionInfo")}</div>
					</div>
					<div className={styles.pendingChain}>
						{pendingSubscriptions.map((subscription, index) => (
							<div key={subscription.id} className={styles.subscriptionRow}>
								<div className={styles.pendingItem}>
									<div className={styles.pendingName}>{subscription.name}</div>
									<div className={styles.pendingTime}>
										{formatEffectiveDate(subscription.start_date)}
									</div>
								</div>
								{index < pendingSubscriptions.length - 1 ? (
									<div className={styles.arrowIcon}>
										<IconArrowRight size={16} />
									</div>
								) : null}
							</div>
						))}
					</div>
				</div>
			) : null}
		</div>
	)
})

export default memo(SubscriptionCard)
