import { useMemoizedFn } from "ahooks"
import { useClusterCode } from "@/opensource/providers/ClusterProvider"
import { userStore } from "@/opensource/models/user"
import { userService } from "@/services"

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
			await userService.switchAccount(unionId, magic_user_id, magic_organization_code)
		},
	)

	/**
	 * @description 退出登录，不仅要销毁token，还需要移除帐号管理中的记录 (兼容指定 magicId 账号退出，不传则退出当前账号)
	 */
	const accountLogout = useMemoizedFn(async (magicId?: string) => {
		await userService.deleteAccount(magicId)
	})

	/** 账号初始化，每次应用初始化时都需要重新获取所有登录过账号的组织 */
	const accountFetch = useMemoizedFn(async () => {
		await userService.fetchAccount()
	})

	return {
		accountLogout,
		accountSwitch,
		accountFetch,
	}
}
