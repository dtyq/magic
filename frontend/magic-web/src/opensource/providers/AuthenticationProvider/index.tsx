import { type PropsWithChildren } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { useNavigate } from "@/opensource/hooks/useNavigate"
import { useTranslation } from "react-i18next"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { RoutePath } from "@/const/routes"
import { useBotStore } from "@/opensource/stores/bot"
import { withThirdPartyAuth } from "@/opensource/layouts/middlewares/withThirdPartyAuth"
import { useAccount } from "@/opensource/stores/authentication"
import { useBoolean, useMemoizedFn, useMount } from "ahooks"
import type { Login } from "@/types/login"
import { userStore } from "@/opensource/models/user"
import { loginService, userService } from "@/services"
import { useAuthorization } from "@/opensource/models/user/hooks"
import { useClusterCode } from "@/opensource/providers/ClusterProvider"
import { useStyles } from "./styles"
import { LoginValueKey } from "@/opensource/pages/login/constants"

const AuthenticationKey = "authorization"

function AuthenticationProvider({ children }: PropsWithChildren) {
	const { styles } = useStyles()

	const { t } = useTranslation("interface")
	const navigate = useNavigate()
	const { accountFetch } = useAccount()

	const { pathname } = useLocation()
	const [searchParams] = useSearchParams()

	const { authorization } = useAuthorization()
	const queryAuthorization = searchParams.get(AuthenticationKey)
	const latestAuth = queryAuthorization ?? authorization

	// 加载默认图标
	const { mutate } = useBotStore((state) => state.useDefaultIcon)()

	const defaultIcon = useBotStore((state) => state.defaultIcon.icons)

	const { clusterCode } = useClusterCode()

	const initial = useMemoizedFn(async (access_token: string | null) => {
		if (!access_token) {
			throw new Error("authorization is null")
		}
		// deployCode 的获取从 账号体系直接获取用作兜底
		const { accounts } = userStore.account
		const accountIndex = accounts.findIndex((account) => account.access_token === access_token)
		// 优先获取外部的 deployCode，再从账号体系获取 deployCode 用作兜底
		const tempToken = clusterCode || accounts?.[accountIndex]?.deployCode
		const magicOrgSyncStep = loginService.magicOrganizationSyncStep(tempToken as string)
		const userSyncStep = loginService.accountSyncStep(tempToken as string)
		return (
			Promise.resolve()
				.then(() => {
					return loginService.authorizationSyncStep({
						access_token,
					} as Login.UserLoginsResponse)
				})
				.then(magicOrgSyncStep)
				// @ts-ignore
				.then(loginService.organizationFetchStep)
				.then(loginService.organizationSyncStep)
				.then(userSyncStep)
				.then(() => {
					// 临时处理
					const isSearchRoutePath = window.location.pathname.indexOf("search.html") > -1
					if (!isSearchRoutePath && ["/", RoutePath.Login].includes(pathname)) {
						navigate(RoutePath.Chat, { replace: true })
					}
					return accountFetch()
				})
				.then(() => {
					return userService.wsLogin({ showLoginLoading: false })
				})
		)
	})

	const [success, { setTrue: loginSuccess, setFalse: loginFail }] = useBoolean(false)
	useMount(async () => {
		// 当且仅当登录后，需要每次检查第三方私有化登录授权码、第三方私有化配置
		if (latestAuth) {
			initial(latestAuth)
				.then(() => {
					loginSuccess()
				})
				.catch(async (error) => {
					// 登录异常需要清空缓存
					console.error(error)
					await userService.deleteAccount()
					loginFail()
				})
		} else {
			loginSuccess()
		}
	})

	useMount(() => {
		if (!latestAuth && window.location.pathname !== RoutePath.Login) {
			navigate(
				{
					pathname: RoutePath.Login,
					search: new URLSearchParams({
						[LoginValueKey.REDIRECT_URL]: window.location.href,
					}).toString(),
				},
				{ replace: true },
			)
			return
		}

		if (!defaultIcon.bot) {
			mutate()
		}
	})

	// useEffect(() => {
	// 	if (!latestAuth) {
	// 		navigate(
	// 			{
	// 				pathname: RoutePath.Login,
	// 				search: new URLSearchParams({
	// 					[LoginValueKey.REDIRECT_URL]: window.location.href,
	// 				}).toString(),
	// 			},
	// 			{ replace: true },
	// 		)
	// 	}
	// }, [latestAuth, navigate, pathname])

	if (!success) {
		return (
			<MagicSpin spinning tip={t("spin.loadingAuth")} wrapperClassName={styles.spin}>
				<div style={{ height: "100vh" }} />
			</MagicSpin>
		)
	}

	return children
}

export default withThirdPartyAuth(AuthenticationProvider)
