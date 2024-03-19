import { observer } from "mobx-react-lite"
import { Flex } from "antd"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"

import MagicScrollBar from "@/opensource/components/base/MagicScrollBar"
import AccountCard from "@/opensource/components/business/AccountCard"
import { useAccount } from "@/opensource/models/user/hooks"
import { useClusterConfig } from "@/opensource/models/config/hooks"
import useLogout from "@/opensource/hooks/account/useLogout"
import { getPlatformName } from "@/opensource/utils/getPlatformName"

import type { OrganizationSwitchProps } from "./types"
import type { User } from "@/opensource/types/user"

import { useOrganizationSwitchStyles } from "./styles"

/**
 * OrganizationSwitch - Mobile organization switching component
 *
 * @param props - Component properties
 * @returns JSX.Element
 */
function OrganizationSwitchComponent(props: OrganizationSwitchProps) {
	const { className, style, onClose, onSwitchBefore } = props

	const { styles, cx } = useOrganizationSwitchStyles()
	const { accounts } = useAccount()
	const { clustersConfig } = useClusterConfig()
	const { t } = useTranslation("interface")
	const triggerLogout = useLogout({
		onConfirm: () => {
			onClose?.()
		},
	})

	const handleLogout = useMemoizedFn(async (account: User.UserAccount) => {
		try {
			await triggerLogout(account)
		} catch (error) {
			console.error("Logout failed:", error)
		}
	})

	if (!accounts || accounts.length === 0) {
		return null
	}

	return (
		<div className={cx(styles.container, className)} style={style}>
			<MagicScrollBar className={styles.scrollContainer} autoHide>
				<Flex vertical gap={10}>
					{accounts.map((account, accountIndex) => {
						const platformName = getPlatformName(
							account,
							clustersConfig,
							t("sider.saasPlatform"),
						)

						return (
							<AccountCard
								key={account.magic_id}
								account={account}
								platformName={platformName}
								accountIndex={accountIndex}
								onLogout={handleLogout}
								onClose={onClose}
								onSwitchBefore={onSwitchBefore}
							/>
						)
					})}
				</Flex>
			</MagicScrollBar>
		</div>
	)
}

const OrganizationSwitch = observer(OrganizationSwitchComponent)

OrganizationSwitch.displayName = "OrganizationSwitch"

export default OrganizationSwitch
