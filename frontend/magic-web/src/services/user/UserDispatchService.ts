import { userStore } from "@/models/user"
import { LoginValueKey } from "@/pages/login/constants"
import { service } from "../index"
import { User } from "@/types/user"
import { getHomeURL } from "@/utils/redirect"
import { cloneDeep, has } from "lodash-es"
import { history } from "@/routes/history"
import { RouteName } from "@/routes/constants"
import { convertSearchParams, getRoutePath, routesMatch } from "@/routes/history/helpers"
import { defaultClusterCode } from "@/routes/helpers"
import { appService } from "../app/AppService"
import type { UserService } from "./UserService"
import type { AccountService } from "./AccountService"

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

		const userService = service.get<UserService>("userService")

		try {
			userService.setUserInfo(data.userInfo)
			userService.setMagicOrganizationCode(data.magicOrganizationCode)
			await appService.initUserData(data.userInfo)
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
	switchAccount: async (data: { magicId: string; magicOrganizationCode: string }) => {
		const accountService = service.get<AccountService>("accountService")
		await accountService.switchAccount(data.magicId, data.magicOrganizationCode)
	},

	/**
	 * @description 更新用户信息
	 * @param data
	 */
	updateUserInfo: async (data: { userInfo: User.UserInfo }) => {
		const userService = service.get<UserService>("userService")
		userService.setUserInfo(data.userInfo)
	},

	/**
	 * @description 添加账号
	 * 注意，账号涉及路由重定向，必须使用 window.location.replace 触发页面重新渲染，而非 history.replace
	 * @param data
	 */
	addAccount: async (data: { userAccount: User.UserAccount }) => {
		// 如果当前页面是登录页面，则刷新页面
		if (location.pathname === getRoutePath({ name: RouteName.Login })) {
			const url = new URL(window.location.href)
			const { searchParams } = url
			/** 从定向URL这里，如果是站点外就需要考虑是否需要携带 */
			const redirectURI = searchParams.get(LoginValueKey.REDIRECT_URL)
			try {
				if (redirectURI) {
					// 需要考虑集群编码替换问题
					const redirect = new URL(decodeURIComponent(redirectURI))
					const matchesRoute = routesMatch(redirect.pathname)
					if (matchesRoute) {
						const newPath = getRoutePath({
							name: matchesRoute?.route?.name || RouteName.Chat,
							params: {
								...(matchesRoute?.params || {}),
								clusterCode: data?.userAccount?.deployCode || defaultClusterCode,
							},
							query: convertSearchParams(redirect.searchParams),
						}) as string
						window.location.replace(newPath)
					} else {
						window.location.replace(decodeURIComponent(redirectURI))
					}
				} else {
					throw new Error("not redirectURI")
				}
			} catch (error) {
				console.error(error)
				getHomeURL().then(({ name }) => {
					const path = getRoutePath({
						name,
						params: {
							clusterCode: data.userAccount?.deployCode ?? defaultClusterCode,
						},
					})
					if (path) {
						window.location.replace(path)
					}
				})
			}
		} else if (
			userStore.user.userInfo?.magic_id !== data.userAccount.magic_id ||
			userStore.user.userInfo?.user_id !== data.userAccount.magic_user_id ||
			userStore.user.organizationCode !== data.userAccount.organizationCode ||
			userStore.user.authorization !== data.userAccount.access_token
		) {
			// 内存状态同步
			userStore.account.setAccount(data.userAccount)

			const accountService = service.get<AccountService>("accountService")
			await accountService.switchAccount(
				data.userAccount.magic_id,
				data.userAccount.organizationCode,
			)

			// 当且仅当路由存在名称且存在集群编码的路由参数时需要重定向替换路由参数(集群不一致时则需要执行)
			const matchesRoute = routesMatch(window.location.pathname)

			// 如果当前账号不存在，则直接切换
			const newAccount = userStore.account.getAccountByMagicId(data?.userAccount.magic_id)
			if (
				matchesRoute?.route?.name &&
				has(matchesRoute?.params || {}, "clusterCode") &&
				newAccount?.deployCode !== matchesRoute?.params?.clusterCode
			) {
				const url = new URL(window.location.href)
				history.replace({
					name: matchesRoute?.route?.name,
					params: {
						...(matchesRoute?.params || {}),
						clusterCode: newAccount?.deployCode || defaultClusterCode,
					},
					query: convertSearchParams(url.searchParams),
				})
			}
			// if (userStore.user.authorization !== data.userAccount.deployCode) {
			//
			// }
			// history.replace({
			// 	name: RouteName.Chat,
			// 	clusterCode: data.userAccount?.deployCode ?? "",
			// })
		}
	},

	/**
	 * @description 更新账号
	 * @param data
	 */
	updateAccount: async (data: { magicId: string; userAccount: Partial<User.UserAccount> }) => {
		if (userStore.account.accounts.find((acc) => acc.magic_id === data.magicId)) {
			userStore.account.updateAccount(data.magicId, data.userAccount)
		}
	},

	/**
	 * @description 删除账号
	 * @param data
	 */
	deleteAccount: async (data: { magicId?: string; navigateToLogin?: boolean }) => {
		const accountService = service.get<AccountService>("accountService")
		await accountService.deleteAccount(data.magicId)
		if (data.navigateToLogin) {
			history.push({ name: RouteName.Login })
		}
	},
}

export default UserDispatchService
