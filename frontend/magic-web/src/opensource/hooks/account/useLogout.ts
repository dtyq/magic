import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { userStore } from "@/opensource/models/user"
import { BroadcastChannelSender } from "@/opensource/broadcastChannel"
import { useAccount } from "@/opensource/stores/authentication"
import MagicModal from "@/opensource/components/base/MagicModal"
import { User } from "@/opensource/types/user"
import { LoginValueKey } from "@/opensource/pages/login/constants"
import { history } from "@/opensource/routes"
import { RouteName } from "@/opensource/routes/constants"
import { convertSearchParams, routesMatch } from "@/opensource/routes/history/helpers"
import { defaultClusterCode } from "@/opensource/routes/helpers"
import { logger as Logger } from "@/opensource/utils/log"
import useCancelRecord from "@/opensource/components/business/RecordingSummary/hooks/useCancelRecord"
import { appService } from "@/opensource/services/app/AppService"

const logger = Logger.createLogger("sso")

interface UseLogoutProps {
	onConfirm?: () => void
	onCancel?: () => void
}

function useLogout({ onConfirm, onCancel }: UseLogoutProps = {}) {
	const { t } = useTranslation("interface")
	const { t: tSuper } = useTranslation("super")

	const { accountLogout, accountSwitch } = useAccount()

	const { cancelRecord } = useCancelRecord({
		noNeedButtonText: tSuper("recordingSummary.cancelModal.noNeedWithContinue"),
		summarizeButtonText: tSuper("recordingSummary.cancelModal.summarizeWithContinue"),
		modalContent: tSuper("recordingSummary.cancelModal.messageWithContinue"),
		aiRecordingModalContent: tSuper("recordingSummary.aiRecordingModal.logoutContent"),
		aiRecordingConfirmText: tSuper("recordingSummary.aiRecordingModal.logoutConfirmText"),
	})

	return useMemoizedFn(async (targetAccount?: User.UserAccount) => {
		try {
			// 取消录音
			await cancelRecord()

			MagicModal.confirm({
				title: t("sider.exitTitle"),
				content: t("sider.exitContent"),
				okText: t("common.confirm"),
				cancelText: t("common.cancel"),
				centered: true,
				onOk: async () => {
					try {
						if (
							targetAccount &&
							targetAccount?.magic_id !== userStore.user.userInfo?.magic_id
						) {
							// 直接退出
							await accountLogout(targetAccount?.magic_id)
							/** 广播删除账号 */
							BroadcastChannelSender.deleteAccount(targetAccount?.magic_id, {
								navigateToLogin: false,
							})

							return
						}

						const accounts = userStore.account.accounts

						// 当且仅当存在多个账号下，优先切换帐号，再移除帐号
						if (accounts?.length > 1) {
							const info = userStore.user.userInfo
							const otherAccount = accounts.filter(
								(account) => account.magic_id !== info?.magic_id,
							)?.[0]

							const targetOrganization = otherAccount?.organizations.find(
								(org) =>
									org.magic_organization_code === otherAccount?.organizationCode,
							)

							accountSwitch(
								targetOrganization?.magic_id ?? "",
								targetOrganization?.magic_user_id ?? "",
								targetOrganization?.magic_organization_code ?? "",
							)
								.then(async () => {
									const user = userStore.user.userInfo
									if (user) {
										await appService.initUserData(user)
									}

									const routeMeta = routesMatch(window.location.pathname)
									if (routeMeta && routeMeta.route.name) {
										history.replace({
											name: routeMeta.route.name,
											params: {
												...routeMeta?.params,
												clusterCode:
													otherAccount?.deployCode || defaultClusterCode,
											},
										})
									}
								})
								.catch((error) => {
									logger.error("switchAccountError", error)
								})

							if (info?.magic_id) {
								await accountLogout(info?.magic_id)
								/** 广播删除账号 */
								BroadcastChannelSender.deleteAccount(info?.magic_id, {
									navigateToLogin: false,
								})
							}
						} else {
							await accountLogout()
							/** 广播删除账号 */
							BroadcastChannelSender.deleteAccount(undefined, {
								navigateToLogin: true,
							})
							const searchParams = new URLSearchParams(window.location.search)
							searchParams.append(LoginValueKey.REDIRECT_URL, window.location.href)
							history.replace({
								name: RouteName.Login,
								query: convertSearchParams(searchParams),
							})
						}
					} catch (error) {
						logger.error("useLogout", error)
					} finally {
						onConfirm?.()
					}
				},
				onCancel: () => {
					onCancel?.()
				},
			})
		} catch (error) {
			logger.error("useLogout", error)
		}
	})
}

export default useLogout
