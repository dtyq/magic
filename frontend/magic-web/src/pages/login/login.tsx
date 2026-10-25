import { useDebounceFn, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Login } from "@/types/login"
import MagicSpin from "@/components/base/MagicSpin"
import { useState } from "react"
import { logger as Logger } from "@/infrastructure/logger"
import { service } from "@/services"
import { LoginValueKey } from "@/pages/login/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import type { OnSubmitFn } from "./types"
import { useLoginServiceContext } from "../../layouts/SSOLayout/providers/LoginServiceProvider"
import MobilePhonePasswordForm from "./components/MobilePhonePasswordForm"
import { RouteName } from "@/routes/constants"
import type { UserService } from "@/services/user/UserService"
import type { LoginService } from "@/services/user/LoginService/LoginService"
import { authNavigationCoordinator } from "@/services/auth/AuthNavigationCoordinator"
import { isAccountDisabledError } from "@/services/auth/AuthFailureClassifier"
import magicToast from "@/components/base/MagicToaster/utils"

const logger = Logger.createLogger("sso")

function LoginPage() {
	const navigate = useNavigate()
	const { clusterCode } = useLoginServiceContext()
	const { t } = useTranslation("login")

	const [loading, setLoading] = useState(false)

	// 登录流程
	const redirect = useMemoizedFn(() => {
		const url = new URL(window.location.href)
		const { searchParams } = url
		/** 从定向URL这里，如果是站点外就需要考虑是否需要携带 */
		const redirectURI = searchParams.get(LoginValueKey.REDIRECT_URL)
		if (redirectURI) {
			// TODO[route]: 处理站内path
			window.location.assign(decodeURIComponent(redirectURI))
		} else {
			navigate({ name: RouteName.Chat, replace: true })
		}
	})

	// 提交数据，统一处理不同登录方式的逻辑
	const { run: onSubmit } = useDebounceFn<OnSubmitFn<Login.LoginType.MobilePhonePassword>>(
		async ({ access_token }) => {
			setLoading(true)

			try {
				service.get<UserService>("userService").setAuthorization(access_token)

				await service
					.get<LoginService>("loginService")
					.magicOrganizationSync(clusterCode || "", access_token)
				authNavigationCoordinator.reset()
				redirect()
			} catch (error: any) {
				logger.error({
					eventKey: "login_page_failed",
					errorKind: "unknown",
					error: error,
					message: "error",
				})
				if (isAccountDisabledError(error)) {
					/*
					 * 账号已被平台禁用（3109）。上面第一步已经把 token 写进 store，
					 * 这里必须清掉，否则页面会带着被禁用的凭证继续发起请求；
					 * 同时提示后直接结束，不再重试或跳转。
					 */
					service.get<UserService>("userService").setAuthorization(null)
					magicToast.error(t("magicOrganizationSyncStep.accountDisabled"))
				}
			} finally {
				setLoading(false)
			}
		},
		{ wait: 3000, leading: true, trailing: false },
	)

	return (
		<MagicSpin spinning={loading} data-testid="login-page">
			<MobilePhonePasswordForm onSubmit={onSubmit} />
		</MagicSpin>
	)
}

export default LoginPage
