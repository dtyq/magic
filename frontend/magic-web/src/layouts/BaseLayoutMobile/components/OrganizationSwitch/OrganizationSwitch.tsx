import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"

import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import AccountCard from "@/components/business/AccountCard"
import { useAccount } from "@/models/user/hooks"
import { useClusterConfig } from "@/models/config/hooks"
import useLogout from "@/hooks/account/useLogout"
import { getPlatformName } from "@/utils/getPlatformName"

import type { OrganizationSwitchProps } from "./types"
import type { User } from "@/types/user"

import { cn } from "@/utils/cn"

/**
 * OrganizationSwitch - Mobile organization switching component
 *
 * @param props - Component properties
 * @returns JSX.Element
 */
function OrganizationSwitchComponent(props: OrganizationSwitchProps) {
	const { className, style, onClose, onSwitchBefore } = props

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
		<div
			className={cn("h-full min-h-0 w-full overflow-hidden bg-neutral-50", className)}
			style={style}
		>
			<ScrollArea
				className="h-full"
				// Account cards must fit the viewport rather than Radix's intrinsic table width.
				viewportClassName="p-2.5 [&>div]:!block"
			>
				<div className="flex flex-col gap-2.5">
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
				</div>
			</ScrollArea>
		</div>
	)
}

const OrganizationSwitch = observer(OrganizationSwitchComponent)

OrganizationSwitch.displayName = "OrganizationSwitch"

export default OrganizationSwitch
