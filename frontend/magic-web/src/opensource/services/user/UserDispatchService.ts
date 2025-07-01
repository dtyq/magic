import { RoutePath } from "@/const/routes"
import { userStore } from "@/opensource/models/user"
import { LoginValueKey } from "@/opensource/pages/login/constants"
import { userService } from "@/services"
import { User } from "@/types/user"
import { cloneDeep } from "lodash-es"

const UserDispatchService = {
	/**
	 * @description 切换组织
	 * @param data
	 */
	switchOrganization: async (data: {
		userInfo: User.UserInfo
		magicOrganizationCode: string
	}) => {
		const oldUserInfo = cloneDeep(userStore.user.userInfo)
		const oldMagicOrganizationCode = userStore.user.organizationCode

		try {
			userService.setUserInfo(data.userInfo)
			userService.setMagicOrganizationCode(data.magicOrganizationCode)
			await userService.loadUserInfo(data.userInfo, { showSwitchLoading: true })
		} catch (err) {
			// 切换失败，恢复当前组织
			userService.setUserInfo(oldUserInfo)
			userService.setMagicOrganizationCode(oldMagicOrganizationCode)
		}
	},

	/**
	 * @description 切换账号
	 * @param data
	 */
	switchAccount: async (data: {
		magicId: string
		magicUserId: string
		magicOrganizationCode: string
	}) => {
		await userService.switchAccount(data.magicId, data.magicUserId, data.magicOrganizationCode)
	},

	/**
	 * @description 添加账号
	 * @param data
	 */
	addAccount: async (data: { userAccount: User.UserAccount }) => {
		// 如果当前页面是登录页面，则刷新页面
		if (location.pathname === RoutePath.Login) {
			const url = new URL(window.location.href)
			const { searchParams } = url
			/** 从定向URL这里，如果是站点外就需要考虑是否需要携带 */
			const redirectURI = searchParams.get(LoginValueKey.REDIRECT_URL)
			if (redirectURI) {
				window.location.assign(decodeURIComponent(redirectURI))
			} else {
				window.location.assign(RoutePath.Chat)
			}
		} else {
			// 内存状态同步
			userStore.account.setAccount(data.userAccount)

			await userService.switchAccount(
				data.userAccount.magic_id,
				data.userAccount.magic_user_id,
				data.userAccount.organizationCode,
			)
		}
	},

	/**
	 * @description 删除账号
	 * @param data
	 */
	deleteAccount: async (data: { magicId?: string; navigateToLogin?: boolean }) => {
		userService.deleteAccount(data.magicId)
		if (data.navigateToLogin) {
			window.location.assign(RoutePath.Login)
		}
	},
}

export default UserDispatchService
