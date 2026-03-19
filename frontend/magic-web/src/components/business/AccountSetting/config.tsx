import { lazy, type ReactNode } from "react"
import {
	IconClockPlay,
	IconHeart,
	IconMailShare,
	IconSitemap,
	IconUserCircle,
} from "@tabler/icons-react"
import type { MenuItem } from "@/components/business/SettingPanel/types"
import { AccountSettingPage } from "./types"

const MyAccountPage = lazy(() => import("./pages/MyAccount"))
const MyTeamPage = lazy(() => import("./pages/MyTeam"))
const PreferencesPage = lazy(() => import("./pages/Preferences"))
const ScheduledTasksPage = lazy(() => import("./pages/ScheduledTasks"))

export interface AccountSettingMenuItem extends MenuItem {
	key: AccountSettingPage
	component: ReactNode
	subtitle?: string
}

export function getAccountSettingMenuItems(t: (key: string) => string): AccountSettingMenuItem[] {
	return [
		{
			key: AccountSettingPage.MY_ACCOUNT,
			label: t("myAccount"),
			subtitle: t("myAccountSubtitle"),
			icon: <IconUserCircle size={24} />,
			background: "linear-gradient(135deg, #56CCF2 24.79%, #2F80ED 123.96%)",
			groupTitle: t("accountGroup"),
			component: <MyAccountPage />,
		},
		{
			key: AccountSettingPage.MY_TEAM,
			label: t("myTeam"),
			subtitle: t("myTeamSubtitle"),
			icon: <IconSitemap size={24} />,
			background: "linear-gradient(34deg, #0072FF -3.29%, #00C6FF 96.85%)",
			groupTitle: t("teamGroup"),
			component: <MyTeamPage />,
		},
		{
			key: AccountSettingPage.PREFERENCES,
			label: t("preferences"),
			subtitle: t("preferencesSubtitle"),
			icon: <IconHeart size={24} />,
			background: "linear-gradient(134deg, #F24AB7 2.44%, #F26A4C 100%)",
			groupTitle: t("settingsGroup"),
			component: <PreferencesPage />,
		},
		{
			key: AccountSettingPage.SCHEDULED_TASKS,
			label: t("scheduledTasks"),
			subtitle: t("scheduledTasksSubtitle"),
			icon: <IconClockPlay size={24} />,
			background: "linear-gradient(134deg, #93EDC7 4.89%, #1CD8D2 81.59%)",
			component: <ScheduledTasksPage />,
		},
	]
}

export function getContactUsMenuItem(t: (key: string) => string): MenuItem {
	return {
		key: "contactUs",
		label: t("contactUs"),
		icon: <IconMailShare size={16} />,
	}
}
