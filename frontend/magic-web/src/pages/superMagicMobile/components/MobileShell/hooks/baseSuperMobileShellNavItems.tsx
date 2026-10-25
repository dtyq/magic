import {
	Bot,
	Box,
	Boxes,
	House,
	LayoutGrid,
	MessageCircle,
	Mic,
	Palette,
	Trash2,
	UsersRound,
} from "lucide-react"

import { FUNCTION_PERMISSION_CODE } from "@/apis/modules/function-permission"
import { MagiClawNavIcon } from "@/pages/superMagicMobile/components/icons/MagiClawNavIcon"
import { RouteName } from "@/routes/constants"

import type { SuperMobileShellNavConfigItem } from "./types"

/** Default mobile shell nav config; enterprise overlays should compose from this list when possible. */
export const BASE_SUPER_MOBILE_SHELL_NAV_ITEMS: SuperMobileShellNavConfigItem[] = [
	{
		key: "home",
		icon: House,
		labelKey: "mobile.shell.navSuper",
		routeName: RouteName.MobileHome,
	},
	{
		key: "chats",
		icon: MessageCircle,
		labelKey: "mobile.shell.navChats",
		routeName: RouteName.SuperChatsList,
	},
	{
		key: "workspaces",
		icon: Box,
		labelKey: "mobile.shell.navWorkspaces",
		routeName: RouteName.SuperWorkspacesList,
	},
	{
		key: "recording",
		icon: Mic,
		labelKey: "mobile.shell.navRecording",
		routeName: RouteName.AudioRecordings,
		nativeRecordingTab: "ai_recording",
	},
	{
		key: "myCrew",
		icon: Bot,
		labelKey: "mobile.shell.navMyCrew",
		routeName: RouteName.MyCrew,
	},
	{
		key: "magiClaw",
		icon: MagiClawNavIcon,
		labelKey: "mobile.shell.navMagiClaw",
		routeName: RouteName.MagiClaw,
		requiredPermissionCode: FUNCTION_PERMISSION_CODE.MagicClawAccess,
	},
	{
		// Above AI research and micro-apps, matching the desktop sidebar's AI canvas entry icon.
		key: "aiCanvas",
		icon: Palette,
		labelKey: "mobile.shell.navAiCanvas",
		routeName: RouteName.AiCanvas,
	},
	{
		// Directly below AI canvas, as on the desktop sidebar.
		key: "personaResearch",
		icon: UsersRound,
		labelKey: "mobile.shell.navPersonaResearch",
		routeName: RouteName.PersonaResearch,
	},
	{
		key: "microApps",
		icon: Boxes,
		labelKey: "mobile.shell.navMicroApps",
		routeName: RouteName.MicroApps,
	},
	{
		key: "trash",
		icon: Trash2,
		labelKey: "mobile.shell.navTrash",
		routeName: RouteName.RecycleBin,
	},
	{
		key: "apps",
		icon: LayoutGrid,
		labelKey: "mobile.shell.navApps",
		routeName: RouteName.SuperApps,
	},
]
