import { isMac } from "@/opensource/utils/devices"
import type { TFunction } from "i18next"

export interface ShortcutKeyItem {
	name: string
	keys: string[]
}

export interface ShortcutKeyGroup {
	title: string
	keys: ShortcutKeyItem[]
}

// 快捷键动作枚举
export enum ShortcutActions {
	/** 创建新项目 */
	CREATE_NEW_PROJECT = "CREATE_NEW_PROJECT",
	/** 查看快捷键 */
	VIEW_SHORTCUTS = "VIEW_SHORTCUTS",
	/** 创建新话题 */
	CREATE_NEW_TOPIC = "CREATE_NEW_TOPIC",
	/** 发送消息 */
	SEND_MESSAGE = "SEND_MESSAGE",
	/** 换行 */
	LINE_BREAK = "LINE_BREAK",
	/** 打开配置 */
	OPEN_MCP_CONFIG = "OPEN_MCP_CONFIG",
	/** 切换语音输入 */
	TOGGLE_VOICE_INPUT = "TOGGLE_VOICE_INPUT",
	/** AI编辑文件 */
	AI_EDIT_FILE = "AI_EDIT_FILE",
	/** 添加到对话 */
	ADD_TO_CONVERSATION = "ADD_TO_CONVERSATION",
	/** 关闭当前 Tab */
	CLOSE_CURRENT_TAB = "CLOSE_CURRENT_TAB",
	/** 关闭其他 Tab */
	CLOSE_OTHER_TABS = "CLOSE_OTHER_TABS",
	/** 关闭已保存 Tab */
	CLOSE_SAVED_TABS = "CLOSE_SAVED_TABS",
	/** 关闭所有 Tab */
	CLOSE_ALL_TABS = "CLOSE_ALL_TABS",
}

// 扩展的快捷键配置接口
export interface ShortcutKeyConfig {
	nameKey: string
	actionId: ShortcutActions
	mac: string[]
	windows: string[]
	enabled?: boolean
}

export interface ShortcutKeyGroupConfig {
	titleKey: string
	keys: ShortcutKeyConfig[]
}

const tabOperations = [
	{
		nameKey: "shortcut.closeCurrentTab",
		actionId: ShortcutActions.CLOSE_CURRENT_TAB,
		mac: ["⌘", "W"],
		windows: ["Ctrl", "W"],
		enabled: false,
	},
	{
		nameKey: "shortcut.closeOtherTabs",
		actionId: ShortcutActions.CLOSE_OTHER_TABS,
		mac: ["⌥", "⌘", "T"],
		windows: ["Alt", "Ctrl", "T"],
		enabled: true,
	},
	{
		nameKey: "shortcut.closeSavedTabs",
		actionId: ShortcutActions.CLOSE_SAVED_TABS,
		mac: ["⌘", "R", "U"],
		windows: ["Ctrl", "R", "U"],
		enabled: false,
	},
	{
		nameKey: "shortcut.closeAllTabs",
		actionId: ShortcutActions.CLOSE_ALL_TABS,
		mac: ["⌘", "R", "W"],
		windows: ["Ctrl", "R", "W"],
		enabled: false,
	},
]

// 快捷键配置（包含Windows和macOS两套）
const SHORTCUT_KEYS_CONFIG: ShortcutKeyGroupConfig[] = [
	{
		titleKey: "shortcut.globalOperations",
		keys: [
			{
				nameKey: "shortcut.createNewProject",
				actionId: ShortcutActions.CREATE_NEW_PROJECT,
				mac: ["⌃", "⌥", "⌘", "N"],
				windows: ["Ctrl", "Alt", "Windows", "N"],
				enabled: true,
			},
			{
				nameKey: "shortcut.viewShortcuts",
				actionId: ShortcutActions.VIEW_SHORTCUTS,
				mac: ["⌘", "/"],
				windows: ["Ctrl", "/"],
				enabled: true,
			},
		],
	},
	{
		titleKey: "shortcut.topicOperations",
		keys: [
			{
				nameKey: "shortcut.createNewTopic",
				actionId: ShortcutActions.CREATE_NEW_TOPIC,
				mac: ["⌃", "L"],
				windows: ["Ctrl", "L"],
				enabled: true,
			},
			{
				nameKey: "shortcut.sendMessage",
				actionId: ShortcutActions.SEND_MESSAGE,
				mac: ["↩"],
				windows: ["↩"],
				enabled: true,
			},
			{
				nameKey: "shortcut.lineBreak",
				actionId: ShortcutActions.LINE_BREAK,
				mac: ["Shift", "↩"],
				windows: ["Shift", "↩"],
				enabled: true,
			},
			{
				nameKey: "shortcut.openMCPConfig",
				actionId: ShortcutActions.OPEN_MCP_CONFIG,
				mac: ["⌃", "M"],
				windows: ["Ctrl", "M"],
				enabled: true,
			},
			{
				nameKey: "shortcut.toggleVoiceInput",
				actionId: ShortcutActions.TOGGLE_VOICE_INPUT,
				mac: ["⌘", "Shift", "E"],
				windows: ["Ctrl", "Shift", "E"],
				enabled: true,
			},
		],
	},
	// {
	// 	titleKey: "shortcut.tabOperations",
	// 	keys: tabOperations,
	// },
	// {
	// 	titleKey: "shortcut.fileOperations",
	// 	keys: [
	// 		{
	// 			nameKey: "shortcut.aiEditFile",
	// 			actionId: ShortcutActions.AI_EDIT_FILE,
	// 			mac: ["Tab"],
	// 			windows: ["Tab"],
	// 			enabled: true,
	// 		},
	// 		{
	// 			nameKey: "shortcut.addToConversation",
	// 			actionId: ShortcutActions.ADD_TO_CONVERSATION,
	// 			mac: ["⌘", "↩"],
	// 			windows: ["Ctrl", "↩"],
	// 			enabled: true,
	// 		},
	// 	],
	// },
]

// 获取所有快捷键配置（用于快捷键处理）
export function getAllShortcutConfigs(): ShortcutKeyConfig[] {
	return SHORTCUT_KEYS_CONFIG.flatMap((group) => group.keys)
}

// 原有的函数保持不变，用于显示快捷键列表
export const getShortcutKeysData = (t: TFunction): ShortcutKeyGroup[] => {
	return SHORTCUT_KEYS_CONFIG.map((group) => ({
		title: t(group.titleKey, { ns: "super" }),
		keys: group.keys
			.filter((item) => item.enabled)
			.map((item) => ({
				name: t(item.nameKey, { ns: "super" }),
				keys: isMac ? item.mac : item.windows,
			})),
	}))
}

// 获取标签页操作的快捷键配置
export const getTabOperations = (t: TFunction): Record<ShortcutActions, ShortcutKeyItem> => {
	return tabOperations.reduce(
		(acc, item) => {
			acc[item.actionId] = {
				name: t(item.nameKey, { ns: "super" }),
				keys: isMac ? item.mac : item.windows,
			}
			return acc
		},
		{} as Record<ShortcutActions, ShortcutKeyItem>,
	)
}
