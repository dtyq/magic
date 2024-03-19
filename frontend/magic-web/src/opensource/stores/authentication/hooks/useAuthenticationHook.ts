import { useMemoizedFn } from "ahooks"
import { useClusterCode } from "@/opensource/providers/ClusterProvider"
import { userStore } from "@/opensource/models/user"
import { service } from "@/opensource/services"
import type { AccountService } from "@/opensource/services/user/AccountService"
import { BroadcastChannelSender } from "@/opensource/broadcastChannel"

export function useAccount() {
	const { setClusterCode } = useClusterCode()

	/**
	 * @description 账号切换
	 * @param {string} magicId magic生态下的唯一Id
	 */
	const accountSwitch = useMemoizedFn(
		async (unionId: string, magic_user_id: string, magic_organization_code: string) => {
			const { accounts } = userStore.account
			const account = accounts.find((o) => o.magic_id === unionId)
			if (account) {
				setClusterCode(account?.deployCode)
			}
			await service
				.get<AccountService>("accountService")
				.switchAccount(unionId, magic_organization_code)
			/** 广播切换账号 */
			BroadcastChannelSender.switchAccount({
				magicId: unionId,
				magicUserId: magic_user_id,
				magicOrganizationCode: magic_organization_code,
			})
		},
	)

	/**
	 * @description 退出登录，不仅要销毁token，还需要移除帐号管理中的记录 (兼容指定 magicId 账号退出，不传则退出当前账号)
	 */
	const accountLogout = useMemoizedFn(async (magicId?: string) => {
		await service.get<AccountService>("accountService").deleteAccount(magicId)
	})

	/** 账号初始化，每次应用初始化时都需要重新获取所有登录过账号的组织 */
	const accountFetch = useMemoizedFn(async () => {
		await service.get<AccountService>("accountService").fetchAccount()
	})

	return {
		accountLogout,
		accountSwitch,
		accountFetch,
	}
}
