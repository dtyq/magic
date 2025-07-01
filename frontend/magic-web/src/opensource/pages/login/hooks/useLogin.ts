// import { useService } from "@/components/providers/ServiceProvider/context"
// import { useMemoizedFn } from "ahooks"
// import { useFetchUserInfo, useUserStore } from "@/stores/user"
// import { useDeploymentStore } from "@/stores/deployment"
// import { LoginValueKey } from "@/opensource/pages/login/constants"
// import { RoutePath } from "@/const/routes"
// import { Login } from "@/types/login"
// import type { User } from "@/types/user"
// import type { LoginFormValuesMap } from "@/opensource/pages/login/types"
// import { useAuthenticationStore } from "@/stores/authentication"
// import { useNavigate } from "@/opensource/hooks/useNavigate"
// import { keyBy } from "lodash-es"
// import { useTranslation } from "react-i18next"
// import { getDeviceInfo } from "@/utils/devices"
// import { message } from "antd"
//
// export interface LoginStepResult {
// 	access_token: string
// 	magicOrganizationMap: Record<string, User.MagicOrganization>
// 	organizations?: Array<User.UserOrganization>
// 	/** magic 生态下的组织Code */
// 	organizationCode?: string
// 	/** teamshare 生态下的组织Code */
// 	teamshareOrganizationCode?: string
// 	deployCode?: string
// }
//
// /**
//  * @description 登录流程（登录类型一：验证码/手机号+密码，登录类型二：第三方登录钉钉/飞书/企微）
//  */
// export function useLogin() {
// 	const { getUserInfo, setUserInfo } = useFetchUserInfo()
// 	const { UserService, AuthService, CommonService } = useService()
// 	const navigate = useNavigate()
// 	const { i18n, t } = useTranslation("login")
//
// 	/** Step 1: 登录 */
// 	const loginStep = useMemoizedFn(
// 		<T extends Login.LoginType>(type: T, values: LoginFormValuesMap[T]) => {
// 			return async () => {
// 				values.device = await getDeviceInfo(i18n)
// 				switch (type) {
// 					case Login.LoginType.MobilePhonePassword:
// 						return UserService.login(
// 							type,
// 							values as Login.MobilePhonePasswordFormValues,
// 						)
// 					case Login.LoginType.SMSVerificationCode:
// 						return UserService.login(
// 							type,
// 							values as Login.SMSVerificationCodeFormValues,
// 						)
// 					case Login.LoginType.DingTalkScanCode:
// 					case Login.LoginType.DingTalkAvoid:
// 					case Login.LoginType.LarkScanCode:
// 					case Login.LoginType.WecomScanCode:
// 					case Login.LoginType.WechatOfficialAccount:
// 						return UserService.thirdPartyLogins(
// 							values as Login.ThirdPartyLoginsFormValues,
// 						)
// 					default:
// 						throw new Error("缺少登录类型")
// 				}
// 			}
// 		},
// 	)
//
// 	/** 当前账号环境编号获取 */
// 	const deployCodeSyncStep = useMemoizedFn(async () => {
// 		try {
// 			const { login_code } = await AuthService.getAccountDeployCode()
// 			// PrivateDeploymentStore.setState((preState) => {
// 			// 	preState.currentPrivateDeploymentCode = login_code
// 			// })
// 			return login_code
// 		} catch (error: any) {
// 			const newMessage = `magicOrganizationSyncStep: ${error.message}`
// 			const newError = new Error(newMessage)
// 			newError.stack = error?.stack
// 			return Promise.reject(error)
// 		}
// 	})
//
// 	/** Step: 环境同步（私有化环境配置同步） */
// 	const envSyncStep = useMemoizedFn(async (code: string) => {
// 		const { config } = await CommonService.getPrivateConfigure(code)
// 		useDeploymentStore.setState((preState) => {
// 			preState.config[code] = config
// 			preState.deployCodeCache = code
// 		})
// 		return Promise.resolve(config)
// 	})
//
// 	/** Step 2: 根据环境同步 magic 组织 */
// 	const magicOrganizationSyncStep = useMemoizedFn(
// 		(deployCode: string, inModal: boolean = false) => {
// 			return async (
// 				params: Login.UserLoginsResponse | { access_token: string },
// 				teamshareOrganizationCode?: string,
// 			): Promise<Omit<LoginStepResult, "organizationCode">> => {
// 				try {
// 					const { access_token } = params
// 					const result = await AuthService.bindMagicAuthorization(
// 						access_token,
// 						deployCode,
// 						teamshareOrganizationCode,
// 					)
// 					const magicOrganizationMap = keyBy(result, "third_platform_organization_code")
// 					return { access_token, magicOrganizationMap }
// 				} catch (error: any) {
// 					console.log("error", error)
// 					if (error.code === 3102) {
// 						if (inModal) {
// 							message.error(t("magicOrganizationSyncStep.pleaseBindExistingAccount"))
// 						} else {
// 							// 用户未创建账号，跳转邀请界面
// 							navigate(RoutePath.Invite, { replace: true })
// 						}
// 					}
// 					const newMessage = `magicOrganizationSyncStep: ${error.message}`
// 					const newError = new Error(newMessage)
// 					newError.stack = error?.stack
// 					return Promise.reject(error)
// 				}
// 			}
// 		},
// 	)
//
// 	/** Teamshare 生态组织同步 */
// 	const organizationSyncStep = useMemoizedFn(
// 		async (params: LoginStepResult): Promise<LoginStepResult> => {
// 			const {
// 				organizationCode,
// 				teamshareOrganizationCode,
// 				organizations,
// 				magicOrganizationMap,
// 			} = params
//
// 			useUserStore.setState((preState) => {
// 				preState.organizationCode = organizationCode
// 				preState.teamshareOrganizationCode = teamshareOrganizationCode
// 				preState.organizations = organizations ?? []
// 				preState.magicOrganizationMap = magicOrganizationMap
// 			})
// 			return Promise.resolve(params)
// 		},
// 	)
//
// 	/** Teamshare 生态组织获取 */
// 	const organizationFetchStep = useMemoizedFn(
// 		async (params: Omit<LoginStepResult, "organizationCode">): Promise<LoginStepResult> => {
// 			try {
// 				const {
// 					access_token,
// 					magicOrganizationMap: allMagicOrganizationMap,
// 					deployCode,
// 				} = params
//
// 				// 获取 teamshare 当前账号下所有组织
// 				const organizations = await UserService.getUserOrganizations(
// 					{ authorization: access_token },
// 					deployCode,
// 				)
// 				const teamshareOrgsCode = organizations.map((o) => o.organization_code)
//
// 				// 获取到 teamshare 的组织后，需要针对上步 magicOrganizationMap 进行合法性过滤(因后端没处理 magicOrganizationMap 数据的合法性，所以这里需要根据 teamshare 中不存在的组织过滤 magicOrganizationMap)
// 				const magicOrganizationArray = Object.values(allMagicOrganizationMap).filter((o) =>
// 					teamshareOrgsCode.includes(o.third_platform_organization_code),
// 				)
// 				const magicOrganizationMap = keyBy(
// 					magicOrganizationArray,
// 					"third_platform_organization_code",
// 				)
// 				const teamshareOrgMap = keyBy(magicOrganizationArray, "magic_organization_code")
//
// 				const authorizedOrgsCode = Object.keys(magicOrganizationMap) // 已授权组织
// 				const authorizedOrg = organizations.find((org) =>
// 					authorizedOrgsCode.includes(org.organization_code),
// 				)
//
// 				// magicOrganizationCode 处理 (优先判断缓存是否存在)
// 				const magicOrgCodeCache = useUserStore.getState()?.organizationCode
// 				let magicOrgCode = null
// 				if (magicOrgCodeCache && teamshareOrgMap?.[magicOrgCodeCache]) {
// 					// 当且仅当缓存中的 magicOrgCode 存在且在当前账号中有效则使用缓存
// 					magicOrgCode = magicOrgCodeCache
// 				} else {
// 					// 当且仅当 magic 组织 Code 不存在的情况下，重新以第一个作为首选
// 					magicOrgCode =
// 						magicOrganizationMap?.[authorizedOrg?.organization_code ?? ""]
// 							?.magic_organization_code
// 				}
//
// 				return {
// 					access_token,
// 					magicOrganizationMap,
// 					organizations,
// 					organizationCode: magicOrgCode,
// 					teamshareOrganizationCode:
// 						teamshareOrgMap[magicOrgCode ?? ""]?.third_platform_organization_code,
// 				}
// 			} catch (error: any) {
// 				const newMessage = `organizationFetchStep: ${error.message}`
// 				const newError = new Error(newMessage)
// 				newError.stack = error?.stack
// 				return Promise.reject(error)
// 			}
// 		},
// 	)
//
// 	/** 账号 Token 同步 */
// 	const authorizationSyncStep = useMemoizedFn((userInfo: Login.UserLoginsResponse) => {
// 		// 更新 useAuthenticationStore 中的 token
// 		useAuthenticationStore.setState((preState) => {
// 			preState.authorization = userInfo.access_token
// 		})
// 		return Promise.resolve(userInfo)
// 	})
//
// 	/** Step 4: 账号同步(判断当前) */
// 	const accountSyncStep = useMemoizedFn((deployCode: string) => {
// 		return async (params: LoginStepResult): Promise<string> => {
// 			try {
// 				const {
// 					access_token,
// 					magicOrganizationMap,
// 					organizations,
// 					teamshareOrganizationCode,
// 				} = params
//
// 				const magicOrgs = Object.values(magicOrganizationMap)
//
// 				const orgCode =
// 					teamshareOrganizationCode ?? magicOrgs?.[0]?.third_platform_organization_code
// 				if (orgCode) {
// 					const userInfo = await getUserInfo(
// 						magicOrganizationMap?.[orgCode]?.magic_user_id,
// 					)
// 					// 登录完成后构造用户信息，维护在账号体系中
// 					const userAccount: User.UserAccount = {
// 						deployCode,
// 						nickname: userInfo?.nickname,
// 						organizationCode: userInfo?.organization_code,
// 						avatar: userInfo?.avatar_url,
// 						magic_id: userInfo?.magic_id,
// 						magic_user_id: userInfo?.user_id,
// 						access_token,
// 						teamshareOrganizations: organizations ?? [],
// 						organizations: magicOrgs,
// 					}
// 					useUserStore.setState((preState) => {
// 						if (!Array.isArray(preState.accounts)) {
// 							preState.accounts = []
// 						}
// 						const hasAccount = preState.accounts?.some(
// 							(account) => account.magic_id === userAccount?.magic_id,
// 						)
// 						if (!hasAccount) {
// 							preState.accounts.push(userAccount)
// 						}
// 						preState.info = {
// 							magic_id: userInfo?.magic_id,
// 							user_id: userInfo?.user_id,
// 							status: userInfo?.status,
// 							nickname: userInfo?.nickname,
// 							avatar: userInfo?.avatar_url,
// 							organization_code: userInfo?.organization_code,
// 							phone: userInfo?.phone,
// 						}
// 					})
// 				}
//
// 				return access_token
// 			} catch (error: any) {
// 				const newMessage = `accountSyncStep: ${error.message}`
// 				const newError = new Error(newMessage)
// 				newError.stack = error?.stack
// 				return Promise.reject(error)
// 			}
// 		}
// 	})
//
// 	/** Step 5: 路由重定向 */
// 	const redirectUrlStep = useMemoizedFn(() => {
// 		const url = new URL(window.location.href)
// 		const { searchParams } = url
// 		/** 从定向URL这里，如果是站点外就需要考虑是否需要携带 */
// 		const redirectUrl = searchParams.get(LoginValueKey.REDIRECT_URL)
// 		if (redirectUrl) {
// 			window.location.assign(decodeURIComponent(redirectUrl))
// 		} else {
// 			navigate(RoutePath.Chat, { replace: true })
// 		}
// 	})
//
// 	/** Step 6: 用户信息同步(magic体系的唯一用户Id) */
// 	const fetchUserInfoStep = useMemoizedFn(async (unionId: string) => {
// 		try {
// 			const userInfo = await getUserInfo(unionId)
// 			setUserInfo(userInfo)
// 			return userInfo
// 		} catch (error: any) {
// 			const newMessage = `fetchUserInfoStep: ${error.message}`
// 			const newError = new Error(newMessage)
// 			newError.stack = error?.stack
// 			return Promise.reject(error)
// 		}
// 	})
//
// 	return {
// 		loginStep,
// 		authorizationSyncStep,
// 		deployCodeSyncStep,
// 		envSyncStep,
// 		magicOrganizationSyncStep,
// 		organizationFetchStep,
// 		organizationSyncStep,
// 		accountSyncStep,
// 		redirectUrlStep,
// 		fetchUserInfoStep,
// 	}
// }
