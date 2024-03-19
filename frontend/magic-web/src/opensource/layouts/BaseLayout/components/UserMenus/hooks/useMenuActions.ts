import { useMemoizedFn } from "ahooks"
import { RoutePath as AdminRoutePath } from "@dtyq/magic-admin"
import { UserMenuKey } from "../constants"
import { setGlobalLanguage } from "@/opensource/models/config/hooks"
import { openNewTab } from "@/opensource/routes/helpers"
import useLogout from "@/opensource/hooks/account/useLogout"
import { openAccountSetting } from "@/opensource/components/business/AccountSetting/openAccountSetting"
import { AccountSettingPage } from "@/opensource/components/business/AccountSetting/types"
import showOnlineFeedbackModal from "@/opensource/components/business/OnlineFeedbackModal"
import { openShareManagementModal } from "@/opensource/pages/superMagic/components/ShareManagement/stores/globalShareManagement"
import { openLongTremMemoryModal } from "@/opensource/pages/superMagic/components/LongTremMemory"
import routeManageService from "@/opensource/pages/superMagic/services/routeManageService"

interface UseMenuActionsProps {
	onClose: () => void
}

function useMenuActions({ onClose }: UseMenuActionsProps) {
	const handleLogout = useLogout()

	const navigateToAdmin = useMemoizedFn(() => {
		openNewTab(AdminRoutePath.Admin)
	})

	const handleMenuClick = useMemoizedFn(({ key }: { key: string }) => {
		switch (key) {
			case UserMenuKey.Logout:
				handleLogout()
				break
			case UserMenuKey.AccountManagement:
				openAccountSetting({ defaultActiveKey: AccountSettingPage.MY_ACCOUNT })
				break
			case UserMenuKey.Preferences:
				openAccountSetting({ defaultActiveKey: AccountSettingPage.PREFERENCES })
				break
			case UserMenuKey.ScheduledTasks:
				openAccountSetting({ defaultActiveKey: AccountSettingPage.SCHEDULED_TASKS })
				break
			case UserMenuKey.LongTermMemory:
				openLongTremMemoryModal({
					onWorkspaceStateChange: routeManageService.navigateToState,
				})
				break
			case UserMenuKey.ConsumptionDetails:
				break
			case UserMenuKey.DownloadClient:
				openNewTab("https://www.letsmagic.cn/download")
				break
			case UserMenuKey.OnlineFeedback:
				showOnlineFeedbackModal()
				break
			case UserMenuKey.Admin:
				navigateToAdmin()
				break
			case UserMenuKey.ShareManagement:
				openShareManagementModal()
				break
			case UserMenuKey.SwitchLanguage:
				// Parent menu item, do nothing
				break
			default:
				// If not a known menu key, assume it's a language code
				setGlobalLanguage(key)
				break
		}
		onClose()
	})

	return { handleMenuClick }
}

export default useMenuActions
