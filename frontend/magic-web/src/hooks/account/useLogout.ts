import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { userStore } from "@/models/user"
import { BroadcastChannelSender } from "@/broadcastChannel"
import { useAccount } from "@/stores/authentication"
import MagicModal from "@/components/base/MagicModal"
import { User } from "@/types/user"
import { LoginValueKey } from "@/pages/login/constants"
import { history } from "@/routes"
import { RouteName } from "@/routes/constants"
import { convertSearchParams, routesMatch } from "@/routes/history/helpers"
import { defaultClusterCode } from "@/routes/helpers"
import { openLightModal } from "@/utils/openLightModal"
import { isMobile } from "@/utils/devices"
import { logger as Logger } from "@/utils/log"
import useCancelRecord from "@/components/business/RecordingSummary/hooks/useCancelRecord"
import { appService } from "@/services/app/AppService"
import { MobileLogoutConfirmPopup } from "./MobileLogoutConfirmPopup"

const logger = Logger.createLogger("sso")

interface UseLogoutProps {
	onConfirm?: () => void
	onCancel?: () => void
}

/** 根据终端形态选择确认容器：桌面端继续走 MagicModal，移动端改成基于 MagicPopup 的轻量抽屉。 */
function showLogoutConfirm(params: {
	isMobileClient: boolean
	title: string
	description: string
	confirmText: string
	cancelText: string
	onConfirm: () => Promise<void>
	onCancel?: () => void
}) {
	const { isMobileClient, title, description, confirmText, cancelText, onConfirm, onCancel } =
		params

	if (isMobileClient) {
		openLightModal(MobileLogoutConfirmPopup, {
			title,
			description,
			cancelAriaLabel: cancelText,
			confirmAriaLabel: confirmText,
			onConfirm,
			onCancel,
		})
		return
	}

	MagicModal.confirm({
		title,
		content: description,
		okText: confirmText,
		cancelText: cancelText,
		centered: true,
		onOk: onConfirm,
		onCancel,
	})
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

			/** 确认后的退出业务链路保持原样，只把确认 UI 切换成终端自适应的实现。 */
			const handleConfirmedLogout = async () => {
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
							(org) => org.magic_organization_code === otherAccount?.organizationCode,
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
			}

			showLogoutConfirm({
				isMobileClient: isMobile,
				title: t("common.logout"),
				description: t("setting.logoutConfirm"),
				confirmText: t("common.confirm"),
				cancelText: t("common.cancel"),
				onConfirm: handleConfirmedLogout,
				onCancel,
			})
		} catch (error) {
			logger.error("useLogout", error)
		}
	})
}

export default useLogout
