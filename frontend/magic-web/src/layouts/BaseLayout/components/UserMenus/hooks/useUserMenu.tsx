import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { MenuProps } from "antd"
import { ItemType } from "antd/es/menu/interface"
import {
	LogOut,
	Timer,
	Brain,
	MonitorSmartphone,
	Languages,
	CircleUserRound,
	Settings,
} from "lucide-react"
import { IconDeviceImacCog, IconLogout, IconShare3 } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import { UserMenuKey } from "../constants"
import { userStore } from "@/models/user"
import useLanguageOptions from "./useLanguageOptions"

interface UseUserMenuProps {
	isPreviewMode?: boolean
}

function useUserMenu({ isPreviewMode }: UseUserMenuProps) {
	const { t } = useTranslation("interface")
	const { languageOptions, languageLabel } = useLanguageOptions()
	const { isAdmin, isPersonalOrganization } = userStore.user

	const menu = useMemo<MenuProps["items"]>(() => {
		if (isPreviewMode) {
			return [
				{
					label: <span data-testid="user-menus-logout">{t("sider.logout")}</span>,
					icon: <MagicIcon size={20} component={IconLogout} color="currentColor" />,
					danger: true,
					key: UserMenuKey.Logout,
					"data-testid": "user-menus-logout",
				},
			]
		}

		return [
			{
				label: (
					<span data-testid="user-menus-account-management">
						{t("sider.accountManagement")}
					</span>
				),
				key: UserMenuKey.AccountManagement,
				icon: <CircleUserRound />,
				"data-testid": "user-menus-account-management",
			},
			{
				label: <span data-testid="user-menus-preferences">{t("sider.preferences")}</span>,
				key: UserMenuKey.Preferences,
				icon: <Settings />,
				"data-testid": "user-menus-preferences",
			},
			{
				label: (
					<span data-testid="user-menus-scheduled-tasks">
						{t("sider.scheduledTasks")}
					</span>
				),
				key: UserMenuKey.ScheduledTasks,
				icon: <Timer />,
				"data-testid": "user-menus-scheduled-tasks",
			},
			{
				label: (
					<span data-testid="user-menus-long-term-memory">
						{t("sider.longTermMemory")}
					</span>
				),
				key: UserMenuKey.LongTermMemory,
				icon: <Brain />,
				"data-testid": "user-menus-long-term-memory",
			},
			{
				label: (
					<span data-testid="user-menus-share-management">
						{t("globalMenus.shareManagement")}
					</span>
				),
				key: UserMenuKey.ShareManagement,
				icon: <IconShare3 />,
				"data-testid": "user-menus-share-management",
			},
			{
				label: (
					<span className="inline-flex w-full items-center justify-between gap-1">
						{t("sider.switchLanguage")}
						<span className="text-sm text-muted-foreground">{languageLabel}</span>
					</span>
				),
				key: UserMenuKey.SwitchLanguage,
				icon: <Languages />,
				children: languageOptions,
				"data-testid": "user-menus-switch-language",
			},
			{
				type: "divider",
			},
			{
				label: (
					<span data-testid="user-menus-download-client">
						{t("sider.downloadClient")}
					</span>
				),
				key: UserMenuKey.DownloadClient,
				icon: <MonitorSmartphone />,
				"data-testid": "user-menus-download-client",
			},
			(isPersonalOrganization || isAdmin) && {
				type: "divider",
			},
			(isPersonalOrganization || isAdmin) && {
				label: <span data-testid="user-menus-admin">{t("sider.admin")}</span>,
				key: UserMenuKey.Admin,
				icon: <MagicIcon size={20} component={IconDeviceImacCog} color="currentColor" />,
				"data-testid": "user-menus-admin",
			},
			{
				type: "divider",
			},
			{
				label: <span data-testid="user-menus-logout">{t("sider.logout")}</span>,
				icon: <LogOut size={20} className="text-red-500" />,
				danger: true,
				key: UserMenuKey.Logout,
				"data-testid": "user-menus-logout",
			},
		].filter(Boolean) as ItemType[]
	}, [isPreviewMode, t, languageLabel, languageOptions, isAdmin])

	return { menu }
}

export default useUserMenu
