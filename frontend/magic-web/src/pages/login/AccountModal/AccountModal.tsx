import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import type { Login } from "@/types/login"
import { OnSubmitFn } from "@/pages/login/types"
import { useTranslation } from "react-i18next"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import useLoginFormOverrideStyles from "@/styles/login-form-overrider"
import { cn } from "@/lib/utils"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { userStore } from "@/models/user"
import MobilePhonePasswordForm from "../components/MobilePhonePasswordForm"
import Footer from "../components/Footer"
import { useUserAgreedPolicy } from "../hooks/useUserAgreedPolicy"
import { useLoginServiceContext } from "../../../layouts/SSOLayout/providers/LoginServiceProvider"
import type { LoginService } from "@/services/user/LoginService"
import type { UserService } from "@/services/user/UserService"
import { BUSINESS_API_ERROR_CODE } from "@/constants/api"
import { history } from "@/routes"
import { routesMatch } from "@/routes/history/helpers"
import { appService } from "@/services/app/AppService"
import magicToast from "@/components/base/MagicToaster/utils"
import { RouteName } from "@/routes/constants"
import { LoginDeployment } from "@/pages/login/constants"
import { isNil } from "lodash-es"

interface AccountModalProps {
	onClose: () => void
	clusterCode?: string
	onClusterChange?: (code: string) => void
	open?: boolean
}

function AccountModal(props: AccountModalProps) {
	const { onClose, onClusterChange, open: openProp = true } = props

	const { styles: loginFormOverrideStyles } = useLoginFormOverrideStyles()
	const { clusterCode, service, setDeployCode, setDeployment } = useLoginServiceContext()
	const { t } = useTranslation("login")

	const [open, setOpen] = useState(false)

	useEffect(() => {
		setOpen(openProp)
	}, [openProp])

	useDeepCompareEffect(() => {
		if (isNil(props?.clusterCode)) return

		setDeployCode(props?.clusterCode || "")
		setDeployment(
			props?.clusterCode === ""
				? LoginDeployment.PublicDeploymentLogin
				: LoginDeployment.PrivateDeploymentLogin,
		)
	}, [props?.clusterCode])

	const { agree, setAgree, triggerUserAgreedPolicy } = useUserAgreedPolicy()

	const redirectUrlStep = useMemoizedFn(() => {
		history.replace({ name: RouteName.Super })
		onClose?.()
	})

	const [loading, setLoading] = useState(false)

	// 提交数据，统一处理不同登录方式的逻辑
	const onSubmit = useMemoizedFn<OnSubmitFn<Login.LoginType.MobilePhonePassword>>(
		async ({ access_token }) => {
			if (!agree) {
				await triggerUserAgreedPolicy()
			}

			setLoading(true)

			try {
				const userService = service.get<UserService>("userService")
				const loginService = service.get<LoginService>("loginService")

				// 流程问题要先在 magic 绑定用户token后才能设置token
				const magicOrganizationMap = await loginService.magicOrganizationSync(
					clusterCode || "",
					access_token,
				)
				userService.setAuthorization(access_token)
				// 环境同步(这里需要同步主服务做集群信息同步)
				const clusterConfig = await loginService.syncClusterConfig()

				// 第三方组织获取
				const { organizations, organizationCode, thirdPlatformOrganizationCode } =
					await loginService.getThirdPlatformOrganization(
						magicOrganizationMap,
						access_token,
						clusterConfig.clusterCode,
					)

				// 设置组织
				userService.setOrganization({
					organizationCode,
					teamshareOrganizationCode: thirdPlatformOrganizationCode,
					organizations,
					magicOrganizationMap,
				})

				// 账号体系同步
				await loginService.accountSync({
					deployCode: clusterConfig.clusterCode,
					access_token,
					magicOrganizationMap,
					organizations,
					teamshareOrganizationCode: thirdPlatformOrganizationCode,
				})
				const { userInfo } = userStore.user
				if (userInfo) {
					await appService.initUserData(userInfo)
				}

				userService.wsLogin()
				onClusterChange?.(clusterConfig.clusterCode)

				// 更新路由集群编码
				const routeMeta = routesMatch(window.location.pathname)
				if (routeMeta) {
					const searchParams = new URLSearchParams(window.location.search)
					const query = Object.fromEntries(searchParams.entries())
					history.replace({
						name: routeMeta.route.name!,
						params: {
							...routeMeta?.params,
							clusterCode,
						},
						query,
					})
				}
				redirectUrlStep()
			} catch (error: any) {
				console.error("login error", error)
				if (error.code === BUSINESS_API_ERROR_CODE.USER_NOT_CREATE_ACCOUNT) {
					magicToast.error(t("magicOrganizationSyncStep.pleaseBindExistingAccount"))
				}
			} finally {
				setLoading(false)
			}
		},
	)

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen)
				if (!nextOpen) onClose?.()
			}}
		>
			<DialogContent
				className="w-[460px] !max-w-[460px] gap-0 border-none p-0"
				overlayClassName="bg-black/80"
				data-testid="account-modal-content"
			>
				<DialogHeader className="flex items-center px-6 pb-0 pt-5">
					<DialogTitle className="w-full text-left text-base font-semibold leading-6">
						{t("account.create")}
					</DialogTitle>
				</DialogHeader>
				<div
					className={cn(
						"relative flex h-full w-full flex-col overflow-x-hidden px-2.5 pb-5 pt-5",
						loginFormOverrideStyles.container,
					)}
				>
					{loading && (
						<div
							className="absolute inset-0 z-10 flex items-center justify-center bg-background/60"
							data-testid="account-modal-loading"
						>
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					)}
					<MobilePhonePasswordForm onSubmit={onSubmit} />
					<Footer agree={agree} onAgreeChange={setAgree} tipVisible />
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default AccountModal
