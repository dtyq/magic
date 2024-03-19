import type { ThemeMode } from "antd-style"
import { create } from "zustand"
import { DEFAULT_FONT_SIZE_BASE } from "@/opensource/constants/style"
import { createJSONStorage, persist } from "zustand/middleware"
import { platformKey } from "@/opensource/utils/storage"
import { immer } from "zustand/middleware/immer"

export const enum IMStyle {
	Modern = "modern",
	Standard = "standard",
}

export interface AppearanceState {
	theme: ThemeMode
	timezone: string
	imStyle: IMStyle
	chatFontSize: number
	aiCompletion: boolean
	/** 全局快捷键管理 */
	shortcutKey?: {
		/** 全局搜索快捷键 */
		globalSearch?: Array<number> | null
	}
}

export const useAppearanceStore = create<AppearanceState>()(
	persist(
		immer<AppearanceState>(() => ({
			theme: "light",
			imStyle: IMStyle.Standard,
			timezone: "Asia/Shanghai",
			aiCompletion: true,
			chatFontSize: DEFAULT_FONT_SIZE_BASE,
			shortcutKey: {
				globalSearch: [91, 75],
			},
		})),
		{
			name: platformKey("store:appearance"),
			partialize: (state) => ({
				theme: state.theme,
				imStyle: state.imStyle,
				timezone: state.timezone,
				aiCompletion: state.aiCompletion,
				chatFontSize: state.chatFontSize,
				shortcutKey: state.shortcutKey,
			}),
			storage: createJSONStorage(() => localStorage),
		},
	),
)
