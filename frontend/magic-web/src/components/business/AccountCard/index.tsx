import { memo, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { Flex, Skeleton } from "antd"
import { useMemoizedFn } from "ahooks"

// Types
import type { AccountCardProps } from "./types"

// Styles
import { useOrganizationSwitchStyles } from "./styles"
import ComponentRender from "@/components/ComponentRender"
import { DefaultComponents } from "@/components/ComponentRender/config/defaultComponents"
import { keyBy } from "lodash-es"
import { useTranslation } from "react-i18next"
import { useUserInfo } from "@/models/user/hooks"
import { User } from "@/types/user"
import AntdSkeleton from "@/components/base/AntdSkeleton"

/**
 * AccountCard - Account section with organizations
 */
const AccountCardComponent = (props: AccountCardProps) => {
	const {
		account,
		accountIndex,
		platformName,
		onLogout,
		onClose,
		onSwitchBefore,
		showPlatformName = true,
	} = props

	const { t } = useTranslation("interface")
	const { styles } = useOrganizationSwitchStyles()

	const { userInfo } = useUserInfo()

	// Check if organization is selected
	const isOrganizationSelected = useCallback(
		(organization: User.MagicOrganization) => {
			return (
				userInfo?.user_id === organization?.magic_user_id &&
				userInfo?.organization_code === organization?.magic_organization_code
			)
		},
		[userInfo?.user_id, userInfo?.organization_code],
	)
	// Handle logout click
	const handleLogoutClick = useMemoizedFn(() => {
		onLogout?.(account)
	})

	// Format phone number
	const formatPhone = (phone: string) => {
		if (!phone) return ""
		return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
	}

	const validOrgs = keyBy(account.organizations, "third_platform_organization_code")

	return (
		<div className={styles.accountCard}>
			<Flex vertical gap={8}>
				{/* Platform Header */}
				{showPlatformName && <div className={styles.platformHeader}>{platformName}</div>}

				{/* Account Info */}
				<Flex justify="space-between" align="center" className={styles.accountInfo}>
					<Flex align="center" gap={10}>
						{/* Account Badge */}
						<div className={styles.accountBadge}>
							{t("sider.accountTitle")} {accountIndex + 1}
						</div>

						{/* Phone Number */}
						<div className={styles.accountPhone}>
							{formatPhone(account.nickname || account.magic_id)}
						</div>
					</Flex>

					{/* Logout Button */}
					{onLogout && (
						<div className={styles.logoutButton} onClick={handleLogoutClick}>
							{t("common.logout")}
						</div>
					)}
				</Flex>

				{/* Organization List */}
				<Flex vertical className={styles.organizationList}>
					{account.teamshareOrganizations?.map((organization) => {
						const magicOrganization = validOrgs[organization.organization_code]

						const isSelected = isOrganizationSelected(magicOrganization)

						return (
							<ComponentRender
								key={
									magicOrganization?.magic_organization_code ??
									organization.organization_code
								}
								componentName={DefaultComponents.OrganizationItem}
								loadingFallback={
									<Flex
										align="center"
										justify="space-between"
										gap={10}
										key={
											magicOrganization?.magic_organization_code ??
											organization.organization_code
										}
									>
										<AntdSkeleton.Avatar
											active
											size="small"
											shape="square"
											style={{ borderRadius: 6 }}
										/>
										<AntdSkeleton.Input
											active
											size="small"
											block
											style={{ flex: 1, borderRadius: 6 }}
										/>
									</Flex>
								}
								account={account}
								organization={magicOrganization}
								thirdPlatformOrganization={organization}
								isSelected={isSelected}
								hasBadge={false}
								onSwitchBefore={onSwitchBefore}
								onSwitchAfter={onClose}
							/>
						)
					})}
				</Flex>
			</Flex>
		</div>
	)
}

const AccountCard = memo(observer(AccountCardComponent))

AccountCard.displayName = "AccountCard"

export default AccountCard
