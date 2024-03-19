import { useMemoizedFn } from "ahooks"
import { User } from "@/opensource/types/user"
import { useUserInfo } from "@/opensource/models/user/hooks"
import { appService } from "@/opensource/services/app/AppService"

/**
 * @description 切换组织
 * @param disabled 是否禁用
 * @param onSwitchAfter 切换后回调
 * @param onSwitchBefore 切换前回调
 * @returns 切换组织函数
 */
export function useSwitchOrganization({
	disabled,
	onSwitchBefore,
	onSwitchAfter,
}: {
	disabled: boolean
	onSwitchBefore?: () => void
	onSwitchAfter?: () => void
}) {
	const { userInfo } = useUserInfo()

	return useMemoizedFn(
		async (accountInfo: User.UserAccount, organizationInfo: User.MagicOrganization) => {
			if (disabled) {
				return
			}

			onSwitchBefore?.()

			await appService.switchOrganization(
				accountInfo,
				organizationInfo,
				userInfo,
				onSwitchAfter,
			)
		},
	)
}
