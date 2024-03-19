import { useDebounceFn, useMemoizedFn } from "ahooks"
import { Login } from "@/opensource/types/login"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useState } from "react"
import { logger as Logger } from "@/opensource/utils/log"
import { service } from "@/opensource/services"
import { LoginValueKey } from "@/opensource/pages/login/constants"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import type { OnSubmitFn } from "./types"
import { useLoginServiceContext } from "../../layouts/SSOLayout/providers/LoginServiceProvider"
import MobilePhonePasswordForm from "./components/MobilePhonePasswordForm"
import { RouteName } from "@/opensource/routes/constants"
import type { UserService } from "@/opensource/services/user/UserService"
import type { LoginService } from "@/opensource/services/user/LoginService/LoginService"

const logger = Logger.createLogger("sso")

function LoginPage() {
	const navigate = useNavigate()
	const { clusterCode } = useLoginServiceContext()

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
				redirect()
			} catch (error: any) {
				logger.error("error", error)
			} finally {
				setLoading(false)
			}
		},
		{ wait: 3000, leading: true, trailing: false },
	)

	return (
		<MagicSpin spinning={loading}>
			<MobilePhonePasswordForm onSubmit={onSubmit} />
		</MagicSpin>
	)
}

export default LoginPage
